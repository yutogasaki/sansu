import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { IslandMaterials } from './primitives';
import { SharedActivityVisuals, type SharedActivityVisualFrame } from './sharedActivityVisuals';

const instances: { visuals: SharedActivityVisuals; materials: IslandMaterials }[] = [];
function make() {
    const materials = new IslandMaterials(), visuals = new SharedActivityVisuals(materials);
    instances.push({ visuals, materials });
    return { visuals, materials };
}
function frame(overrides: Partial<SharedActivityVisualFrame> = {}): SharedActivityVisualFrame {
    return { kind: 'flower', phase: 'gather', progress: 0, source: new THREE.Vector3(-1, .6, 2),
        carrier: new THREE.Vector3(0, 1, 1), receiver: new THREE.Vector3(1, 1.5, 0), reduced: false, ...overrides };
}
afterEach(() => {
    for (const { visuals, materials } of instances.splice(0)) { visuals.dispose(); materials.dispose(); }
    vi.restoreAllMocks();
});

describe('visible shared furniture handoff', () => {
    it.each(['flower', 'star', 'bubble'] as const)('moves one %s from the actual source through both hand attachments', kind => {
        const { visuals } = make(), input = frame({ kind });
        const samples = [
            ['gather', 0, 'source', input.source], ['gather', .5, 'transfer', input.source.clone().lerp(input.carrier, .5)],
            ['gather', 1, 'carrier', input.carrier], ['carry', .5, 'carrier', input.carrier],
            ['share', 0, 'carrier', input.carrier], ['share', .5, 'transfer', input.carrier.clone().lerp(input.receiver, .5)],
            ['share', 1, 'receiver', input.receiver], ['enjoy', 0, 'receiver', input.receiver],
        ] as const;
        for (const [phase, progress, owner, point] of samples) {
            visuals.update({ ...input, phase, progress });
            const result = visuals.snapshot();
            expect(result).toMatchObject({ kind, phase, owner, visible: true, position: point.toArray(), scale: [1, 1, 1] });
            expect(result.meshes.filter(mesh => mesh.visible).length).toBeGreaterThan(0);
            expect(result.meshes.filter(mesh => mesh.visible).every(mesh => mesh.name.startsWith(`shared-${kind}-surface-`))).toBe(true);
        }
    });

    it('keeps phase boundaries continuous while carrying and then holding a flower or star', () => {
        const { visuals } = make();
        for (const kind of ['flower', 'star'] as const) {
            const input = frame({ kind });
            for (const [before, after] of [['gather', 'carry'], ['carry', 'share'], ['share', 'enjoy'], ['enjoy', 'settled']] as const) {
                visuals.update({ ...input, phase: before, progress: 1 });
                const previous = visuals.snapshot();
                visuals.update({ ...input, phase: after, progress: 0 });
                const next = visuals.snapshot();
                expect(next.position).toEqual(previous.position);
                expect(next.scale).toEqual(previous.scale);
                expect(next.visible).toBe(true);
            }
            visuals.update({ ...input, phase: 'carry', carrier: new THREE.Vector3(2, 2, 2) });
            expect(visuals.snapshot().position).toEqual([2, 2, 2]);
            visuals.update({ ...input, phase: 'settled', receiver: new THREE.Vector3(-2, 3, 1) });
            expect(visuals.snapshot()).toMatchObject({ owner: 'receiver', position: [-2, 3, 1], visible: true });
        }
    });

    it('expands the received water ball, pops it into five local water droplets, then clears', () => {
        const { visuals } = make(), input = frame({ kind: 'bubble', phase: 'enjoy' });
        visuals.update(input);
        expect(visuals.snapshot()).toMatchObject({ visible: true, scale: [1, 1, 1], owner: 'receiver' });
        visuals.update({ ...input, progress: .54999 });
        expect(visuals.snapshot().scale[0]).toBeCloseTo(1.65, 5);
        visuals.update({ ...input, progress: .55 });
        const popped = visuals.snapshot().meshes.filter(mesh => mesh.visible);
        expect(popped).toHaveLength(5);
        for (const drop of popped) {
            expect(drop.name).toMatch(/^shared-water-droplet-/);
            expect(new THREE.Vector3(...drop.position).distanceTo(input.receiver)).toBeCloseTo(.37, 6);
        }
        visuals.update({ ...input, progress: .9 });
        expect(visuals.snapshot().meshes.filter(mesh => mesh.visible).every(mesh => mesh.scale[0] < .065)).toBe(true);
        visuals.update({ ...input, progress: 1 });
        expect(visuals.snapshot()).toMatchObject({ visible: false, owner: 'none' });
        visuals.update({ ...input, phase: 'settled', progress: 0 });
        expect(visuals.snapshot().visible).toBe(false);
    });

    it.each(['flower', 'star', 'bubble'] as const)('shows a static received %s under reduced motion without flight or droplets', kind => {
        const { visuals } = make(), input = frame({ kind, reduced: true });
        for (const phase of ['gather', 'carry', 'share', 'enjoy', 'settled'] as const) {
            for (const progress of [0, .4, 1]) {
                visuals.update({ ...input, phase, progress });
                const result = visuals.snapshot();
                expect(result).toMatchObject({ owner: 'receiver', position: input.receiver.toArray(), visible: true });
                expect(result.scale).toEqual(kind === 'bubble' ? [1.25, 1.25, 1.25] : [1, 1, 1]);
                expect(result.meshes.filter(mesh => mesh.visible).some(mesh => mesh.name.includes('droplet'))).toBe(false);
            }
        }
    });

    it('reports real world mesh transforms and inherited visibility under a scene parent', () => {
        const { visuals } = make(), scene = new THREE.Group(), input = frame({ phase: 'carry' });
        scene.position.set(5, -2, 1); scene.rotation.y = .6;
        scene.add(visuals.group);
        visuals.update(input);
        const snapshot = visuals.snapshot();
        expect(snapshot.position[0]).toBeCloseTo(input.carrier.x, 6);
        expect(snapshot.position[1]).toBeCloseTo(input.carrier.y, 6);
        expect(snapshot.position[2]).toBeCloseTo(input.carrier.z, 6);
        for (const item of snapshot.meshes) {
            const actual = visuals.group.getObjectByName(item.name)!;
            expect(item.position).toEqual(actual.getWorldPosition(new THREE.Vector3()).toArray());
            expect(item.scale).toEqual(actual.getWorldScale(new THREE.Vector3()).toArray());
        }
        scene.visible = false;
        expect(visuals.snapshot().visible).toBe(false);
        expect(visuals.snapshot().meshes.every(mesh => !mesh.visible)).toBe(true);
    });

    it('clears all props on cancellation and can start again without leaving the water payoff', () => {
        const { visuals } = make();
        visuals.update(frame({ kind: 'bubble', phase: 'enjoy', progress: .7 }));
        expect(visuals.snapshot().visible).toBe(true);
        visuals.update();
        expect(visuals.snapshot()).toMatchObject({ kind: null, phase: null, owner: 'none', visible: false, position: [0, 0, 0] });
        visuals.update(frame({ kind: 'star', phase: 'carry' }));
        expect(visuals.snapshot().meshes.filter(mesh => mesh.visible).every(mesh => mesh.name.startsWith('shared-star'))).toBe(true);
    });

    it('keeps visible silhouettes large enough in world units and all geometry bounds finite', () => {
        const { visuals } = make();
        for (const kind of ['flower', 'star', 'bubble'] as const) {
            const prop = visuals.group.getObjectByName(`shared-${kind}`)!;
            const bounds = new THREE.Box3().setFromObject(prop), size = bounds.getSize(new THREE.Vector3());
            expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
            expect(size.x).toBeGreaterThan(.4);
            expect(size.y).toBeGreaterThan(.4);
            expect(Math.max(size.x, size.y, size.z)).toBeLessThan(.8);
        }
        for (const progress of [NaN, Infinity, -1, 2]) {
            visuals.update(frame({ progress }));
            expect(visuals.snapshot().position.every(Number.isFinite)).toBe(true);
        }
        visuals.update(frame({ carrier: new THREE.Vector3(NaN, 1, 1) }));
        expect(visuals.snapshot().visible).toBe(false);
    });

    it('reuses geometry and palette while drawing and disposes only its own resources once', () => {
        const { visuals, materials } = make();
        const geometries = new Set<THREE.BufferGeometry>(), allMaterials = new Set<THREE.Material>();
        visuals.group.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) allMaterials.add(material);
        });
        const idsBefore = [...geometries].map(geometry => geometry.uuid);
        const createMaterial = vi.spyOn(materials, 'surface');
        const input = frame();
        for (let i = 0; i < 500; i++) {
            input.kind = (['flower', 'star', 'bubble'] as const)[i % 3];
            input.phase = (['gather', 'carry', 'share', 'enjoy', 'settled'] as const)[i % 5];
            input.progress = (i % 101) / 100;
            visuals.update(input);
        }
        expect(createMaterial).not.toHaveBeenCalled();
        const idsAfter = new Set<string>();
        visuals.group.traverse(object => { if (object instanceof THREE.Mesh) idsAfter.add(object.geometry.uuid); });
        expect([...idsAfter]).toEqual(idsBefore);
        const disposedGeometry = new Map<THREE.BufferGeometry, number>(), disposedMaterial = new Map<THREE.Material, number>();
        for (const geometry of geometries) { disposedGeometry.set(geometry, 0); geometry.addEventListener('dispose', () => disposedGeometry.set(geometry, disposedGeometry.get(geometry)! + 1)); }
        for (const material of allMaterials) { disposedMaterial.set(material, 0); material.addEventListener('dispose', () => disposedMaterial.set(material, disposedMaterial.get(material)! + 1)); }
        visuals.dispose(); visuals.dispose(); visuals.update(input);
        expect([...disposedGeometry.values()].every(count => count === 1)).toBe(true);
        for (const [material, count] of disposedMaterial) expect(count).toBe(material.userData.islandOwned ? 1 : 0);
        expect(visuals.snapshot().visible).toBe(false);
        expect(visuals.group.children).toHaveLength(0);
    });
});
