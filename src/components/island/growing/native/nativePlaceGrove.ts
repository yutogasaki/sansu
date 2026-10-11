import * as T from 'three';
import type { GardenGeometry, V3 } from '../../three/garden/geometry';
import type { GrowingState, Cell } from '../../../../domain/growingIsland';
import type { DerivedPlace } from '../../../../domain/growingIsland/placeTypes';
import type { SceneLayout } from '../sceneLayout';
import type { NativeGrowingKit } from './nativeGrowingKit';
import { buildPlaceRootRoom } from '../placeRootRoomGeometry';

const tuple = (point: T.Vector3): V3 => [point.x, point.y, point.z];
const AUTHORED_SOURCE_SCALE = .45;

/** A compact four-owner grove carries one source root house. Wider courts and
 * lanes still use their existing construction; this is not a free hero anchor. */
function buildAuthoredCompactGrove(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, kit: NativeGrowingKit) {
    if (!layout.authored || place.ruleId !== 'P02' || place.variant !== 'cluster'
        || !['grown', 'lived'].includes(place.stage) || place.mainIds.length !== 4) return false;
    const owners = place.mainIds.map(id => state.landmarks.find(owner => owner.id === id && owner.kind === 'sapling' && owner.cell));
    if (owners.some(owner => !owner?.cell || !layout.world.owns(owner.cell) || !layout.world.floorAt(owner.cell))) return false;
    const cells = owners.map(owner => owner!.cell!), xs = [...new Set(cells.map(cell => cell.x))], zs = [...new Set(cells.map(cell => cell.z))];
    if (xs.length !== 2 || zs.length !== 2 || Math.abs(xs[0] - xs[1]) !== 1 || Math.abs(zs[0] - zs[1]) !== 1
        || cells.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.z))
        || new Set(cells.map(cell => `${cell.x},${cell.z}`)).size !== 4) return false;
    const logicalCenter = { x: (xs[0] + xs[1]) / 2, z: (zs[0] + zs[1]) / 2 };
    if (!layout.world.floorAt(logicalCenter)) return false;
    const points = cells.map(cell => layout.point(cell, 0));
    const center = points.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / points.length);
    const shared = new T.Group(); shared.name = 'place-native-shared-tree'; shared.position.copy(center);
    shared.userData.ownerIds = [...place.mainIds]; shared.userData.supportCells = cells.map(cell => ({ ...cell }));
    shared.userData.sourceScale = AUTHORED_SOURCE_SCALE; shared.userData.authoredGalleryArt = 'pending';
    const trunk = kit.instance('hollow-trunk'); trunk.scale.setScalar(AUTHORED_SOURCE_SCALE);
    const crown = kit.instance('fan-crown'); crown.name = 'place-native-fan-crown'; crown.scale.setScalar(AUTHORED_SOURCE_SCALE);
    // Both templates have their own minimum y baked to zero. Restore their
    // original relative position so the fan meets the unmodified source boughs.
    crown.position.y = (kit.manifest.parts['fan-crown'].min[1] - kit.manifest.parts['hollow-trunk'].min[1]) * AUTHORED_SOURCE_SCALE;
    shared.add(trunk, crown);
    let ownerIndex = 0;
    shared.traverse(object => {
        object.userData.ownerIds = [...place.mainIds];
        // A material-batched source mesh represents all four owners. Give its
        // ordinary hit a real member, while retaining the complete selection set.
        if (object instanceof T.Mesh) object.userData.ownerId = place.mainIds[ownerIndex++ % place.mainIds.length];
    });
    g.root.add(shared); return true;
}

/** Native crowns above the same owned stems and actual route. The source model's
 * fixed balcony/stairs are deliberately absent; this gallery is the real route. */
