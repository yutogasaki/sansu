import * as THREE from 'three';
import { SHARED_DISPLAY_RADII } from '../../../domain/island/sharedDisplayGeometry';
import { SHARED_DISPLAY_IDS, sharedDisplayKey, type SharedDisplay, type SharedDisplayId, type SharedTarget } from '../../../domain/island/sharedMemories';
import { getIslandWorkshop, getWorkshopSpecimenName } from '../../../domain/island/workshop';
import { WORKSHOP_PART_IDS, type WorkshopPartId } from '../../../domain/island/workshopLayout';
import type { IslandRecord } from '../../../domain/island/types';
import { batch, box, cylinder, disposeGeometry, ellipsoid, IslandMaterials, mesh } from './primitives';
import { makeWorkshopPart, makeWorkshopSpecimen, WORKSHOP_CELL_SIZE, workshopAnchorToWorld,
    type WorkshopPartVisual, type WorkshopSpecimenVisual } from './workshopGeometry';

export const SHARED_DISPLAY_SCENE_CANDIDATE = 'island-shared-display-v1';
export const SHARED_DISPLAY_TABLE_Y = .52;
export const SHARED_DISPLAY_TARGET_Y = .535;
export const SHARED_DISPLAY_TARGET_Z = .10;
export const SHARED_DISPLAY_WORK_SCALE = .22;
export const SHARED_DISPLAY_SPECIMEN_SCALE = .62;

export interface SharedSpecimenAppearance { cleanedMask: number; name: string; identified: boolean }
export interface SharedDisplayTargetVisual {
    /** This is the actual owned object. A carrier may reparent it with Object3D.attach. */
    group: THREE.Group;
    specimen?: WorkshopSpecimenVisual;
    parts: Partial<Record<WorkshopPartId, WorkshopPartVisual>>;
    name: string;
    appearance?: SharedSpecimenAppearance;
    updateAppearance(appearance: SharedSpecimenAppearance): boolean;
    anchors(): { center: THREE.Vector3; gripLeft: THREE.Vector3; gripRight: THREE.Vector3;
        surface: THREE.Vector3; partSurfaces: Partial<Record<WorkshopPartId, THREE.Vector3>> };
    bounds(): THREE.Box3;
    dispose(): void;
}
export interface SharedDisplaySceneOptions { active?: boolean; selectedDisplayId?: SharedDisplayId }
export interface SharedDisplayAnchors {
    center: THREE.Vector3;
    surface: THREE.Vector3;
    gripLeft: THREE.Vector3;
    gripRight: THREE.Vector3;
    partSurfaces: Partial<Record<WorkshopPartId, THREE.Vector3>>;
    /** Fixed legal placement point, even while the actual object is being carried. */
    destination: THREE.Vector3;
    petals: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    preparation: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    returnPlate: THREE.Vector3;
    lightReceiver: THREE.Vector3;
    /** Candidate standing points, not an assertion that a route is clear. */
    approaches: THREE.Vector3[];
}
export interface SharedDisplayDescription {
    displayId: SharedDisplayId;
    displayKey: string;
    targetKey: string;
    kind: SharedTarget['kind'];
    name: string;
    identified?: boolean;
    cleanedMask?: number;
    visibleSand?: number[];
    arrangement: SharedDisplay['arrangement'];
    radius: number;
    targetUuid: string;
    carried: boolean;
    anchors: SharedDisplayAnchors;
    /** Live geometry only: no invisible sand/frame/selection enlarges a photo. */
    targetBounds: THREE.Box3;
    tableBounds: THREE.Box3;
    displayBounds: THREE.Box3;
}
export interface SharedDisplayHit { displayId: SharedDisplayId; targetKey: string; point: THREE.Vector3; distance: number }

