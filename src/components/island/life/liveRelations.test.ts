import { BoxGeometry, Mesh, MeshBasicMaterial, OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { newLife, type LifeState } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
import { liveRelations } from './liveRelations';

function fixture(swing = false): LifeState {
    const state = { ...replayLife(newLife('p', 0)), now: 2000 };
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 0, z: 2 }, growth: 0, style: 'original' },
        { id: 'target', kind: swing ? 'swing' : 'flower', cell: { x: 2, z: 2 }, growth: 0, style: 'original' }];
    state.residents.forEach(resident => { resident.visit = resident.id === 'pokomoko'
        ? { itemId: 'bench', from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 20000 } : undefined; });
    return state;
}
const camera = () => {
    const camera = new OrthographicCamera(-4, 4, 4, -4, .1, 100);
    camera.position.set(3, 8, 11); camera.lookAt(-1.5, .1, .2); camera.updateMatrixWorld(true); return camera;
};
describe('live rendered bench relations', () => {
    it.each([false, true])('requires actual settled gaze, visible head and target (swing=%s)', swing => {
        const state = fixture(swing), before = structuredClone(state), scene = buildLifeScene(state), view = camera();
        const sample = (shown = true) => liveRelations(state, 'p', scene, view, () => shown);
        try {
            scene.animate(500, false); scene.root.updateMatrixWorld(true); expect(sample()).toEqual([]);
            scene.animate(2000, false); scene.root.updateMatrixWorld(true);
            expect(sample()).toMatchObject([{ core: true, rule: { ruleId: swing ? 'R3' : 'R1' }, focalResidentIds: ['pokomoko'] }]);
            expect(sample(false)[0].core).toBe(false);
            scene.root.getObjectByName('life-item-target')!.visible = false; expect(sample()[0].core).toBe(false);
            scene.root.getObjectByName('life-item-target')!.visible = true;
            view.left = -.1; view.right = .1; view.updateProjectionMatrix(); expect(sample()[0].core).toBe(false);
            scene.animate(20000, false); expect(sample()).toEqual([]); expect(state).toEqual(before);
        } finally { scene.dispose(); }
    });
    it('tracks the actual swing occupant and separates a later visit to the same bench', () => {
        const state = fixture(true), view = camera();
        const sample = () => {
            const scene = buildLifeScene(state);
            try { scene.animate(state.now, false); scene.root.updateMatrixWorld(true); return liveRelations(state, 'p', scene, view, () => true)[0]; }
            finally { scene.dispose(); }
        };
        const empty = sample();
        state.residents[1].visit = { itemId: 'target', from: { x: 2, z: 3 }, path: [{ x: 2, z: 3 }], start: 0, end: 20000 };
        const occupied = sample(); expect(occupied.focalResidentIds).toEqual(['pokomoko', 'rabbit']); expect(occupied.key).not.toBe(empty.key);
        state.residents[0].visit!.start = 100; expect(sample().key).not.toBe(occupied.key);
    });
    it('never relabels a free observation visit as a live encounter after closing its panel', () => {
        const state = fixture(true), view = camera();
        for (const who of [0, 1]) {
            state.residents[who].visit = { itemId: who === 0 ? 'bench' : 'target', from: { x: who * 2, z: 3 }, path: [{ x: who * 2, z: 3 }], start: 0, end: 20000, observationTest: true };
            const scene = buildLifeScene(state);
            try { scene.animate(state.now, false); scene.root.updateMatrixWorld(true); expect(liveRelations(state, 'p', scene, view, () => true)).toEqual([]); }
            finally { scene.dispose(); }
            state.residents[who].visit!.observationTest = false;
        }
    });
    it('rejects real opaque cover while ignoring hidden geometry', () => {
        const state = fixture(), scene = buildLifeScene(state), view = camera();
        const cover = new Mesh(new BoxGeometry(12, .2, 12), new MeshBasicMaterial()); cover.position.y = 3; scene.root.add(cover);
        try {
            scene.animate(2000, false); scene.root.updateMatrixWorld(true);
            expect(liveRelations(state, 'p', scene, view, () => true)[0].core).toBe(false);
            cover.visible = false; expect(liveRelations(state, 'p', scene, view, () => true)[0].core).toBe(true);
        } finally { scene.dispose(); }
    });
});
