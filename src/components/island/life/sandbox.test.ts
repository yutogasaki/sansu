import { describe, it, expect } from 'vitest';
import { Box3, Vector3 } from 'three';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
function fixture(users: number) {
    const state = replayLife(newLife('sand-scene', 0));
    state.items = [{ id: 'sand', kind: 'sandbox', cell: { x: 1, z: 2 }, growth: 0, style: 'original' }];
    state.residents.forEach((r, i) => { const cell = { x: 1, z: i ? 1 : 3 }; r.cell = cell; r.visit = i < users ? { itemId: 'sand', from: cell, path: [cell], start: 0, end: i ? 10000 : 20000 } : undefined; });
    return state;
}
describe('sandbox ordinary making', () => {
    it.each([1, 2])('shows a mountain for one user and a castle for two (users=%s)', users => {
        const state = fixture(users), before = structuredClone(state), scene = buildLifeScene(state);
        try {
            scene.animate(5000, true); scene.root.updateMatrixWorld(true);
            const poses = scene.audit().filter(p => p.sandWork); expect(poses).toHaveLength(users);
            expect(poses.every(p => p.sandWork!.form === (users === 1 ? 'mountain' : 'castle') && p.headPitch > 0)).toBe(true);
            expect(scene.root.getObjectByName('life-sand-mountain')!.visible).toBe(users === 1); expect(scene.root.getObjectByName('life-sand-castle')!.visible).toBe(users === 2);
            if (users === 2) expect(new Vector3(...poses[0].position).distanceTo(new Vector3(...poses[1].position))).toBeGreaterThan(1.3);
            expect(poses.every(p => p.position[1] === .04)).toBe(true);
            const bounds = new Box3().setFromObject(scene.root.getObjectByName('life-item-sand')!);
            expect(bounds.max.x - bounds.min.x).toBeLessThan(1); expect(bounds.max.z - bounds.min.z).toBeLessThan(1);
            scene.animate(10500, true); expect(scene.audit().filter(p => p.sandWork)).toHaveLength(1); expect(scene.root.getObjectByName('life-sand-mountain')!.visible).toBe(true);
            scene.animate(20000, true); expect(scene.root.getObjectByName('life-sand-mountain')!.visible).toBe(false); expect(scene.root.getObjectByName('life-sand-castle')!.visible).toBe(false);
            expect(state).toEqual(before);
        } finally { scene.dispose(); }
    });
    it('keeps a sand-building user as the R3 bench focus without moving the sitter', () => {
        const state = fixture(2); state.items.push({ id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, growth: 0, style: 'original' });
        state.residents[2].visit = { itemId: 'bench', from: { x: 3, z: 3 }, path: [{ x: 3, z: 3 }], start: 0, end: 30000 };
        const scene = buildLifeScene(state);
        try {
            scene.animate(5000, true); const pose = scene.audit()[2];
            expect(pose.relation).toMatchObject({ ruleId: 'R3', targetId: 'sand', targetResidentId: 'pokomoko', ready: true }); expect(pose.seatGap).toBeLessThan(1e-8);
        } finally { scene.dispose(); }
    });
    it('grows the current sand shape over time and replays a captured pose unchanged', () => {
        const state = fixture(1), scene = buildLifeScene(state);
        try {
            scene.animate(1000, false); const early = scene.audit()[0].sandWork!.progress;
            scene.animate(4000, false); expect(scene.audit()[0].sandWork!.progress).toBeGreaterThan(early);
            const captured = buildLifeScene({ ...state, now: 1000, scenePose: 'captured-v1', poseReducedMotion: false });
            try { captured.animate(8000, true); expect(captured.audit()[0].sandWork!.progress).toBe(early); } finally { captured.dispose(); }
        } finally { scene.dispose(); }
    });
});
