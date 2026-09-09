import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND_LEARNING_KEEPSAKES, isIslandLearningKeepsakeAvailable,
    type IslandLearningKeepsakeId, type IslandLearningKeepsakesState } from '../../../domain/island/learningKeepsakes';
import { roundedBoxGeometry } from './geometry';
import { cylinder, ellipsoid, mesh, star } from './primitives';

export type IslandChallengeDisplayId = 'certificate' | 'trophy';

export const ISLAND_KEEPSAKE_SCENERY_CANDIDATE = 'island-home-interior-v4';
export const ISLAND_KEEPSAKE_VIEW = {
    target: [0, 1.65, 1.9], position: [6, 8, 13], minimumHeight: 5.7,
} as const;
export interface IslandKeepsakeFrameView {
    target: [number, number, number]; position: [number, number, number]; minimumHeight: number;
    selectedId: IslandLearningKeepsakeId | null;
}

export type IslandHomeHit = { type: 'keepsake'; id: IslandLearningKeepsakeId } | { type: 'album' } | { type: 'notices' };

/** A closed, static interior for the same island renderer. It never owns or hides the
 * island, changes learning state, or exhibits an unavailable award. Leaving the
 * room retires all its resources; an active selection keeps the actual objects. */
export class IslandLearningKeepsakeScenery {
    readonly group = new THREE.Group();
    private readonly awards = new Map<IslandLearningKeepsakeId, THREE.Group>();
    private readonly challengeAwards = new Map<IslandChallengeDisplayId, THREE.Group>();
    private challengeSelection: IslandChallengeDisplayId[] = [];
    private readonly materials = new Set<THREE.Material>();
    private built = false;
    private disposed = false;
    private selectedId: IslandLearningKeepsakeId | null = null;
    private selection: IslandLearningKeepsakeId[] = [];

