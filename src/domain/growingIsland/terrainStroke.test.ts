import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { editableTerracePlan } from './editableTerrainWorld';
import { newIsland } from './island';
import { setTerrainForm } from './terraceTerrain';
import type { Cell, Command, GrowingState } from './types';

afterEach(() => setTerrainForm('continuous'));

describe('DEV terrain stroke: shaping the island with a finger', () => {
    const island = () => {
        setTerrainForm('terrace');
        const state = newIsland('stroke', 0);
        state.tutorial = 'done';
        return state;
    };
    const run = (state: GrowingState, command: Command, id = 'stroke') => applyIntent(state, { id, command }).state;
    const coast: Cell[] = [{ x: 0, z: 4 }, { x: 1, z: 4 }];

    it('pulls the sea into the coast as a cove, and one undo brings the shore back', () => {
        let state = island();
        state = run(state, { type: 'terrain-stroke', cells: coast, to: 'sea' });
        const plan = editableTerracePlan(state)!;
        for (const cell of coast) expect(plan.dry.has(`${cell.x},${cell.z}`)).toBe(false);
        expect(plan.stranded).toBe(0);
        state = run(state, { type: 'terrain-undo' }, 'undo');
        expect(state.terrain!.heights).toEqual({});
        state = run(state, { type: 'terrain-redo' }, 'redo');
        for (const cell of coast) expect(editableTerracePlan(state)!.dry.has(`${cell.x},${cell.z}`)).toBe(false);
    });

    it('a stroke wholly outside the child\'s land points back to the bright cells', () => {
        expect(() => run(island(), { type: 'terrain-stroke', cells: [{ x: -9, z: 9 }, { x: -8, z: 9 }], to: 'up' }))
            .toThrow('あかるい マスの なかを なぞってね');
    });

    it('raises every crossed cell one step per stroke, and flattens them back', () => {
        let state = island();
        const ridge = [{ x: 0, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 0, z: 2 }];
        state = run(state, { type: 'terrain-stroke', cells: ridge, to: 'up' });
        expect(state.terrain!.heights).toEqual({ '0,2': 1, '0,3': 1, '1,3': 1 });
        state = run(state, { type: 'terrain-stroke', cells: ridge, to: 'up' }, 'again');
        expect(state.terrain!.heights).toEqual({ '0,2': 2, '0,3': 2, '1,3': 2 });
        state = run(state, { type: 'terrain-stroke', cells: ridge, to: 'flat' }, 'flat');
        expect(state.terrain!.heights).toEqual({});
    });

    it('keeps the ground under the home, the pier and every owner', () => {
        let state = island();
        state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 1, z: 2 }, growth: 0 }];
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 2, z: 1 }, { x: 1, z: 2 }, { x: 4, z: 4 }, { x: 0, z: 1 }], to: 'sea' });
        expect(Object.keys(state.terrain!.heights)).toEqual(['0,1']);
    });

    it('flattens a hill that rose with a thing on it, the thing coming down with the ground', () => {
        let state = island();
        state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 1, z: 2 }, growth: 0 }];
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 0, z: 2 }, { x: 1, z: 2 }], to: 'up' });
        expect(state.terrain!.heights).toEqual({ '0,2': 1, '1,2': 1 });
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 1, z: 2 }], to: 'flat' }, 'flat');
        expect(state.terrain!.heights).toEqual({ '0,2': 1 });
        expect(state.landmarks[0].cell).toEqual({ x: 1, z: 2 });
    });

    it('moves a building on four cells as one, up and back down', () => {
        let state = island();
        state.landmarks = [{ id: 'hut', kind: 'garden-hut', cell: { x: 0, z: 2 }, growth: 0 }];
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 1, z: 3 }], to: 'up' });
        expect(state.terrain!.heights).toEqual({ '1,3': 1, '0,2': 1, '1,2': 1, '0,3': 1 });
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 0, z: 2 }], to: 'flat' }, 'flat');
        expect(state.terrain!.heights).toEqual({});
        state = run(state, { type: 'terrain-undo' }, 'undo');
        expect(Object.keys(state.terrain!.heights)).toHaveLength(4);
    });

    it('keeps the cells the rules allow when one cell of a stroke may not change, all in one undo', () => {
        let state = island();
        // (4,0) is the home's footing; the rest of the stroke still rises.
        state = run(state, { type: 'terrain-stroke', cells: [{ x: 4, z: 0 }, { x: 4, z: 1 }, { x: 5, z: 1 }], to: 'up' });
        expect(state.terrain!.heights).toEqual({ '4,1': 1, '5,1': 1 });
        state = run(state, { type: 'terrain-undo' }, 'undo');
        expect(state.terrain!.heights).toEqual({});
    });
});
