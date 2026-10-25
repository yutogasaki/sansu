import { afterEach, expect, it } from 'vitest';
import { applyIntent, landQuote } from './commands';
import { newIsland } from './island';
import { setTerrainForm } from './terraceTerrain';
import { editableTerracePlan } from './editableTerrainWorld';
import { landBounds, landCells } from './space';
import { terrainOwnerSupported } from './terrainEditing';
import type { Command, GrowingState } from './types';

afterEach(() => setTerrainForm('continuous'));

it('grows through every land step on one terrace ground, sculpting before each, and never strands a thing', () => {
    setTerrainForm('terrace');
    let state: GrowingState = newIsland('terrace-expansion', 0), n = 0;
    state.tutorial = 'done'; state.growth ??= {} as GrowingState['growth'];
    // No terrain saved yet: the one ground still reads it, and the first edit swaps nothing.
    expect(state.terrain).toBeUndefined();
    expect(editableTerracePlan(state)).toBeDefined();
    const act = (command: Command) => { state = applyIntent(state, { id: `e-${n++}`, command }).state; };
    for (let step = 1; step <= 7; step++) {
        const quote = landQuote(state)!;
        expect(quote.step).toBe(step);
        // A two-step pad holding a keepsake beside the edge that is about to grow.
        const b = landBounds(state), x = quote.sides[0] === 'west' ? b.minX : b.maxX;
        const pad = [2, 3, 1].map(z => ({ x, z })).find(cell => !state.terrain?.heights[`${cell.x},${cell.z}`])!;
        state.keepsakes = [...state.keepsakes, { id: `pad-${step}`, unitId: `pad-${step}`, cell: pad }];
        act({ type: 'terrain-edit', cell: pad, delta: 1 }); act({ type: 'terrain-edit', cell: pad, delta: 1 });
        state.drops = 1e6;
        act({ type: 'expand', side: quote.sides[0] });
        const plan = editableTerracePlan(state)!;
        expect(plan.stranded).toBe(0);
        expect(state.terrain!.heights[`${pad.x},${pad.z}`]).toBe(2);
        expect(landCells(state).filter(cell => !terrainOwnerSupported(state, cell))).toEqual([]);
    }
}, 300000);