const world = (object: THREE.Object3D, point: THREE.Vector3) => {
    object.updateWorldMatrix(true, false); return object.localToWorld(point.clone());
};
const shown = (object: THREE.Object3D, stop?: THREE.Object3D) => {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
        if (!current.visible) return false;
        if (current === stop) break;
    }
    return true;
};
function visibleBounds(object: THREE.Object3D) {
    object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    object.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !shown(child, object)) return;
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
    });
    return bounds;
}
function ring(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], radius: number, tube: number) {
    const result = mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 48), material, position);
    result.rotation.x = -Math.PI / 2; return result;
}
function staticChildren(group: THREE.Object3D, m: IslandMaterials, keep: (THREE.Object3D | undefined)[] = []) {
    const fixed = new THREE.Group();
    for (const child of [...group.children]) if (!keep.includes(child)) fixed.add(child);
    batch(fixed, m.painted); group.add(fixed);
}

/** Reuses the inlet's real materials/shapes. A work is constructed exclusively
 * from its capture; this builder never looks at a current saved-work slot.
 * Specimens require an explicit appearance so memory callers can supply history. */
export function makeSharedDisplayTarget(target: SharedTarget, appearance?: SharedSpecimenAppearance): SharedDisplayTargetVisual {
    if (target.kind === 'specimen' && !appearance) throw new Error('A specimen display needs its recorded appearance');
    const group = new THREE.Group(), content = new THREE.Group(), m = new IslandMaterials();
    group.name = 'shared-display-target'; group.userData.targetKey = target.targetKey;
    content.position.y = .055; group.add(content);
    const parts: SharedDisplayTargetVisual['parts'] = {};
    let specimen: WorkshopSpecimenVisual | undefined, glass: THREE.MeshPhysicalMaterial | undefined;
    const tray = new THREE.Group(); tray.name = 'shared-carry-tray'; group.add(tray);
    // Two front handles can be reached from outside the table footprint.
    // Their actual geometry and hand anchors share these same local points.
    const grip = target.kind === 'work' ? .30 : .26, gripZ = target.kind === 'work' ? .49 : .30;
    if (target.kind === 'specimen') {
        ellipsoid(tray, m.get('#987149'), [0, .025, 0], [.54, .026, .34], 24);
        ellipsoid(tray, m.get('#f5dcaa'), [0, .039, 0], [.505, .012, .31], 24);
        content.scale.setScalar(SHARED_DISPLAY_SPECIMEN_SCALE);
        glass = new THREE.MeshPhysicalMaterial({ color: '#289b78', roughness: .23, metalness: 0,
            transparent: true, opacity: .85, clearcoat: .7 });
        glass.userData.sharedTransmits = true;
        specimen = makeWorkshopSpecimen(target.specimenId, m, glass); content.add(specimen.group);
        staticChildren(specimen.group, m, specimen.patches);
        specimen.patches.forEach(patch => staticChildren(patch, m));
    } else {
        box(tray, m.get('#76597d'), [0, .028, 0], [1.04, .056, 1.04]);
        box(tray, m.get('#a8c7ba'), [0, .059, 0], [1.01, .012, 1.01]);
        content.position.y = .074; content.scale.setScalar(SHARED_DISPLAY_WORK_SCALE);
        for (let n = 0; n <= 4; n++) {
            const p = (n - 2) * WORKSHOP_CELL_SIZE * SHARED_DISPLAY_WORK_SCALE;
            box(tray, m.get('#698e8c'), [p, .066, 0], [.006, .002, .95]);
            box(tray, m.get('#698e8c'), [0, .066, p], [.95, .002, .006]);
        }
        for (const id of WORKSHOP_PART_IDS) {
            const saved = target.layout.parts[id];
            if (!saved.position) continue;
            const part = makeWorkshopPart(id, m); parts[id] = part; content.add(part.group);
            // The same cached material used only by the real rotor window.
            if (id === 'wheel') m.surface('#77cbb2', .25).userData.sharedTransmits = true;
            part.group.position.copy(workshopAnchorToWorld(saved.position, 0));
            part.group.rotation.y = -saved.rotation * Math.PI / 2;
            part.finished.visible = saved.assembled; part.frame.visible = !saved.assembled;
            staticChildren(part.finished, m, [part.rotor, part.bell]);
            if (part.rotor) batch(part.rotor, m.painted);
            if (part.bell) batch(part.bell, m.painted);
            batch(part.frame, m.painted); batch(part.insert, m.painted);
        }
    }
    for (const x of [-grip, grip]) {
        ellipsoid(tray, m.get('#e2b477'), [x, .035, gripZ], [.10, .027, .045], 12);
    }
    batch(tray, m.painted);
    group.traverse(object => { delete object.userData.workshopHit; });
    let disposed = false;
    const visual: SharedDisplayTargetVisual = {
        group, specimen, parts, name: target.kind === 'work' ? target.name : appearance!.name,
        updateAppearance(next) {
            if (disposed || !specimen) return false;
            const previous = visual.appearance;
            const changed = !previous || previous.cleanedMask !== next.cleanedMask || previous.name !== next.name || previous.identified !== next.identified;
            visual.appearance = { ...next }; visual.name = next.name;
            group.userData.targetName = next.name; group.userData.identified = next.identified;
            specimen.patches.forEach((patch, section) => { patch.visible = !(next.cleanedMask & 1 << section); });
            return changed;
        },
        anchors() {
            const bounds = visibleBounds(group), partSurfaces: SharedDisplayAnchors['partSurfaces'] = {};
            for (const id of WORKSHOP_PART_IDS) {
                const part = parts[id];
                if (!part?.finished.visible) continue;
                const point = id === 'wheel' ? new THREE.Vector3(.229, .35, .09)
                    : id === 'bell' ? new THREE.Vector3(.08, .33, .16) : new THREE.Vector3(0, .245, id === 'elbow' ? -.24 : .24);
                partSurfaces[id] = world(part.group, point);
            }
            let surface = partSurfaces.wheel ?? partSurfaces.bell ?? partSurfaces.straight ?? partSurfaces.elbow ?? bounds.getCenter(new THREE.Vector3());
            if (specimen) {
                const meshes: THREE.Mesh[] = [];
                specimen.group.traverse(object => { if (object instanceof THREE.Mesh && shown(object, group)) meshes.push(object); });
                const above = world(specimen.group, new THREE.Vector3(0, 2, 0));
                const down = world(specimen.group, new THREE.Vector3()).sub(above).normalize();
                surface = new THREE.Raycaster(above, down).intersectObjects(meshes, false)[0]?.point ?? bounds.getCenter(new THREE.Vector3());
            }
            return { center: bounds.getCenter(new THREE.Vector3()), surface,
                gripLeft: world(group, new THREE.Vector3(-grip, .035, gripZ)), gripRight: world(group, new THREE.Vector3(grip, .035, gripZ)), partSurfaces };
        },
        bounds: () => visibleBounds(group),
        dispose() {
            if (disposed) return;
            disposed = true; group.removeFromParent(); disposeGeometry(group); m.dispose(); glass?.dispose(); group.clear();
        },
    };
    group.userData.targetName = visual.name;
    if (appearance && target.kind === 'specimen') visual.updateAppearance(appearance);
    return visual;
}

