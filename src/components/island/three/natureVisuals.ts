import * as THREE from 'three';
import { disposeGeometry, ellipsoid, IslandMaterials, pole } from './primitives';
import type { LivingNature } from './livingActivities';

function butterflyLocal(source: THREE.Group, elapsed: number, reduced: boolean) {
    const phase = reduced ? 1 : Math.min(1, elapsed / 4200), turn = phase * Math.PI * 2;
    return new THREE.Vector3(-.16 + Math.sin(turn) * .1,
        (source.userData.growthFlowerHeight ?? .52) + .36 + Math.sin(phase * Math.PI) * .14, -.1 + Math.cos(turn) * .1);
}
const butterflyWingAngle = (elapsed: number, reduced: boolean) => reduced ? .35 : .3 + Math.sin(elapsed / 110) * .55;

export interface ButterflyObservationProjection {
    readonly times: readonly number[];
    /** Detached calculation objects borrow the real meshes' geometry/material.
     * They are never inserted into or rendered by the live scene. */
    at(camera: THREE.Camera, elapsed: number): { object: THREE.Group; channels: readonly THREE.Object3D[] };
}

export function createButterflyObservationProjection(visitor: THREE.Group, source: THREE.Group, reduced: boolean): ButterflyObservationProjection | undefined {
    if (!['butterfly', 'ribbon-butterfly'].includes(visitor.name)) return undefined;
    const object = visitor.clone(true), parent = new THREE.Group();
    parent.matrixAutoUpdate = false; parent.matrix.copy(visitor.parent?.matrixWorld ?? new THREE.Matrix4()); parent.add(object);
    const channels = ['butterfly-body', 'butterfly-wing-left', 'butterfly-wing-right'].map(name => object.getObjectByName(name)!);
    // Bounded runtime representatives include both hinge extremes, the first
    // observable result, and the flight's quarter turns. Dense 30 fps testing
    // verifies the intervening poses without replaying all of them during fit.
    const times = reduced ? [0] : [0, Math.PI / 2 * 110, 350, Math.PI * 1.5 * 110, 1050, 2100, 3150, 4200];
    return { times, at(camera, elapsed) {
        object.position.copy(source.localToWorld(butterflyLocal(source, elapsed, reduced)));
        // Same local quaternion used by faceCamera, including the live parent.
        object.quaternion.copy(camera.quaternion);
        for (const wing of channels.slice(1)) wing.rotation.y = wing.userData.side * butterflyWingAngle(elapsed, reduced);
        parent.updateMatrixWorld(true);
        return { object, channels };
    } };
}

/** Small, reusable actors. Their vertices are allocated once; changing an
 * invitation changes transforms, never the saved world or its geometry. */
