import { expect, it } from 'vitest';
import * as T from 'three';
import { GardenGeometry } from './geometry';
import { batchStaticGardenItems } from './staticBatch';

function expanded(geometry: T.BufferGeometry) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const attributes = Object.fromEntries(Object.entries(flat.attributes).map(([name, attr]) => [name, Array.from(attr.array)]));
    flat.dispose(); return attributes;
}
function bytes(geometry: T.BufferGeometry) {
    return (geometry.index?.array.byteLength ?? 0) + Object.values(geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
}

it('preserves every ordered vertex attribute across indexed and non-indexed garden parts', () => {
    const garden = new GardenGeometry(), parent = garden.root;
    const material = garden.paint('#786345', .7);
    garden.mesh(new T.SphereGeometry(.4, 16, 12), material, [-1, 0, 0]);
    garden.mesh(new T.BoxGeometry(.5, .7, .9).toNonIndexed(), material, [1, 0, 0]);
    const original = parent.children as T.Mesh[];
    const expected: Record<string, number[]> = {};
    for (const mesh of original) {
        mesh.updateMatrix();
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        for (const [name, values] of Object.entries(expanded(geometry))) (expected[name] ??= []).push(...values);
        geometry.dispose();
    }
    const flatBytes = Object.values(expected).reduce((sum, values) => sum + values.length * 4, 0);
    garden.batch();
    const merged = parent.children[0] as T.Mesh;
    try {
        expect(parent.children).toHaveLength(1);
        expect(merged.geometry.index).not.toBeNull();
        expect(expanded(merged.geometry)).toEqual(expected);
        expect(bytes(merged.geometry)).toBeLessThan(flatBytes / 2);
    } finally { merged.geometry.dispose(); garden.dispose(); }
});

it('retains distinct vertex colors and normal/UV seams when combining painted parts', () => {
    const garden = new GardenGeometry();
    const colors = ['#a12645', '#47b5cb'];
    for (const [i, color] of colors.entries()) garden.mesh(new T.BoxGeometry(), garden.paint(color), [i * 2, 0, 0]);
    garden.batch();
    const mesh = garden.root.children[0] as T.Mesh, flat = mesh.geometry.toNonIndexed();
    try {
        expect(mesh.geometry.attributes.position.count).toBe(48);
        expect(mesh.geometry.index!.count).toBe(72);
        for (let i = 0; i < 72; i++) {
            const expected = new T.Color(colors[Math.floor(i / 36)]);
            expect(flat.attributes.color.getX(i)).toBeCloseTo(expected.r);
            expect(flat.attributes.color.getY(i)).toBeCloseTo(expected.g);
            expect(flat.attributes.color.getZ(i)).toBeCloseTo(expected.b);
        }
    } finally { flat.dispose(); mesh.geometry.dispose(); garden.dispose(); }
});

it('retains indices above 65535, original item hits and geometry disposal', () => {
    const root = new T.Group(), material = new T.MeshStandardMaterial();
    const items = [-2, 2].map(x => {
        const item = new T.Group(); item.position.x = x;
        item.add(new T.Mesh(new T.SphereGeometry(.5, 256, 128), material));
        root.add(item); return item;
    });
    const dispose = batchStaticGardenItems(root, items);
    root.updateMatrixWorld(true);
    const merged = root.getObjectByName('garden-static-items') as T.Mesh;
    let disposed = 0; merged.geometry.addEventListener('dispose', () => { disposed++; });
    try {
        expect(merged.geometry.index!.array).toBeInstanceOf(Uint32Array);
        expect(Math.max(...merged.geometry.index!.array.slice(-1000))).toBeGreaterThan(65535);
        const ray = new T.Raycaster(new T.Vector3(2, .01, 4), new T.Vector3(0, 0, -1));
        const actual: T.Intersection[] = [];
        merged.raycast(ray, actual);
        expect(actual.length).toBeGreaterThan(0);
        expect(actual.every(hit => hit.object.parent === items[1])).toBe(true);
        expect(actual[0].distance).toBeCloseTo(3.5, 2);
    } finally { dispose(); }
    expect(disposed).toBe(1);
});
