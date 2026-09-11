import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildLandscape, coastShape } from './landscape';
import { newLife, type LifeItem } from '../../../domain/islandLife/model';
import { landCells } from '../../../domain/islandLife/space';
import { replayLife } from '../../../domain/islandLife/simulation';
import { disposeGeometry } from '../three/primitives';

const point = (c: { x: number; z: number }) => new T.Vector3(c.x - 2.5, .04, c.z - 2);
describe('garden scenery preserves usable ground and ownership', () => {
    it('keeps every playable cell corner inside the grass for both expansions', () => {
        for (const expanded of [undefined, 'east', 'west'] as const) {
            const cells = landCells({ expanded }), min = Math.min(...cells.map(c => c.x)), max = Math.max(...cells.map(c => c.x));
            const polygon = coastShape(max - min + 2.4, 5.65).getPoints();
            const inside = (x: number, y: number) => {
                let hit = false;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    const a = polygon[i], b = polygon[j];
                    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
                }
                return hit;
            };
            for (const c of cells) for (const dx of [-.45, .45]) for (const dz of [-.45, .45]) expect(inside(c.x - (min + max) / 2 + dx, c.z - 2 + dz)).toBe(true);
        }
    });
    it('shows a bed only for the actual mature cluster; storage and immature flowers do not add a bed', () => {
        const state = replayLife(newLife('visual-test', 0));
        const items: LifeItem[] = [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 0, z: 3 }].map((cell, i) => ({ id: String(i), kind: 'flower', cell, growth: 6, style: 'original' }));
        const mature = { ...state, items }, before = structuredClone(mature);
        for (const [items, hasBed] of [[mature.items, true], [mature.items.map(i => ({ ...i, growth: 0 })), false], [mature.items.map((i, n) => n === 2 ? { ...i, cell: undefined } : i), false]] as const) {
            const scene = buildLandscape({ ...state, items: [...items] }, 6, point);
            try { expect(scene.root.getObjectByName('life-district-ground')!.children.length > 0).toBe(hasBed); }
            finally { disposeGeometry(scene.root); scene.dispose(); }
        }
        expect(mature).toEqual(before);
    });
    it('holds the sea still with reduced motion, with phase precision even at epoch time', () => {
        const scene = buildLandscape(replayLife(newLife('visual-test', 0)), 6, point);
        try {
            const water = (scene.root.getObjectByName('life-sea') as T.Mesh).material as T.ShaderMaterial;
            scene.animate(1_789_020_000_000, false); const phase = water.uniforms.time.value;
            scene.animate(1_789_020_000_100, false); expect(water.uniforms.time.value - phase).toBeCloseTo(.1, 4);
            scene.animate(1_789_020_000_100, true); expect(water.uniforms.time.value).toBe(0);
        } finally { disposeGeometry(scene.root); scene.dispose(); }
    });
});
