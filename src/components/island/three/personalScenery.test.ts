import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { getIslandExperience, ISLAND_EMBLEMS } from '../../../domain/island/experience';
import { ISLAND_RESERVED_AREAS } from '../../../domain/island/catalog';
import { IslandPersonalScenery } from './personalScenery';
import { IslandCosmeticScenery } from './cosmeticScenery';

function canvasFixture(available = true) {
    // Explicit 2D API test double: these assertions cover literal strings/layout/lifetime, not font rasterization or phone readability.
    const context = { fillStyle: '', textAlign: '', textBaseline: '', font: '', fillRect: vi.fn(), fillText: vi.fn(),
        measureText(text: string) { return { width: [...text].length * Number(this.font.match(/(\d+)px/)?.[1] ?? 12) }; } };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => available ? context : null) } as unknown as HTMLCanvasElement;
    return { canvas, context, create: vi.fn(() => canvas) };
}
function meshes(group: THREE.Object3D) {
    const result: THREE.Mesh[] = []; group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); }); return result;
}
const identity = (name = 'ひかりの しま') => ({ ...getIslandExperience({}), islandName: name });

describe('house-mounted personal identity', () => {
    it('keeps legacy/default scenes untouched, creates one label lazily, and paints names as text with two bounded lines', () => {
        const fixture = canvasFixture(), world = new IslandPersonalScenery(fixture.create);
        try {
            expect(world.update()).toBe(false);
            expect(world.update(getIslandExperience({}))).toBe(false);
            expect(world.group.visible).toBe(false); expect(fixture.create).not.toHaveBeenCalled();
            expect(meshes(world.group)).toHaveLength(0);
            expect(world.update(identity('あいうえおかきくけこさしすせそた'))).toBe(true);
            expect(fixture.create).toHaveBeenCalledTimes(1);
            expect(fixture.canvas.width).toBe(1024); expect(fixture.canvas.height).toBe(384);
            expect(fixture.context.fillText.mock.calls).toEqual([
                ['あいうえおかきく', 512, 110, 928], ['けこさしすせそた', 512, 274, 928],
            ]);
            expect(world.group.userData.islandName).toBe('あいうえおかきくけこさしすせそた');
            world.update(identity('<b>しま</b>'));
            expect(fixture.context.fillText.mock.calls.slice(2).map(call => call[0]).join('')).toBe('<b>しま</b>');
            expect(world.group.userData.nameLines.join('')).toBe('<b>しま</b>');
            expect(world.update()).toBe(true); expect(world.group.visible).toBe(false);
            world.update(identity()); expect(fixture.create).toHaveBeenCalledTimes(1);
        } finally { world.dispose(); }
    });

    it('uses four real silhouettes on the same blue roof flag and allocates nothing when identity is unchanged', () => {
        const fixture = canvasFixture(), world = new IslandPersonalScenery(fixture.create);
        try {
            world.update(identity());
            const allMeshes = meshes(world.group), uuids = allMeshes.map(object => object.geometry.uuid), signatures = new Set<string>();
            const text = world.group.getObjectByName('island-nameplate-text') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
            const version = text.material.map!.version, textCalls = fixture.context.fillText.mock.calls.length;
            expect(world.update(identity())).toBe(false);
            expect(text.material.map!.version).toBe(version); expect(fixture.context.fillText).toHaveBeenCalledTimes(textCalls);
            for (const emblem of ISLAND_EMBLEMS) {
                world.update({ ...identity(), emblem });
                const selected = world.group.getObjectByName(`island-emblem-${emblem}`)!;
                expect(selected.visible).toBe(true);
                expect(ISLAND_EMBLEMS.filter(id => world.group.getObjectByName(`island-emblem-${id}`)!.visible)).toEqual([emblem]);
                signatures.add(JSON.stringify(meshes(selected).map(object => Array.from(object.geometry.getAttribute('position').array))));
            }
            expect(signatures.size).toBe(4);
            expect(meshes(world.group).map(object => object.geometry.uuid)).toEqual(uuids);
            expect(fixture.context.fillText).toHaveBeenCalledTimes(textCalls);
        } finally { world.dispose(); }
    });

    it('keeps every plaque, pole, cloth and emblem vertex inside the existing house reservation and below the tall-tree envelope', () => {
        const world = new IslandPersonalScenery(canvasFixture().create), house = ISLAND_RESERVED_AREAS[0];
        try {
            world.update(identity()); world.group.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(world.group, true);
            expect(bounds.max.y).toBeLessThan(3.1); expect(bounds.min.y).toBeGreaterThan(.8);
            for (const object of meshes(world.group)) {
                const positions = object.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    expect(Math.hypot(point.x - house.x, point.z - house.z)).toBeLessThan(house.radius);
                }
            }
            // The real nameplate is a house detail, not a world-sized title or full-canvas plane.
            const plate = world.group.getObjectByName('island-nameplate-frame')!;
            const size = new THREE.Box3().setFromObject(plate, true).getSize(new THREE.Vector3());
            expect(size.x).toBeCloseTo(1.42); expect(size.y).toBeCloseTo(.46);
        } finally { world.dispose(); }
    });

    it('reuses its single texture/material/geometry pool and releases every owned resource once, including repeated dispose', () => {
        const fixture = canvasFixture(), world = new IslandPersonalScenery(fixture.create), scene = new THREE.Scene(); scene.add(world.group);
        world.update(identity());
        const objects = meshes(world.group), geometries = [...new Set(objects.map(object => object.geometry))];
        const materials = [...new Set(objects.flatMap(object => Array.isArray(object.material) ? object.material : [object.material]))];
        const label = (world.group.getObjectByName('island-nameplate-text') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.map!;
        const disposed = new Map<string, number>();
        for (const resource of [...geometries, ...materials, label]) resource.addEventListener('dispose', () => { disposed.set(resource.uuid, (disposed.get(resource.uuid) ?? 0) + 1); });
        for (let i = 0; i < 50; i++) world.update({ ...identity(`しま ${i}`), emblem: ISLAND_EMBLEMS[i % 4] });
        expect(fixture.create).toHaveBeenCalledTimes(1);
        expect(meshes(world.group).map(object => object.geometry.uuid)).toEqual(objects.map(object => object.geometry.uuid));
        expect(disposed.size).toBe(0);
        world.dispose(); world.dispose(); expect(world.update(identity())).toBe(false);
        expect(scene.children).toHaveLength(0); expect(meshes(world.group)).toHaveLength(0);
        expect(disposed.size).toBe(geometries.length + materials.length + 1);
        expect([...disposed.values()].every(count => count === 1)).toBe(true);
    });

    it.each(['moon-garden', 'starry', 'candy', 'crystal'] as const)('%s leaves the actual nameplate and roof flag visible from the home camera direction', themeId => {
        const world = new IslandPersonalScenery(canvasFixture().create), scenery = new IslandCosmeticScenery({ themeId, accentId: null });
        try {
            world.update(identity()); world.group.updateMatrixWorld(true); scenery.group.updateMatrixWorld(true);
            const view = new THREE.Vector3(4.7, 8.8, 13.5).normalize();
            for (const local of [-.45, 0, .45].flatMap(x => [.92, 1.05, 1.18].map(y => [x, y, .888])).concat([[-.555, 2.77, .25]])) {
                const point = world.group.localToWorld(new THREE.Vector3(...local));
                const ray = new THREE.Raycaster(point.clone().addScaledVector(view, 30), view.clone().negate(), 0, 29.995);
                const hits = ray.intersectObject(scenery.scenery, true);
                expect(hits, `${themeId} at ${local}: ${JSON.stringify(hits.map(hit => hit.point.toArray()))}`).toHaveLength(0);
            }
        } finally { world.dispose(); scenery.dispose(); }
    });

    it('retains the physical flag when the 2D context is unavailable, without creating an unusable texture', () => {
        const fixture = canvasFixture(false), world = new IslandPersonalScenery(fixture.create);
        try {
            expect(world.update({ ...identity(), emblem: 'wave' })).toBe(true);
            expect(world.group.getObjectByName('island-personal-flag')).toBeDefined();
            expect(world.group.getObjectByName('island-nameplate-text')).toBeUndefined();
            expect(fixture.context.fillText).not.toHaveBeenCalled();
        } finally { world.dispose(); }
    });

    it('attaches the leaf bird to the real flag edge without covering any emblem or changing the island name', () => {
        const fixture = canvasFixture(), world = new IslandPersonalScenery(fixture.create), experience = identity(), before = JSON.stringify(experience);
        try {
            world.update(experience, 'leaf-bird-flag-trim');
            const trim = world.group.getObjectByName('island-flag-leaf-bird-trim')!, flag = world.group.getObjectByName('island-personal-flag')!;
            expect(trim.parent).toBe(flag); expect(trim.visible).toBe(true); expect(meshes(trim).length).toBeGreaterThan(3);
            expect(meshes(trim).some(mesh => mesh.name === 'flag-trim-leaf-body' && mesh.geometry.type === 'ExtrudeGeometry')).toBe(true);
            const resources = meshes(world.group).map(mesh => [mesh.geometry, mesh.material]);
            const nameCalls = fixture.context.fillText.mock.calls.length;
            world.group.updateMatrixWorld(true);
            const house = ISLAND_RESERVED_AREAS[0];
            for (const object of meshes(trim)) {
                const positions = object.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    expect(Math.hypot(point.x - house.x, point.z - house.z)).toBeLessThan(house.radius);
                    // Every trim vertex lies beyond the entire central emblem envelope.
                    expect(flag.worldToLocal(point).x).toBeGreaterThan(.19);
                }
            }
            for (const emblem of ISLAND_EMBLEMS) {
                expect(world.update({ ...experience, emblem }, 'leaf-bird-flag-trim')).toBe(emblem !== 'leaf');
                expect(world.group.getObjectByName(`island-emblem-${emblem}`)!.visible).toBe(true); expect(trim.visible).toBe(true);
            }
            expect(fixture.context.fillText.mock.calls.length).toBe(nameCalls);
            expect(world.update({ ...experience, emblem: 'wave' })).toBe(true); expect(trim.visible).toBe(false);
            expect(world.group.getObjectByName('island-emblem-wave')!.visible).toBe(true); expect(world.group.visible).toBe(true);
            expect(meshes(world.group).map(mesh => [mesh.geometry, mesh.material])).toEqual(resources); expect(JSON.stringify(experience)).toBe(before);
        } finally { world.dispose(); }
    });

    it('shows an explicitly selected trim with default identity, then fully restores the legacy hidden state on removal', () => {
        const fixture = canvasFixture(), world = new IslandPersonalScenery(fixture.create);
        try {
            expect(world.update(undefined, 'leaf-bird-flag-trim')).toBe(true);
            expect(world.group.visible).toBe(true); expect(world.group.userData.flagTrim).toBe('leaf-bird-flag-trim');
            expect(world.group.userData.islandName).toBe('わたしの しま');
            expect(world.update(undefined, 'leaf-bird-flag-trim')).toBe(false);
            expect(world.update()).toBe(true); expect(world.group.visible).toBe(false);
            expect(world.group.getObjectByName('island-flag-leaf-bird-trim')!.visible).toBe(false); expect(world.group.userData.flagTrim).toBe(null);
            for (let i = 0; i < 30; i++) { world.update(undefined, 'leaf-bird-flag-trim'); world.update(); }
            expect(fixture.create).toHaveBeenCalledTimes(1);
        } finally { world.dispose(); }
    });
});
