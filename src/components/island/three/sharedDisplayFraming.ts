import * as THREE from 'three';
import { boxCorners } from './sceneFraming';
import { isSharedActivityOccluderMaterial, segmentHitsMesh, type SharedActivityOccluder } from './sharedActivityOcclusion';

export interface SharedDisplayFrameScene {
    /** The specimen itself or each placed work part, rather than the larger tray/table. */
    subjects: readonly (THREE.Object3D | readonly THREE.Object3D[])[];
    /** Live scenery, furniture, residents and displays. Nothing is moved or faded. */
    occluders: readonly THREE.Object3D[];
    /** Optional front-facing view restrictions for an actual resident's tool use. */
    angles?: readonly number[];
}
interface FramingMesh extends SharedActivityOccluder { bounds: THREE.Box3 }
interface Visibility { channels: number[]; samples: number[]; minimum: number; total: number }
interface Selection { angle: number; elevation: number; visibility: Visibility }
interface CachedSelection { subjectKey: string; sceneKey: string; selection: Selection }
const selections = new WeakMap<THREE.Camera, CachedSelection>();
const geometryBounds = new WeakMap<THREE.BufferGeometry, { position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; version: number; bounds: THREE.Box3 }>();
const UP = new THREE.Vector3(0, 1, 0);
const CLEAR = .95;

function shown(object: THREE.Object3D) {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
}
function meshes(roots: readonly THREE.Object3D[]) {
    const found = new Set<THREE.Mesh>();
    for (const root of roots) {
        if (!shown(root)) continue;
        root.updateWorldMatrix(true, true);
        root.traverseVisible(object => {
            if (!(object instanceof THREE.Mesh) || !object.geometry.getAttribute('position')) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (materials.some(isSharedActivityOccluderMaterial)) found.add(object);
        });
    }
    return [...found].map(mesh => {
        const position = mesh.geometry.getAttribute('position');
        const version = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position.version;
        let cached = geometryBounds.get(mesh.geometry);
        if (!cached || cached.position !== position || cached.version !== version) {
            mesh.geometry.computeBoundingBox();
            cached = { position, version, bounds: mesh.geometry.boundingBox!.clone() }; geometryBounds.set(mesh.geometry, cached);
        }
        return { mesh, inverse: mesh.matrixWorld.clone().invert(), bounds: cached.bounds.clone().applyMatrix4(mesh.matrixWorld) };
    });
}
function meshKey(objects: FramingMesh[]) {
    return objects.map(({ mesh }) => {
        const p = mesh.geometry.getAttribute('position');
        const version = p instanceof THREE.InterleavedBufferAttribute ? p.data.version : p.version;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        return [mesh.id, mesh.geometry.id, version, mesh.geometry.index?.version ?? 0,
            ...mesh.matrixWorld.elements.map(value => Math.round(value * 100)),
            ...materials.flatMap(material => [material.uuid, material.visible, material.side, isSharedActivityOccluderMaterial(material)])].join(',');
    }).join(';');
}
function apply(camera: THREE.OrthographicCamera, bounds: THREE.Box3, aspect: number, yaw: number, angle: number, elevation: number) {
    const target = bounds.getCenter(new THREE.Vector3());
    camera.position.copy(target).add(new THREE.Vector3(3, elevation, 6).applyAxisAngle(UP, yaw + angle));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const projected = new THREE.Box3().setFromPoints(boxCorners(bounds).map(point => point.applyMatrix4(camera.matrixWorldInverse)));
    const height = Math.max(2.5, 2 * Math.max(Math.abs(projected.min.y), Math.abs(projected.max.y)) / .86,
        2 * Math.max(Math.abs(projected.min.x), Math.abs(projected.max.x)) / (Math.max(.1, aspect) * .86));
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
}

/** Each ray ends at the frontmost real triangle of that subject, sampled over
 * its projected silhouette. Empty AABB corners and a large visible tray cannot
 * compensate for a hidden specimen or an entirely hidden work part. */
