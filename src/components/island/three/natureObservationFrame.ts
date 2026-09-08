import * as THREE from 'three';
import { boxCorners } from './sceneFraming';
import type { ButterflyObservationProjection } from './natureVisuals';
import { segmentHitsMesh, type SharedActivityOccluder } from './sharedActivityOcclusion';

interface BirdIdentity {
    candidate: 'leaf-bird-face-observation-v2';
    eyes: [number, number];
    beak: number;
    frontDot: number;
    elevation: number;
    eyePixels: [FeaturePixels, FeaturePixels];
    beakPixels: FeaturePixels;
    reason: 'missing-features' | 'unknown-viewport' | 'face-angle' | 'outside-frame' | 'face-too-small' | 'face-occluded' | null;
    readable: boolean;
}
interface FeaturePixels { width: number; height: number; visibleArea: number }
interface ObservationViewport { width: number; height: number }

interface ButterflyIdentity {
    candidate: 'butterfly-silhouette-observation-v1';
    readable: boolean;
    reason: 'resident-overlap' | 'foreground-occlusion' | 'outside-frame' | null;
    poses: number;
    totalPoses: number;
    visible: [number, number, number];
    residentClear: [number, number, number];
}

function opaque(object: THREE.Object3D) {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    if (!(object instanceof THREE.Mesh)) return false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.some(material => material.visible && (!material.transparent || material.opacity >= .9));
}

function observationSurfaces(objects: readonly THREE.Object3D[]) {
    const meshes = new Map<THREE.Mesh, SharedActivityOccluder>();
    for (const object of objects) {
        object.updateWorldMatrix(true, true);
        object.traverseVisible(child => {
            if (child instanceof THREE.Mesh && opaque(child)) meshes.set(child, { mesh: child, inverse: child.matrixWorld.clone().invert() });
        });
    }
    return [...meshes.values()];
}

function butterflyInspector(camera: THREE.OrthographicCamera, physical: readonly THREE.Object3D[], people: readonly THREE.Object3D[], occupied: readonly THREE.Box3[] = []) {
    // Borrow the existing exact triangle hierarchy, not broad merged-world
    // bounds or thousands of invisible wardrobe triangles on every ray.
    const foreground = observationSurfaces(physical), residents = observationSurfaces(people);
    const raycaster = new THREE.Raycaster(), point = new THREE.Vector3();
    return (channels: readonly THREE.Object3D[]): ButterflyIdentity => {
        const visible: [number, number, number] = [0, 0, 0], residentClear: [number, number, number] = [0, 0, 0];
        let inFrame = true;
        for (const [index, channel] of channels.entries()) {
            const screen = new THREE.Box3().setFromPoints(boxCorners(new THREE.Box3().setFromObject(channel, true)).map(point => point.project(camera)));
            inFrame &&= screen.min.x > -.92 && screen.max.x < .92 && screen.min.y > -.92 && screen.max.y < .92;
            const center = screen.getCenter(new THREE.Vector3()), size = screen.getSize(new THREE.Vector3());
            let samples = 0, clear = 0, seen = 0;
            for (const x of [-.3, 0, .3]) for (const y of [-.3, 0, .3]) {
                raycaster.setFromCamera(new THREE.Vector2(center.x + x * size.x, center.y + y * size.y), camera);
                const hit = raycaster.intersectObject(channel, true).find(hit => opaque(hit.object));
                if (!hit) continue;
                samples++;
                const end = hit.point.clone().addScaledVector(raycaster.ray.direction, -.0001);
                const blockedBox = occupied.some(box => raycaster.ray.intersectBox(box, point)
                    && point.distanceTo(raycaster.ray.origin) < end.distanceTo(raycaster.ray.origin));
                if (!blockedBox && !foreground.some(surface => segmentHitsMesh(raycaster.ray.origin, end, surface))) seen++;
                // Both foreground and background silhouettes count: a fully
                // visible wing can still look attached to a resident behind it.
                const far = raycaster.ray.at(camera.far, new THREE.Vector3());
                if (!residents.some(surface => segmentHitsMesh(raycaster.ray.origin, far, surface))) clear++;
            }
            visible[index] = samples ? seen / samples : 0;
            residentClear[index] = samples ? clear / samples : 0;
        }
        const reason = !inFrame ? 'outside-frame' : Math.min(...visible) < .8 ? 'foreground-occlusion'
            : Math.min(...residentClear) < 1 ? 'resident-overlap' : null;
        return { candidate: 'butterfly-silhouette-observation-v1', readable: reason === null, reason,
            poses: 1, totalPoses: 1, visible, residentClear };
    };
}

