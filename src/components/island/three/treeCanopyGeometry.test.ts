import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { islandAppearanceStyleId } from '../../../domain/island/appearance';
import { IslandPartMaterials } from './appearanceParts';
import { organicEllipsoidGeometry, type Size3 } from './geometry';
import { disposeGeometry, IslandMaterials } from './primitives';
import { applyTreeGrowth, applyTreeLife, getTreeLightAnchor, makeStarTree, replaceTreeAppearance } from './scenery';
import { treeCanopyGeometry } from './treeCanopyGeometry';

const clumps: Size3[] = [[.85, .7, .78], [.88, .72, .76], [.95, .79, .83], [.82, .72, .78], [.94, .65, .78], [.87, .73, .74]];
const pointKey = (point: THREE.Vector3) => point.toArray().map(value => Math.round(value * 1e6)).join(':');
const meshes = (group: THREE.Object3D) => {
    const result: THREE.Mesh[] = [];
    group.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); });
    return result;
};

describe('sculpted moon-garden canopy', () => {
    it.each(clumps.map((size, index) => ({ size, phase: index * .9 })))('carves $phase inside the actual old surface with bounded topology and spherical UVs', ({ size, phase }) => {
        const old = organicEllipsoidGeometry(size, phase), sculpted = treeCanopyGeometry(size, phase);
        const grid = new THREE.SphereGeometry(1, 32, 24), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        try {
            expect(sculpted.index!.count / 3).toBeLessThanOrEqual(1472);
            expect(sculpted.getAttribute('uv').array).toEqual(grid.getAttribute('uv').array);
            const actual = sculpted.getAttribute('position');
            expect(actual.count).toBeLessThanOrEqual(825);
            const oldMesh = new THREE.Mesh(old, material), ray = new THREE.Raycaster();
            const b = new THREE.Vector3(), ratios: number[] = [];
            for (let i = 0; i < actual.count; i++) {
                b.fromBufferAttribute(actual, i);
                // An exact ray along the old duplicated UV seam can miss both
                // faces by floating-point roundoff. Move numerical-zero ray
                // components by 1e-9, below the 1e-6 surface tolerance.
                const direction = b.clone();
                for (const axis of ['x', 'y', 'z'] as const) if (Math.abs(direction[axis]) < 1e-12) direction[axis] = 1e-9;
                ray.set(new THREE.Vector3(), direction.normalize());
                const hit = ray.intersectObject(oldMesh)[0];
                expect(hit, `Old surface exit for vertex ${i}: ${b.toArray()}`).toBeDefined();
                const ratio = b.length() / hit.distance; ratios.push(ratio);
                expect(ratio).toBeGreaterThan(.64);
                expect(ratio).toBeLessThanOrEqual(1 + 1e-6);
            }
            // Actual relief, not one uniformly shrunken ellipsoid.
            expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(.24);
        } finally { old.dispose(); sculpted.dispose(); grid.dispose(); material.dispose(); }
    });

    it('retains one closed outward surface with finite unit normals and a welded lighting seam', () => {
        for (const [index, size] of clumps.entries()) {
            const geometry = treeCanopyGeometry(size, index * .9);
            try {
                const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
                for (const attribute of Object.values(geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
                const welded = new Map<string, THREE.Vector3>();
                const point = new THREE.Vector3(), normal = new THREE.Vector3();
                for (let i = 0; i < positions.count; i++) {
                    point.fromBufferAttribute(positions, i); normal.fromBufferAttribute(normals, i);
                    expect(normal.length()).toBeCloseTo(1, 5);
                    const key = pointKey(point), previous = welded.get(key);
                    if (previous) expect(normal.distanceTo(previous)).toBeLessThan(1e-7);
                    else welded.set(key, normal.clone());
                }
                const edges = new Map<string, { count: number; direction: number }>();
                const vertices = new Set<string>(), indices = geometry.index!;
                const triangle = new THREE.Triangle(), center = new THREE.Vector3();
                for (let i = 0; i < indices.count; i += 3) {
                    const points = [triangle.a, triangle.b, triangle.c];
                    points.forEach((p, j) => p.fromBufferAttribute(positions, indices.getX(i + j)));
                    expect(triangle.getArea()).toBeGreaterThan(1e-7);
                    expect(triangle.getNormal(normal).dot(triangle.getMidpoint(center))).toBeGreaterThan(0);
                    const keys = points.map(pointKey); keys.forEach(key => vertices.add(key));
                    for (let edge = 0; edge < 3; edge++) {
                        const a = keys[edge], b = keys[(edge + 1) % 3], key = [a, b].sort().join('|');
                        const record = edges.get(key) ?? { count: 0, direction: 0 };
                        record.count++; record.direction += a < b ? 1 : -1; edges.set(key, record);
                    }
                }
                expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(true);
                expect(vertices.size - edges.size + indices.count / 3).toBe(2);
            } finally { geometry.dispose(); }
        }
    });

    it('retains the reviewed upper and side silhouette while restoring lower branch support', () => {
        // Immutable25's actual upper/side vertices, before the supporting-volume
        // fix. Keep this independent of the implementation's lobe formula.
        const before = [
            '6353ebf4902845dc91eed7b40e9661a079a4348b7498873bd11963104fd4d930',
            'ae8aab1b63d405f61e05fd0b5d18f9ceb89c5a8cdd83047523d79eeb95219479',
            '654c0c7d6207c2616bc6256b769d3199f2fee5aa62ca578d3164e50c28f46361',
            'ee0496a6a1db9d0b6f0e9845aba612d3c94b4d7563696765fd1d1d9aba924043',
            '785e2e571a828e3dcb82395ef4db312b9f90b42814422006e92f01b8fdc3d0f1',
            '6ca54933b7712a3a4346bfb55b90fb0e52bba0bdd875420593229b877b09e5e3',
        ];
        for (const [index, size] of clumps.entries()) {
            const geometry = treeCanopyGeometry(size, index * .9);
            try {
                const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), upper: number[] = [];
                for (let i = 0; i < positions.count; i++) if (uv.getY(i) >= .45) upper.push(positions.getX(i), positions.getY(i), positions.getZ(i));
                expect(createHash('sha256').update(JSON.stringify(upper)).digest('hex')).toBe(before[index]);
            } finally { geometry.dispose(); }
        }
    });

    it('preserves real branch-cap contact at every growth scale', () => {
        const materials = new IslandPartMaterials(islandAppearanceStyleId('moon-garden', 'tree', 'legacy-v1'));
        const tree = makeStarTree(materials), crown = tree.getObjectByName('tree-canopy')!;
        // Prism uses the unchanged six authored organic clumps. Paint does not
        // affect this comparison of the former and current actual closed meshes.
        const oldMaterials = new IslandMaterials('prism'), oldTree = makeStarTree(oldMaterials);
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const probes = (group: THREE.Object3D) => meshes(group).map(mesh => {
            const probe = new THREE.Mesh(mesh.geometry, material); probe.matrixAutoUpdate = false;
            return { mesh, probe };
        });
        const surfaces = probes(crown), oldSurfaces = probes(oldTree.getObjectByName('tree-canopy')!);
        // Actual vertices on each final closed cap, including its center. A
        // carved valley may expose the center while the solid cap stays joined.
        const tips = [[.01, 2.55, -.03, .08], [-.86, 2.66, .06, .045], [.95, 2.67, -.08, .045], [-.17, 2.83, -.48, .04]];
        const caps = tips.map(([x, y, z, radius]) => {
            const values = new Map<string, THREE.Vector3>();
            for (const mesh of meshes(tree.getObjectByName('tree-structure')!)) {
                const positions = mesh.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const p = new THREE.Vector3().fromBufferAttribute(positions, i);
                    if (Math.abs(p.y - y) < 1e-6 && Math.hypot(p.x - x, p.z - z) <= radius + 1e-6) values.set(pointKey(p), p);
                }
            }
            expect(values.size).toBeGreaterThan(10);
            return [...values.values()];
        });
        try {
            for (let level = 0; level <= 3; level++) {
                applyTreeGrowth(tree, level); tree.updateMatrixWorld(true);
                applyTreeGrowth(oldTree, level); oldTree.updateMatrixWorld(true);
                [...surfaces, ...oldSurfaces].forEach(({ mesh, probe }) => probe.matrixWorld.copy(mesh.matrixWorld));
                for (const [index, cap] of caps.entries()) {
                    const joined = (objects: typeof surfaces) => cap.some(sample => {
                        const ray = new THREE.Raycaster(tree.localToWorld(sample.clone()), new THREE.Vector3(.31, .89, .337).normalize());
                        return objects.some(({ probe }) => {
                            const crossings = new Set(ray.intersectObject(probe).map(hit => Math.round(hit.distance * 1e8)));
                            return crossings.size % 2 === 1;
                        });
                    });
                    if (joined(oldSurfaces)) expect(joined(surfaces), `Existing cap ${tips[index]} at growth ${level}`).toBe(true);
                }
            }
        } finally { disposeGeometry(tree); disposeGeometry(oldTree); materials.dispose(); oldMaterials.dispose(); material.dispose(); }
    });

    it('keeps rooted growth, light contact and yellow dots through an owned-theme round trip', () => {
        const legacy = new IslandPartMaterials(islandAppearanceStyleId('moon-garden', 'tree', 'legacy-v1'));
        const starry = new IslandPartMaterials(islandAppearanceStyleId('starry', 'tree'));
        const current = new IslandPartMaterials(islandAppearanceStyleId('moon-garden', 'tree'));
        const tree = makeStarTree(legacy), crown = tree.getObjectByName('tree-canopy')!, structure = tree.getObjectByName('tree-structure')!;
        tree.updateMatrixWorld(true);
        const rootPose = tree.matrixWorld.clone(), structurePose = structure.matrixWorld.clone(), anchor = getTreeLightAnchor(tree);
        const originalPositions = meshes(crown).map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
        const yellow = legacy.surface('#86b557', .91), oldGeometry = meshes(crown).map(mesh => mesh.geometry);
        const retired = oldGeometry.map(geometry => { const count = { value: 0 }; geometry.addEventListener('dispose', () => count.value++); return count; });
        const widths: number[] = [];
        try {
            expect(yellow.map).toBeDefined();
            expect(meshes(crown).some(mesh => mesh.material === yellow)).toBe(true);
            for (let level = 0; level <= 3; level++) {
                applyTreeGrowth(tree, level); tree.updateMatrixWorld(true);
                widths.push(new THREE.Box3().setFromObject(crown, true).getSize(new THREE.Vector3()).x);
                expect(tree.matrixWorld).toEqual(rootPose); expect(structure.matrixWorld).toEqual(structurePose);
                expect(tree.getObjectByName('tree-canopy')).toBe(crown);
                expect(getTreeLightAnchor(tree)).toEqual(anchor);
            }
            expect(widths.every((width, i) => !i || width > widths[i - 1])).toBe(true);
            const grownScale = crown.scale.clone();
            replaceTreeAppearance(tree, starry);
            expect(retired.every(count => count.value === 1)).toBe(true);
            replaceTreeAppearance(tree, current); applyTreeLife(tree, .6); tree.updateMatrixWorld(true);
            expect(tree.getObjectByName('tree-canopy')).toBe(crown);
            expect(tree.getObjectByName('tree-structure')).toBe(structure);
            expect(crown.scale).toEqual(grownScale); expect(applyTreeGrowth(tree, 3)).toBe(false);
            expect(tree.matrixWorld).toEqual(rootPose); expect(structure.matrixWorld).toEqual(structurePose);
            expect(getTreeLightAnchor(tree)).toEqual(anchor);
            expect(meshes(crown).map(mesh => Array.from(mesh.geometry.getAttribute('position').array))).toEqual(originalPositions);
            expect(meshes(crown).some(mesh => mesh.material === current.surface('#86b557', .91))).toBe(true);
            expect(current.surface('#86b557', .91).map!.image.data).toEqual(yellow.map!.image.data);
        } finally { disposeGeometry(tree); legacy.dispose(); starry.dispose(); current.dispose(); }
    });
});
