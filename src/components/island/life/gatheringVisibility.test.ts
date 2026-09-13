import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newLife, type LifeItem } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { displayedGatherings, gatheringVisible } from './gatheringVisibility';
import { buildLifeScene } from './scene';
const flowers = (count: number, growth = 0): LifeItem[] => Array.from({ length: count }, (_, i) => ({ id: `f${i}`, kind: 'flower', cell: { x: i % 3, z: 2 + Math.floor(i / 3) }, growth, style: 'original' }));
const world = (items: LifeItem[]) => ({ ...replayLife(newLife('p', 0)), items });
describe('rendered gathering evidence', () => {
    it('only records the upper ground actually drawn, preserving separate components', () => {
        expect(displayedGatherings(world(flowers(6, 6)), 'p').map(rule => rule.ruleId)).toEqual(['GF6']);
        expect(displayedGatherings(world(flowers(3, 6)), 'p').map(rule => rule.ruleId)).toEqual(['GF3']);
        expect(displayedGatherings(world(flowers(3)), 'p').map(rule => rule.ruleId)).toEqual(['G0']);
        expect(displayedGatherings(world(flowers(3).map(item => ({ ...item, kind: 'swing' }))), 'p').map(rule => rule.ruleId)).toEqual(['GP3']);
    });
    it.each([0, 6])('requires visible real items, connecting ground and an unobstructed viewport (growth=%i)', growth => {
        const state = world(flowers(3, growth)), before = structuredClone(state), scene = buildLifeScene(state);
        const camera = new T.OrthographicCamera(-3, 3, 3, -3, .1, 100);
        camera.position.set(-1.5, 8, 6); camera.lookAt(-1.5, .1, .2); camera.updateMatrixWorld(true); scene.animate(state.now, true); scene.root.updateMatrixWorld(true);
        const rule = displayedGatherings(state, 'p')[0];
        const visible = (screen = true) => gatheringVisible(state, rule, scene.root, camera, scene.point, () => screen);
        try {
            expect(visible()).toBe(true); expect(visible(false)).toBe(false);
            const ground = scene.root.getObjectByName(growth ? 'life-district-ground' : 'life-young-plant-ground')!;
            ground.visible = false; expect(visible()).toBe(false); ground.visible = true;
            scene.root.getObjectByName('life-item-f1')!.visible = false; expect(visible()).toBe(false);
            expect(state).toEqual(before);
        } finally { scene.dispose(); }
    });
    it('rejects a clipped group and a real opaque object covering its ground', () => {
        const state = world(flowers(3)), scene = buildLifeScene(state), camera = new T.OrthographicCamera(-3, 3, 3, -3, .1, 100);
        camera.position.set(-1.5, 8, 6); camera.lookAt(-1.5, .1, .2); camera.updateMatrixWorld(true); scene.animate(state.now, true); scene.root.updateMatrixWorld(true);
        const rule = displayedGatherings(state, 'p')[0], visible = () => gatheringVisible(state, rule, scene.root, camera, scene.point, () => true);
        try {
            camera.left = -.1; camera.right = .1; camera.updateProjectionMatrix(); expect(visible()).toBe(false);
            camera.left = -3; camera.right = 3; camera.updateProjectionMatrix();
            const cover = new T.Mesh(new T.BoxGeometry(6, .2, 4), new T.MeshBasicMaterial()); cover.position.set(-1.5, 3, .2); scene.root.add(cover); scene.animate(state.now, true); scene.root.updateMatrixWorld(true);
            expect(visible()).toBe(false);
        } finally { scene.dispose(); }
    });
    it('sees the actual exposed parts of all six mature cells and joins from the island angle', () => {
        const state = world(flowers(6, 6).map(item => ({ ...item, cell: { x: item.cell!.x + 1, z: item.cell!.z } }))), scene = buildLifeScene(state);
        const camera = new T.OrthographicCamera(-3, 3, 3, -3, .1, 100);
        camera.position.set(4, 7.9, 11.5); camera.lookAt(-.5, .1, .5); camera.updateMatrixWorld(true); scene.animate(state.now, true); scene.root.updateMatrixWorld(true);
        try { expect(gatheringVisible(state, displayedGatherings(state, 'p')[0], scene.root, camera, scene.point, () => true)).toBe(true); }
        finally { scene.dispose(); }
    });

    it('sees exposed shared ground around a sandbox instead of sampling underneath its rim', () => {
        const state = world([0, 1, 2].map(x => ({ id: `p${x}`, kind: x === 2 ? 'sandbox' : 'swing', cell: { x: x + 2, z: 2 }, growth: 0, style: 'original' })));
        const scene = buildLifeScene(state), camera = new T.OrthographicCamera(-4, 4, 4, -4, .1, 100);
        camera.position.set(4, 8, 11); camera.lookAt(0, .1, 0); camera.updateMatrixWorld(true); scene.animate(0, true); scene.root.updateMatrixWorld(true);
        const rule = displayedGatherings(state, 'p')[0]; let reason = '';
        try {
            expect(gatheringVisible(state, rule, scene.root, camera, scene.point, () => true, r => { reason = r; }), reason).toBe(true);
            scene.root.getObjectByName('life-district-ground')!.visible = false;
            expect(gatheringVisible(state, rule, scene.root, camera, scene.point, () => true)).toBe(false);
        } finally { scene.dispose(); }
    });

});
