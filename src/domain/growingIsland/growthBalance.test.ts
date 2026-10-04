import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { refreshUnlocks } from './community';
import { newIsland } from './island';
import { advancePier, boatInterval, boatProgress } from './pier';
import { openTown } from './town';

describe('growth pacing with existing rights', () => {
    it('shows the actual saved crossing fraction for old and new boats without changing the save', () => {
        const state = applyIntent(newIsland('progress', 0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
        for (const interval of [26, 50]) {
            state.pier.dockAt = interval;
            state.town.clock = 0;
            expect(boatProgress(state)).toBe(0);
            state.town.clock = interval / 2;
            const before = structuredClone(state);
            expect(boatProgress(state)).toBe(.5);
            expect(state).toEqual(before);
            state.town.clock = interval;
            expect(boatProgress(state)).toBe(1);
        }
        // Arrival records need not be stored in chronological order.
        state.villagers.unshift({ ...state.villagers[0], id: 'later', arrivedAt: 50 });
        state.pier.dockAt = 102; state.town.clock = 76;
        expect(boatProgress(state)).toBe(.5);
    });

    it('retains a saved crossing and uses the new interval only after arrival', () => {
        const state = newIsland('old-boat', 0);
        state.tutorial = 'done';
        state.pier.dockAt = 26; state.town.bank = 12;
        const visitor = structuredClone(state.pier.visitor);
        openTown(state);
        expect(state.pier.dockAt).toBe(26);
        expect(state.pier.visitor).toEqual(visitor);
        advancePier(state, 26);
        expect(state.pier.dockAt).toBe(76);
        expect(boatInterval(10)).toBe(68);
    });

    it('spreads new play choices across levels while preserving old unlocks and owned things', () => {
        const state = newIsland('choices', 0);
        state.tutorial = 'done'; state.drops = 100;
        state.genki.best = 3; refreshUnlocks(state);
        expect(state.unlocked).toContain('landmark:swing');
        for (const kind of ['bandstand', 'slide', 'trampoline', 'fountain']) expect(state.unlocked).not.toContain(`landmark:${kind}`);
        for (const [points, kind] of [[15, 'bandstand'], [40, 'slide'], [60, 'trampoline'], [85, 'fountain']] as const) {
            state.genki.best = points;
            expect(refreshUnlocks(state)).toContain(`landmark:${kind}`);
        }
        state.genki.best = 3;
        refreshUnlocks(state);
        const owned = applyIntent(state, { id: 'old-fountain', command: { type: 'place', kind: 'fountain', cell: { x: 4, z: 2 } } }).state;
        expect(owned.landmarks.at(-1)?.kind).toBe('fountain');
        expect(owned.unlocked).toContain('landmark:trampoline');
    });
});
