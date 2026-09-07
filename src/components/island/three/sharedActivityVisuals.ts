import * as THREE from 'three';
import { batch, disposeGeometry, ellipsoid, IslandMaterials, mesh, pole, star } from './primitives';

export type SharedActivityPropKind = 'flower' | 'star' | 'bubble';
export type SharedActivityPropPhase = 'gather' | 'carry' | 'share' | 'enjoy' | 'settled';
export type SharedActivityPropOwner = 'source' | 'carrier' | 'receiver' | 'transfer' | 'none';
export interface SharedActivityVisualFrame {
    kind: SharedActivityPropKind;
    phase: SharedActivityPropPhase;
    progress: number;
    /** Actual world-space source and hand attachments, sampled after resident posing. */
    source: THREE.Vector3;
    carrier: THREE.Vector3;
    receiver: THREE.Vector3;
    reduced: boolean;
}

type Triple = [number, number, number];
const PROP_KINDS = ['flower', 'star', 'bubble'] as const;
const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (value: number) => value * value * (3 - 2 * value);
const finitePoint = (point: THREE.Vector3) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);

/** A slightly larger back-facing hull preserves the prop silhouette against fur and grass. */
function outlinedBall(parent: THREE.Group, outline: THREE.Material, fill: THREE.Material,
    position: Triple, scale: Triple) {
    ellipsoid(parent, outline, position, scale.map(value => value * 1.10) as Triple, 12);
    return ellipsoid(parent, fill, position, scale, 12);
}

function makeBlossom(materials: IslandMaterials, outline: THREE.Material) {
    const group = new THREE.Group();
    // The attachment is the grip on the stem, so the blossom stays above the paw.
    pole(group, materials.get('#292341'), [0, -.10, 0], [0, .27, 0], .027);
    pole(group, materials.get('#32bb83'), [.004, -.10, .014], [.004, .27, .014], .017);
    const leaf = new THREE.Group();
    leaf.position.set(.095, .05, 0); leaf.rotation.z = .55;
    group.add(leaf);
    outlinedBall(leaf, outline, materials.get('#32bb83'), [0, 0, 0], [.13, .045, .035]);
    const bloom = new THREE.Group();
    bloom.position.y = .28;
    // Face the established island camera, with enough depth to remain a flower from the side.
    bloom.rotation.set(-.38, .34, 0);
    group.add(bloom);
    for (let i = 0; i < 5; i++) {
        const angle = Math.PI / 2 + i * Math.PI * 2 / 5;
        outlinedBall(bloom, outline, materials.get('#f39482'),
            [Math.cos(angle) * .125, Math.sin(angle) * .125, 0], [.105, .105, .055]);
    }
    outlinedBall(bloom, outline, materials.get('#ffd06c'), [0, 0, .055], [.09, .09, .045]);
    ellipsoid(bloom, materials.get('#fff1bf'), [-.025, .03, .093], [.024, .025, .009], 8);
    return batch(group);
}

function makeStar(materials: IslandMaterials, outline: THREE.Material) {
    const group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    body.rotation.set(-.38, .34, 0);
    const outer = star(body, outline, [0, 0, -.009], .29);
    outer.rotation.y = 0;
    const center = star(body, materials.surface('#ffbf27', .38, 0, true), [0, 0, 0], .26);
    center.rotation.y = 0;
    ellipsoid(body, materials.get('#fff1bf'), [-.054, .07, .09], [.025, .052, .016], 8);
    return batch(group);
}

function makeBubble(materials: IslandMaterials, outline: THREE.Material) {
    const group = new THREE.Group();
    outlinedBall(group, outline, materials.surface('#60dcf2', .18, .04), [0, 0, 0], [.235, .235, .235]);
    ellipsoid(group, materials.surface('#efffff', .12), [-.067, .12, .184], [.069, .086, .025], 10);
    ellipsoid(group, materials.surface('#b3efde', .2, .04), [.125, -.08, .175], [.041, .055, .02], 8);
    return batch(group);
}

/** One physical object changes hands. These props never award or persist anything. */
export class SharedActivityVisuals {
    readonly group = new THREE.Group();
    private readonly props: Record<SharedActivityPropKind, THREE.Group>;
    private readonly droplets = new THREE.Group();
    private readonly dropletMeshes: THREE.Mesh[] = [];
    private readonly dropletDirections: THREE.Vector3[] = [];
    private readonly point = new THREE.Vector3();
    private readonly worldPosition = new THREE.Vector3();
    private readonly worldScale = new THREE.Vector3();
    private active?: THREE.Group;
    private kind: SharedActivityPropKind | null = null;
    private phase: SharedActivityPropPhase | null = null;
    private owner: SharedActivityPropOwner = 'none';
    private progress = 0;
    private reduced = false;
    private disposed = false;

