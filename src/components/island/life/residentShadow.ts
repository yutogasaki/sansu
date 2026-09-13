import * as T from 'three';
export const SHADOW_MAGIC_MS = 4000;
/** A separate ground silhouette of the existing rig. Never change its geometry,
 * materials or pose. Only replace its cast shadow while this view owns the copy. */
export function buildResidentShadow(actor: T.Object3D, lightDirection = new T.Vector3(-3, 8, 4), groundY = .09) {
    if (Math.abs(lightDirection.y) < .001) throw new Error('Shadow light must reach the ground');
    const root = new T.Group(); root.name = 'life-resident-shadow';
    const clone = actor.clone(true), sources: T.Object3D[] = [], copies: T.Object3D[] = [];
    actor.traverse(o => sources.push(o)); clone.traverse(o => copies.push(o));
    const material = new T.MeshBasicMaterial({ color: '#365f63', side: T.DoubleSide, depthWrite: true });
    const cast = new Map<T.Mesh, boolean>();
    const meshes: { source: T.Mesh; copy: T.Mesh; output: T.Mesh; instance?: number }[] = [];
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i]; if (!(source instanceof T.Mesh)) continue;
        cast.set(source, source.castShadow); source.castShadow = false;
        const count = source instanceof T.InstancedMesh ? source.count : 1;
        for (let instance = 0; instance < count; instance++) {
            const output = new T.Mesh(source.geometry.clone(), material); output.name = `shadow-${source.name || i}-${instance}`;
            root.add(output); meshes.push({ source, copy: copies[i] as T.Mesh, output, ...(source instanceof T.InstancedMesh ? { instance } : {}) });
        }
    }
    let shoulder = clone.getObjectByName('shoulder-right');
    const heroArm = shoulder ? undefined : copies.find(o => o.position.x === .27 && o.position.y === .46);
    if (heroArm?.parent) {
        shoulder = new T.Group(); shoulder.position.set(.27, .60, heroArm.position.z);
        heroArm.parent.add(shoulder); shoulder.add(heroArm);
    }
    const vertex = new T.Vector3(), matrix = new T.Matrix4(), instanceMatrix = new T.Matrix4();
    const projection = new T.Matrix4().set(1,-lightDirection.x/lightDirection.y,0,groundY*lightDirection.x/lightDirection.y,
        0,0,0,groundY,0,-lightDirection.z/lightDirection.y,1,groundY*lightDirection.z/lightDirection.y,0,0,0,1);
    const gesture = meshes.filter(({ copy }) => {
        for (let o: T.Object3D | null = copy; o; o = o.parent) if (o === shoulder) return true;
        return false;
    }).map(({ output }) => output);
    let disposed = false;
    return { root, gesture, update(elapsed = -1, reduced = false) {
        if (disposed) return;
        actor.updateMatrixWorld(true);
        for (let i = 0; i < sources.length; i++) {
            copies[i].position.copy(sources[i].position); copies[i].quaternion.copy(sources[i].quaternion); copies[i].scale.copy(sources[i].scale);
            copies[i].visible = sources[i].visible; copies[i].matrixAutoUpdate = true;
        }
        clone.matrixAutoUpdate = false; clone.matrix.copy(actor.matrixWorld);
        if (heroArm && shoulder) { heroArm.position.sub(shoulder.position); shoulder.rotation.set(0,0,0); }
        const active = elapsed >= 0 && elapsed < SHADOW_MAGIC_MS;
        if (shoulder && active) {
            const gain = reduced ? 1 : Math.min(1, elapsed/350, (SHADOW_MAGIC_MS-elapsed)/500);
            shoulder.rotation.z += gain * (1.9 + (reduced ? 0 : Math.sin(elapsed/145)*.18));
        }
        clone.updateMatrixWorld(true);
        for (const { source, copy, output, instance } of meshes) {
            let visible = true;
            for (let o: T.Object3D | null = copy; o; o = o.parent) if (!o.visible) visible = false;
            const mats = Array.isArray(source.material) ? source.material : [source.material];
            output.visible = visible && mats.some(m => m.visible && (!m.transparent || m.opacity > .01));
            matrix.copy(copy.matrixWorld);
            if (instance !== undefined) { (source as T.InstancedMesh).getMatrixAt(instance, instanceMatrix); matrix.multiply(instanceMatrix); }
            matrix.premultiply(projection);
            const from = source.geometry.getAttribute('position'), to = output.geometry.getAttribute('position');
            for (let i = 0; i < from.count; i++) { vertex.fromBufferAttribute(from,i).applyMatrix4(matrix); to.setXYZ(i,vertex.x,vertex.y,vertex.z); }
            to.needsUpdate = true; output.geometry.computeBoundingBox(); output.geometry.computeBoundingSphere();
        }
        root.updateMatrixWorld(true);
    }, dispose() {
        if (disposed) return; disposed = true;
        for (const [source, original] of cast) source.castShadow = original;
        for (const { output } of meshes) output.geometry.dispose(); material.dispose(); root.removeFromParent();
    } };
}