    constructor() { this.group.name = ISLAND_KEEPSAKE_SCENERY_CANDIDATE; this.group.visible = false; }
    private material(color: string, metalness = 0) {
        const result = new THREE.MeshStandardMaterial({ color, roughness: metalness ? .48 : .87, metalness });
        this.materials.add(result); return result;
    }
    private build() {
        if (this.built) return;
        this.built = true;
        const wood = this.material('#bd844d'), dark = this.material('#31476a'), paper = this.material('#fff4d3');
        const gold = this.material('#e8b64d', .22), teal = this.material('#3d9b88'), coral = this.material('#cf6957');
        const ivory = this.material('#f5e8cf'), floor = this.material('#e6cca4'), blue = this.material('#5962ad');
        const cabinet = this.material('#567ea9'), plum = this.material('#8263a9');
        // A finite, warm indoor fill belongs to this room and is retired on
        // exit. It never changes the island's daylight or shadow settings.
        const fill = new THREE.PointLight('#fff5e6', 3, 9, 2);
        fill.name = 'home-interior-fill'; fill.position.set(0, 3.55, 2.45);
        this.group.add(fill);
        mesh(this.group, roundedBoxGeometry([6.8, 4.1, .13], .035, 1), plum, [0, 2.05, -.35]).name = 'keepsake-room-wall';
        mesh(this.group, new THREE.BoxGeometry(.14, 4.1, 5.3), blue, [-3.38, 2.05, 2.2]).name = 'keepsake-room-side-wall';
        mesh(this.group, roundedBoxGeometry([6.85, .13, 5.3], .04, 1), floor, [0, -.07, 2.2]).name = 'keepsake-room-floor';
        mesh(this.group, new THREE.BoxGeometry(.14, 4.16, 5.3), ivory, [3.38, 2.05, 2.2]).name = 'home-right-wall';
        mesh(this.group, new THREE.BoxGeometry(6.85, .14, 5.36), paper, [0, 4.15, 2.2]).name = 'home-ceiling';
        mesh(this.group, new THREE.BoxGeometry(6.85, 4.16, .14), blue, [0, 2.05, 4.84]).name = 'home-entry-wall';
        mesh(this.group, new THREE.BoxGeometry(1.3, 2.75, .035), wood, [1.84, 1.375, 4.751]).name = 'home-front-door';
        ellipsoid(this.group, gold, [1.36, 1.2, 4.713], [.06, .06, .035], 10);
        // Opaque daylight glass closes the window: no hole into the exterior sea.
        mesh(this.group, new THREE.BoxGeometry(.05, 1.42, 1.46), wood, [3.279, 2.38, 1.05]).name = 'home-window-frame';
        mesh(this.group, new THREE.BoxGeometry(.016, 1.20, 1.24), this.material('#bce1dc'), [3.246, 2.38, 1.05]).name = 'home-window-glass';
        mesh(this.group, new THREE.BoxGeometry(.026, 1.20, .055), paper, [3.223, 2.38, 1.05]);
        mesh(this.group, new THREE.BoxGeometry(.026, .055, 1.24), paper, [3.223, 2.38, 1.05]);
        mesh(this.group, roundedBoxGeometry([6.5, .1, .08], .015), wood, [0, .09, -.23]);
        mesh(this.group, roundedBoxGeometry([6.5, .09, .085], .015), blue, [0, 3.96, -.23]);
        // A substantial wooden cabinet, with grounded sides and three real
        // shelf boards. The available space stays finite even when empty.
        for (const x of [-.88, 3.08]) mesh(this.group, roundedBoxGeometry([.1, 3.69, .58], .018), cabinet, [x, 1.845, .10]);
        for (const y of [.06, .54, 1.66, 2.78, 3.70]) {
            mesh(this.group, roundedBoxGeometry([4.06, .06, .65], .018, 1), wood, [1.1, y, .10]).name = 'keepsake-room-shelf-board';
        }
        for (let i = 0; i < 6; i++) mesh(this.group, new THREE.BoxGeometry(.016, .004, 5.12), wood, [-2.75 + i * 1.08, .001, 2.2]);
        // The awards live in a furnished home: a reading seat, a book on the
        // table and a small notice board share the space with the actual shelf.
        const mint = this.material('#4d9b9b'), fabric = this.material('#d98098');
        mesh(this.group, roundedBoxGeometry([3.9, .025, 2.35], .12), mint, [.25, .018, 2.52]).name = 'home-rug';
        mesh(this.group, roundedBoxGeometry([1.7, .38, 1.1], .18), fabric, [-2.13, .38, 2.1]).name = 'home-reading-seat';
        const detailStart = this.group.children.length;
        mesh(this.group, roundedBoxGeometry([.32, 1.2, 1.15], .15), fabric, [-2.97, .6, 2.1]);
        mesh(this.group, roundedBoxGeometry([.55, .3, .66], .1), paper, [-2.4, .65, 2.1]);
        // A curved upholstered back and a large stitched cushion make a place
        // to sit, without introducing pretend awards into the empty cabinet.
        ellipsoid(this.group, fabric, [-2.16, .80, 1.64], [.84, .66, .16], 12).name = 'home-seat-back';
        const cushion = mesh(this.group, roundedBoxGeometry([.62, .19, .56], .085, 1), gold, [-2.13, .66, 2.03]);
        cushion.rotation.y = -.18;
        for (const x of [-2.32, -2.13, -1.94]) {
            mesh(this.group, new THREE.BoxGeometry(.045, .01, .39), paper, [x, .761, 2.03]);
        }
        // Broad woven bands belong only to the rug, leaving floor and walls quiet.
        for (const z of [1.50, 1.67, 3.38, 3.55]) {
            mesh(this.group, new THREE.BoxGeometry(3.65, .006, .055), paper, [.25, .034, z]);
        }
        for (const x of [-2.70, -1.54]) for (const z of [1.78, 2.43]) {
            cylinder(this.group, wood, [x, .15, z], .055, .29, .08, 10);
        }
        // Cabinet crown: one gently arched silhouette above the existing slots.
        for (let i = 0; i < 3; i++) {
            ellipsoid(this.group, cabinet, [-.28 + i * 1.38, 3.77, .1], [.76, i === 1 ? .29 : .19, .31], 10);
        }
        // Batch static fabric/wood details by material to retain the room's
        // draw-call budget. Keep interactive and framing anchors independent.
        const details = this.group.children.slice(detailStart).filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
        for (const material of new Set(details.map(object => object.material))) {
            const objects = details.filter(object => object.material === material);
            const geometries = objects.map(object => { object.updateMatrix(); return (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrix); });
            const combined = mergeGeometries(geometries);
            geometries.forEach(geometry => geometry.dispose());
            if (combined) {
                objects.forEach(object => { object.geometry.dispose(); this.group.remove(object); });
                mesh(this.group, combined, material as THREE.Material).name = 'home-furniture-detail';
            }
        }
        const table = cylinder(this.group, wood, [.55, .49, 2.52], .69, .09, .69, 32); table.name = 'home-coffee-table';
        cylinder(this.group, dark, [.55, .25, 2.52], .13, .46, .22, 12);
        const album = mesh(this.group, roundedBoxGeometry([.65, .07, .48], .025), blue, [.53, .58, 2.49]); album.rotation.y = -.18; album.name = 'home-album'; album.userData.homeAction = 'album';
        mesh(this.group, roundedBoxGeometry([.31, .012, .27], .012), paper, [.53, .624, 2.49]).userData.homeAction = 'album';
        cylinder(this.group, coral, [2.74, .29, 1.95], .27, .5, .21, 16).name = 'home-plant-pot';
        for (let i = 0; i < 4; i++) {
            const leaf = ellipsoid(this.group, teal, [2.74 + Math.sin(i * 2) * .18, .65 + i * .12, 1.95 + Math.cos(i * 2) * .14], [.13, .32, .08], 12);
            leaf.rotation.z = Math.sin(i * 2) * .7;
        }
        const notice = mesh(this.group, roundedBoxGeometry([.07, 1.08, 1.33], .04), wood, [-3.25, 2.15, .95]); notice.name = 'home-notice-board'; notice.userData.homeAction = 'notices';
        const noticePaper = mesh(this.group, new THREE.BoxGeometry(.014, .66, .49), paper, [-3.206, 2.2, .71]); noticePaper.name = 'home-notice-paper'; noticePaper.userData.homeAction = 'notices';
        mesh(this.group, new THREE.BoxGeometry(.014, .46, .42), mint, [-3.206, 2.13, 1.26]).userData.homeAction = 'notices';
        let certificateIndex = 0, trophyIndex = 0;
        for (const entry of ISLAND_LEARNING_KEEPSAKES) {
            const award = new THREE.Group(); award.name = `keepsake-${entry.id}`; award.visible = false;
            award.userData.keepsakeId = entry.id;
            const index = entry.slot === 'certificate' ? certificateIndex++ : trophyIndex++;
            if (entry.slot === 'certificate') {
                award.scale.setScalar(3.25); award.position.set(-2.08, 3.12 - index * 1.08 - .157 * 3.25, -.035);
            } else {
                const row = index < 5 ? 0 : index < 9 ? 1 : 2, column = index - (row === 0 ? 0 : row === 1 ? 5 : 9);
                const rowWidth = row === 0 ? 5 : 4;
                award.scale.setScalar(2.45);
                award.position.set(1.1 + (column - (rowWidth - 1) / 2) * .75, 2.78 - row * 1.12 + .03 - .017 * 2.45, .11);
            }
            this.awards.set(entry.id, award); this.group.add(award);
            if (entry.slot === 'certificate') {
                mesh(award, roundedBoxGeometry([.244, .276, .029], .008), wood, [0, .157, .019]).name = 'keepsake-certificate-frame';
                mesh(award, new THREE.PlaneGeometry(.209, .241), paper, [0, .157, .0345]).name = 'keepsake-certificate-paper';
                // A heading, three ruled lines and an actual embossed seal; fine
                // text belongs to the DOM record rather than a tiny raster label.
                mesh(award, new THREE.BoxGeometry(.096, .012, .003), dark, [0, .231, .037]);
                for (const [index, width] of [.145, .156, .118].entries()) {
                    mesh(award, new THREE.BoxGeometry(width, .006, .003), teal, [-.008, .199 - index * .026, .037]);
                }
                const seal = cylinder(award, coral, [.051, .07, .038], .022, .006, .022, 12);
                seal.rotation.x = Math.PI / 2; seal.name = 'keepsake-certificate-seal';
                const ribbon = mesh(award, new THREE.BoxGeometry(.016, .043, .004), gold, [.047, .045, .037]); ribbon.rotation.z = -.15;
            } else {
                const band = Math.floor(index / 4);
                for (let tier = 0; tier < band; tier++) {
                    mesh(award, roundedBoxGeometry([.184 - tier * .02, .018, .09 - tier * .008], .004),
                        tier % 2 ? gold : dark, [0, .06 + tier * .018, .012]);
                }
                const sculpture = new THREE.Group(); sculpture.position.y = band * .018; award.add(sculpture);
                mesh(award, roundedBoxGeometry([.184, .034, .09], .008), dark, [0, .034, .012]).name = 'keepsake-trophy-base';
                cylinder(sculpture, gold, [0, .086, .012], .018, .074, .014, 10);
                if (index % 4 >= 2) cylinder(sculpture, gold, [0, .135, .012], .009, .10, .008, 8);
                if (index % 4 === 0) {
                    // An open cup, including its inner bowl and two real handles.
                    const profile = [[.018, .118], [.066, .177], [.069, .214], [.059, .214], [.055, .182], [.014, .133]];
                    const bowl = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 16);
                    mesh(sculpture, bowl, gold, [0, 0, .012]).name = 'keepsake-cup-bowl';
                    for (const x of [-.065, .065]) {
                        const handle = mesh(sculpture, new THREE.TorusGeometry(.034, .009, 6, 12), gold, [x, .172, .012]);
                        handle.scale.y = 1.14; handle.name = 'keepsake-cup-handle';
                    }
                } else if (index % 4 === 1) {
                    cylinder(sculpture, teal, [0, .17, .012], .01, .115, .008, 8).name = 'keepsake-sprout-stem';
                    for (const side of [-1, 1]) {
                        const leaf = ellipsoid(sculpture, teal, [side * .042, side < 0 ? .183 : .22, .012], [.055, .026, .012], 10);
                        leaf.rotation.z = side * .48; leaf.name = 'keepsake-sprout-leaf';
                    }
                } else if (index % 4 === 3) {
                    for (let petal = 0; petal < 5; petal++) {
                        const angle = petal / 5 * Math.PI * 2;
                        ellipsoid(sculpture, gold, [Math.cos(angle) * .046, .203 + Math.sin(angle) * .046, .012], [.029, .03, .015], 10);
                    }
                    ellipsoid(sculpture, coral, [0, .203, .025], [.024, .025, .01], 10).name = 'keepsake-flower-heart';
                } else {
                    const top = star(sculpture, gold, [0, .202, .008], .075); top.scale.z = .25; top.name = 'keepsake-star-top';
                }
            }
        }
        // Two dedicated challenge slots leave all sixteen original placements intact.
        // Reuse the room's material language and geometry, with a wall certificate
        // above a separate small shelf on the right-hand wall.
        const certificate = this.awards.get('first-completion')!.clone(true);
        certificate.name = 'challenge-certificate'; certificate.userData = {};
        certificate.scale.setScalar(2.65); certificate.rotation.y = -Math.PI / 2;
        certificate.position.set(3.23, 3.52 - .157 * 2.65, .75);
        const trophy = this.awards.get('completed-5')!.clone(true);
        trophy.name = 'challenge-trophy'; trophy.userData = {};
        trophy.scale.setScalar(2.45); trophy.rotation.y = -Math.PI / 2;
        trophy.position.set(2.94, 1.02 - .017 * 2.45, .75);
        mesh(this.group, roundedBoxGeometry([.65, .06, .86], .018), wood, [3.0, .99, .75]).name = 'challenge-award-shelf';
        this.challengeAwards.set('certificate', certificate); this.challengeAwards.set('trophy', trophy);
        this.group.add(certificate, trophy);
        this.group.traverse(object => {
            if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = false; }
        });
    }

    update(state?: IslandLearningKeepsakesState, completedSets = 0, active = false, selectedId?: IslandLearningKeepsakeId, challengeDisplayed: readonly IslandChallengeDisplayId[] = []) {
        if (this.disposed) return false;
        if (!active) {
            const changed = this.built || this.group.visible;
            this.release(); this.group.visible = false; return changed;
        }
        this.build();
        const scale = this.group.getWorldScale(new THREE.Vector3()).x;
        const fill = this.group.getObjectByName('home-interior-fill') as THREE.PointLight;
        fill.intensity = 3 * scale * scale; fill.distance = 9 * scale;
        const requested = state?.version === 1 && Array.isArray(state.displayed) ? state.displayed : [];
        const next = ISLAND_LEARNING_KEEPSAKES.filter(entry => requested.includes(entry.id)
            && isIslandLearningKeepsakeAvailable({ completedSets }, entry.id)).map(entry => entry.id);
        const focus = selectedId && next.includes(selectedId) ? selectedId : null;
        const nextChallenge = (['certificate', 'trophy'] as const).filter(id => challengeDisplayed.includes(id));
        const challengeChanged = nextChallenge.join(':') !== this.challengeSelection.join(':');
        this.challengeSelection = nextChallenge;
        this.challengeAwards.forEach((group, id) => { group.visible = nextChallenge.includes(id); });
        const changed = challengeChanged || !this.group.visible || next.join(':') !== this.selection.join(':') || focus !== this.selectedId;
        this.group.visible = true; this.selection = next; this.selectedId = focus;
        this.awards.forEach((group, id) => { group.visible = next.includes(id); });
        return changed;
    }

    private focused(id = this.selectedId) {
        return id && this.group.visible && this.selection.includes(id) ? this.awards.get(id) : undefined;
    }
    selectedObject() { return this.focused(); }
    /** The first actual surface owns the tap. Never look through an opaque
     * wall or furniture to find a more convenient selectable object. */
    selectHit(ray: THREE.Ray): IslandHomeHit | undefined {
        if (!this.group.visible) return;
        this.group.updateWorldMatrix(true, true);
        const raycaster = new THREE.Raycaster(); raycaster.ray.copy(ray);
        const hit = raycaster.intersectObject(this.group, true).find(candidate => {
            for (let object: THREE.Object3D | null = candidate.object; object; object = object.parent) if (!object.visible) return false;
            return true;
        });
        for (let object: THREE.Object3D | null = hit?.object ?? null; object && object !== this.group; object = object.parent) {
            const id = object.userData.keepsakeId as IslandLearningKeepsakeId | undefined;
            if (id && this.selection.includes(id)) return { type: 'keepsake', id };
            if (object.userData.homeAction === 'album') return { type: 'album' };
            if (object.userData.homeAction === 'notices') return { type: 'notices' };
        }
    }
    /** Overview always includes the same room, independent of qualifications.
     * A close-up uses the real displayed object; hidden/unknown selection falls
     * back to the room without placing or previewing an unearned model. */
    framePoints(selectedId: IslandLearningKeepsakeId | null = this.selectedId) {
        this.group.updateWorldMatrix(true, true);
        const award = this.focused(selectedId);
        const bounds = award ? new THREE.Box3().setFromObject(award, true).expandByScalar(.08 * this.group.getWorldScale(new THREE.Vector3()).x)
            : new THREE.Box3(new THREE.Vector3(-3.48, -.15, -.49), new THREE.Vector3(3.48, 4.23, 4.95));
        return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
            [bounds.min.z, bounds.max.z].map(z => award ? new THREE.Vector3(x, y, z) : this.group.localToWorld(new THREE.Vector3(x, y, z)))));
    }
    frameView(selectedId: IslandLearningKeepsakeId | null = this.selectedId): IslandKeepsakeFrameView {
        this.group.updateWorldMatrix(true, true);
        const award = this.focused(selectedId);
        const scale = this.group.getWorldScale(new THREE.Vector3()).x;
        if (!award) return { target: this.group.localToWorld(new THREE.Vector3(...ISLAND_KEEPSAKE_VIEW.target)).toArray(),
            position: this.group.localToWorld(new THREE.Vector3(...ISLAND_KEEPSAKE_VIEW.position)).toArray(),
            minimumHeight: ISLAND_KEEPSAKE_VIEW.minimumHeight * scale, selectedId: null };
        const target = new THREE.Box3().setFromObject(award, true).getCenter(new THREE.Vector3());
        return { target: target.toArray(), position: target.clone().add(new THREE.Vector3(.48, 3.4, 5).multiplyScalar(scale)
            .applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()))).toArray(),
            minimumHeight: 1.25 * scale, selectedId: selectedId ?? null };
    }
    describe() {
        this.group.updateWorldMatrix(true, true);
        return { candidate: ISLAND_KEEPSAKE_SCENERY_CANDIDATE, uuid: this.group.uuid, visible: this.group.visible, selectedId: this.selectedId,
            challengeAwards: [...this.challengeAwards].map(([id, group]) => ({ id, visible: this.group.visible && group.visible })),
            awards: [...this.awards].map(([id, group]) => ({ id, uuid: group.uuid, visible: this.group.visible && group.visible,
                position: group.getWorldPosition(new THREE.Vector3()).toArray() })) };
    }
    private release() {
        const geometries = new Set<THREE.BufferGeometry>();
        this.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
        geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
        this.group.clear(); this.awards.clear(); this.challengeAwards.clear(); this.challengeSelection = []; this.materials.clear(); this.built = false;
        this.selection = []; this.selectedId = null;
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.group.removeFromParent(); this.release(); this.group.visible = false;
    }
}
