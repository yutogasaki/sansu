import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { isTopModalLayer, popModalLayer, pushModalLayer } from "./modalLayerManager";
import { cn } from "../../utils/cn";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: "sm" | "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    width = "sm"
}) => {
    const titleId = useId();
    const layerTokenRef = useRef<symbol | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const layerToken = pushModalLayer(document.body.style);
        layerTokenRef.current = layerToken;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isTopModalLayer(layerToken)) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            popModalLayer(layerToken, document.body.style);
            if (layerTokenRef.current === layerToken) {
                layerTokenRef.current = null;
            }
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-2xl"
    };

    const handleBackdropClose = () => {
        const layerToken = layerTokenRef.current;
        if (!layerToken || isTopModalLayer(layerToken)) {
            onClose();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%)]"
                aria-hidden="true"
            />
            <div
                className="absolute inset-0 bg-[color:var(--app-overlay)] backdrop-blur-md transition-opacity"
                onClick={handleBackdropClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={cn(
                    "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-[28px] app-glass-strong app-shadow-strong",
                    sizeClasses[width]
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {title && (
                    <div className="border-b border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.24))] px-5 py-4">
                        <h3
                            id={titleId}
                            className="text-center text-lg font-black tracking-[-0.01em] text-slate-800"
                        >
                            {title}
                        </h3>
                    </div>
                )}

                <div className="overflow-y-auto px-5 py-5">
                    {children}
                </div>

                {footer && (
                    <div className="border-t border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.36))] px-4 pb-[calc(var(--safe-area-bottom)+1rem)] pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
