import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { editableIslandWorld } from './editableTerrainWorld';
import { newIsland } from './island';
import { applyTerrainCommand, terrainEditingRevision, validateTerrain } from './terrainEditing';
import type { GrowingState, TerrainCommand } from './types';

const island = () => newIsland('terrain-owner', 1_000);
function edit(state: GrowingState, command: TerrainCommand, id = crypto.randomUUID()) {
    return applyIntent(state, { id, command }, 1_000).state;
}
const cell = { x: 0, z: 4 };

describe('game terrain commands', () => {
    it('changes real support, retains acquired land and all earned state, then restores exactly', () => {
        const original = island();
        let state = original;
        for (let n = 0; n < 4; n++) state = edit(state, { type: 'terrain-edit', cell, delta: -1 });
        expect(state.terrain!.heights['0,4']).toBe(-4);
        expect(editableIslandWorld(state)!.floorAt(cell)).toBeUndefined();
        expect(editableIslandWorld(state)!.owns(cell)).toBe(true);
        expect({ ...state, terrain: undefined, applied: [] }).toEqual({ ...original, terrain: undefined });
        const atLimit = edit(state, { type: 'terrain-edit', cell, delta: -1 });
        expect(atLimit).toBe(state);
        for (let n = 0; n < 4; n++) state = edit(state, { type: 'terrain-undo' });
        expect(state.terrain!.heights).toEqual({});
        expect(editableIslandWorld(state)!.floorAt(cell)).toBeDefined();
        expect(state.terrain!.redo).toHaveLength(4);
        state = edit(state, { type: 'terrain-redo' });
        expect(state.terrain!.heights['0,4']).toBe(-1);
        validateTerrain(state);
    });

    it('rejects unsupported feet, fixed house/pier and stale terrain without mutating the source', () => {
        const state = island(), source = structuredClone(state);
        expect(() => edit(state, { type: 'terrain-edit', cell, delta: -1, actors: [cell] })).toThrow('なかま');
        expect(() => edit(state, { type: 'terrain-edit', cell: { x: 2, z: 1 }, delta: 1 })).toThrow('おうち');
        expect(() => edit(state, { type: 'terrain-edit', cell: { x: 4, z: 4 }, delta: -1 })).toThrow('ふなつきば');
        expect(() => edit(state, { type: 'terrain-edit', cell, delta: 1, expectedTerrainRevision: 'old' })).toThrow('かわった');
        expect(state).toEqual(source);
    });

    it('revalidates undo against newly moved owners and does not erase earned objects', () => {
        let state = edit(island(), { type: 'terrain-edit', cell, delta: 1 });
        state = edit(state, { type: 'terrain-undo' });
        state.landmarks.push({ id: 'earned-tree', kind: 'sapling', cell, growth: 99 });
        state = edit(state, { type: 'terrain-redo' });
        // One small raise supports the footprint; repeated tilting must stop.
        expect(() => edit(state, { type: 'terrain-edit', cell, delta: 1 })).toThrow('足もと');
        expect(state.landmarks.find(owner => owner.id === 'earned-tree')).toMatchObject({ id: 'earned-tree', cell, growth: 99 });
        expect(state.terrain!.undo).toHaveLength(1);
    });

    it('replays a committed intent once and allows learning-only changes against the same terrain revision', () => {
        const state = island(), revision = terrainEditingRevision(state);
        const command: TerrainCommand = { type: 'terrain-edit', cell, delta: 1, expectedTerrainRevision: revision };
        const next = edit(state, command, 'same-intent');
        expect(edit(next, command, 'same-intent')).toBe(next);
        const learned = { ...state, drops: state.drops + 10 };
        expect(edit(learned, command).terrain).toEqual(next.terrain);
    });

    it('rejects malformed offsets/history and clears redo only after a successful branch', () => {
        let state = edit(island(), { type: 'terrain-edit', cell, delta: 1 });
        state = edit(state, { type: 'terrain-undo' });
        expect(applyTerrainCommand(state, { type: 'terrain-redo' })).toBe(true);
        const bad = structuredClone(state); bad.terrain!.undo[0].after = 3;
        expect(() => validateTerrain(bad)).toThrow('よみこめなかった');
        state = edit(state, { type: 'terrain-undo' });
        state = edit(state, { type: 'terrain-edit', cell: { x: 1, z: 3 }, delta: 1 });
        expect(state.terrain!.redo).toEqual([]);
    });

    it('rejects an old undo after an ABA edit has returned to the same visible height', () => {
        const first = edit(island(), { type: 'terrain-edit', cell, delta: 1 });
        const revision = terrainEditingRevision(first);
        let state = edit(first, { type: 'terrain-edit', cell, delta: 1 });
        state = edit(state, { type: 'terrain-edit', cell, delta: -1 });
        expect(state.terrain!.heights).toEqual(first.terrain!.heights);
        expect(() => edit(state, { type: 'terrain-undo', expectedTerrainRevision: revision })).toThrow('かわった');
        expect(state.terrain!.undo).toHaveLength(3);
    });
});
