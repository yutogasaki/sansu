export function getModalTabBoundaryTarget<T>(
    focusables: readonly T[],
    activeElement: T | null,
    shiftKey: boolean,
): T | null {
    if (focusables.length === 0) return null;

    const activeIndex = activeElement === null ? -1 : focusables.indexOf(activeElement);
    if (activeIndex === -1) return shiftKey ? focusables[focusables.length - 1] : focusables[0];
    if (shiftKey && activeIndex === 0) return focusables[focusables.length - 1];
    if (!shiftKey && activeIndex === focusables.length - 1) return focusables[0];
    return null;
}

export function getModalInitialFocusTarget<T>(
    focusables: readonly T[],
    dialog: T | null,
    preferDialog: boolean,
): T | null {
    if (preferDialog && dialog !== null) return dialog;
    return focusables[0] ?? dialog;
}
