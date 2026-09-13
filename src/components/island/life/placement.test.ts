import { describe, expect, it } from 'vitest';
import { LIFE_RULES, learningDay, newLife } from '../../../domain/islandLife/model';
import { commandLife, replayLife } from '../../../domain/islandLife/simulation';
import { cellKey, landCells } from '../../../domain/islandLife/space';
import { buildLifeScene } from './scene';
import { previewPlacement } from './placement';

function record() {
    const r = newLife('placement', 1); r.now = 100;
    r.credits = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
    return commandLife(r, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'bench', 100);
}
describe('placement preview', () => {
    it('matches saved placement rules, including a free cell that blocks another seat', () => {
        const r = record(), state = replayLife(r);
        const preview = previewPlacement(state, 'flower', { x: 0, z: 3 });
        expect(preview.valid).toBe(false);
        expect(preview.reason).toContain('ベンチまで あるけなくなる');
        expect(preview.path).toContainEqual({ x: 0, z: 3 });
        for (const kind of ['flower', 'bench', 'swing', 'lantern'] as const) {
            const allowed = previewPlacement(state, kind).allowed;
            for (const cell of landCells(state)) {
                const save = () => commandLife(r, { type: 'buy', kind, cell }, 'new', 100);
                if (allowed.includes(cellKey(cell))) expect(save).not.toThrow();
                else expect(save).toThrow();
            }
        }
        expect(previewPlacement(state, 'swing', { x: 4, z: 4 }).reason).toContain('まえを');
    });
    it('previews stored and moved flowers at their earned growth and style without changing the world', () => {
        const state = replayLife(record());
        state.items.push({ id: 'flower', kind: 'flower', cell: { x: 4, z: 1 }, growth: LIFE_RULES.bloomHours, style: 'starlight' });
        const before = JSON.stringify(state);
        const placed = previewPlacement(state, state.items[1], { x: 4, z: 2 });
        expect(placed.valid).toBe(true);
        expect(placed.item).toMatchObject({ growth: 6, style: 'starlight', cell: { x: 4, z: 2 } });
        expect(placed.path?.at(-1)).toBeDefined();
        expect(JSON.stringify(state)).toBe(before);
        expect(previewPlacement(state, { ...state.items[1], cell: undefined }, { x: 4, z: 2 }).item).toEqual(placed.item);
    });
    it('keeps a resident on the real seat while a copy is previewed elsewhere', () => {
        const state = replayLife(record());
        const preview = previewPlacement(state, state.items[0], { x: 4, z: 2 });
        const original = buildLifeScene(state), scene = buildLifeScene(state, 'bench', preview.item.cell, preview);
        try {
            original.animate(state.now + 20000, true); scene.animate(state.now + 20000, true);
            expect(scene.audit()).toEqual(original.audit());
            expect(scene.root.getObjectByName('life-placement-ghost')?.position).not.toEqual(scene.root.getObjectByName('life-item-bench')?.position);
            expect(scene.root.getObjectByName('life-placement-path')?.children.length).toBe(preview.path?.length);
        } finally { original.dispose(); scene.dispose(); }
    });
});

describe('isolation placement presentation', () => {
    it('allows blocking an existing entrance and names every affected item without inventing a route', () => {
        const state = { ...replayLife(record()), placementVersion: 1 as const };
        state.items = [
            { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
            { id: 'hut', kind: 'garden-hut', cell: { x: 0, z: 2 }, growth: 0, style: 'original' },
        ];
        const preview = previewPlacement(state, 'bench', { x: 0, z: 4 });
        expect(preview.valid).toBe(true);
        expect(preview.isolated.map(i => i.id)).toEqual(expect.arrayContaining(['library', 'hut', '__life-preview__']));
        expect(preview.reason).toContain('このまま おけるよ');
        expect(preview.path).toBeUndefined();
        const scene = buildLifeScene(state, undefined, preview.item.cell, preview);
        try {
            for (const item of preview.isolated) expect(scene.root.getObjectByName(`life-isolation-${item.id}`)).toBeDefined();
            expect(scene.root.getObjectByName('life-placement-path')?.children).toHaveLength(0);
        } finally { scene.dispose(); }
    });
    it('keeps static markers after confirmation and clears them when an entrance reconnects', () => {
        const state = { ...replayLife(record()), placementVersion: 1 as const };
        state.items = [
            { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
            { id: 'bench', kind: 'bench', cell: { x: 0, z: 2 }, access: 'front', growth: 0, style: 'original' },
        ];
        const scene = buildLifeScene(state, 'library');
        try {
            expect(scene.root.getObjectByName('life-isolation-library')).toBeDefined();
            expect(scene.root.getObjectByName('life-placement-path')?.children).toHaveLength(0);
        } finally { scene.dispose(); }
        const moved = previewPlacement(state, state.items[1], { x: 4, z: 2 });
        expect(moved.valid).toBe(true);
        expect(moved.isolated).toEqual([]);
    });
});
