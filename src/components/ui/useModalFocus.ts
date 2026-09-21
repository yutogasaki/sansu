import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";
import { isTopModalLayer, popModalLayer, pushModalLayer } from "./modalLayerManager";
import { getModalInitialFocusTarget, getModalTabBoundaryTarget } from "./modalFocus";

type ModalInitialFocus = "first" | "dialog";

export function useModalFocus<T extends HTMLElement>(
    isOpen: boolean,
    onClose: () => void,
    dialogRef: RefObject<T | null>,
    initialFocus: ModalInitialFocus = "first",
) {
    const layerTokenRef = useRef<symbol | null>(null);
    const closeModal = useEffectEvent(() => onClose());

    useLayoutEffect(() => {
        if (!isOpen) return;

        const returnFocusTo = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const layerToken = pushModalLayer(document.body.style);
        layerTokenRef.current = layerToken;
        const dialog = dialogRef.current;
        const focusables = () => {
            if (!dialog) return [];

            const candidates = Array.from(dialog.querySelectorAll<HTMLElement>([
                "a[href]",
                "area[href]",
                "button",
                "input:not([type='hidden'])",
                "select",
                "textarea",
                "summary",
                "audio[controls]",
                "video[controls]",
                "[contenteditable='true']",
                "[tabindex]",
            ].join(","))).filter(element => (
                element.tabIndex >= 0
                && !element.matches(":disabled")
                && !element.closest("[hidden], [inert], [aria-hidden='true']")
                && element.getClientRects().length > 0
            ));
            const ordered = candidates.filter(element => element.tabIndex > 0)
                .sort((left, right) => left.tabIndex - right.tabIndex);
            return [...ordered, ...candidates.filter(element => element.tabIndex === 0)];
        };

        const focusInside = (preferDialog = false) => {
            const target = getModalInitialFocusTarget(focusables(), dialog, preferDialog && initialFocus === "dialog");
            target?.focus({ preventScroll: true });
        };

        focusInside(true);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isTopModalLayer(layerToken)) {
                event.preventDefault();
                closeModal();
                return;
            }

            if (event.key !== "Tab" || !isTopModalLayer(layerToken) || !dialog) return;

            const items = focusables();
            const activeElement = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            if (items.length === 0) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }

            const target = getModalTabBoundaryTarget(items, activeElement, event.shiftKey);
            if (target) {
                event.preventDefault();
                target.focus({ preventScroll: true });
            }
        };

        const keepFocusInside = (event: FocusEvent) => {
            if (!isTopModalLayer(layerToken) || !dialog || dialog.contains(event.target as Node)) return;
            focusInside();
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("focusin", keepFocusInside);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("focusin", keepFocusInside);
            popModalLayer(layerToken, document.body.style);
            if (layerTokenRef.current === layerToken) {
                layerTokenRef.current = null;
            }
            if (returnFocusTo?.isConnected) {
                returnFocusTo.focus({ preventScroll: true });
            }
        };
    }, [dialogRef, initialFocus, isOpen]);

    return layerTokenRef;
}