/** Inspect only the actual already-rendered pose. No camera search, model
 * rotation or prediction of a resident's future walk takes place here. */
export function inspectCurrentButterflyObservation(camera: THREE.OrthographicCamera, visitor: THREE.Object3D,
    physical: readonly THREE.Object3D[], residents: readonly THREE.Object3D[]) {
    const channels = ['butterfly-body', 'butterfly-wing-left', 'butterfly-wing-right'].map(name => visitor.getObjectByName(name))
        .filter((object): object is THREE.Object3D => !!object);
    return butterflyInspector(camera, physical, residents)(channels);
}

function leafBirdFeatures(visitor: THREE.Object3D | undefined) {
    if (visitor?.name !== 'leaf-bird') return undefined;
    const head = visitor.getObjectByName('leaf-bird-head'), beak = visitor.getObjectByName('leaf-bird-beak');
    const left = visitor.getObjectByName('leaf-bird-eye-left'), right = visitor.getObjectByName('leaf-bird-eye-right');
    if (!(head instanceof THREE.Mesh) || !(beak instanceof THREE.Mesh)
        || !(left instanceof THREE.Mesh) || !(right instanceof THREE.Mesh)) return undefined;
    // The real beak/head placement defines forward even below a rotated
    // parent. Neither the bird nor its host is turned to suit this view.
    const forward = beak.getWorldPosition(new THREE.Vector3()).sub(head.getWorldPosition(new THREE.Vector3()));
    forward.y = 0; forward.normalize();
    return { eyes: [left, right] as const, beak, forward };
}

function leafBirdInspector(camera: THREE.OrthographicCamera, visitor: THREE.Object3D,
    physical: readonly THREE.Object3D[], viewport?: ObservationViewport) {
    const surfaces = observationSurfaces([...physical, visitor]), ray = new THREE.Raycaster();
    const validViewport = !!viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
        && viewport.width > 1 && viewport.height > 1;
    const feature = (mesh: THREE.Mesh) => {
        // Project real vertices: rotating a world AABB would make a tiny eye
        // look larger without adding a single visible pixel.
        const outline = new THREE.Box3(), position = mesh.geometry.getAttribute('position'), point = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) outline.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).project(camera));
        const center = outline.getCenter(new THREE.Vector3()), size = outline.getSize(new THREE.Vector3());
        let samples = 0, visible = 0;
        if (opaque(mesh)) for (const x of [-.4, -.2, 0, .2, .4]) for (const y of [-.4, -.2, 0, .2, .4]) {
            ray.setFromCamera(new THREE.Vector2(center.x + x * size.x, center.y + y * size.y), camera);
            const hit = ray.intersectObject(mesh, false)[0];
            if (!hit) continue;
            samples++;
            const end = hit.point.clone().addScaledVector(ray.ray.direction, -.0001);
            if (!surfaces.some(surface => segmentHitsMesh(ray.ray.origin, end, surface))) visible++;
        }
        const width = validViewport ? size.x * viewport.width / 2 : 0, height = validViewport ? size.y * viewport.height / 2 : 0;
        return { fraction: samples ? visible / samples : 0,
            pixels: { width, height, visibleArea: width * height * visible / 25 },
            inFrame: outline.min.x > -.94 && outline.max.x < .94 && outline.min.y > -.94 && outline.max.y < .94 };
    };
    return (): BirdIdentity => {
        const bird = leafBirdFeatures(visitor), empty = { width: 0, height: 0, visibleArea: 0 };
        if (!bird) return { candidate: 'leaf-bird-face-observation-v2', eyes: [0, 0], beak: 0, frontDot: 0, elevation: 0,
            eyePixels: [{ ...empty }, { ...empty }], beakPixels: empty, reason: 'missing-features', readable: false };
        const toward = camera.getWorldDirection(new THREE.Vector3()).negate(), horizontal = toward.clone().setY(0).normalize();
        const frontDot = horizontal.dot(bird.forward), elevation = Math.asin(toward.y) * 180 / Math.PI;
        const eyes = [feature(bird.eyes[0]), feature(bird.eyes[1])], beak = feature(bird.beak);
        const largeEye = (eye: typeof beak) => Math.min(eye.pixels.width, eye.pixels.height) >= 3;
        const largeBeak = Math.min(beak.pixels.width, beak.pixels.height) >= 5;
        const reason = !validViewport ? 'unknown-viewport' : frontDot < .85 || elevation < 0 || elevation > 30 ? 'face-angle'
            : !beak.inFrame || !eyes.some(eye => eye.inFrame) ? 'outside-frame'
                : !largeBeak || !eyes.some(largeEye) ? 'face-too-small'
                    : beak.fraction < .8 || beak.pixels.visibleArea < 24
                        || !eyes.some(eye => eye.inFrame && largeEye(eye) && eye.fraction >= .75 && eye.pixels.visibleArea >= 6) ? 'face-occluded' : null;
        return { candidate: 'leaf-bird-face-observation-v2', eyes: [eyes[0].fraction, eyes[1].fraction], beak: beak.fraction,
            frontDot, elevation, eyePixels: [eyes[0].pixels, eyes[1].pixels], beakPixels: beak.pixels, reason, readable: reason === null };
    };
}

