import * as T from 'three';
import type { Cell } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';

/** Only procedural ground details/decks use this bake. Owned native homes, trees,
 * resident cloth and shared kit buffers stay rigid and immutable. */
export function curveGroundGeometry(root: T.Object3D, layout: SceneLayout, origin?: Cell) {
    if (!layout.curved) return;
    root.updateMatrixWorld(true);
    const inverseRoot = root.matrixWorld.clone().invert(), local = new T.Vector3();
    const meshes: T.Mesh[] = []; root.traverse(o => { if (o instanceof T.Mesh) meshes.push(o); });
    for (const mesh of meshes) {
        const matrix = inverseRoot.clone().multiply(mesh.matrixWorld), inverseMesh = matrix.clone().invert();
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            local.fromBufferAttribute(positions, i).applyMatrix4(matrix);
            const cell = origin ? { x: origin.x + local.x, z: origin.z + local.z } : { x: local.x + layout.center, z: local.z + 2 };
            const p = layout.projected(cell), base = origin ? layout.projected(origin) : { x: layout.center, z: 2 };
            local.x = p.x - base.x; local.z = p.z - base.z;
            local.applyMatrix4(inverseMesh); positions.setXYZ(i, local.x, local.y, local.z);
        }
        positions.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    }
}
