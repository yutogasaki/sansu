import * as T from 'three';
import { GardenGeometry, type V3 } from '../three/garden/geometry';
import type { GrowingState, Cell } from '../../../domain/growingIsland';
import type { DerivedPlace, PlaceRelation } from '../../../domain/growingIsland/placeTypes';
import { key } from '../../../domain/growingIsland/space';
import { PLACE_GALLERY_WIDTH } from '../../../domain/growingIsland/placeTerrain';
import type { SceneLayout } from './sceneLayout';
import { placeLeafGeometry, placeLeafSpine } from './placeLeafGeometry';
import { buildPlaceSpring } from './placeSpringGeometry';
import { buildPlaceShell } from './placeShellGeometry';
import { buildPlaceFlowerRoof } from './placeFlowerGeometry';
import { buildPlaceRootRoom, ROOT_ROOM_ACTOR_HEIGHT } from './placeRootRoomGeometry';
import { disposeGeometry } from '../three/primitives';
import { walkableCells } from '../../../domain/growingIsland/space';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import { buildNativePlaceGrove } from './native/nativePlaceGrove';

const LEAVES = ['#6779cf', '#8f79d6', '#6bc5b5', '#92cfae', '#a395e6'];
const JADE = ['#5c9c80', '#74ba94', '#9acbab', '#80bcae', '#639e9b'];
const RELATION_PETALS = ['#efa4cc', '#aa9de8', '#83cbdc', '#f3c986'];
const WOOD = '#b98346', ROOT = '#9b683c';
const cellOf = (state: GrowingState, id: string) => state.landmarks.find(l => l.id === id)?.cell ?? state.plots.find(p => p.id === id)?.cell;
const matured = (place: DerivedPlace) => place.stage === 'grown' || place.stage === 'lived';
const tuple = (v: T.Vector3): V3 => [v.x, v.y, v.z];

function join(g: GardenGeometry, from: T.Vector3, to: T.Vector3, height: number, radius: number, color: string) {
    const a = from.clone().add(new T.Vector3(0, height, 0)), b = to.clone().add(new T.Vector3(0, height, 0));
    const middle = a.clone().lerp(b, .5);
    if (height >= .3) middle.y += Math.min(.32, a.distanceTo(b) * .1);
    return g.branch([tuple(a), tuple(middle), tuple(b)], radius, color);
}

function inlaidRoot(g: GardenGeometry, layout: SceneLayout, from: Cell, to: Cell) {
    const points: V3[] = [], vertices: number[] = [], indices: number[] = [];
    const normal = new T.Vector3(to.z - from.z, 0, from.x - to.x).normalize().multiplyScalar(.04);
    for (let i = 0; i <= 8; i++) {
        const t = i / 8, cell = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
        points.push(tuple(layout.point(cell, -.065)));
        for (const side of [-1, 1]) {
            const edge = layout.point({ x: cell.x + normal.x * side, z: cell.z + normal.z * side }, 0);
            vertices.push(edge.x, edge.y, edge.z);
        }
        if (i < 8) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const root = g.branch(points, .022, ROOT); root.name = 'place-inlaid-root';
    // A carved root-colored strip lies on the existing physical ground plane. It
    // makes a young connection visible without adding an arched obstacle to a path.
    const floor = new T.BufferGeometry(); floor.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); floor.setIndex(indices); floor.computeVertexNormals();
    const material = g.paint('#c19d6a', .91); material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
    const inlay = g.mesh(floor, material); inlay.name = 'place-ground-inlay'; inlay.castShadow = false;
    return root;
}

function crown(g: GardenGeometry, at: T.Vector3, width: number, height: number, seed: number) {
    // Unequal soft leaf masses keep the toy-like silhouette, while blue-violet and jade
    // color groups distinguish these crowns from flowers, water and shell roofs.
    for (let i = 0; i < 7; i++) {
        const a = i * 2.39996 + seed * .7, r = i ? width * (.23 + (i % 3) * .06) : 0;
        const leaf = g.pebble(JADE[(i + seed) % JADE.length], [at.x + Math.cos(a) * r, at.y + height + Math.sin(i * 1.8) * .13, at.z + Math.sin(a) * r],
            [width * (.37 + i % 2 * .08), width * (.29 + i % 3 * .025), width * .40], g.root, 14);
        leaf.rotation.set(.12 + i * .09, a, -.18 + i % 3 * .16);
    }
}

