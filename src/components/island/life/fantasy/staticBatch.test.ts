import { expect, it } from 'vitest';
import * as T from 'three';
import { batchStaticGardenItems } from './staticBatch';

it('keeps item bounds and attributes real merged triangle hits to the original item', () => {
    const root = new T.Group(), material = new T.MeshStandardMaterial();
    const containers = [-2, 2].map(x => {
        const item = new T.Group(); item.position.x = x;
        item.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), material)); root.add(item); return item;
    });
    root.updateMatrixWorld(true);
    const boxes = containers.map(item => new T.Box3().setFromObject(item));
    const dispose = batchStaticGardenItems(root, containers); root.updateMatrixWorld(true);
    try {
        expect(root.children.filter(child => child.name === 'garden-static-items')).toHaveLength(1);
        containers.forEach((item, index) => {
            expect(new T.Box3().setFromObject(item)).toEqual(boxes[index]);
            const ray = new T.Raycaster(new T.Vector3(item.position.x, 0, 4), new T.Vector3(0, 0, -1));
            const hits = ray.intersectObject(root, true);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits.every(hit => hit.object.parent === item)).toBe(true);
            expect(hits[0].distance).toBeCloseTo(3.5);
        });
        expect(new T.Raycaster(new T.Vector3(0, 0, 4), new T.Vector3(0, 0, -1)).intersectObject(root, true)).toHaveLength(0);
    } finally { dispose(); }
});

it('keeps named animated contact pieces and translucent items outside static batches', () => {
    const root = new T.Group(), m = new T.MeshStandardMaterial(), containers = [new T.Group(), new T.Group()];
    for (const item of containers) {
        const moving = new T.Mesh(new T.BoxGeometry(), m); moving.name = 'seat'; item.add(moving);
        item.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ transparent: true, opacity: .5 })));
        root.add(item);
    }
    const dispose = batchStaticGardenItems(root, containers);
    expect(root.children).toEqual(containers);
    expect(containers.every(item => item.children.every(child => child.layers.mask === 1))).toBe(true);
    dispose();
});
