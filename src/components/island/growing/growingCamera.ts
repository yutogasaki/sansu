import * as T from 'three';
import type { SceneLayout } from './sceneLayout';
import { buildPlaceGround } from './placeGround';

export interface CameraView { zoom: number; azimuth: number; pan: { x: number; z: number } }
export const initialView = (): CameraView => ({ zoom: 1, azimuth: 0, pan: { x: 0, z: 0 } });
const BASE = new T.Vector3(4.5, 7.8, 11);
const OMIT = new Set(['life-sea', 'growing-next-boat', 'growing-boat', 'growing-ghost', 'growing-place-preview', 'growing-hint', 'growing-house-selection']);
interface ArtSamples { roots: string; points: T.Vector3[]; projections: Map<number, { minX: number; maxX: number; minY: number; maxY: number }> }
const artSamples = new WeakMap<SceneLayout, ArtSamples>();

/** Samples visible static geometry, including curved leaves and the real shoreline.
 * The sea, boats approaching from afar and placement controls do not shrink the world. */
export function cameraArtPoints(roots: readonly T.Object3D[]): T.Vector3[] {
    const points: T.Vector3[] = [], local = new T.Vector3(), instance = new T.Matrix4(), matrix = new T.Matrix4();
    const visit = (object: T.Object3D) => {
        if (!object.visible || OMIT.has(object.name) || object.userData.placementHitOnly) return;
        if (object instanceof T.Mesh) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (materials.some(material => material.colorWrite && material.opacity >= .5)) {
                const positions = object.geometry.getAttribute('position');
                if (positions) {
                    const count = object instanceof T.InstancedMesh ? object.count : 1;
                    for (let j = 0; j < count; j++) {
                        if (object instanceof T.InstancedMesh) { object.getMatrixAt(j, instance); matrix.multiplyMatrices(object.matrixWorld, instance); }
                        else matrix.copy(object.matrixWorld);
                        for (let i = 0; i < positions.count; i++) points.push(local.fromBufferAttribute(positions, i).applyMatrix4(matrix).clone());
                    }
                }
            }
        }
        for (const child of object.children) visit(child);
    };
    for (const root of roots) { root.updateWorldMatrix(true, true); visit(root); }
    return points;
}

function framingSamples(layout: SceneLayout): ArtSamples {
    const roots = layout.cameraObjects?.() ?? [], signature = roots.map(root => root.uuid).join(':');
    const previous = artSamples.get(layout);
    if (previous && previous.roots === signature) return previous;
    let points = cameraArtPoints(roots);
    if (!points.length) {
        // A layout without a mounted scene (e.g. a preview) can still fit its real
        // irregular bank. It has no invented mature place at an unowned position.
        const ground = buildPlaceGround(layout); points = cameraArtPoints([ground.root]); ground.dispose();
        points.push(layout.pierRoot.clone(), layout.pierEnd.clone(), layout.dock.clone());
    }
    const samples = { roots: signature, points, projections: new Map() }; artSamples.set(layout, samples); return samples;
}

/** Fits the whole island in portrait and landscape; zoom and pan stay within the island. */
export function frameCamera(camera: T.OrthographicCamera, layout: SceneLayout, view: CameraView, aspect: number) {
    const halfWidth = layout.width / 2 + layout.artMargin, shoreDepth = layout.depth / 2 + layout.artMargin;
    const halfHeight = layout.artMargin > 1.1 ? (shoreDepth + 1.15 + layout.maxHeight * .4) * .82 : (layout.depth + 4.2 + layout.maxHeight * .8) / 2 * .82;
    const offset = BASE.clone().applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    let fit = Math.max(halfHeight, halfWidth / aspect);
    const target = new T.Vector3(0, .2, (layout.depth - 5) / 2 + .6);
    const hasOwnedHero = layout.cameraObjects?.().some(root => root.getObjectByName('place-root-room') || root.getObjectByName('place-hollow-tree-home'));
    if (layout.artMargin > 1.1 || hasOwnedHero) {
        const forward = offset.clone().normalize(), right = new T.Vector3(forward.z, 0, -forward.x).normalize();
        const up = new T.Vector3().crossVectors(forward, right);
        const samples = framingSamples(layout), angle = view.azimuth;
        let projected = samples.projections.get(angle);
        if (!projected) {
            projected = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
            for (const point of samples.points) {
                const x = right.dot(point), y = up.dot(point);
                projected.minX = Math.min(projected.minX, x); projected.maxX = Math.max(projected.maxX, x);
                projected.minY = Math.min(projected.minY, y); projected.maxY = Math.max(projected.maxY, y);
            }
            samples.projections.set(angle, projected);
        }
        // Five percent of the viewport remains clear at each outer edge.
        fit = Math.max((projected.maxY - projected.minY) / 2, (projected.maxX - projected.minX) / (2 * Math.max(.01, aspect))) / .90;
        target.addScaledVector(right, (projected.minX + projected.maxX) / 2 - right.dot(target));
        target.addScaledVector(up, (projected.minY + projected.maxY) / 2 - up.dot(target));
    }
    const half = fit / view.zoom;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.far = Math.max(100, (layout.width + layout.depth) * 2);
    const limitX = layout.width / 2, limitZ = layout.depth / 2 + 1;
    view.pan.x = Math.max(-limitX, Math.min(limitX, view.pan.x));
    view.pan.z = Math.max(-limitZ, Math.min(limitZ, view.pan.z));
    target.add(new T.Vector3(view.pan.x, 0, view.pan.z));
    offset.multiplyScalar(Math.max(1, (layout.width + layout.depth) / 30));
    camera.position.copy(target).add(offset); camera.lookAt(target);
    camera.updateProjectionMatrix();
    return target;
}

/** Converts a screen drag into a ground-plane pan that follows the finger. */
export function panFromDrag(camera: T.OrthographicCamera, view: CameraView, dx: number, dy: number, width: number, height: number) {
    const worldPerPixel = (camera.right - camera.left) / width;
    const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    const forward = new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    view.pan.x -= (right.x * dx + forward.x * dy * 1.35) * worldPerPixel;
    view.pan.z -= (right.z * dx + forward.z * dy * 1.35) * worldPerPixel;
    void height;
}
