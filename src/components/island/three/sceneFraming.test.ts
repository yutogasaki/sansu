import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandResident } from './animals';
import { boxCorners, fitLearningFrame } from './sceneFraming';
import { disposeGeometry, IslandMaterials } from './primitives';
import type { ResidentSpecies } from './residentRig';
import type { IslandStageItem } from './types';
import { fitIslandComparisonCamera, IslandScene } from './runtime';
import { applyTreeGrowth, makeExpansion, makeScenery } from './scenery';
import { makeWestExpansion } from './westScenery';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';
import { IslandCameraControls } from './islandCameraControls';
import { buildConnectedTerrain } from './connectedTerrain';

const materials: IslandMaterials[] = [], actors: IslandResident[] = [];
function actor(species: ResidentSpecies, position: [number, number, number]) {
    const material = new IslandMaterials(); materials.push(material);
    const resident = new IslandResident(species, material, position, () => undefined); actors.push(resident);
    return resident;
}
function camera() {
    const result = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    const focus = new THREE.Vector3(.8, .55, 1);
    result.position.copy(focus).add(new THREE.Vector3(4.7, 8.8, 13.5)); result.lookAt(focus); result.updateMatrixWorld(true);
    return result;
}
function expectVisible(resident: IslandResident, view: THREE.Camera) {
    for (const point of boxCorners(new THREE.Box3().setFromObject(resident.group, true))) {
        point.project(view);
        expect(Math.abs(point.x)).toBeLessThan(.96);
        expect(Math.abs(point.y)).toBeLessThan(.94);
    }
}
afterEach(() => {
    actors.splice(0).forEach(resident => disposeGeometry(resident.group));
    materials.splice(0).forEach(material => material.dispose());
});