export class IslandNatureVisuals {
    readonly group = new THREE.Group();
    readonly observationPoints: THREE.Vector3[] = [];
    ready = false;
    private readonly objects = new Map<LivingNature, THREE.Group>();
    private readonly wings: THREE.Group[] = [];
    private readonly petals: THREE.Mesh[] = [];
    private readonly ripples: THREE.Mesh[] = [];
    private readonly reflection: THREE.Mesh[] = [];
    private readonly beam: THREE.Mesh;
    private readonly fireflyGlow: THREE.Mesh;
    private readonly birdWings: THREE.Mesh[] = [];
    private activeKind?: LivingNature;
    birdPerched = false;
    private disposed = false;
    constructor(m: IslandMaterials) {
        this.group.name = 'island-nature';
        for (const kind of ['butterfly', 'boat', 'petal-ripple', 'lantern-reflection', 'ribbon-butterfly', 'pond-firefly', 'leaf-bird'] as const) {
            const object = new THREE.Group(); object.name = kind; this.objects.set(kind, object); this.group.add(object);
        }
        for (const kind of ['butterfly', 'ribbon-butterfly'] as const) {
            const butterfly = this.objects.get(kind)!, ribbon = kind === 'ribbon-butterfly';
            const scale = ribbon ? 1.7 : 1.4;
            ellipsoid(butterfly, m.get('#735b42'), [0, 0, 0], [.017 * scale, .055 * scale, .017], 8).name = 'butterfly-body';
            for (const side of [-1, 1]) pole(butterfly, m.get('#735b42'), [side * .01 * scale, .035 * scale, 0],
                [side * .032 * scale, .095 * scale, 0], .006);
            for (const side of [-1, 1]) {
                const wing = new THREE.Group();
                wing.name = `butterfly-wing-${side < 0 ? 'left' : 'right'}`;
                ellipsoid(wing, m.get('#735b42'), [side * .064, .023, -.01], [.086, .07, .01], 10);
                ellipsoid(wing, m.get('#735b42'), [side * .052, -.032, -.006], [.062, .05, .01], 10);
                ellipsoid(wing, m.get(ribbon ? '#e878aa' : '#f2bb74'), [side * .064, .023, 0], [.077, .061, .012], 10);
                ellipsoid(wing, m.get(ribbon ? '#986fc2' : '#efcf94'), [side * .052, -.032, .004], [.055, .044, .01], 10);
                if (ribbon) {
                    ellipsoid(wing, m.get('#fff0c0'), [side * .074, .014, .012], [.013, .063, .009], 8);
                    ellipsoid(wing, m.get('#e878aa'), [side * .055, -.092, 0], [.018, .047, .01], 8);
                }
                wing.scale.setScalar(scale); wing.userData.side = side;
                this.wings.push(wing); butterfly.add(wing);
            }
        }
        const boat = this.objects.get('boat')!;
        ellipsoid(boat, m.get('#76a85b'), [0, 0, 0], [.12, .021, .058], 12).rotation.y = .25;
        pole(boat, m.get('#b49b64'), [0, .01, 0], [0, .17, 0], .008);
        ellipsoid(boat, m.get('#fff0c0'), [.04, .115, 0], [.045, .06, .007], 8).rotation.z = -.2;
        const petals = this.objects.get('petal-ripple')!;
        for (let i = 0; i < 3; i++) {
            const petal = ellipsoid(petals, m.get(i === 1 ? '#fff0c0' : '#f39482'), [0, 0, 0], [.085, .018, .053], 10);
            this.petals.push(petal);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(.105 + i * .03, .014, 5, 36), m.get('#e0fcf2', true));
            ring.rotation.x = -Math.PI / 2; petals.add(ring); this.ripples.push(ring);
        }
        const reflection = this.objects.get('lantern-reflection')!;
        for (let i = 0; i < 5; i++) this.reflection.push(ellipsoid(reflection, m.get(i % 2 ? '#ffe093' : '#fff0c0', true),
            [0, .002 * i, -.18 + i * .08], [.13 - i * .014, .007, .025], 12));
        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.013, .045, 1, 6), m.get('#ffe39a', true));
        reflection.add(this.beam);
        const insect = this.objects.get('pond-firefly')!;
        ellipsoid(insect, m.get('#735b42'), [0, .012, 0], [.049, .074, .044], 10);
        for (const side of [-1, 1]) ellipsoid(insect, m.get('#d7e8b4'), [side * .064, .02, -.013], [.075, .035, .014], 10).rotation.z = side * .4;
        this.fireflyGlow = ellipsoid(insect, m.get('#fff083', true), [0, -.056, .015], [.062, .062, .05], 10);
        const bird = this.objects.get('leaf-bird')!;
        ellipsoid(bird, m.get('#7fa65b'), [0, .16, 0], [.13, .16, .105], 12);
        ellipsoid(bird, m.get('#c8db89'), [0, .15, .07], [.085, .105, .035], 10);
        ellipsoid(bird, m.get('#83b566'), [0, .32, .018], [.11, .105, .1], 12).name = 'leaf-bird-head';
        for (const side of [-1, 1]) {
            const wing = ellipsoid(bird, m.get('#507948'), [side * .107, .17, -.018], [.028, .1, .078], 10);
            wing.rotation.x = -.5; wing.userData.side = side; this.birdWings.push(wing);
            ellipsoid(bird, m.get('#453d32'), [side * .049, .345, .104], [.012, .014, .008], 8).name = `leaf-bird-eye-${side < 0 ? 'left' : 'right'}`;
            pole(bird, m.get('#b49b64'), [side * .045, .075, 0], [side * .045, 0, .025], .012);
        }
        ellipsoid(bird, m.get('#e3af55'), [0, .315, .126], [.028, .022, .036], 8).name = 'leaf-bird-beak';
        ellipsoid(bird, m.get('#507948'), [0, .12, -.15], [.055, .024, .13], 10).rotation.x = -.3;
        this.clear();
    }
    clear() {
        this.group.visible = false; this.ready = false; this.observationPoints.length = 0;
        this.activeKind = undefined; this.birdPerched = false;
        for (const object of this.objects.values()) object.visible = false;
    }
    get activeObject() { return this.activeKind ? this.objects.get(this.activeKind) : undefined; }
    observationProjection(source: THREE.Group, reduced: boolean) {
        return this.activeObject ? createButterflyObservationProjection(this.activeObject, source, reduced) : undefined;
    }
    /** Flying bodies turn toward the observation view; wing hinge movement
     * remains actual 3D geometry and never collapses to an edge-on line. */
    faceCamera(camera: THREE.Camera) {
        const object = this.activeObject;
        if (!object || !['butterfly', 'ribbon-butterfly', 'pond-firefly'].includes(this.activeKind!)) return;
        object.quaternion.copy(camera.quaternion); object.updateWorldMatrix(true, true);
        this.observationPoints.length = 0;
        this.observationPoints.push(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()));
    }
    update(kind: LivingNature, source: THREE.Group, elapsed: number, reduced: boolean, support?: THREE.Group,
        occupied: readonly THREE.Box3[] = []) {
        this.clear();
        const object = this.objects.get(kind)!;
        if ((kind === 'petal-ripple' || kind === 'lantern-reflection') && !support) return false;
        this.group.visible = true; object.visible = true; this.activeKind = kind;
        source.updateWorldMatrix(true, false); support?.updateWorldMatrix(true, false);
        const phase = reduced ? 1 : Math.min(1, elapsed / 4200), turn = phase * Math.PI * 2;
        if (kind === 'petal-ripple' || kind === 'lantern-reflection') {
            // This open part of the real basin keeps the landed petals and
            // reflected strips away from the central spout and falling water.
            const water = support!.localToWorld(new THREE.Vector3(0, .315, -.32));
            const origin = source.localToWorld(new THREE.Vector3(kind === 'lantern-reflection' ? .12 : 0,
                kind === 'lantern-reflection' ? .91 : source.userData.growthFlowerHeight ?? .52, 0));
            this.observationPoints.push(origin, water);
            if (kind === 'petal-ripple') {
                object.position.set(0, 0, 0); object.rotation.set(0, 0, 0);
                const waterSide = new THREE.Vector3(1, 0, 0).transformDirection(support!.matrixWorld);
                this.petals.forEach((petal, i) => {
                    const flight = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - i * 170) / 2300));
                    petal.position.lerpVectors(origin, water, flight);
                    petal.position.y += Math.sin(flight * Math.PI) * .4;
                    petal.position.addScaledVector(waterSide, i * .038 * flight);
                    petal.rotation.set(0, flight * 3 + i, reduced ? 0 : Math.sin(flight * Math.PI) * .4);
                    const ring = this.ripples[i], spread = reduced ? .85 : Math.max(0, Math.min(1, (elapsed - 2350 - i * 160) / 1200));
                    ring.visible = spread > 0; ring.position.copy(water); ring.position.y -= .01 - i * .002;
                    ring.scale.setScalar(.1 + spread);
                });
                this.ready = reduced || elapsed >= 2800;
            } else {
                object.position.copy(water); object.rotation.set(0, 0, 0);
                const direction = origin.clone().sub(water), length = direction.length();
                this.beam.position.copy(direction).multiplyScalar(.5);
                this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
                this.beam.scale.set(1, length, 1); this.beam.visible = !reduced && elapsed < 1100;
                const yaw = Math.atan2(origin.x - water.x, origin.z - water.z), amount = reduced ? 1 : Math.min(1, elapsed / 900);
                this.reflection.forEach((strip, i) => {
                    const offset = -.18 + i * .08;
                    strip.position.set(Math.sin(yaw) * offset, .002 * i, Math.cos(yaw) * offset);
                    strip.rotation.y = yaw;
                    strip.scale.set((.13 - i * .014) * amount * (reduced ? 1 : 1 + Math.sin(elapsed / 240 + i) * .13), .007, .025);
                });
                this.ready = reduced || elapsed >= 900;
            }
        } else {
            const butterfly = kind === 'butterfly' || kind === 'ribbon-butterfly';
            const local = butterfly ? butterflyLocal(source, elapsed, reduced)
                : kind === 'boat' ? new THREE.Vector3(Math.sin(turn) * .32, .327, Math.cos(turn) * .32)
                    : kind === 'pond-firefly' ? new THREE.Vector3(-.4 + Math.sin(turn) * .08, 1.15 + Math.sin(turn) * .08, 1.4)
                        : new THREE.Vector3(0, .64, 0);
            object.position.copy(source.localToWorld(local));
            object.rotation.y = kind === 'boat' ? turn + source.rotation.y : kind === 'leaf-bird' ? -.4 + source.rotation.y : .3;
            if (kind === 'leaf-bird') {
                // A seated resident owns the cap. The visitor instead hovers
                // in clear air in front of that same mushroom, never through
                // the resident and never by hiding/moving the existing body.
                const candidates = [new THREE.Vector3(0, .64, 0), new THREE.Vector3(1.05, 1.35, .35),
                    new THREE.Vector3(-1.05, 1.35, .35), new THREE.Vector3(0, 1.35, 1.05)];
                let accepted = false;
                for (const [index, candidate] of candidates.entries()) {
                    object.position.copy(source.localToWorld(candidate)); object.updateWorldMatrix(true, true);
                    const bounds = new THREE.Box3().setFromObject(object).expandByScalar(.12);
                    if (index === 0 && !reduced) bounds.max.y += .35;
                    if (occupied.some(obstacle => obstacle.intersectsBox(bounds))) continue;
                    this.birdPerched = index === 0; accepted = true; break;
                }
                if (!accepted) { this.clear(); return false; }
                const landing = this.birdPerched && !reduced ? Math.max(0, 1 - elapsed / 1200) * .35 : 0;
                object.position.y += landing;
                this.birdWings.forEach(wing => {
                    wing.rotation.z = this.birdPerched && !landing ? 0 : wing.userData.side * (reduced ? .9 : .8 + Math.sin(elapsed / 100) * .24);
                });
            }
            this.wings.forEach(wing => { wing.rotation.y = wing.userData.side * butterflyWingAngle(elapsed, reduced); });
            const glow = reduced ? 1 : .92 + Math.sin(elapsed / 380) * .16;
            this.fireflyGlow.scale.set(.062 * glow, .062 * glow, .05 * glow);
            object.updateWorldMatrix(true, true);
            this.observationPoints.push(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()));
            this.ready = reduced || elapsed >= (kind === 'leaf-bird' ? 1200 : 350);
        }
        return !reduced && phase < 1;
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.group.removeFromParent();
        disposeGeometry(this.group); this.clear();
    }
}
