import * as THREE from 'three';

/** The closed interior occupies the existing cottage footprint in the same world. */
export const ISLAND_HOME_INTERIOR = { position: [-2.6, .18, -2.25], scale: .26 } as const;
interface Frame { position: THREE.Vector3; rotation: THREE.Quaternion; left: number; right: number; top: number; bottom: number }
const frame = (camera: THREE.OrthographicCamera): Frame => ({ position: camera.position.clone(), rotation: camera.quaternion.clone(),
    left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom });

export class IslandHomePresentation {
    private transition?: { from: Frame; to?: Frame; startedAt: number };
    begin(camera: THREE.OrthographicCamera, now: number, reduced: boolean) {
        this.transition = reduced ? undefined : { from: frame(camera), startedAt: now };
    }
    animate(camera: THREE.OrthographicCamera, now: number, reduced: boolean) {
        const transition = this.transition;
        if (!transition) return false;
        if (reduced) { this.transition = undefined; return false; }
        transition.to ??= frame(camera);
        const t = Math.min(1, Math.max(0, (now - transition.startedAt) / 520)), ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(transition.from.position, transition.to.position, ease);
        camera.quaternion.slerpQuaternions(transition.from.rotation, transition.to.rotation, ease);
        for (const key of ['left', 'right', 'top', 'bottom'] as const) camera[key] = THREE.MathUtils.lerp(transition.from[key], transition.to[key], ease);
        camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
        if (t === 1) this.transition = undefined;
        return t < 1;
    }
    cancel() { this.transition = undefined; }
    dispose() { this.cancel(); }
}
