import * as THREE from 'three';
import type { IslandStageState } from './types';

export const HOME_MIN_ZOOM = .75;
export const HOME_MAX_ZOOM = 2.5;
export type HomeCameraAction = 'left' | 'right' | 'up' | 'down' | 'turn-left' | 'turn-right' | 'in' | 'out' | 'reset';
export interface HomeCameraView {
    manual: boolean; zoom: number; azimuth: number; elevation: number; distance: number; fov: number;
    target: { x: number; y: number; z: number };
}
export const initialHomeCameraView = (): HomeCameraView => ({ manual: false, zoom: 1, azimuth: 0, elevation: .8, distance: 2.8, fov: 60, target: { x: .7, y: .75, z: 2.65 } });
export function canControlHomeCamera(state?: IslandStageState) {
    return Boolean(state?.learningKeepsakes?.closeOverview && !state.learningKeepsakes.selectedId && !state.learningKeepsakes.decorating
        && !state.learning && !state.preview && !state.workshop?.active && !state.photographing);
}
const clamp = THREE.MathUtils.clamp;
interface Point { x: number; y: number }
interface Pointer extends Point { start: Point; moved: boolean }

/** Transient indoor view only. Its camera stays inside the room; gestures never write game state. */
export class HomeCameraControls {
    view = initialHomeCameraView();
    private pointers = new Map<number, Pointer>();
    constructor(private readonly changed: (view: HomeCameraView) => void = () => {}) {}

    /** Freeze the currently rendered automatic fit only when the child takes control. */
    prepare(camera: THREE.PerspectiveCamera, room: THREE.Object3D) {
        if (this.view.manual || this.pointers.size) return;
        room.updateWorldMatrix(true, false);
        const position = room.worldToLocal(camera.position.clone());
        const direction = camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(room.getWorldQuaternion(new THREE.Quaternion()).invert());
        const target = position.clone().addScaledVector(direction, 2.8);
        this.view = { manual: false, zoom: 1, distance: 2.8, fov: camera.fov,
            azimuth: Math.atan2(-direction.x, -direction.z), elevation: Math.asin(clamp(-direction.y, -1, 1)),
            target: { x: target.x, y: target.y, z: target.z } };
    }
    reset() { this.cancel(); this.view = initialHomeCameraView(); this.changed(this.view); }
    cancel() { this.pointers.clear(); }
    hasPointer(id: number) { return this.pointers.has(id); }
    private commit(target = this.view.target, zoom = this.view.zoom, azimuth = this.view.azimuth) {
        if (![target.x, target.y, target.z, zoom, azimuth].every(Number.isFinite)) return;
        this.view = { ...this.view, manual: true, zoom: clamp(zoom, HOME_MIN_ZOOM, HOME_MAX_ZOOM),
            azimuth: Math.atan2(Math.sin(azimuth), Math.cos(azimuth)),
            target: { x: clamp(target.x, -2.6, 2.6), y: clamp(target.y, .35, 2.6), z: clamp(target.z, .45, 3.9) } };
        this.changed(this.view);
    }
    private pan(dx: number, dy: number, height: number, zoom = this.view.zoom, turn = 0) {
        if (!Number.isFinite(height) || height <= 0) return;
        const { azimuth, elevation, target, distance, fov } = this.view;
        const unit = 2 * distance * Math.tan(fov * Math.PI / 360) / height / this.view.zoom;
        const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
        const up = new THREE.Vector3(-Math.sin(azimuth) * Math.sin(elevation), Math.cos(elevation), -Math.cos(azimuth) * Math.sin(elevation));
        const next = new THREE.Vector3(target.x, target.y, target.z).addScaledVector(right, -dx * unit).addScaledVector(up, dy * unit);
        this.commit(next, zoom, azimuth + turn);
    }
    action(action: HomeCameraAction) {
        this.cancel();
        if (action === 'reset') this.reset();
        else if (action === 'in' || action === 'out') this.commit(undefined, this.view.zoom * (action === 'in' ? 1.2 : 1 / 1.2));
        else if (action === 'turn-left' || action === 'turn-right') this.commit(undefined, undefined, this.view.azimuth + (action === 'turn-left' ? -1 : 1) * Math.PI / 9);
        else this.pan(action === 'left' ? 50 : action === 'right' ? -50 : 0, action === 'up' ? 50 : action === 'down' ? -50 : 0, 500);
    }
    wheel(delta: number) {
        if (!Number.isFinite(delta) || delta === 0) return false;
        const zoom = clamp(this.view.zoom * Math.exp(-clamp(delta, -160, 160) * .003), HOME_MIN_ZOOM, HOME_MAX_ZOOM);
        if (zoom === this.view.zoom) return false;
        this.commit(undefined, zoom); return true;
    }
    down(id: number, point: Point) {
        this.pointers.set(id, { ...point, start: { ...point }, moved: false });
        if (this.pointers.size > 1) this.pointers.forEach(pointer => { pointer.moved = true; });
    }
    move(id: number, point: Point, height: number) {
        const pointer = this.pointers.get(id); if (!pointer) return;
        const old = { x: pointer.x, y: pointer.y };
        const pair = [...this.pointers.values()].slice(0, 2);
        const midpoint = () => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
        const distance = () => Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
        const angle = () => Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);
        if (pair.length === 2) {
            const before = midpoint(), length = distance(), turn = angle();
            pointer.x = point.x; pointer.y = point.y;
            const after = midpoint(), stable = length > 12 && distance() > 12;
            this.pan(after.x - before.x, after.y - before.y, height,
                stable ? this.view.zoom * distance() / length : this.view.zoom, stable ? Math.atan2(Math.sin(angle() - turn), Math.cos(angle() - turn)) : 0);
        } else {
            pointer.x = point.x; pointer.y = point.y;
            if (!pointer.moved && Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) < 8) return;
            const from = pointer.moved ? old : pointer.start; pointer.moved = true;
            this.pan(point.x - from.x, point.y - from.y, height);
        }
    }
    up(id: number, point: Point) {
        const pointer = this.pointers.get(id); this.pointers.delete(id);
        return Boolean(pointer && !pointer.moved && Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) < 8);
    }
    apply(camera: THREE.PerspectiveCamera, room: THREE.Object3D, aspect: number) {
        if (!this.view.manual || !Number.isFinite(aspect) || aspect <= 0) return false;
        const { target, azimuth, elevation, distance, fov, zoom } = this.view;
        const focus = new THREE.Vector3(target.x, target.y, target.z);
        const horizontal = distance * Math.cos(elevation);
        const eye = focus.clone().add(new THREE.Vector3(Math.sin(azimuth) * horizontal, distance * Math.sin(elevation), Math.cos(azimuth) * horizontal));
        eye.clamp(new THREE.Vector3(-3.2, .3, -.15), new THREE.Vector3(3.2, 3.5, 4.62));
        room.updateWorldMatrix(true, false);
        camera.position.copy(room.localToWorld(eye));
        camera.up.set(0, 1, 0).applyQuaternion(room.getWorldQuaternion(new THREE.Quaternion()));
        camera.lookAt(room.localToWorld(focus)); camera.fov = fov; camera.zoom = zoom; camera.aspect = aspect;
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); return true;
    }
}