function fantasyLeaves(g: GardenGeometry, at: T.Vector3, scale: number, seed: number, count = 8, jade = false) {
    const leaf = placeLeafGeometry(), spine = placeLeafSpine();
    for (let i = 0; i < count; i++) {
        // A crest opens toward the house front (+Z); large drooping blades grow
        // behind and beside it so the amber hollow stays visible from the overview.
        const angle = jade ? i * Math.PI * 2 / count + seed * .25 : -.95 + i / (count - 1) * 1.90;
        const palette = jade ? JADE : LEAVES;
        const blade = g.mesh(leaf.clone(), g.paint(palette[(i + seed) % palette.length], .75), [at.x, at.y + .12 + (i % 3) * .14, at.z]);
        blade.rotation.set(-.24 + i % 3 * .16, angle, (i % 2 ? 1 : -1) * .12); blade.scale.set(scale * (i % 3 === 0 ? 1.04 : .88), scale, scale * (i % 2 ? 1.15 : 1.32));
        blade.name = 'place-fantasy-leaf';
        blade.updateMatrix();
        g.branch(spine.map(point => tuple(new T.Vector3(...point).applyMatrix4(blade.matrix))), .013, '#c4b585');
    }
    leaf.dispose();
}

function grove(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace) {
    const owners = place.mainIds.map(id => cellOf(state, id)).filter((c): c is Cell => Boolean(c));
    const grown = matured(place), large = place.ruleId === 'P02', height = large ? 1.68 : 1.85;
    const points = owners.map(cell => layout.point(cell));
    const courtCenter = points.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / Math.max(1, points.length));
    let roomMade = large && grown && buildPlaceRootRoom(g, state, layout, place);
    const room = roomMade ? g.root.getObjectByName('place-root-room') as T.Group : undefined;
    if (room) {
        const gallery = buildGallery(g, state, layout, place, room);
        if (!gallery.userData.rootRoomConnected) {
            // A steep edge cannot trade away real head clearance for a wider room.
            // Keep the existing open-tree gallery until all four joints fit safely.
            disposeGeometry(room); disposeGeometry(gallery); room.removeFromParent(); gallery.removeFromParent(); roomMade = false;
        }
    }
    points.forEach((point, i) => {
        if (roomMade && room) {
            const owned = room.getObjectByName('place-living-root-room')?.children.find(child => child.userData.ownerId === place.mainIds[i]);
            if (!owned) return;
            const start = g.root.children.length;
            const foliage = point.clone().addScaledVector(point.clone().sub(courtCenter).setY(0).normalize(), .80);
            g.taperedBranch([[point.x, point.y + 1.45, point.z],
                [foliage.x, point.y + 1.94, foliage.z]], .065, .03, WOOD);
            crown(g, foliage, 1.0, 2.04 + i % 3 * .12, i + 2);
            for (const child of [...g.root.children].slice(start)) { child.name ||= 'place-root-room-owner-crown'; owned.add(child); }
            return;
        }
        const start = g.root.children.length;
        if (large && grown) {
            // A real hollow trunk, with an open front and a differently colored inner
            // wall. It occupies the original tree's blocked cell, never a house door.
            const trunk = g.mesh(new T.CylinderGeometry(.13, .24, 1.65, 18, 3, true, .55, Math.PI * 1.62), g.paint(WOOD), [point.x, point.y + .82, point.z]);
            trunk.name = 'place-hollow-trunk';
            const lining = new T.MeshStandardMaterial({ color: '#715037', roughness: .95, side: T.BackSide });
            g.mesh(new T.CylinderGeometry(.11, .22, 1.64, 18, 3, true, .55, Math.PI * 1.62), lining, [point.x, point.y + .82, point.z]);
            for (let root = 0; root < 5; root++) {
                const a = root * Math.PI * 2 / 5;
                g.taperedBranch([[point.x + Math.cos(a) * .06, point.y + .38, point.z + Math.sin(a) * .06],
                    [point.x + Math.cos(a) * .23, point.y + .1, point.z + Math.sin(a) * .23],
                    [point.x + Math.cos(a) * .39, point.y, point.z + Math.sin(a) * .39]], .10, .035, ROOT);
            }
            g.taperedBranch([[point.x, point.y + 1.3, point.z], [point.x + .10, point.y + height - .25, point.z - .12], [point.x - .12, point.y + height, point.z]], .16, .045, WOOD);
        } else if (grown) {
            g.taperedBranch([[point.x, point.y + .45, point.z], [point.x + .06, point.y + 1.04, point.z], [point.x, point.y + height - .1, point.z]], .075, .035, WOOD);
        }
        if (grown) {
            const foliage = point.clone();
            if (large && place.variant === 'court') {
                const outward = point.clone().sub(courtCenter).setY(0).normalize().multiplyScalar(.42);
                foliage.add(outward);
                g.taperedBranch([[point.x, point.y + height - .28, point.z],
                    [foliage.x, point.y + height + .03, foliage.z]], .08, .03, WOOD);
            }
            crown(g, foliage, large ? 1.42 : 1.32, height - .1 + i % 3 * .17, i + (large ? 2 : 0));
            if (large) fantasyLeaves(g, foliage.clone().add(new T.Vector3(0, height + .10, 0)), .56, i + 2, 2, true);
        }
        const owned = new T.Group(); owned.userData.ownerId = place.mainIds[i]; owned.name = 'place-owned-tree';
        for (const child of [...g.root.children].slice(start)) owned.add(child);
        g.root.add(owned);
    });
    if (large && grown && !roomMade) {
        const home = state.plots.find(plot => place.memberIds.includes(plot.id) && plot.kind === 'home' && plot.style === 'tree' && plot.cell);
        if (home?.cell) {
            const point = layout.point(home.cell), group = new T.Group(); group.name = 'place-hollow-tree-home'; group.userData.ownerId = home.id; g.root.add(group);
            // The owned house is still present in this opening, with its unchanged
            // roof, doors and resident. This trunk wall stays within its blocked cell.
            const stemGeometry = new T.CylinderGeometry(.22, .43, 3.95, 32, 12, true, Math.PI / 3, Math.PI * 4 / 3);
            const stemPositions = stemGeometry.getAttribute('position');
            for (let i = 0; i < stemPositions.count; i++) {
                const y = stemPositions.getY(i) + 1.975;
                // Broad shoulders begin above ground actors, with space outside the
                // saved doorway and below the foliage. Upper board lanes keep clearance.
                const swell = y <= 1 ? 1 : 1 + 1.40 * Math.sin(Math.PI * (y - 1) / 2.95);
                stemPositions.setX(i, stemPositions.getX(i) * swell);
                stemPositions.setZ(i, stemPositions.getZ(i) * swell);
            }
            stemGeometry.computeVertexNormals();
            const trunk = g.mesh(stemGeometry, g.paint(WOOD), [point.x, point.y + 1.975, point.z], group);
            trunk.name = 'place-tree-home-hollow';
            const lining = new T.MeshStandardMaterial({ color: '#ab804d', roughness: .95, side: T.BackSide });
            const inner = stemGeometry.clone(); inner.scale(.955, .997, .955);
            g.mesh(inner, lining, [point.x, point.y + 1.975, point.z], group);
            // The hollow belongs to the doorway, not a full-height cut in the tree.
            // Close its upper front with the identical shoulder profile, keeping
            // the saved door and all ground/upper routes physically open below.
            const bottomY = 1.25, topY = 3.95, bottomRadius = .43 + (.22 - .43) * bottomY / topY;
            const frontGeometry = new T.CylinderGeometry(.22, bottomRadius, topY - bottomY, 16, 10, true, -Math.PI / 3, Math.PI * 2 / 3);
            const frontPositions = frontGeometry.getAttribute('position');
            for (let i = 0; i < frontPositions.count; i++) {
                const y = frontPositions.getY(i) + (topY + bottomY) / 2, swell = 1 + 1.40 * Math.sin(Math.PI * (y - 1) / 2.95);
                frontPositions.setX(i, frontPositions.getX(i) * swell);
                frontPositions.setZ(i, frontPositions.getZ(i) * swell);
            }
            frontGeometry.computeVertexNormals();
            g.mesh(frontGeometry, g.paint('#c69b5d'), [point.x, point.y + (topY + bottomY) / 2, point.z], group).name = 'place-tree-home-upper-body';
            const windowY = 2.30, windowRadius = (.43 + (.22 - .43) * windowY / topY) * (1 + 1.40 * Math.sin(Math.PI * (windowY - 1) / 2.95));
            g.pebble('#87b8d5', [point.x, point.y + windowY, point.z + windowRadius + .010], [.10, .13, .017], group, 16).name = 'place-tree-home-window';
            const windowRim = g.mesh(new T.TorusGeometry(.12, .021, 10, 28), g.paint('#e0b67a'), [point.x, point.y + windowY, point.z + windowRadius + .018], group);
            windowRim.scale.y = 1.18;
            for (const side of [-1, 1]) {
                g.taperedBranch([[point.x + side * .25, point.y + 1.45, point.z - .05],
                    [point.x + side * .58, point.y + 2.70, point.z - .16],
                    [point.x + side * .93, point.y + 3.93, point.z - .23]], .17, .055, WOOD, group);
            }
            for (const angle of [1.15, 2.15, 3.15, 4.15, 5.15]) {
                g.taperedBranch([[point.x + Math.sin(angle) * .25, point.y + .45, point.z + Math.cos(angle) * .25],
                    [point.x + Math.sin(angle) * .40, point.y + .10, point.z + Math.cos(angle) * .40],
                    [point.x + Math.sin(angle) * .44, point.y + .025, point.z + Math.cos(angle) * .44]], .09, .02, ROOT, group);
            }
            const start = g.root.children.length;
            fantasyLeaves(g, point.clone().add(new T.Vector3(0, 4.05, 0)), 2.30, 2, 7);
            for (const child of [...g.root.children].slice(start)) group.add(child);
            const rim = g.mesh(new T.TorusGeometry(.34, .035, 8, 32), g.paint('#d4b487'), [point.x, point.y + 2.1, point.z], group); rim.rotation.x = Math.PI / 2;
        }
    }
    // Join only the same straight/gap connections as the domain, not diagonals or
    // distant members. Low roots are inlaid under the floor; the canopy is overhead.
    for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
        const a = owners[i], b = owners[j], distance = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
        if (distance > 2 || (a.x !== b.x && a.z !== b.z)) continue;
        inlaidRoot(g, layout, a, b);
        if (grown && !roomMade) {
            join(g, points[i], points[j], height - .18, large ? .095 : .055, WOOD);
            const middle = points[i].clone().lerp(points[j], .5);
            // Courts retain a sky opening; lanes and clumps become a continuous crown.
            if (place.variant !== 'court') crown(g, middle, large ? 1.5 : 1.0, height + .06, i + j + 3);
        }
    }
    if (roomMade && room) {
        const crest = layout.point(room.userData.courtCenter, 0); crest.y = room.userData.crownY + .04;
        const start = g.root.children.length;
        fantasyLeaves(g, crest, 2.30, 2, 7);
        for (const leaf of [...g.root.children].slice(start)) room.add(leaf);
    } else if (large && grown && place.walkSurface.length) buildGallery(g, state, layout, place);
}

