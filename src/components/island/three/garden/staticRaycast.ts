import * as T from 'three';

/** Raycast the rendered triangles, but reject each authored part's bounds first.
 * Geometry views share the merged attributes and never enter the render scene. */
export function partitionStaticRaycast(mesh: T.Mesh, parts: { count: number; object?: T.Object3D }[]) {
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    let start = 0;
    const point = new T.Vector3();
    const views = parts.map(part => {
        const geometry = new T.BufferGeometry();
        for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) geometry.setAttribute(name, attribute);
        geometry.setIndex(index);
        geometry.setDrawRange(start, part.count);
        const box = new T.Box3();
        for (let i = start; i < start + part.count; i++) box.expandByPoint(point.fromBufferAttribute(position, index ? index.getX(i) : i));
        geometry.boundingBox = box;
        geometry.boundingSphere = box.getBoundingSphere(new T.Sphere());
        start += part.count;
        return { probe: new T.Mesh(geometry, mesh.material), object: part.object ?? mesh };
    });
    mesh.raycast = (ray, hits) => {
        for (const { probe, object } of views) {
            probe.matrixWorld.copy(mesh.matrixWorld);
            probe.material = mesh.material;
            const actual: T.Intersection[] = [];
            probe.raycast(ray, actual);
            for (const hit of actual) { hit.object = object; hits.push(hit); }
        }
    };
    mesh.geometry.addEventListener('dispose', () => views.forEach(({ probe }) => probe.geometry.dispose()));
}
