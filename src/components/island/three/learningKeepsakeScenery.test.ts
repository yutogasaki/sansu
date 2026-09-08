import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_LEARNING_KEEPSAKES, type IslandLearningKeepsakesState } from '../../../domain/island/learningKeepsakes';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';

const all: IslandLearningKeepsakesState = { version: 1, displayed: ISLAND_LEARNING_KEEPSAKES.map(item => item.id) };
function meshes(group: THREE.Object3D) {
    const result: THREE.Mesh[] = []; group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); }); return result;
}
function vertices(group: THREE.Object3D) {
    group.updateWorldMatrix(true, true);
    return meshes(group).flatMap(object => {
        const positions = object.geometry.getAttribute('position');
        return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
    });
}
describe('a finite room for actual learning keepsakes', () => {
    it('shows no unearned models, supports an empty visit and keeps the same objects during selection/display changes', () => {
        const room = new IslandLearningKeepsakeScenery(), original = structuredClone(all);
        try {
            expect(room.update()).toBe(false); expect(room.group.children).toHaveLength(0);
            const frame = room.framePoints().map(p => p.toArray());
            room.update(undefined, 0, true); expect(room.group.visible).toBe(true);
            expect(room.describe().awards.filter(a => a.visible)).toHaveLength(0);
            const identity = meshes(room.group).map(m => [m.uuid, m.geometry.uuid]);
            room.update(all, 1, true); expect(room.describe().awards.filter(a => a.visible).map(a => a.id)).toEqual(['first-completion']);
            room.update(all, 5, true); expect(room.describe().awards.filter(a => a.visible).map(a => a.id)).toEqual(['first-completion', 'completed-5']);
            expect(room.update(all, 5, true)).toBe(false);
            room.update(all, 5, true, 'completed-1000'); expect(room.describe().selectedId).toBeNull();
            room.update(all, 1000, true, 'completed-1000'); expect(room.describe().awards.filter(a => a.visible)).toHaveLength(16);
            expect(meshes(room.group).map(m => [m.uuid, m.geometry.uuid])).toEqual(identity);
            room.update({ version: 1, displayed: [] }, 1000, true); expect(room.describe().awards.filter(a => a.visible)).toHaveLength(0);
            expect(room.frameView('completed-5').selectedId).toBeNull();
            expect(room.framePoints().map(p => p.toArray())).toEqual(frame); expect(all).toEqual(original);
        } finally { room.dispose(); }
    });

    it('physically supports thirteen separate trophies and wall-mounts three papers within a bounded static room', () => {
        const room = new IslandLearningKeepsakeScenery(); room.update(all, 1000, true);
        try {
            const envelope = new THREE.Box3().setFromPoints(room.framePoints()), shapes = new Set<string>();
            for (const point of vertices(room.group)) expect(envelope.containsPoint(point)).toBe(true);
            const trophyBounds: THREE.Box3[] = [];
            for (const entry of ISLAND_LEARNING_KEEPSAKES) {
                const award = room.group.getObjectByName(`keepsake-${entry.id}`)!;
                const bounds = new THREE.Box3().setFromPoints(vertices(award));
                if (entry.slot === 'certificate') {
                    expect(award.getObjectByName('keepsake-certificate-paper')).toBeDefined();
                    expect(award.getObjectByName('keepsake-certificate-seal')).toBeDefined();
                    // Back of the frame remains outside the actual wall front.
                    expect(bounds.min.z).toBeGreaterThan(-.285);
                } else {
                    const support = [.57, 1.69, 2.81].find(y => Math.abs(y - bounds.min.y) < 1e-6);
                    expect(support, `${entry.id} actual base y=${bounds.min.y}`).toBeDefined();
                    for (const other of trophyBounds) expect(bounds.intersectsBox(other)).toBe(false);
                    trophyBounds.push(bounds);
                    shapes.add(JSON.stringify(meshes(award).map(m => Array.from(m.geometry.getAttribute('position').array))));
                }
            }
            expect(trophyBounds).toHaveLength(13); expect(shapes.size).toBe(13);
            expect(meshes(room.group).length).toBeLessThan(160);
            expect(meshes(room.group).reduce((sum, m) => sum + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, 0)).toBeLessThan(25000);
        } finally { room.dispose(); }
    });

    it('releases all room resources on exit and never touches the separate island scene', () => {
        const room = new IslandLearningKeepsakeScenery(), scene = new THREE.Scene(), island = new THREE.Group(); scene.add(island, room.group);
        const pose = island.matrix.clone(), uuid = island.uuid; room.update(all, 1000, true);
        const resources = new Set<THREE.BufferGeometry | THREE.Material>();
        meshes(room.group).forEach(object => { resources.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => resources.add(m)); });
        const disposed = new Map<string, number>();
        resources.forEach(resource => resource.addEventListener('dispose', () => disposed.set(resource.uuid, (disposed.get(resource.uuid) ?? 0) + 1)));
        room.update(undefined, 0, false); room.update(undefined, 0, false);
        expect([...disposed.values()]).toHaveLength(resources.size); expect([...disposed.values()].every(n => n === 1)).toBe(true);
        expect(room.group.children).toHaveLength(0); expect(room.group.visible).toBe(false);
        expect(island.uuid).toBe(uuid); expect(island.matrix.equals(pose)).toBe(true); expect(island.visible).toBe(true);
        room.update(all, 5, true); expect(room.describe().awards.filter(a => a.visible)).toHaveLength(2);
        room.dispose(); room.dispose(); expect(scene.children).toEqual([island]); expect(room.update(all, 1000, true)).toBe(false);
    });

    it('owns its indoor fill without receiving exterior shadows or changing island lights', () => {
        const room = new IslandLearningKeepsakeScenery(), scene = new THREE.Scene();
        const sun = new THREE.DirectionalLight('#fff1d1', 2.6); sun.castShadow = true;
        const tree = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
        tree.castShadow = true; tree.receiveShadow = true; scene.add(sun, tree, room.group);
        const color = sun.color.clone();
        try {
            room.group.scale.setScalar(.26); room.update(all, 1000, true);
            const fill = room.group.getObjectByName('home-interior-fill') as THREE.PointLight;
            expect(fill).toBeInstanceOf(THREE.PointLight); expect(fill.castShadow).toBe(false);
            expect(fill.intensity).toBeCloseTo(3 * .26 ** 2); expect(fill.distance).toBeCloseTo(9 * .26);
            expect(meshes(room.group).every(object => !object.castShadow && !object.receiveShadow)).toBe(true);
            room.update(undefined, 0, false);
            expect(room.group.getObjectByName('home-interior-fill')).toBeUndefined();
            expect(sun.intensity).toBe(2.6); expect(sun.color.equals(color)).toBe(true); expect(sun.castShadow).toBe(true);
            expect(tree.castShadow).toBe(true); expect(tree.receiveShadow).toBe(true);
        } finally { room.dispose(); tree.geometry.dispose(); (tree.material as THREE.Material).dispose(); }
    });
});