interface DisplaySlot {
    group: THREE.Group;
    table: THREE.Group;
    target: SharedDisplayTargetVisual;
    petals: [THREE.Mesh, THREE.Mesh, THREE.Mesh];
    preparation: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    returnPlate: THREE.Vector3;
    selection: THREE.Mesh;
    materials: IslandMaterials;
    ownsTarget: boolean;
    display: SharedDisplay;
    key: string;
}
function makeSlot(display: SharedDisplay, appearance?: SharedSpecimenAppearance, retainedTarget?: SharedDisplayTargetVisual): DisplaySlot {
    const group = new THREE.Group(), table = new THREE.Group(), m = new IslandMaterials();
    const radius = SHARED_DISPLAY_RADII[display.target.kind], work = display.target.kind === 'work';
    group.add(table); table.name = 'shared-display-table';
    cylinder(table, m.get('#aa7851'), [0, .285, 0], radius * .35, .43, radius * .27, 20);
    cylinder(table, m.get('#a67a53'), [0, .055, 0], radius * .57, .09, radius * .53, 28);
    // Keep the support bottom at .42 and its cap below the .512–.52 top slab.
    // Two opaque caps at .52 otherwise produce radial depth fighting after batching.
    cylinder(table, m.get('#9b725c'), [0, .465, 0], radius - .045, .09, radius - .045, 48);
    cylinder(table, m.get('#f3e0b6'), [0, .516, 0], radius - .073, .008, radius - .073, 48);
    ring(table, m.get('#dfb780'), [0, .516, 0], radius - .052, .013);
    const preparation: DisplaySlot['preparation'] = [-1, 0, 1].map(x => new THREE.Vector3(x * (work ? .16 : .12), .55, work ? -.69 : -.46)) as DisplaySlot['preparation'];
    ellipsoid(table, m.get('#bc8f65'), [0, .535, work ? -.69 : -.46], [work ? .27 : .22, .02, .1], 20);
    for (const p of preparation) {
        cylinder(table, m.get('#745b58'), p.toArray() as [number, number, number], .044, .005, .044, 16);
        ring(table, m.get('#efc991'), [p.x, p.y + .005, p.z], .047, .008);
    }
    const returnPlate = new THREE.Vector3(work ? .66 : .43, .55, work ? -.51 : -.35);
    cylinder(table, m.get('#877cab'), [returnPlate.x, .536, returnPlate.z], work ? .105 : .085, .023, undefined, 24);
    cylinder(table, m.get('#f8efda'), returnPlate.toArray() as [number, number, number], work ? .09 : .073, .008, undefined, 24);
    batch(table, m.painted);
    const petalPositions = work ? [[-.72, -.08], [.72, -.08], [0, .81]] : [[-.54, -.17], [.54, -.17], [0, .57]];
    const petals = petalPositions.map(([x, z], index) => {
        const petal = ellipsoid(group, m.get(index === 1 ? '#d16d9c' : '#e89cbb'), [x, .541, z], [work ? .083 : .062, .016, .043], 14);
        petal.name = `shared-display-petal-${index + 1}`; petal.rotation.y = index === 0 ? -.65 : index === 1 ? .65 : Math.PI / 2;
        return petal;
    }) as DisplaySlot['petals'];
    const selection = ring(group, m.get('#ffe29a', true), [0, .53, 0], radius - .02, .012);
    selection.name = 'shared-display-selection'; selection.visible = false; selection.castShadow = false;
    const target = retainedTarget ?? makeSharedDisplayTarget(display.target, appearance);
    // A retained target may still be in the actor's hands until its visible
    // placement is acknowledged. Never replace/reparent it during a save update.
    if (!target.group.parent) {
        target.group.position.set(0, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z);
        target.group.quaternion.identity(); target.group.scale.setScalar(1); group.add(target.group);
    }
    return { group, table, target, petals, preparation, returnPlate, selection, materials: m, ownsTarget: true, display, key: '' };
}