function buildGallery(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, room?: T.Group) {
    const route = place.walkSurface;
    const deck = new T.Group(); deck.name = 'place-physical-gallery'; g.root.add(deck);
    deck.userData.floorRoute = route;
    const entrance = layout.floorPoint(route[0]);
    const landing = g.mesh(new T.CylinderGeometry(.44, .44, .045, 32), g.paint('#cda579'),
        [entrance.x, entrance.y - .0225, entrance.z], deck); landing.name = 'place-gallery-ground-landing';
    const supports = new T.Group(); supports.name = 'place-gallery-branch-supports'; deck.add(supports);
    const supportOrigins: Cell[] = []; supports.userData.origins = supportOrigins;
    const boards: T.Mesh[] = [];
    for (let i = 1; i < route.length; i++) {
        const a = layout.floorPoint(route[i - 1]), b = layout.floorPoint(route[i]);
        if (a.distanceTo(b) < .01) continue;
        const center = a.clone().lerp(b, .5), run = Math.hypot(a.x - b.x, a.z - b.z);
        // Floor top is exactly route.y. Sloped boards (not invisible treads) match
        // the same interpolation the actors use, including their rise and descent.
        const board = g.box('#cda579', [center.x, center.y, center.z], [PLACE_GALLERY_WIDTH, .055, Math.max(.09, a.distanceTo(b) + .035)], deck, .016);
        board.rotation.order = 'YXZ';
        board.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        board.rotation.x = -Math.atan2(b.y - a.y, Math.max(.001, run));
        board.position.sub(new T.Vector3(0, .0275, 0).applyQuaternion(board.quaternion));
        board.userData.walkSurface = true;
        boards.push(board);
        if (!room && i > 28 && route[i].y - layout.heightAt(route[i]) > ROOT_ROOM_ACTOR_HEIGHT + .08 && i % 3 === 0) {
            // Supports grow from existing blocked tree/home cells. There is no new
            // column in a walkable ground cell beneath this upper branch path.
            const owners = [place.anchorId, ...place.mainIds].map(id => cellOf(state, id)).filter((cell): cell is Cell => Boolean(cell));
            const owner = owners.sort((left, right) => Math.hypot(left.x - route[i].x, left.z - route[i].z) - Math.hypot(right.x - route[i].x, right.z - route[i].z))[0];
            if (owner) {
                const base = layout.point(owner, ROOT_ROOM_ACTOR_HEIGHT + .22), middle = base.clone().lerp(b, .65); middle.y = Math.max(base.y, b.y) - .04;
                supportOrigins.push({ ...owner });
                // The thin tip enters the board's actual .055 thickness. A thick
                // sagging tip would occupy the ground actor's hat clearance.
                g.taperedBranch([tuple(base), tuple(middle), [b.x, b.y - .03, b.z]], .095, .025, WOOD, supports).name = 'place-gallery-branch-support';
            }
        }
    }
    if (room) {
        const open = walkableCells(state), joints = new T.Group(); joints.name = 'place-root-floor-connections'; supports.add(joints);
        g.root.updateMatrixWorld(true);
        const anchors = room.userData.floorConnectionAnchors as { ownerId: string; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[];
        for (const anchor of anchors) {
            const center = layout.point(room.userData.courtCenter, 0), to = new T.Vector3(anchor.to.x, anchor.to.y, anchor.to.z);
            const inward = center.clone().sub(to).setY(0).normalize(); to.addScaledVector(inward, .008);
            const ray = new T.Raycaster(to.clone().add(new T.Vector3(0, 8, 0)), new T.Vector3(0, -1, 0));
            const floor = ray.intersectObjects(boards)[0];
            if (!floor || Math.abs(floor.point.y - anchor.to.y - .055) > .035) continue;
            // This short joint enters the existing board's solid edge. It adds
            // no floor, rim or column in the free courtyard beneath the walk.
            to.y = floor.point.y - .030;
            const from = new T.Vector3(anchor.from.x, to.y, anchor.from.z);
            const joint = g.branch([tuple(from), tuple(to)], .013, WOOD, joints);
            joint.name = 'place-root-floor-connector'; joint.userData.ownerId = anchor.ownerId; joint.userData.floorTop = floor.point.y;
            joint.updateWorldMatrix(true, false);
            const positions = joint.geometry.getAttribute('position'); let safe = true;
            for (let i = 0; i < positions.count; i++) {
                const vertex = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(joint.matrixWorld), cell = layout.cellAt(vertex);
                if (open.has(key(cell)) && vertex.y - layout.point({ x: vertex.x + layout.center, z: vertex.z + 2 }).y < ROOT_ROOM_ACTOR_HEIGHT) safe = false;
            }
            if (!safe) { joint.geometry.dispose(); joint.removeFromParent(); continue; }
            const owner = cellOf(state, anchor.ownerId); if (owner) supportOrigins.push({ ...owner });
        }
        deck.userData.rootRoomConnected = joints.children.length === 4;
    }
    for (let i = 1; i < route.length; i++) {
        if (route[i].y - layout.heightAt(route[i]) < .8 || route[i - 1].y - layout.heightAt(route[i - 1]) < .8) continue;
        const a = layout.floorPoint(route[i - 1]), b = layout.floorPoint(route[i]);
        const tangent = b.clone().sub(a); tangent.y = 0; tangent.normalize();
        if (tangent.lengthSq() < .5) continue;
        for (const side of [-1, 1]) {
            const offset = new T.Vector3(tangent.z, 0, -tangent.x).multiplyScalar(.20 * side);
            const railA = a.clone().add(offset).add(new T.Vector3(0, .30, 0)), railB = b.clone().add(offset).add(new T.Vector3(0, .30, 0));
            g.branch([tuple(railA), tuple(railB)], .02, '#dcba89', deck).name = 'place-gallery-handrail';
            if (i % 2 === 0) g.branch([tuple(b.clone().add(offset)), tuple(railB)], .016, WOOD, deck).name = 'place-gallery-railing-post';
        }
    }
    return deck;
}


/** Derived structures contain no purchased objects and consume no game random draw. */
export function buildPlaceGeometry(state: GrowingState, layout: SceneLayout, places: readonly DerivedPlace[], relations: readonly PlaceRelation[] = [], preview = false, native?: NativeGrowingKit) {
    const root = new T.Group(); root.name = preview ? 'growing-place-preview' : 'growing-derived-places';
    root.userData.artCandidate = native ? 'native05-owned-runtime-v1' : 'native-05-place-runtime-v3';
    for (const place of places) {
        const g = new GardenGeometry();
        g.root.name = `growing-place-${place.ruleId}-${place.variant}`;
        g.root.userData.placeId = place.id; g.root.userData.placeRevision = place.revision; g.root.userData.placeRule = place.ruleId;
        if (place.family === 'grove' && native) buildNativePlaceGrove(g, state, layout, place, native, room => buildGallery(g, state, layout, place, room));
        else if (place.family === 'grove') grove(g, state, layout, place);
        else if (place.family === 'flowers') buildPlaceFlowerRoof(g, state, layout, place, native);
        else if (place.family === 'spring') buildPlaceSpring(g, state, layout, place, places);
        else if (place.family === 'community') buildPlaceShell(g, state, layout, place, native);
        // Batch opaque components per place. Floor metadata is reassigned afterwards
        // and remains raycastable; owner selection resolves to this place's anchor.
        for (const child of [...g.root.children]) if (child instanceof T.Group && !child.userData.nativePart) g.batch(child);
        g.batch(g.root);
        g.root.traverse(object => {
            let owner: T.Object3D | null = object;
            while (owner && !owner.userData.ownerId && owner !== g.root) owner = owner.parent;
            object.userData.objectId = owner?.userData.ownerId ?? place.anchorId;
            object.userData.placeId = place.id;
            let gallery: T.Object3D | null = object;
            while (gallery && gallery.name !== 'place-physical-gallery' && gallery !== g.root) gallery = gallery.parent;
            if (gallery?.name === 'place-physical-gallery') object.userData.galleryTarget = true;
            if (!(object instanceof T.Mesh)) return;
            object.userData.ownMaterial = !object.userData.nativeSharedMaterial;
            if (preview) {
                object.castShadow = false;
                if (object.userData.nativeSharedMaterial) {
                    object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
                    object.userData.nativeSharedMaterial = false; object.userData.ownMaterial = true;
                }
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                for (const material of materials) { material.transparent = true; material.opacity = .32; material.depthWrite = false; }
            }
        });
        root.add(g.root);
    }
    for (const relation of relations) {
        if (relation.path.length < 2) continue;
        const g = new GardenGeometry(); g.root.name = `growing-relation-${relation.id}`; g.root.userData.placeRelation = relation.id;
        const points = relation.path.map(cell => layout.point(cell));
        const color = relation.id === 'C01' || relation.id === 'C03' ? WOOD : '#aa91d2';
        // Joining overhead branches and petal ribbons follow the same reachable path
        // that qualified this relation. The lane below them stays physically open.
        if (relation.id === 'C01') {
            for (let i = 1; i < points.length; i++) inlaidRoot(g, layout, relation.path[i - 1], relation.path[i]);
        } else {
            const height = relation.id === 'C03' ? 1.92 : 1.4;
            g.branch(points.map(point => [point.x, point.y + height, point.z] as V3), .028, color);
            points.forEach((point, i) => {
                const petal = g.pebble((relation.id === 'C03' ? LEAVES : RELATION_PETALS)[i % (relation.id === 'C03' ? LEAVES.length : RELATION_PETALS.length)], [point.x, point.y + height + .10, point.z], [.33, .07, .22]);
                petal.rotation.y = i * 1.9;
            });
        }
        g.batch(g.root); g.root.traverse(object => { if (object instanceof T.Mesh) object.userData.ownMaterial = true; }); root.add(g.root);
    }
    root.userData.placeCount = places.length; root.userData.relationCount = relations.length;
    root.userData.memberKeys = places.map(place => place.memberIds.map(id => `${id}@${key(cellOf(state, id) ?? { x: -999, z: -999 })}`).join('|')).join(';');
    return root;
}