describe('frozen learning frame after free play', () => {
    it.each([[342, 185], [345, 320]])('keeps the full mature grove crown inside the comparison at %sx%s', (width, height) => {
        const material = new IslandMaterials(), grove = makeWestExpansion(material);
        try {
            const tree = grove.getObjectByName('western-grove-tree') as THREE.Group;
            applyTreeGrowth(tree, 3); grove.updateMatrixWorld(true);
            const view = camera(); fitIslandComparisonCamera(view, 'grove', width / height);
            const bounds = new THREE.Box3();
            tree.traverse(child => {
                if (!(child instanceof THREE.Mesh)) return;
                const vertices = child.geometry.getAttribute('position');
                for (let index = 0; index < vertices.count; index++) bounds.expandByPoint(
                    new THREE.Vector3().fromBufferAttribute(vertices, index).applyMatrix4(child.matrixWorld).project(view));
            });
            expect(bounds.max.y).toBeLessThan(.96);
            expect(bounds.min.y).toBeGreaterThan(-.96);
            expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(.96);
        } finally { disposeGeometry(grove); material.dispose(); }
    });

    it.each([[390, 190], [768, 400]].flatMap(([width, height]) =>
        ([0, 1, 2, undefined] as const).map(expansionLevel => ({ width, height, expansionLevel }))))(
        'contains earned shores in matching album cameras and the home view at $width×$height, chapter $expansionLevel', ({ width, height, expansionLevel }) => {
        const material = new IslandMaterials();
        const island = createIsland('scene-framing', 0);
        const state = { ...island, completedSets: 24, growth: { ...island.growth!, expansionLevel }, learning: false, districtFocus: 'all' };
        const level = getIslandExpansionLevel(state);
        const objects = [makeScenery(material), ...(level >= 1 ? [makeExpansion(material)] : []),
            ...(level >= 2 ? [makeWestExpansion(material)] : []),
            ...(level > 0 ? (['ground', 'shore', 'water'] as const).map(slot => buildConnectedTerrain(material, level, slot)) : [])];
        try {
            const before = camera(), after = camera(), view = camera();
            fitIslandComparisonCamera(before, 'all', width / height);
            fitIslandComparisonCamera(after, 'all', width / height);
            expect(after.matrixWorld.toArray()).toEqual(before.matrixWorld.toArray());
            expect(after.projectionMatrix.toArray()).toEqual(before.projectionMatrix.toArray());
            const scene = Object.create(IslandScene.prototype) as { resize(): void };
            Object.assign(scene, { camera: view, host: { clientWidth: width, clientHeight: height },
                renderer: { setSize: () => undefined, getSize: (size: THREE.Vector2) => size.set(width, height) }, rendererSize: new THREE.Vector2(),
                cameraControls: new IslandCameraControls(() => undefined), expansion: { visible: level >= 1 }, westExpansion: { visible: level >= 2 },
                state, items: new Map(), requestFrame: () => undefined });
            scene.resize();
            for (const object of objects) {
                object.updateMatrixWorld(true);
                const projectedBounds = [after, view].map(lens => ({ lens, bounds: new THREE.Box3() }));
                object.traverse(child => {
                    if (!(child instanceof THREE.Mesh)) return;
                    const vertices = child.geometry.getAttribute('position');
                    for (let index = 0; index < vertices.count; index++) {
                        const point = new THREE.Vector3().fromBufferAttribute(vertices, index).applyMatrix4(child.matrixWorld);
                        for (const { lens, bounds } of projectedBounds) bounds.expandByPoint(point.clone().project(lens));
                    }
                });
                for (const { bounds } of projectedBounds) {
                    expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), `${object.name} horizontal at ${width}×${height}`).toBeLessThan(1);
                    expect(Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)), `${object.name} vertical at ${width}×${height}`).toBeLessThan(1);
                }
            }
        } finally { objects.forEach(disposeGeometry); material.dispose(); }
    });

    it.each([[390, 136], [390, 112], [768, 252]])('fits standing, bench and lantern residents at %sx%s without moving their roots', (width, height) => {
        const otter = actor('otter', [.1, 0, 1.6]), rabbit = actor('rabbit', [2.45, 0, 1.45]);
        const bench: IslandStageItem = { id: 'bench', kind: 'bench', position: { x: 0, z: 1 }, rotation: Math.PI / 2 };
        const lantern: IslandStageItem = { id: 'lantern', kind: 'lantern', position: { x: -.65, z: .4 }, rotation: 0 };
        for (const settled of [false, true]) {
            if (settled) {
                expect(otter.visit(bench, 0, true, [bench, lantern], 0)).toBe(true);
                expect(rabbit.visit(lantern, 0, true, [bench, lantern], 0)).toBe(true);
            }
            const roots = [otter.group.position.clone(), rabbit.group.position.clone()], view = camera();
            fitLearningFrame(view, [otter.learningFrameBounds(), rabbit.learningFrameBounds()], width / height, width < 600 ? 7.2 : 9.5);
            for (const resident of [otter, rabbit]) {
                expectVisible(resident, view);
                for (const kind of ['correct', 'retry', 'support'] as const) {
                    resident.respondToLearning(kind, 1, 1, new THREE.Vector3(1.6, .8, -.5));
                    expectVisible(resident, view); resident.clearLearningPose();
                }
            }
            expect([otter.group.position.toArray(), rabbit.group.position.toArray()]).toEqual(roots.map(root => root.toArray()));
        }
    });

    it('keeps the same camera while an already-started route reaches the east island and plays', () => {
        const rabbit = actor('rabbit', [2.45, 0, 1.45]), fox = actor('fox', [6.26, 0, .83]);
        const swing: IslandStageItem = { id: 'swing', kind: 'swing', position: { x: 6.25, z: .95 }, rotation: Math.PI / 2 };
        expect(rabbit.visit(swing, 0, false, [swing], 4)).toBe(true);
        rabbit.update(250);
        const view = camera();
        fitLearningFrame(view, [rabbit.learningFrameBounds(), fox.learningFrameBounds()], 768 / 252, 9.5);
        const frame = [...view.matrixWorld.elements, ...view.projectionMatrix.elements];
        for (let now = 250; now <= 8200; now += 50) {
            rabbit.update(now); rabbit.respondToLearning('correct', 1, 1, new THREE.Vector3(6.98, .35, .82));
            expectVisible(rabbit, view); expectVisible(fox, view); rabbit.clearLearningPose();
        }
        expect([...view.matrixWorld.elements, ...view.projectionMatrix.elements]).toEqual(frame);
        expect(rabbit.action).toBe('swing');
        expect(rabbit.group.position.x).toBe(swing.position!.x);
    });

    it('protects the ears through a seat-release transition without changing resident state', () => {
        const rabbit = actor('rabbit', [0, 0, 1.6]);
        const mushroom: IslandStageItem = { id: 'mushroom', kind: 'mushroom', position: { x: 0, z: 1 }, rotation: 0 };
        expect(rabbit.visit(mushroom, 0, false, [mushroom], 0)).toBe(true); rabbit.update(2500); rabbit.release(2500);
        const view = camera();
        fitLearningFrame(view, [rabbit.learningFrameBounds()], 390 / 136, 7.2);
        for (let now = 2500; now <= 2720; now += 20) { rabbit.update(now); expectVisible(rabbit, view); }
        expect(rabbit.group.position.toArray()).toEqual([0, 0, 1]);
    });
});
