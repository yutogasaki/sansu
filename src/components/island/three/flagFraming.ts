import * as THREE from 'three';
import type { IslandFlagView } from './personalScenery';

export const ISLAND_FLAG_FRAME_CANDIDATE = 'island-flag-inspection-v1';

export interface IslandFlagFrame {
    candidate: typeof ISLAND_FLAG_FRAME_CANDIDATE;
    flagUuid: string;
    trimUuid: string;
    nameplateUuid: string;
    target: number[];
}

/** A front-facing, fixed identity envelope includes the pole tip, every free
 * emblem, the hanging trim and the actual nameplate. Hidden trim geometry never
 * changes the scale. No model, material or world visibility is changed here. */
export function fitIslandFlagCamera(camera: THREE.OrthographicCamera, view: IslandFlagView, aspect: number): IslandFlagFrame {
    view.root.updateWorldMatrix(true, true);
    const target = view.root.localToWorld(new THREE.Vector3(-.07, 2.1, .45));
    const position = view.root.localToWorld(new THREE.Vector3(-.77, 2.45, 7.45));
    camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld(true);
    const height = Math.max(3.0, 2.35 / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
    return { candidate: ISLAND_FLAG_FRAME_CANDIDATE, flagUuid: view.flag.uuid, trimUuid: view.trim.uuid,
        nameplateUuid: view.nameplate.uuid, target: target.toArray() };
}