export function buildNativePlaceGrove(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace,
    kit: NativeGrowingKit, gallery: (room?: T.Group) => T.Group) {
    if (buildAuthoredCompactGrove(g, state, layout, place, kit)) {
        if (place.walkSurface.length) gallery().userData.authoredGalleryArt = 'pending';
        return;
    }
    const owners = place.mainIds.map(id => ({ id, owner: state.landmarks.find(l => l.id === id && l.cell) })).filter(item => Boolean(item.owner));
    if (!owners.length) return;
    const grown = place.stage === 'grown' || place.stage === 'lived', large = place.ruleId === 'P02';
    const points = owners.map(({ owner }) => layout.point(owner!.cell!));
    const center = points.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / points.length);
    let room: T.Group | undefined;
    if (large && grown && buildPlaceRootRoom(g, state, layout, place)) {
        room = g.root.getObjectByName('place-root-room') as T.Group;
        const floor = gallery(room);
        if (!floor.userData.rootRoomConnected) {
            // Preserve the existing clearance fallback instead of leaving a stair
            // that does not meet the court's actual floor.
            room.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
            floor.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
            room.removeFromParent(); floor.removeFromParent(); room = undefined;
        }
    }
    owners.forEach(({ id }, i) => {
        if (!grown) return; // The actual young owner is already visible in ObjectLayer.
        const point = points[i], root = new T.Group(); root.name = 'place-native-owned-tree'; root.userData.ownerId = id; g.root.add(root);
        if (large && !room) {
            const trunk = kit.instance('hollow-trunk'); trunk.position.copy(point);
            // The existing blocked owner cell carries the base. The hollow source
            // keeps its actual doorway; its crown is shared above the open lane.
            trunk.scale.set(.25, .39, .25); root.add(trunk);
        } else {
            const tree = kit.instance('willow'); tree.position.copy(point); tree.scale.setScalar(room ? .38 : .34); root.add(tree);
        }
    });
    const connected = (a: Cell, b: Cell) => (a.x === b.x || a.z === b.z) && Math.abs(a.x - b.x) + Math.abs(a.z - b.z) <= 2;
    for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
        if (!connected(owners[i].owner!.cell!, owners[j].owner!.cell!)) continue;
        const a = points[i], b = points[j];
        // Young roots are a flush mark in the ground. Mature boughs leave rabbit
        // ears and every real entrance clear.
        const h = grown ? room ? 2.40 : large ? 2.48 : 1.93 : -.03;
        g.branch([tuple(a.clone().add(new T.Vector3(0, h, 0))), tuple(a.clone().lerp(b, .5).add(new T.Vector3(0, h + (grown ? .12 : 0), 0))), tuple(b.clone().add(new T.Vector3(0, h, 0)))], grown ? .065 : .025, '#ad7948');
        if (grown && !large && place.variant !== 'court') {
            const canopy = kit.instance('willow');
            // Keep only source canopy meshes for a joined overhead crown. There
            // is no extra trunk in the walkable cell between the same two trees.
            for (const child of [...canopy.children]) if (/wood|branches|bark/.test(child.name)) canopy.remove(child);
            const middle = a.clone().lerp(b, .5); canopy.position.copy(middle); canopy.scale.set(.35, .34, .35);
            rootCanopyBase(canopy, middle.y + 1.35); g.root.add(canopy);
        }
    }
    if (large && grown) {
        if (place.variant === 'lane') {
            // A real line grows along its owners instead of receiving the same
            // round hero crown as a court. Original colored leaves and wood remain
            // rigid, shared meshes; overlapping sections follow the actual boughs.
            for (let i = 0; i < owners.length; i++) {
                const crown = kit.instance('fan-crown'); crown.name = 'place-native-lane-crown';
                const size = .42; crown.scale.setScalar(size); crown.position.copy(points[i]);
                crown.position.y += 2.38;
                crown.rotation.y = Math.atan2(points[Math.min(i + 1, points.length - 1)].x - points[Math.max(0, i - 1)].x,
                    points[Math.min(i + 1, points.length - 1)].z - points[Math.max(0, i - 1)].z);
                crown.userData.ownerId = owners[i].id; g.root.add(crown);
            }
            if (place.walkSurface.length) gallery();
            return;
        }
        const crown = kit.instance('fan-crown'); crown.name = 'place-native-fan-crown';
        const width = room ? .72 : Math.max(.62, Math.min(1.32, Math.max(...points.map(p => Math.hypot(p.x - center.x, p.z - center.z))) / 3 + .48));
        const sourceBough = crown.getObjectByName('sculpted tree wood');
        const boughBase = sourceBough ? new T.Box3().setFromObject(sourceBough).min.y : 0;
        crown.scale.set(width, room ? width : .45, width);
        crown.position.copy(room ? layout.point(room.userData.courtCenter) : center);
        // Keep the source leaf proportions on the broad hollow court. Its actual
        // source boughs meet the actual root volume, rather than floating above a
        // guessed height or flattening the leaves to fill the owned rectangle.
        crown.position.y = room ? new T.Box3().setFromObject(room).max.y - boughBase * width - .025
            : Math.max(...points.map(p => p.y)) + 2.8;
        g.root.add(crown); if (!room && place.walkSurface.length) gallery();
    }
}

function rootCanopyBase(root: T.Group, minY: number) {
    const box = new T.Box3().setFromObject(root); root.position.y += minY - box.min.y;
}
