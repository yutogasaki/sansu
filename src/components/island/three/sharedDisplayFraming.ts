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
export interface SharedJobFrame {
    key: string;
    phase: string;
    bounds: THREE.Box3;
    channels: readonly { name: string; objects: readonly THREE.Object3D[]; identity?: boolean; handContact?: THREE.Object3D }[];
    /** Actual head forward direction, never a rotation applied to the actor. */
    facing: { origin: THREE.Vector3; direction: THREE.Vector3 };
    /** Points on the actual lit object / receiving table triangles. */
    light?: { source: THREE.Vector3; surface: THREE.Vector3; receiver: THREE.Vector3; receiverSamples: readonly THREE.Vector3[] };
}
export const SHARED_JOB_CAMERA_CANDIDATE = 'island-shared-job-camera-v2';
interface JobSelection { angle: number; elevation: number; visibility: Visibility; contacts: boolean[]; facing: boolean; separated: boolean; readable: boolean; score: number }
interface CachedJobSelection {
    key: string; phase: string; geometryKey: string; selection: JobSelection;
    searches: number; candidates: number; reused: boolean; channelNames: string[]; minimums: number[];
}
const jobSelections = new WeakMap<THREE.Camera, CachedJobSelection>();
interface FramingMesh extends SharedActivityOccluder { bounds: THREE.Box3; tip?: { axis: THREE.Vector3; cutoff: number } }
interface Visibility { channels: number[]; samples: number[]; minimum: number; total: number }
interface Selection { angle: number; elevation: number; visibility: Visibility }
interface CachedSelection { subjectKey: string; sceneKey: string; selection: Selection }
const selections = new WeakMap<THREE.Camera, CachedSelection>();
const geometryBounds = new WeakMap<THREE.BufferGeometry, { position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; version: number; bounds: THREE.Box3 }>();
const fingerRegions = new WeakMap<THREE.Object3D, { geometry: THREE.BufferGeometry; version: number; axis: THREE.Vector3; cutoff: number; bounds: THREE.Box3 }>();
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
/** The hand anchor is on the authored ellipsoid's fingertip. Its distal
 * quarter is a region of that same mesh, not the upper arm buried at the
 * shoulder. All full meshes remain ray blockers, including this arm. */
function jobMeshes(channel: SharedJobFrame['channels'][number]): FramingMesh[] {
    const result: FramingMesh[] = meshes(channel.objects), contact = channel.handContact;
    if (!contact || !(contact.parent instanceof THREE.Mesh)) return result;
    const mesh = contact.parent, geometry = mesh.geometry, position = geometry.getAttribute('position');
    const version = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position.version;
    let region = fingerRegions.get(contact);
    if (!region || region.geometry !== geometry || region.version !== version) {
        const axis = contact.position.clone().normalize(), point = new THREE.Vector3();
        let minimum = Infinity, maximum = -Infinity;
        for (let i = 0; i < position.count; i++) {
            const distance = point.fromBufferAttribute(position, i).dot(axis);
            minimum = Math.min(minimum, distance); maximum = Math.max(maximum, distance);
        }
        const cutoff = maximum - (maximum - minimum) / 4, bounds = new THREE.Box3();
        const index = geometry.index, count = index?.count ?? position.count;
        for (let i = 0; i < count; i += 3) {
            const points = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset));
            for (let j = 0; j < 3; j++) {
                const a = points[j], b = points[(j + 1) % 3], da = a.dot(axis) - cutoff, db = b.dot(axis) - cutoff;
                if (da >= 0) bounds.expandByPoint(a);
                if ((da < 0) !== (db < 0)) bounds.expandByPoint(a.clone().lerp(b, da / (da - db)));
            }
        }
        region = { geometry, version, axis, cutoff, bounds }; fingerRegions.set(contact, region);
    }
    return result.map(value => value.mesh === mesh ? { ...value, bounds: region!.bounds.clone().applyMatrix4(mesh.matrixWorld), tip: region } : value);
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
                const region = channel.find(value => value.mesh === mesh);
                return isSharedActivityOccluderMaterial(material) && (!region?.tip
                    || hit.point.clone().applyMatrix4(region.inverse).dot(region.tip.axis) >= region.tip.cutoff - 1e-7);
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

export function clearSharedJobCamera(camera: THREE.Camera) { jobSelections.delete(camera); }
export function sharedJobCameraDiagnostic(camera: THREE.Camera) {
    const cached = jobSelections.get(camera);
    return cached && { candidate: SHARED_JOB_CAMERA_CANDIDATE, key: cached.key, phase: cached.phase,
        angle: cached.selection.angle, elevation: cached.selection.elevation, readable: cached.selection.readable,
        channels: cached.channelNames.map((name, i) => ({ name, visible: cached.selection.visibility.channels[i], samples: cached.selection.visibility.samples[i], minimum: cached.minimums[i] })),
        contacts: [...cached.selection.contacts], facing: cached.selection.facing, separated: cached.selection.separated,
        candidates: cached.candidates, searches: cached.searches, reused: cached.reused };
}

