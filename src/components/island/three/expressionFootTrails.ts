import * as THREE from 'three';
import type { IslandExpressionSelection, IslandExpressionTrailId } from '../../../domain/island/expression';
import type { IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandResident } from './animals';
import { residentGroundHeight } from './navigation';
import type { ResidentSpecies } from './residentRig';

export const EXPRESSION_TRAIL_LIFETIME_MS = 1200;
export const EXPRESSION_TRAIL_POOL_PER_RESIDENT = 8;
interface Mark { group: THREE.Group; leaf: THREE.Mesh; ring: THREE.Mesh; born: number; active: boolean; style: IslandExpressionTrailId | null; contact: THREE.Vector3; foot: number }
interface Foot { grounded: boolean; stamped?: THREE.Vector3 }
interface Track { root?: THREE.Vector3; feet: Foot[]; marks: Mark[]; style: IslandExpressionTrailId | null; walking: boolean }

/** A point on the actual ellipsoid sole, transformed by its real foot matrix.
 * It works for ordinary steps and the same rigs borrowed by physical jobs. */
export function expressionFootContact(resident: IslandResident, index: number, out = new THREE.Vector3()) {
    const foot = resident.feet[index]; foot.updateWorldMatrix(true, false);
    return out.set(0, -1, 0).applyMatrix4(foot.matrixWorld);
}

/** One finite world-space pool. Creation is driven by measured foot landing and
 * root movement, never by elapsed frames, a pretend path, or an idle timer. */
export class ExpressionFootTrails {
    readonly group = new THREE.Group();
    private readonly tracks = new Map<ResidentSpecies, Track>();
    private readonly leafGeometry: THREE.ShapeGeometry;
    private readonly ringGeometry = new THREE.RingGeometry(.067, .081, 24);
    private readonly materials: THREE.MeshBasicMaterial[] = [];
    private disposed = false;

    constructor(private readonly residents: readonly IslandResident[]) {
        this.group.name = 'expression-ground-trails';
        const leaf = new THREE.Shape(); leaf.moveTo(0, -.092); leaf.bezierCurveTo(-.086, -.047, -.060, .038, 0, .100);
        leaf.bezierCurveTo(.060, .038, .086, -.047, 0, -.092); this.leafGeometry = new THREE.ShapeGeometry(leaf, 8);
        for (const resident of residents) {
            const marks: Mark[] = [];
            for (let i = 0; i < EXPRESSION_TRAIL_POOL_PER_RESIDENT; i++) {
                const group = new THREE.Group(), leafMat = this.material('#6f8c4e'), ringMat = this.material('#599da9');
                const leafMesh = new THREE.Mesh(this.leafGeometry, leafMat), ringMesh = new THREE.Mesh(this.ringGeometry, ringMat);
                leafMesh.rotation.x = ringMesh.rotation.x = -Math.PI / 2;
                group.add(leafMesh, ringMesh); group.name = `${resident.species}-foot-mark-${i}`; group.visible = false; this.group.add(group);
                marks.push({ group, leaf: leafMesh, ring: ringMesh, born: 0, active: false, style: null, contact: new THREE.Vector3(), foot: 0 });
            }
            this.tracks.set(resident.species, { feet: [{ grounded: true }, { grounded: true }], marks, style: null, walking: false });
        }
    }
    private material(color: string) {
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide });
        this.materials.push(material); return material;
    }
    update(selection: IslandExpressionSelection | undefined, walking: ReadonlySet<ResidentSpecies>, land: IslandLandAccess, now: number,
        active: boolean, reduced: boolean) {
        if (this.disposed) return false;
        if (!active) { this.clear(); return false; }
        let moving = false;
        for (const resident of this.residents) {
            const track = this.tracks.get(resident.species)!;
            const style = selection?.residents[resident.species].trail ?? null;
            if (style !== track.style || !resident.group.visible) { this.clearTrack(track); track.style = style; }
            const isWalking = Boolean(style && resident.group.visible && walking.has(resident.species));
            const root = resident.group.getWorldPosition(new THREE.Vector3());
            const displacement = track.root ? Math.hypot(root.x - track.root.x, root.z - track.root.z) : 0;
            const moved = displacement > .0001 && displacement < 1.0;
            for (let i = 0; i < 2; i++) {
                const contact = expressionFootContact(resident, i), ground = residentGroundHeight(contact, land);
                const grounded = Math.abs(contact.y - ground) <= .024;
                const foot = track.feet[i];
                const newlyPlanted = !foot.grounded || !track.walking || !foot.stamped
                    || reduced && foot.stamped.distanceTo(contact) > .12;
                if (isWalking && moved && grounded && newlyPlanted) this.stamp(track, style!, contact, i, resident.group.rotation.y, now, reduced);
                foot.grounded = grounded;
            }
            track.root = root; track.walking = isWalking;
            for (const [index, mark] of track.marks.entries()) {
                if (reduced && index >= 2 || !mark.active || now - mark.born >= EXPRESSION_TRAIL_LIFETIME_MS || now < mark.born) {
                    mark.active = mark.group.visible = false; continue;
                }
                moving = true;
                const t = (now - mark.born) / EXPRESSION_TRAIL_LIFETIME_MS;
                mark.group.visible = true;
                mark.ring.scale.setScalar(reduced ? 1 : 1 + t * .65);
                const material = (mark.style === 'leaf-trail' ? mark.leaf : mark.ring).material as THREE.MeshBasicMaterial;
                material.opacity = .62 * (reduced ? 1 : 1 - t);
            }
        }
        return moving;
    }
    private stamp(track: Track, style: IslandExpressionTrailId, contact: THREE.Vector3, foot: number, yaw: number, now: number, reduced: boolean) {
        const available = reduced ? track.marks.slice(0, 2) : track.marks;
        const mark = available.find(candidate => !candidate.active) ?? available.reduce((oldest, candidate) => candidate.born < oldest.born ? candidate : oldest);
        mark.born = now; mark.style = style; mark.active = true; mark.foot = foot; mark.contact.copy(contact);
        mark.group.position.copy(contact); mark.group.position.y += .012; mark.group.rotation.y = yaw;
        mark.leaf.visible = style === 'leaf-trail'; mark.ring.visible = style === 'water-ring-trail';
        track.feet[foot].stamped = contact.clone();
    }
    private clearTrack(track: Track) {
        track.root = undefined; track.walking = false; track.feet = [{ grounded: true }, { grounded: true }];
        track.marks.forEach(mark => { mark.active = mark.group.visible = false; });
    }
    clear() { this.tracks.forEach(track => this.clearTrack(track)); }
    describe() {
        return this.residents.map(resident => {
            const track = this.tracks.get(resident.species)!;
            return { residentId: resident.species, residentUuid: resident.group.uuid, style: track.style, walking: track.walking,
                marks: track.marks.map(mark => ({ uuid: mark.group.uuid, visible: mark.group.visible, style: mark.style, foot: mark.foot,
                    born: mark.born, contact: mark.contact.toArray(), position: mark.group.position.toArray(), ringScale: mark.ring.scale.x })) };
        });
    }
    dispose() {
        if (this.disposed) return; this.disposed = true; this.clear(); this.group.removeFromParent(); this.group.clear();
        this.leafGeometry.dispose(); this.ringGeometry.dispose(); this.materials.forEach(material => material.dispose());
    }
}
