import * as T from 'three';
import type { GardenGeometry, V3 } from '../../three/garden/geometry';
import type { GrowingState, Cell } from '../../../../domain/growingIsland';
import type { DerivedPlace } from '../../../../domain/growingIsland/placeTypes';
import type { SceneLayout } from '../sceneLayout';
import type { NativeGrowingKit } from './nativeGrowingKit';
import { buildPlaceRootRoom } from '../placeRootRoomGeometry';

const tuple = (point: T.Vector3): V3 => [point.x, point.y, point.z];

/** Native crowns above the same owned stems and actual route. The source model's
 * fixed balcony/stairs are deliberately absent; this gallery is the real route. */
export function buildNativePlaceGrove(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace,
    kit: NativeGrowingKit, gallery: (room?: T.Group) => T.Group) {
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