/** Refit moving bounds, retaining one world angle throughout a phase. On a
 * phase change a finite search may improve it; contact occlusion is measured
 * honestly but does not create a new gameplay or persistence condition. */
export function fitSharedJobCamera(camera: THREE.OrthographicCamera, frame: SharedJobFrame, aspect: number,
    occluderRoots: readonly THREE.Object3D[], now: number) {
    const { bounds } = frame;
    if (bounds.isEmpty() || !Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(now)
        || !frame.channels.length || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) {
        clearSharedJobCamera(camera); return false;
    }
    selections.delete(camera);
    const channels = frame.channels.map(jobMeshes), obstacles = meshes(occluderRoots);
    const geometryKey = [aspect, ...bounds.min.toArray(), ...bounds.max.toArray(), ...channels.map(meshKey), meshKey(obstacles),
        ...frame.facing.origin.toArray(), ...frame.facing.direction.toArray(),
        ...(frame.light ? [frame.light.source, frame.light.surface, frame.light.receiver, ...frame.light.receiverSamples].flatMap(p => p.toArray()) : [])].join('|');
    const previous = jobSelections.get(camera), same = previous?.key === frame.key ? previous : undefined;
    if (same?.geometryKey === geometryKey && same.phase === frame.phase) {
        apply(camera, bounds, aspect, 0, same.selection.angle, same.selection.elevation);
        same.candidates = 0; same.reused = true; return true;
    }
    const backward = new THREE.Vector3(), origin = new THREE.Vector3(), end = new THREE.Vector3();
    const contactVisible = (point: THREE.Vector3) => {
        const ndc = point.clone().project(camera);
        if (![ndc.x, ndc.y, ndc.z].every(Number.isFinite) || Math.abs(ndc.x) > .94 || Math.abs(ndc.y) > .94 || Math.abs(ndc.z) > 1) return false;
        backward.set(0, 0, 1).applyQuaternion(camera.quaternion);
        origin.copy(point).addScaledVector(backward, camera.far);
        end.copy(point).addScaledVector(backward, .004);
        return !obstacles.some(obstacle => segmentHitsMesh(origin, end, obstacle));
    };
    const evaluate = (angle: number, elevation: number): JobSelection => {
        apply(camera, bounds, aspect, 0, angle, elevation);
        const visible = visibility(camera, channels, obstacles);
        const direction = camera.position.clone().sub(frame.facing.origin); direction.y = 0;
        const forward = frame.facing.direction.clone(); forward.y = 0;
        const facing = direction.normalize().dot(forward.normalize()) > 0;
        const light = frame.light;
        const contacts = light ? [contactVisible(light.surface), ...light.receiverSamples.map(contactVisible)] : [];
        const projected = light && [light.source, light.surface, light.receiver].map(point => point.clone().project(camera));
        const gap = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.y - b.y);
        const separated = !projected || gap(projected[0], projected[1]) >= .08 && gap(projected[1], projected[2]) >= .08;
        const ratios = visible.channels.map((ratio, i) => ratio / (frame.channels[i].identity ? .5 : CLEAR));
        const score = Math.min(...ratios, facing ? 1 : 0, separated ? 1 : 0,
            light ? contacts.filter(Boolean).length / 6 : 1);
        return { angle, elevation, visibility: visible, contacts, facing, separated, readable: score >= 1, score };
    };
    let selection = same && evaluate(same.selection.angle, same.selection.elevation);
    let candidates = 0, searches = same?.searches ?? 0;
    const canSearch = !same || same.phase !== frame.phase;
    if ((!selection || !selection.readable) && canSearch) {
        searches++;
        const preferred = Math.atan2(frame.facing.direction.x, frame.facing.direction.z) - Math.atan2(3, 6);
        let best = selection;
        search: for (const elevation of [3.8, 6.5, 9]) for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * .75, -Math.PI * .75, Math.PI]) {
            const next = evaluate(preferred + offset, elevation); candidates++;
            if (!best || next.facing && !best.facing || next.facing === best.facing && (next.score > best.score
                || next.score === best.score && next.visibility.total > best.visibility.total)) best = next;
            if (next.readable) { best = next; break search; }
        }
        // A new phase may improve a partially visible contact. Within a phase
        // moving bounds never select a different angle, even when occluded.
        selection = best;
    }
    jobSelections.set(camera, { key: frame.key, phase: frame.phase, geometryKey, selection: selection!, searches,
        candidates, reused: Boolean(same && selection?.angle === same.selection.angle && selection?.elevation === same.selection.elevation),
        channelNames: frame.channels.map(channel => channel.name), minimums: frame.channels.map(channel => channel.identity ? .5 : CLEAR) });
    apply(camera, bounds, aspect, 0, selection!.angle, selection!.elevation); return true;
}
