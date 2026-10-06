import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { partitionStaticRaycast } from './staticRaycast';

function fixture(indexed = false) {
    const parts = Array.from({ length: 30 }, (_, i) => (() => {
        const geometry = new T.SphereGeometry(.4, 12, 8).translate((i % 10) - 4.5, Math.floor(i / 10) - 1, i % 2);
        return indexed ? geometry : geometry.toNonIndexed();
    })());
    const geometry = mergeGeometries(parts, false)!;
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ side: T.DoubleSide }));
    partitionStaticRaycast(mesh, parts.map(part => ({ count: part.index?.count ?? part.attributes.position.count })));
    parts.forEach(part => part.dispose());
    return mesh;
}

it.each([false, true])('matches every triangle hit after transforms and near/far clipping (indexed=%s)', indexed => {
    const mesh = fixture(indexed), parent = new T.Group(); parent.add(mesh);
    parent.position.set(1, 2, -3); parent.rotation.set(.3, -.2, .1); parent.scale.set(1.3, .8, 1.1);
    parent.updateMatrixWorld(true);
    let hits = 0, misses = 0;
    try {
        for (const [near, far] of [[0, Infinity], [7, 8], [0, 2]]) {
            for (let x = -5; x <= 5; x += .25) for (let y = -2; y <= 2; y += .5) {
                const origin = new T.Vector3(x, y, 8).applyMatrix4(mesh.matrixWorld);
                const direction = new T.Vector3(0, 0, -1).transformDirection(mesh.matrixWorld);
                const ray = new T.Raycaster(origin, direction, near, far);
                const expected: T.Intersection[] = [], actual: T.Intersection[] = [];
                T.Mesh.prototype.raycast.call(mesh, ray, expected); mesh.raycast(ray, actual);
                expect(actual).toEqual(expected);
                if (actual.length) hits++; else misses++;
            }
        }
        expect(hits).toBeGreaterThan(50); expect(misses).toBeGreaterThan(50);
    } finally { mesh.geometry.dispose(); }
});

it('rejects separated parts before triangle tests without adding draw objects or attribute copies', () => {
    const mesh = fixture(); mesh.updateMatrixWorld(true);
    const ray = new T.Raycaster(new T.Vector3(-4.5, -1, 8), new T.Vector3(0, 0, -1));
    const intersect = vi.spyOn(T.Ray.prototype, 'intersectTriangle');
    try {
        const expected: T.Intersection[] = [], actual: T.Intersection[] = [];
        T.Mesh.prototype.raycast.call(mesh, ray, expected); const baseline = intersect.mock.calls.length;
        intersect.mockClear(); mesh.raycast(ray, actual);
        expect(actual).toEqual(expected); expect(actual.length).toBeGreaterThan(0);
        expect(intersect.mock.calls.length).toBeLessThan(baseline / 10);
        expect(mesh.children).toHaveLength(0);
    } finally { intersect.mockRestore(); mesh.geometry.dispose(); }
});
