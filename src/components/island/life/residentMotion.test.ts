import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { HOUR, LIFE_STEP_MS, learningDay, newLife } from '../../../domain/islandLife/model';
import { commandLife, replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';

describe('rendered activity geometry', () => {
    it('keeps bodies on their moving seat and disables the motion in reduced mode', () => {
        let r = newLife('motion', 1); r.now = 100;
        r.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
        r = commandLife(r, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'b', 100);
        r = commandLife(r, { type: 'buy', kind: 'swing', cell: { x: 4, z: 2 } }, 's', 100);
        const state = replayLife(r, 100 + HOUR), scene = buildLifeScene(state);
        try {
            const at = state.now + 20000;
            scene.animate(at, false); const first = scene.audit().filter(p => p.seatGap !== undefined);
            expect(first.length).toBeGreaterThan(0);
            scene.animate(at + 1000, false); const next = scene.audit().filter(p => p.seatGap !== undefined);
            for (const p of [...first, ...next]) expect(p.seatGap).toBeLessThan(1e-8);
            for (const p of next.filter(p => p.phase === 'swing')) {
                const actor = scene.root.getObjectByName(`life-resident-${p.id}`)!;
                expect(new Box3().setFromObject(actor).max.y).toBeLessThan(1.42 + .04 - .045);
            }
            scene.animate(at, true); const reduced = scene.audit(); scene.animate(at + 1000, true);
            expect(scene.audit().map(p => p.position)).toEqual(reduced.map(p => p.position));
            expect(scene.audit().every(p => p.hop === 0)).toBe(true);
        } finally { scene.dispose(); }
    });
    it('returns a happy hop to the same ground and retains the icon without jumping in reduced mode', () => {
        let r = newLife('jump', 1); r.now = 100;
        r.credits = [{ id: 'c', at: 100, day: learningDay(100) }];
        r = commandLife(r, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'f', 100);
        const state = replayLife(r), v = state.residents[1].visit!, scene = buildLifeScene(state);
        const arrived = v.start + (v.path.length - 1) * LIFE_STEP_MS + 400;
        try {
            scene.animate(arrived + 275, false); const hopped = scene.audit()[1];
            scene.animate(arrived + 1200, false); const landed = scene.audit()[1];
            expect(hopped.position[1] - landed.position[1]).toBeCloseTo(.13);
            scene.animate(arrived + 275, true); const reduced = scene.audit()[1];
            expect(reduced.reaction).toBe('♪'); expect(reduced.position).toEqual(landed.position);
        } finally { scene.dispose(); }
    });
});