/** Same finite feature check as selection, evaluated on the already-rendered
 * landing pose. It neither refits the camera nor advances any actor. */
export function inspectCurrentLeafBirdObservation(camera: THREE.OrthographicCamera, visitor: THREE.Object3D,
    physical: readonly THREE.Object3D[], viewport: ObservationViewport) {
    return leafBirdInspector(camera, visitor, physical, viewport)();
}

/** The explicit observation reuses the live world and frames its physical
 * host/partner/visitor. Learning and ordinary world framing are separate. */
export function fitNatureObservationCamera(camera: THREE.OrthographicCamera, source: THREE.Object3D,
    support: THREE.Object3D | undefined, visitor: THREE.Object3D | undefined, aspect: number, side: -1 | 1 = -1,
    targets: readonly THREE.Vector3[] = [], occupied: readonly THREE.Box3[] = [], occluders: readonly THREE.Object3D[] = [],
    composition?: { residents: readonly THREE.Object3D[]; butterfly?: ButterflyObservationProjection; viewport?: ObservationViewport }) {
    source.updateWorldMatrix(true, true); support?.updateWorldMatrix(true, true); visitor?.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(source);
    if (support) bounds.union(new THREE.Box3().setFromObject(support));
    if (visitor) bounds.union(new THREE.Box3().setFromObject(visitor));
    const bird = leafBirdFeatures(visitor), butterfly = composition?.butterfly;
    bounds.expandByScalar(bird ? .10 : .45);
    const target = bounds.getCenter(new THREE.Vector3());
    const directions = bird ? [.2, .35, .5].flatMap(elevation => [0, -.3, .3, -.55, .55].map(yaw => {
        const direction = bird.forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiplyScalar(16);
        direction.y = 16 * elevation; return direction;
    })) : [side === 1 ? new THREE.Vector3(8.8, 10.2, 11.5) : new THREE.Vector3(-15, 12, 3),
        new THREE.Vector3(-15, 13, -8), new THREE.Vector3(15, 13, -8), new THREE.Vector3(0, 17, 13),
        new THREE.Vector3(-12, 23, 8), new THREE.Vector3(12, 23, 8), new THREE.Vector3(0, 25, 5)];
    if (butterfly) for (let i = 0; i < 8; i++) directions.push(new THREE.Vector3(Math.sin(i * Math.PI / 4) * 16, 12, Math.cos(i * Math.PI / 4) * 16));
    occluders.forEach(object => object.updateWorldMatrix(true, true));
    const apply = (direction: THREE.Vector3) => {
        camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld(true);
        const fitBounds = bounds.clone();
        if (butterfly) for (const elapsed of butterfly.times) fitBounds.union(new THREE.Box3().setFromObject(butterfly.at(camera, elapsed).object));
        const projected = new THREE.Box3().setFromPoints(boxCorners(fitBounds).map(point => point.applyMatrix4(camera.matrixWorldInverse)));
        const height = Math.max(bird ? 0 : 3.6, (projected.max.y - projected.min.y) * 1.16,
            (projected.max.x - projected.min.x) / Math.max(.1, aspect) * 1.16);
        camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
        camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
        return height;
    };
    const raycaster = new THREE.Raycaster(), point = new THREE.Vector3();
    const visibleFrom = (targetPoint: THREE.Vector3, physical: readonly THREE.Object3D[], tolerance = .03) => {
        const projected = targetPoint.clone().project(camera);
        raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
        const distance = raycaster.ray.origin.distanceTo(targetPoint);
        if (occupied.some(obstacle => raycaster.ray.intersectBox(obstacle, point)
            && raycaster.ray.origin.distanceTo(point) < distance - tolerance)) return false;
        return !raycaster.intersectObjects([...physical], true).some(hit => {
            if (hit.distance >= distance - tolerance) return false;
            for (let parent: THREE.Object3D | null = hit.object; parent; parent = parent.parent) if (!parent.visible) return false;
            if (hit.object instanceof THREE.Mesh) {
                const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
                return materials.some(material => !material.transparent || material.opacity >= .9);
            }
            return false;
        });
    };
    const inspectBird = bird && visitor ? leafBirdInspector(camera, visitor, [...occluders, source, ...(support ? [support] : [])], composition?.viewport) : undefined;
    // Seeing a single point through a gap is not enough to understand the
    // objects around it. Compare the actual host outlines against the rest
    // of the world as a second priority, after clearing each causal point.
    const context = [source, ...(support ? [support] : [])].flatMap(object => boxCorners(new THREE.Box3().setFromObject(object)));
    const inspect = butterfly ? butterflyInspector(camera, [...occluders, source, ...(support ? [support] : [])], composition?.residents ?? [], occupied) : undefined;
    const butterflyIdentity = (): ButterflyIdentity | undefined => {
        if (!butterfly) return undefined;
        const visible: [number, number, number] = [1, 1, 1], residentClear: [number, number, number] = [1, 1, 1];
        let inFrame = true, checked = 0;
        for (const elapsed of butterfly.times) {
            checked++;
            const result = inspect!(butterfly.at(camera, elapsed).channels);
            inFrame &&= result.reason !== 'outside-frame';
            for (const index of [0, 1, 2]) {
                visible[index] = Math.min(visible[index], result.visible[index]);
                residentClear[index] = Math.min(residentClear[index], result.residentClear[index]);
            }
            // One failed pose is a sufficient witness against this camera.
            // Only a successful candidate must finish the entire sequence.
            if (!inFrame || Math.min(...visible) < .8 || Math.min(...residentClear) < 1) break;
        }
        const reason = !inFrame ? 'outside-frame' : Math.min(...visible) < .8 ? 'foreground-occlusion'
            : Math.min(...residentClear) < 1 ? 'resident-overlap' : null;
        return { candidate: 'butterfly-silhouette-observation-v1', readable: reason === null, reason,
            poses: checked, totalPoses: butterfly.times.length, visible, residentClear };
    };
    let chosen = 0, best = -1, bestVisible = 0, bestContext = 0, bestSeparation = false;
    let bestIdentity: BirdIdentity | undefined;
    let bestButterfly: ButterflyIdentity | undefined;
    for (const [index, direction] of directions.entries()) {
        apply(direction);
        const visible = targets.filter((targetPoint, targetIndex) => {
            // A source point can sit inside its own flower/light. The
            // downstream payoff and flying visitor must also clear the real
            // host geometry (spout, falling water, light pole), not just the
            // rest of the world.
            const physical = [...occluders, ...(support ? [support] : []),
                ...(targets.length > 1 && targetIndex === 0 ? [] : [source])];
            return visibleFrom(targetPoint, physical);
        }).length;
        const visibleContext = context.filter(point => visibleFrom(point, occluders)).length;
        const hostScreen = new THREE.Box3().setFromPoints(boxCorners(new THREE.Box3().setFromObject(source)).map(point => point.project(camera)));
        const visitorScreen = targets[0]?.clone().project(camera);
        const separated = targets.length === 1 && visitorScreen && visitor && (visitorScreen.x < hostScreen.min.x - .06
            || visitorScreen.x > hostScreen.max.x + .06 || visitorScreen.y > hostScreen.max.y + .06 || visitorScreen.y < hostScreen.min.y - .06);
        const identity = inspectBird?.();
        const insect = butterflyIdentity();
        const insectScore = insect ? (insect.readable && visible === targets.length ? 100000 : 0)
            + Math.min(...insect.visible) * 10000 + Math.min(...insect.residentClear) * 1000 : 0;
        const identityScore = identity ? (identity.readable && visible === targets.length ? 100000 : 0)
            + visible * 10000 + identity.beak * 1000 + Math.max(...identity.eyes) * 1000
            + Math.min(...identity.eyes) * 100 + identity.frontDot * 100 - identity.elevation : 0;
        const score = identityScore + insectScore + visible * (context.length + 1) * 2 + (separated ? context.length + 1 : 0) + visibleContext;
        if (score > best) { best = score; bestVisible = visible; bestContext = visibleContext;
            bestSeparation = Boolean(separated); bestIdentity = identity; bestButterfly = insect; chosen = index; }
    }
    const height = apply(directions[chosen]);
    return { target: target.toArray(), width: height * aspect, height, angle: chosen,
        visibleTargets: bestVisible, totalTargets: targets.length, visibleContext: bestContext, totalContext: context.length, visitorSeparated: bestSeparation,
        visitorIdentity: bestIdentity ?? bestButterfly };
}
