import * as T from 'three';

export function visibleRelationObject(object: T.Object3D, root: T.Object3D, camera: T.Camera, onScreen: (point: T.Vector3) => boolean, focus?: T.Vector3) {
    for (let parent: T.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    const ray = new T.Raycaster();
    const box = new T.Box3().setFromObject(object);
    const corners = [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => new T.Vector3(x, y, z).project(camera))));
    if (corners.some(p => Math.abs(p.x) > .99 || Math.abs(p.y) > .99 || Math.abs(p.z) > 1)) return false;
    const samples: T.Vector3[] = focus ? [focus] : [];
    if (!focus) object.traverse(part => {
        if (!(part instanceof T.Mesh)) return;
        const center = new T.Box3().setFromObject(part).getCenter(new T.Vector3());
        if (center.y >= box.min.y + (box.max.y - box.min.y) * .3) samples.push(center);
    });
    return samples.some(sample => {
        const p = sample.clone().project(camera);
        if (!onScreen(p)) return false;
        ray.setFromCamera(new T.Vector2(p.x, p.y), camera);
        const hit = ray.intersectObject(root, true).find(hit => {
            for (let parent: T.Object3D | null = hit.object; parent; parent = parent.parent) if (!parent.visible) return false;
            const material = (hit.object as T.Mesh).material;
            return !Array.isArray(material) && material && material.visible && (!material.transparent || material.opacity >= .6);
        });
        for (let current = hit?.object; current; current = current.parent ?? undefined) if (current === object) return true;
        return false;
    });
}
