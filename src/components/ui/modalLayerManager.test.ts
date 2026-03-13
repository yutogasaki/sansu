import { afterEach, describe, expect, it } from "vitest";
import {
    isTopModalLayer,
    popModalLayer,
    pushModalLayer,
    resetModalLayerManagerForTests,
} from "./modalLayerManager";

describe("modalLayerManager", () => {
    afterEach(() => {
        resetModalLayerManagerForTests();
    });

    it("preserves overflow until the last modal closes", () => {
        const bodyStyle = { overflow: "auto" };

        const first = pushModalLayer(bodyStyle);
        const second = pushModalLayer(bodyStyle);

        expect(bodyStyle.overflow).toBe("hidden");
        expect(isTopModalLayer(second)).toBe(true);

        popModalLayer(second, bodyStyle);
        expect(bodyStyle.overflow).toBe("hidden");
        expect(isTopModalLayer(first)).toBe(true);

        popModalLayer(first, bodyStyle);
        expect(bodyStyle.overflow).toBe("auto");
    });

    it("ignores duplicate releases safely", () => {
        const bodyStyle = { overflow: "" };
        const token = pushModalLayer(bodyStyle);

        popModalLayer(token, bodyStyle);
        popModalLayer(token, bodyStyle);

        expect(bodyStyle.overflow).toBe("");
    });
});
