import { liveRelations } from './liveRelations';
import { describe, expect, it } from 'vitest';
import { Box3, Vector3, OrthographicCamera } from 'three';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
function fixture(two: boolean, tree = false) {
    const state = replayLife(newLife('picnic-scene', 0));
    state.items = [{ id: 'table', kind: 'picnic-table', cell: { x: 1, z: 2 }, growth: 0, style: 'original' }];
    if (tree) state.items.push({ id: 'tree', kind: 'sapling', cell: { x: 3, z: 2 }, growth: 18, style: 'original' });
    state.residents.forEach((r, i) => { r.visit = i < (two ? 2 : 1) ? { itemId: 'table', from: { x: 1, z: i ? 1 : 3 }, path: [{ x: 1, z: i ? 1 : 3 }], start: 0, end: 30000 } : undefined; });
    return state;
}
describe('real picnic seats and ordinary use', () => {
    it.each([false, true])('keeps separate seat contact and shows the current users snack (two=%s)', two => {
        const state = fixture(two), before = structuredClone(state), scene = buildLifeScene(state);
        try {
            scene.animate(3000, true); scene.root.updateMatrixWorld(true);
            const users = scene.audit().filter(p => p.phase === 'picnic-table'); expect(users).toHaveLength(two ? 2 : 1);
            expect(users.every(p => p.seatGap! < 1e-8)).toBe(true);
            expect(users[0].picnic?.partnerId).toBe(two ? 'rabbit' : undefined);
            if (two) expect(new Vector3(...users[0].position).distanceTo(new Vector3(...users[1].position))).toBeGreaterThan(.7);
            let snacks = 0; scene.root.traverse(o => { if (o.name.startsWith('life-picnic-snack') && o.visible) snacks++; });
            expect(snacks).toBe(two ? 2 : 1);
            const bounds = new Box3().setFromObject(scene.root.getObjectByName('life-item-table')!);
            expect(bounds.max.x - bounds.min.x).toBeLessThan(1); expect(bounds.max.z - bounds.min.z).toBeLessThan(1);
            expect(state).toEqual(before);
            scene.animate(30000, true); snacks = 0; scene.root.traverse(o => { if (o.name.startsWith('life-picnic-snack') && o.visible) snacks++; }); expect(snacks).toBe(0);
        } finally { scene.dispose(); }
    });
    it('collects one shared R2 candidate for two partners', () => {
        const state = fixture(true, true), scene = buildLifeScene(state), camera = new OrthographicCamera(-5, 5, 5, -5, .1, 100);
        camera.position.set(4, 8, 11); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        try {
            scene.animate(3000, true); scene.root.updateMatrixWorld(true);
            const candidates = liveRelations(state, 'p', scene, camera, () => true);
            expect(candidates).toHaveLength(1); expect(candidates[0].focalResidentIds).toEqual(['pokomoko', 'rabbit']);
            scene.root.traverse(o => { if (o.name.startsWith('life-picnic-snack')) o.visible = false; });
            expect(liveRelations(state, 'p', scene, camera, () => true)[0].core).toBe(false);
        } finally { scene.dispose(); }
    });
    it('turns toward the mature tree while keeping the actual seat contact', () => {
        const scene = buildLifeScene(fixture(false, true));
        try {
            scene.animate(3000, true); const pose = scene.audit()[0]; expect(pose.relation).toMatchObject({ ruleId: 'R2', targetId: 'tree', ready: true });
            expect(pose.seatGap).toBeLessThan(1e-8); expect(scene.root.getObjectByName('life-resident-pokomoko')!.rotation.y).not.toBe(Math.PI);
        } finally { scene.dispose(); }
    });
});