/** Static main-world displays. This controller owns no clock, renderer, input
 * listener, persistence, or learning callback. The runtime owns acting/framing. */
export class IslandSharedDisplayScene {
    readonly group = new THREE.Group();
    private readonly slots = new Map<SharedDisplayId, DisplaySlot>();
    private profileId?: string;
    private disposed = false;
    constructor() { this.group.name = SHARED_DISPLAY_SCENE_CANDIDATE; this.group.visible = false; }

    private remove(id: SharedDisplayId, keepTarget = false) {
        const slot = this.slots.get(id);
        if (!slot) return;
        if (slot.ownsTarget) {
            if (keepTarget) { if (slot.target.group.parent === slot.group) slot.target.group.removeFromParent(); }
            else slot.target.dispose();
        }
        slot.group.removeFromParent(); disposeGeometry(slot.group); slot.materials.dispose(); slot.group.clear(); this.slots.delete(id);
    }

    update(island: IslandRecord, options: SharedDisplaySceneOptions = {}) {
        if (this.disposed) return false;
        let changed = false;
        if (this.profileId !== island.profileId) {
            this.slots.forEach((_, id) => this.remove(id)); this.profileId = island.profileId; changed = true;
        }
        const displays = island.sharedMemories?.displays ?? {};
        const wanted = new Set(Object.values(displays).map(display => display?.target.targetKey));
        const retained = new Map<string, SharedDisplayTargetVisual>();
        this.slots.forEach((slot, id) => {
            if (displays[id]?.target.targetKey === slot.display.target.targetKey) return;
            const key = slot.display.target.targetKey, keep = slot.ownsTarget && wanted.has(key);
            if (keep) retained.set(key, slot.target);
            this.remove(id, keep); changed = true;
        });
        const workshop = SHARED_DISPLAY_IDS.some(id => displays[id]?.target.kind === 'specimen') ? getIslandWorkshop(island) : undefined;
        for (const id of SHARED_DISPLAY_IDS) {
            const display = displays[id]; let slot = this.slots.get(id);
            if (!display) { if (slot) { this.remove(id); changed = true; } continue; }
            const specimen = display.target.kind === 'specimen' ? workshop!.specimens[display.target.specimenId] : undefined;
            const appearance = specimen && display.target.kind === 'specimen' ? { cleanedMask: specimen.cleanedMask,
                name: getWorkshopSpecimenName(workshop!, display.target.specimenId), identified: Boolean(specimen.identity) } : undefined;
            if (slot && slot.display.target.targetKey !== display.target.targetKey) { this.remove(id); slot = undefined; }
            if (!slot) {
                slot = makeSlot(display, appearance, retained.get(display.target.targetKey)); slot.group.name = `shared-${id}`; slot.group.userData.sharedDisplayId = id;
                this.slots.set(id, slot); this.group.add(slot.group); changed = true;
            }
            const key = sharedDisplayKey(display)!;
            if (key !== slot.key) {
                slot.group.position.set(display.position.x, 0, display.position.z); slot.group.rotation.y = display.rotation;
                slot.petals.forEach(petal => { petal.visible = display.arrangement === 'petal-ring'; });
                slot.key = key; slot.display = display; changed = true;
            }
            if (appearance && slot.ownsTarget) changed = slot.target.updateAppearance(appearance) || changed;
            const selected = options.selectedDisplayId === id;
            if (slot.selection.visible !== selected) { slot.selection.visible = selected; changed = true; }
        }
        const visible = options.active !== false && this.slots.size > 0;
        if (this.group.visible !== visible) { this.group.visible = visible; changed = true; }
        this.group.updateWorldMatrix(true, true); return changed;
    }

