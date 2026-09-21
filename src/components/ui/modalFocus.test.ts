import { describe, expect, it } from "vitest";
import { getModalInitialFocusTarget, getModalTabBoundaryTarget } from "./modalFocus";

describe("modal focus boundaries", () => {
    const items = ["first", "middle", "last"];

    it("wraps forward and backward at the dialog boundaries", () => {
        expect(getModalTabBoundaryTarget(items, "last", false)).toBe("first");
        expect(getModalTabBoundaryTarget(items, "first", true)).toBe("last");
    });

    it("redirects focus back inside when it is outside the dialog", () => {
        expect(getModalTabBoundaryTarget(items, "outside", false)).toBe("first");
        expect(getModalTabBoundaryTarget(items, "outside", true)).toBe("last");
        expect(getModalTabBoundaryTarget(items, null, false)).toBe("first");
    });

    it("leaves ordinary movement inside the dialog to the browser", () => {
        expect(getModalTabBoundaryTarget(items, "middle", false)).toBeNull();
        expect(getModalTabBoundaryTarget(items, "middle", true)).toBeNull();
        expect(getModalTabBoundaryTarget([], null, false)).toBeNull();
    });

    it("can start a confirmation dialog on its container instead of its only action", () => {
        expect(getModalInitialFocusTarget(items, "dialog", true)).toBe("dialog");
        expect(getModalInitialFocusTarget(items, "dialog", false)).toBe("first");
        expect(getModalInitialFocusTarget([], "dialog", false)).toBe("dialog");
    });
});
