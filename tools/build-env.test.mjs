import { describe, expect, it } from "vitest";
import { withCurrentUiBuildDefaults } from "./build-env.mjs";

describe("current UI build defaults", () => {
    it("selects Island for an otherwise unconfigured production build", () => {
        expect(withCurrentUiBuildDefaults({ NODE_ENV: "production" })).toMatchObject({
            NODE_ENV: "production",
            VITE_ISLAND_ENABLED: "true",
        });
    });

    it("preserves an explicit classic opt-out", () => {
        expect(withCurrentUiBuildDefaults({ VITE_ISLAND_ENABLED: "false" })).toMatchObject({
            VITE_ISLAND_ENABLED: "false",
        });
    });

    it("preserves an explicit Island selection", () => {
        expect(withCurrentUiBuildDefaults({ VITE_ISLAND_ENABLED: "true" })).toMatchObject({
            VITE_ISLAND_ENABLED: "true",
        });
    });
});