    targetObject(displayId: SharedDisplayId) { return this.targetVisual(displayId)?.group; }
    targetVisual(displayId: SharedDisplayId) {
        const slot = this.slots.get(displayId); return slot?.ownsTarget ? slot.target : undefined;
    }

    /** Transfer ownership out of a preview scene, keeping the table in place.
     * The detached object retains its world pose and is safe to attach elsewhere.
     * Its recipient must adopt it into another scene or eventually dispose it. */
    releaseTarget(displayId: SharedDisplayId) {
        const slot = this.slots.get(displayId);
        if (this.disposed || !slot?.ownsTarget) return undefined;
        const target = slot.target, object = target.group;
        object.updateWorldMatrix(true, true); const matrix = object.matrixWorld.clone();
        object.removeFromParent(); matrix.decompose(object.position, object.quaternion, object.scale);
        object.updateWorldMatrix(true, true); slot.ownsTarget = false; return target;
    }

    /** Accept a previously unexhibited owned object after its display commits.
     * true transfers disposal responsibility to this scene; false changes nothing.
     * The caller still controls its pose until restoreTarget(). */
    adoptTarget(displayId: SharedDisplayId, target: SharedDisplayTargetVisual) {
        const slot = this.slots.get(displayId);
        if (this.disposed || !slot || target.group.userData.targetKey !== slot.display.target.targetKey) return false;
        if (slot.target === target) { slot.ownsTarget = true; return true; }
        if ([...this.slots.values()].some(other => other !== slot && other.ownsTarget && other.target === target)) return false;
        const appearance = slot.target.appearance;
        if (slot.ownsTarget) slot.target.dispose();
        slot.target = target; slot.ownsTarget = true;
        if (appearance) target.updateAppearance(appearance);
        return true;
    }