    constructor(materials: IslandMaterials) {
        this.group.name = 'shared-activity-props';
        const outline = materials.get('#292341').clone();
        outline.side = THREE.BackSide;
        outline.userData.islandOwned = true;
        this.props = { flower: makeBlossom(materials, outline), star: makeStar(materials, outline), bubble: makeBubble(materials, outline) };
        for (const kind of PROP_KINDS) {
            const prop = this.props[kind];
            prop.name = `shared-${kind}`;
            prop.children.forEach((child, index) => { child.name = `${prop.name}-surface-${index}`; });
            this.group.add(prop);
        }
        this.droplets.name = 'shared-bubble-droplets';
        // Five coherent pieces of the same water ball, not an unrelated confetti system.
        const geometry = new THREE.SphereGeometry(1, 10, 8);
        for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * 2 / 5 + .3;
            this.dropletDirections.push(new THREE.Vector3(Math.cos(angle), .28 + (i % 2) * .25, Math.sin(angle)).normalize());
            const drop = mesh(this.droplets, geometry, materials.surface('#60dcf2', .18, .04));
            drop.name = `shared-water-droplet-${i}`;
            this.dropletMeshes.push(drop);
        }
        this.group.add(this.droplets);
        this.group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
        this.update();
    }

    update(frame?: SharedActivityVisualFrame) {
        if (this.disposed) return;
        for (const kind of PROP_KINDS) {
            const prop = this.props[kind];
            prop.visible = false;
            prop.scale.setScalar(1);
        }
        this.droplets.visible = false;
        if (!frame || !finitePoint(frame.source) || !finitePoint(frame.carrier) || !finitePoint(frame.receiver)) {
            this.group.visible = false;
            this.active = undefined;
            this.kind = this.phase = null;
            this.owner = 'none';
            this.progress = 0;
            this.reduced = false;
            return;
        }
        this.kind = frame.kind;
        this.phase = frame.phase;
        this.progress = unit(frame.progress);
        this.reduced = frame.reduced;
        const prop = this.props[frame.kind], t = this.progress;
        this.active = prop;
        prop.visible = true;
        this.group.visible = true;
        this.owner = 'receiver';
        if (frame.reduced || frame.phase === 'enjoy' || frame.phase === 'settled') {
            this.point.copy(frame.receiver);
        } else if (frame.phase === 'gather') {
            this.point.copy(frame.source).lerp(frame.carrier, ease(t));
            this.owner = t === 0 ? 'source' : t === 1 ? 'carrier' : 'transfer';
        } else if (frame.phase === 'carry') {
            this.point.copy(frame.carrier);
            this.owner = 'carrier';
        } else {
            this.point.copy(frame.carrier).lerp(frame.receiver, ease(t));
            this.owner = t === 0 ? 'carrier' : t === 1 ? 'receiver' : 'transfer';
        }
        this.group.updateWorldMatrix(true, false);
        prop.position.copy(this.point);
        this.group.worldToLocal(prop.position);
        if (frame.kind === 'bubble') this.updateBubble(frame, t);
    }

    private updateBubble(frame: SharedActivityVisualFrame, t: number) {
        const bubble = this.props.bubble;
        if (frame.reduced) {
            bubble.scale.setScalar(1.25);
        } else if (frame.phase === 'enjoy' && t < .55) {
            bubble.scale.setScalar(1 + .65 * ease(t / .55));
        } else if (frame.phase === 'enjoy' && t < 1) {
            bubble.visible = false;
            this.droplets.visible = true;
            this.droplets.position.copy(bubble.position);
            const pop = (t - .55) / .45;
            for (let i = 0; i < this.dropletMeshes.length; i++) {
                const drop = this.dropletMeshes[i];
                drop.position.copy(this.dropletDirections[i]).multiplyScalar(.37 + .24 * pop);
                drop.position.y -= .33 * pop * pop;
                const radius = .065 * (1 - ease(pop));
                drop.scale.set(radius, radius * 1.35, radius);
            }
        } else if (frame.phase === 'enjoy' || frame.phase === 'settled') {
            bubble.visible = false;
            this.group.visible = false;
            this.owner = 'none';
        }
    }

    /** Reports the rendered objects, including inherited visibility and actual world transforms. */
    snapshot() {
        this.group.updateWorldMatrix(true, true);
        const meshes: { name: string; visible: boolean; position: Triple; scale: Triple }[] = [];
        this.group.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            let visible = object.visible;
            for (let parent = object.parent; parent; parent = parent.parent) visible &&= parent.visible;
            object.getWorldPosition(this.worldPosition);
            object.getWorldScale(this.worldScale);
            meshes.push({ name: object.name, visible, position: this.worldPosition.toArray(), scale: this.worldScale.toArray() });
        });
        if (this.active) {
            this.active.getWorldPosition(this.worldPosition);
            this.active.getWorldScale(this.worldScale);
        } else {
            this.worldPosition.set(0, 0, 0);
            this.worldScale.set(0, 0, 0);
        }
        return { kind: this.kind, phase: this.phase, owner: this.owner, progress: this.progress, reduced: this.reduced,
            visible: meshes.some(object => object.visible), position: this.worldPosition.toArray(), scale: this.worldScale.toArray(), meshes };
    }

    dispose() {
        if (this.disposed) return;
        this.update();
        disposeGeometry(this.group);
        this.group.clear();
        this.group.removeFromParent();
        this.disposed = true;
    }
}
