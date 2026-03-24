import { describe, expect, it } from "vitest";
import { getHomeMagicEnergyState } from "./homeMagicEnergy";

describe("homeMagicEnergy", () => {
    it("caps the tank at the target value", () => {
        const state = getHomeMagicEnergyState({
            todayCount: 20,
            todayCorrect: 20,
            streak: 10,
            weakCount: 0,
        });

        expect(state.currentValue).toBe(state.maxValue);
        expect(state.isFull).toBe(true);
        expect(state.percent).toBe(100);
    });

    it("reduces the glow slightly when weak points are piled up", () => {
        const healthy = getHomeMagicEnergyState({
            todayCount: 4,
            todayCorrect: 4,
            streak: 1,
            weakCount: 0,
        });
        const struggling = getHomeMagicEnergyState({
            todayCount: 4,
            todayCorrect: 4,
            streak: 1,
            weakCount: 8,
        });

        expect(healthy.currentValue).toBeGreaterThan(struggling.currentValue);
        expect(struggling.percent).toBeLessThan(healthy.percent);
    });
});