    /** Explicit cancellation/placement boundary. Restore the same instance to
     * its current saved destination; update() never calls this during acting. */
    restoreTarget(displayId: SharedDisplayId) {
        const slot = this.slots.get(displayId);
        if (this.disposed || !slot?.ownsTarget) return false;
        slot.group.add(slot.target.group);
        slot.target.group.position.set(0, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z);
        slot.target.group.quaternion.identity(); slot.target.group.scale.setScalar(1);
        slot.target.group.updateWorldMatrix(true, true); return true;
    }

    anchors(displayId: SharedDisplayId): SharedDisplayAnchors | undefined {
        const slot = this.slots.get(displayId);
        if (!slot?.ownsTarget) return undefined;
        const radius = SHARED_DISPLAY_RADII[slot.display.target.kind];
        return { ...slot.target.anchors(), destination: world(slot.group, new THREE.Vector3(0, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z)),
            petals: slot.petals.map(petal => world(petal, new THREE.Vector3())) as SharedDisplayAnchors['petals'],
            preparation: slot.preparation.map(point => world(slot.group, point)) as SharedDisplayAnchors['preparation'],
            returnPlate: world(slot.group, slot.returnPlate), lightReceiver: world(slot.group, new THREE.Vector3(0, .525, -radius * .72)),
            approaches: [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(angle => world(slot.group,
                new THREE.Vector3(Math.sin(angle) * (radius + .36), 0, Math.cos(angle) * (radius + .36)))) };
    }

    describe(): SharedDisplayDescription[] {
        return SHARED_DISPLAY_IDS.flatMap(displayId => {
            const slot = this.slots.get(displayId);
            if (!slot?.ownsTarget) return [];
            const targetBounds = slot.target.bounds(), tableBounds = visibleBounds(slot.table);
            const displayBounds = tableBounds.clone().union(targetBounds);
            slot.petals.filter(petal => petal.visible).forEach(petal => displayBounds.union(visibleBounds(petal)));
            return [{ displayId, displayKey: slot.key, targetKey: slot.display.target.targetKey, kind: slot.display.target.kind,
                name: slot.target.name, ...(slot.target.appearance ? { ...slot.target.appearance,
                    visibleSand: slot.target.specimen!.patches.flatMap((patch, index) => patch.visible ? [index] : []) } : {}),
                arrangement: slot.display.arrangement, radius: SHARED_DISPLAY_RADII[slot.display.target.kind], targetUuid: slot.target.group.uuid,
                carried: slot.target.group.parent !== slot.group, anchors: this.anchors(displayId)!, targetBounds, tableBounds, displayBounds }];
        });
    }

    selectHit(ray: THREE.Ray): SharedDisplayHit | undefined {
        if (this.disposed || !shown(this.group)) return undefined;
        this.group.updateWorldMatrix(true, true);
        const raycaster = new THREE.Raycaster(); raycaster.ray.copy(ray);
        const objects: THREE.Mesh[] = [];
        this.group.traverse(object => { if (object instanceof THREE.Mesh && shown(object) && object.name !== 'shared-display-selection') objects.push(object); });
        for (const hit of raycaster.intersectObjects(objects, false)) {
            let object: THREE.Object3D | null = hit.object;
            while (object && !object.userData.sharedDisplayId) object = object.parent;
            const displayId = object?.userData.sharedDisplayId as SharedDisplayId | undefined;
            const slot = displayId && this.slots.get(displayId);
            if (slot) return { displayId: displayId!, targetKey: slot.display.target.targetKey, point: hit.point.clone(), distance: hit.distance };
        }
        return undefined;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.slots.forEach((_, id) => this.remove(id)); this.group.removeFromParent(); this.group.clear(); this.group.visible = false;
    }
}