function visibility(camera: THREE.OrthographicCamera, channels: FramingMesh[][], obstacles: FramingMesh[]): Visibility {
    const caster = new THREE.Raycaster(), backward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const screen = new THREE.Vector2(), end = new THREE.Vector3(), intersection = new THREE.Vector3();
    const counts = channels.map(channel => {
        const projected = new THREE.Box3().setFromPoints(channel.flatMap(({ bounds }) => boxCorners(bounds).map(point => point.project(camera))));
        const size = projected.getSize(new THREE.Vector3());
        let samples = 0, visible = 0;
        if (projected.isEmpty()) return { samples, visible };
        for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
            screen.set(projected.min.x + size.x * (x + .5) / 7, projected.min.y + size.y * (y + .5) / 5);
            caster.setFromCamera(screen, camera);
            const hit = caster.intersectObjects(channel.map(value => value.mesh), false).find(hit => {
                const mesh = hit.object as THREE.Mesh;
                const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
                return isSharedActivityOccluderMaterial(material);
            });
            if (!hit) continue;
            samples++;
            // Stop before the actual surface so it does not occlude itself.
            end.copy(hit.point).addScaledVector(backward, .002);
            const distanceSquared = caster.ray.origin.distanceToSquared(end);
            const blocked = obstacles.some(obstacle => {
                if (!obstacle.bounds.containsPoint(caster.ray.origin) && (caster.ray.intersectBox(obstacle.bounds, intersection) === null
                    || caster.ray.origin.distanceToSquared(intersection) > distanceSquared)) return false;
                return segmentHitsMesh(caster.ray.origin, end, obstacle);
            });
            if (!blocked) visible++;
        }
        return { samples, visible };
    });
    const ratios = counts.map(value => value.samples ? value.visible / value.samples : 0);
    const total = counts.reduce((sum, value) => sum + value.samples, 0);
    return { channels: ratios, samples: counts.map(value => value.samples), minimum: ratios.length ? Math.min(...ratios) : 0,
        total: total ? counts.reduce((sum, value) => sum + value.visible, 0) / total : 0 };
}

export function sharedDisplayCameraDiagnostic(camera: THREE.Camera) {
    const selected = selections.get(camera)?.selection;
    return selected && { angle: selected.angle, elevation: selected.elevation, visibility: [...selected.visibility.channels],
        samples: [...selected.visibility.samples], minimumVisibility: selected.visibility.minimum, readable: selected.visibility.minimum >= CLEAR };
}

/** Same live bounds for viewing and photography. Ordinary/job bounds-only
 * callers retain their camera. Explicit display views select from a bounded
 * set of real scene sightlines and keep a clear selection while actors move. */
export function fitSharedDisplayCamera(camera: THREE.OrthographicCamera, bounds: THREE.Box3, aspect: number, yaw = 0,
    scene?: SharedDisplayFrameScene) {
    if (bounds.isEmpty() || !Number.isFinite(aspect) || aspect <= 0
        || !Number.isFinite(yaw) || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) return false;
    if (!scene?.subjects.length) {
        selections.delete(camera); apply(camera, bounds, aspect, yaw, 0, 3.8); return true;
    }
    const channels = scene.subjects.map(subject => meshes(Array.isArray(subject) ? subject : [subject as THREE.Object3D])), obstacles = meshes(scene.occluders);
    const angles = scene.angles?.length ? scene.angles : [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * .75, -Math.PI * .75, Math.PI];
    const subjectKey = [aspect, yaw, ...angles, ...bounds.min.toArray(), ...bounds.max.toArray(), ...channels.map(meshKey)].join('|');
    const sceneKey = meshKey(obstacles), previous = selections.get(camera);
    let best: Selection | undefined;
    if (previous?.subjectKey === subjectKey) {
        apply(camera, bounds, aspect, yaw, previous.selection.angle, previous.selection.elevation);
        if (previous.sceneKey === sceneKey) return true;
        best = { ...previous.selection, visibility: visibility(camera, channels, obstacles) };
        // Small changes at an outline must not produce repeated camera cuts.
        if (best.visibility.minimum >= .85) {
            selections.set(camera, { subjectKey, sceneKey, selection: best }); return true;
        }
    }
    let clear = false;
    for (const elevation of [3.8, 6.5, 9]) {
        for (const angle of angles) {
            apply(camera, bounds, aspect, yaw, angle, elevation);
            const candidate = { angle, elevation, visibility: visibility(camera, channels, obstacles) };
            if (!best || candidate.visibility.minimum > best.visibility.minimum + .001
                || Math.abs(candidate.visibility.minimum - best.visibility.minimum) < .001 && candidate.visibility.total > best.visibility.total + .001) best = candidate;
            if (candidate.visibility.minimum >= CLEAR) { best = candidate; clear = true; break; }
        }
        if (clear) break;
    }
    selections.set(camera, { subjectKey, sceneKey, selection: best! });
    apply(camera, bounds, aspect, yaw, best!.angle, best!.elevation); return true;
}
