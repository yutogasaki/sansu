import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { newIsland } from '../../../domain/growingIsland/island';
import { foldedHomeRoofGeometry, roundedHomeWallGeometry } from './homeSurfaceGeometry';

function inspectClosed(geometry: T.BufferGeometry, components: number) {
    const positions = geometry.getAttribute('position'), index = geometry.getIndex()!;
    const edges = new Map<string, { count: number; direction: number }>();
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    let volume = 0;
    for (let i = 0; i < index.count; i += 3) {
        const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        for (let j = 0; j < 3; j++) {
            const from = face[j], to = face[(j + 1) % 3], key = `${Math.min(from, to)}:${Math.max(from, to)}`;
            const edge = edges.get(key) ?? { count: 0, direction: 0 };
            edge.count++; edge.direction += from < to ? 1 : -1; edges.set(key, edge);
        }
        a.fromBufferAttribute(positions, face[0]); b.fromBufferAttribute(positions, face[1]); c.fromBufferAttribute(positions, face[2]);
        expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-14);
        volume += a.dot(b.cross(c)) / 6;
    }
    expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(true);
    expect(positions.count - edges.size + index.count / 3).toBe(2 * components);
    expect(volume).toBeGreaterThan(0);
    for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.getAttribute(name);
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(a.fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5);
    return volume;
}

function mesh(geometry: T.BufferGeometry) {
    const material = new T.MeshBasicMaterial(), model = new T.Mesh(geometry, material);
    model.updateMatrixWorld(true);
    return { model, dispose: () => { geometry.dispose(); material.dispose(); } };
}

describe('native05 owned home surfaces', () => {
    it('makes a closed vertical oval with exact grounding, width and depth', () => {
        const geometry = roundedHomeWallGeometry(.7, .52, .60);
        const bounds = geometry.boundingBox!, size = bounds.getSize(new T.Vector3());
        expect(bounds.min.y).toBe(0); expect(bounds.max.y).toBeCloseTo(.52);
        expect(size.x).toBeCloseTo(.7); expect(size.z).toBeCloseTo(.6);
        const volume = inspectClosed(geometry, 1);
        expect(volume).toBeGreaterThan(.16); expect(volume).toBeLessThan(.18);
        const { model, dispose } = mesh(geometry), ray = new T.Raycaster();
        for (const x of [0, .12, -.12]) {
            ray.set(new T.Vector3(x, .26, 1), new T.Vector3(0, 0, -1));
            const front = ray.intersectObject(model)[0];
            expect(front).toBeDefined();
            expect(front.point.z).toBeCloseTo(.3 * Math.sqrt(1 - (x / .35) ** 2), 2);
            expect(front.face!.normal.z).toBeGreaterThan(.8);
        }
        // Wall fixtures positioned at the current +Z doorway remain in front
        // of the oval, rather than being buried by a rotated new home body.
        ray.set(new T.Vector3(0, .16, .36), new T.Vector3(0, 0, -1));
        expect(ray.intersectObject(model)[0].distance).toBeCloseTo(.06);
        dispose();
    });

    it('makes two sealed thick leaves with broad, nearly level middle roof sections', () => {
        const width = .7, geometry = foldedHomeRoofGeometry(width), box = geometry.boundingBox!;
        expect(box.min.y).toBe(0); expect(box.max.y).toBeGreaterThan(width * .48); expect(box.max.y).toBeLessThan(width * .5);
        expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(width * .7);
        expect(box.getSize(new T.Vector3()).x).toBeGreaterThan(width * 1.25);
        expect(box.min.z).toBeCloseTo(-width * .6); expect(box.max.z).toBeCloseTo(width * .6);
        const volume = inspectClosed(geometry, 2);
        expect(volume).toBeGreaterThan(.010); expect(volume).toBeLessThan(.035);
        const { model, dispose } = mesh(geometry), ray = new T.Raycaster();
        const heights: number[] = [];
        for (const z of [-.14 * width, 0, .14 * width]) {
            ray.set(new T.Vector3(0, 1, z), new T.Vector3(0, -1, 0));
            const top = ray.intersectObject(model)[0];
            ray.set(new T.Vector3(0, -1, z), new T.Vector3(0, 1, 0));
            const bottom = ray.intersectObject(model)[0];
            expect(top).toBeDefined(); expect(bottom).toBeDefined();
            expect(top.point.y - bottom.point.y).toBeGreaterThan(width * .05);
            heights.push(top.point.y);
        }
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(width * .05);
        dispose();
    });

    it('scales uniformly and leaves existing owner, style, clocks and place revisions untouched', () => {
        const state = newIsland('native-home-surfaces', 1000);
        state.plots.push({ id: 'owned-tree-home', kind: 'home', cell: { x: 2, z: 2 }, stage: 4, style: 'tree', roof: 5,
            plantedAt: 0, builtAt: 6, stagedAt: 24, growth: 0, origin: 'seed', paid: 40 });
        for (const [id, x, z] of [['tree-a', 1, 1], ['tree-b', 2, 1], ['tree-c', 3, 1], ['tree-d', 3, 2]] as const) {
            state.landmarks.push({ id, kind: 'sapling', cell: { x, z }, growth: 18, maturedAt: 0 });
        }
        const before = structuredClone(state), places = derivePlaces(state);
        expect(places.length).toBeGreaterThan(0);
        const small = foldedHomeRoofGeometry(.7), large = foldedHomeRoofGeometry(1.4);
        expect(large.boundingBox!.getSize(new T.Vector3())).toEqual(small.boundingBox!.getSize(new T.Vector3()).multiplyScalar(2));
        const wall = roundedHomeWallGeometry(.7, .8);
        small.dispose(); large.dispose(); wall.dispose();
        expect(state).toEqual(before); expect(derivePlaces(state)).toEqual(places);
    });

    it('rejects invalid dimensions before creating geometry', () => {
        for (const invalid of [0, -1, NaN, Infinity]) {
            expect(() => foldedHomeRoofGeometry(invalid)).toThrow(RangeError);
            expect(() => roundedHomeWallGeometry(.7, invalid)).toThrow(RangeError);
            expect(() => roundedHomeWallGeometry(.7, .5, invalid)).toThrow(RangeError);
        }
    });
});
