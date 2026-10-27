import * as T from 'three';
import { HOME_PLACE, ISLAND_PLACE, neighbors, type IslandKey, type NeighborMode } from '../../../domain/growingIsland/journey';
import { landCells } from '../../../domain/growingIsland/space';
import { TERRAIN_SEA_LEVEL } from '../../../domain/growingIsland/editableTerrainWorld';
import type { GrowingState } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';

/** Each island's ground as seen from afar: its top and its sides. */
const LAND: Record<IslandKey, { top: string; side: string }> = {
    home: { top: '#9fd67a', side: '#c8a878' }, shiokaze: { top: '#f6e7c4', side: '#e0c79a' }, kodama: { top: '#4f9a5a', side: '#6b4f36' },
    hikari: { top: '#a8eadc', side: '#7fc8c8' }, watagumo: { top: '#ffffff', side: '#e4ebf8' }, karakuri: { top: '#8f9aa4', side: '#b08a3c' },
    hoshi: { top: '#3a4a8a', side: '#1e2a5a' },
};
export interface NeighborHit { key: IslandKey; mode: NeighborMode; islandId?: string }

const solid = (color: string, emissive?: string) => new T.MeshStandardMaterial({ color, roughness: .75, ...(emissive ? { emissive, emissiveIntensity: .7 } : {}) });

/** A small version of each island's sign, so it is known from afar (island-journey.md §4). */
function sign(key: IslandKey) {
    const g = new T.Group(), put = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => { const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
    if (key === 'home') {
        put(new T.BoxGeometry(.7, .55, .6), solid('#fff4e0'), 0, .28, 0);
        put(new T.ConeGeometry(.6, .5, 4), solid('#e0745a'), 0, .8, 0).rotation.y = Math.PI / 4;
    } else if (key === 'shiokaze') {
        for (let i = 0; i < 4; i++) put(new T.TorusGeometry(.5 - i * .1, .13 - i * .02, 8, 20), solid(i % 2 ? '#fbe3ec' : '#fff4e6'), 0, .15 + i * .2, 0).rotation.x = Math.PI / 2;
        put(new T.ConeGeometry(.12, .35, 10), solid('#f5c6d6'), 0, 1, 0);
    } else if (key === 'kodama') {
        put(new T.CylinderGeometry(.18, .3, 1.3, 8), solid('#7a5a40'), 0, .65, 0);
        put(new T.IcosahedronGeometry(.8, 0), solid('#3f8a55'), 0, 1.6, 0);
    } else if (key === 'hikari') {
        put(new T.TorusGeometry(.7, .1, 8, 24, Math.PI), new T.MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd8f0', emissiveIntensity: .7, transparent: true, opacity: .8 }), 0, 0, 0);
    } else if (key === 'watagumo') {
        for (const [x, y, r] of [[-.35, .5, .4], [.3, .55, .45], [0, .85, .38]]) put(new T.SphereGeometry(r, 12, 8), solid('#ffffff'), x, y, 0);
    } else if (key === 'karakuri') {
        const wheel = put(new T.CylinderGeometry(.55, .55, .14, 14), new T.MeshStandardMaterial({ color: '#c9a24a', metalness: .6, roughness: .35 }), -.2, .7, 0);
        wheel.rotation.x = Math.PI / 2; wheel.name = 'archipelago-gear';
        put(new T.BoxGeometry(.35, 1.1, .35), new T.MeshStandardMaterial({ color: '#d0a04a', metalness: .6, roughness: .3 }), .45, .55, 0);
    } else {
        put(new T.TorusGeometry(.6, .12, 8, 24, Math.PI * 1.3), solid('#fff2b0', '#ffd860'), 0, .75, 0).rotation.z = -.6;
    }
    return g;
}

/**
 * ひとつの群島 (island-journey.md §3.4): the other islands seen from here in their chart
 * directions, kept simple so only the island you are on is drawn in detail. Made islands joined
 * to home by a bridge, islands a route opened for by glowing stepping stones, the rest in mist.
 */
export class Archipelago {
    readonly root = new T.Group();
    readonly targets: T.Object3D[] = [];
    private steps: ((now: number, reduced: boolean) => void)[] = [];

    constructor(parent: T.Object3D) { this.root.name = 'archipelago'; parent.add(this.root); }

    build(state: GrowingState, layout: SceneLayout, here: IslandKey | undefined) {
        this.clear();
        if (!here) return;
        const land = landCells(state).map(cell => layout.point(cell, 0));
        if (!land.length) return;
        const center = land.reduce((sum, p) => sum.add(p), new T.Vector3()).multiplyScalar(1 / land.length).setY(0);
        const radius = Math.max(...land.map(p => Math.hypot(p.x - center.x, p.z - center.z))) + .5, sea = TERRAIN_SEA_LEVEL;
        const from = here === 'home' ? HOME_PLACE : ISLAND_PLACE[here];
        for (const near of neighbors(state, here)) {
            const to = near.key === 'home' ? HOME_PLACE : ISLAND_PLACE[near.key];
            const dx = to[0] - from[0], dz = to[1] - from[1], span = Math.hypot(dx, dz), dir = new T.Vector3(dx / span, 0, dz / span);
            // Close enough to peek in at the edge of the view; the chart's distance only adds a little.
            const at = center.clone().addScaledVector(dir, radius + 2.6 + span * .025);
            const group = new T.Group(); group.position.set(at.x, sea, at.z);
            group.userData.neighbor = { key: near.key, mode: near.mode, islandId: near.islandId } satisfies NeighborHit;
            group.name = `archipelago-${near.key}`;
            this.island(group, near.key, near.mode);
            this.root.add(group); this.targets.push(group);
            // Bridges and stones run between home and the special islands, as the chart draws them.
            if (here !== 'home' && near.key !== 'home') continue;
            const edge = Math.max(...land.map(p => (p.x - center.x) * dir.x + (p.z - center.z) * dir.z));
            const start = center.clone().addScaledVector(dir, edge + .25), end = at.clone().addScaledVector(dir, -1.5);
            if (near.mode === 'made') this.bridge(start.setY(land[0].y + .05), end.setY(sea + .25));
            else if (near.mode === 'open') this.stones(start.setY(sea + .05), end.setY(sea + .05));
        }
    }

    private island(group: T.Group, key: IslandKey, mode: NeighborMode) {
        if (mode === 'fog') {
            // Not reachable yet: only a soft white shape in the mist.
            const mist = new T.Mesh(new T.CylinderGeometry(1.7, 1.9, .5, 20), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .45, depthWrite: false }));
            mist.scale.z = .8; mist.position.y = .2; group.add(mist);
            const veil = new T.Mesh(new T.SphereGeometry(1.6, 16, 10), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .32, depthWrite: false }));
            veil.scale.set(1.2, .6, 1); veil.position.y = .7; group.add(veil);
            return;
        }
        const colors = LAND[key];
        const side = new T.Mesh(new T.CylinderGeometry(1.8, 1.5, .7, 22), solid(colors.side)); side.scale.z = .8; side.position.y = -.05; group.add(side);
        const top = new T.Mesh(new T.CylinderGeometry(1.82, 1.82, .12, 22), solid(colors.top)); top.scale.z = .8; top.position.y = .34; group.add(top);
        const mark = sign(key); mark.position.y = .4; group.add(mark);
        if (key === 'watagumo') {
            // The sky island floats on its bed of cloud.
            for (let i = 0; i < 6; i++) { const puff = new T.Mesh(new T.SphereGeometry(.6, 10, 8), solid('#ffffff')); puff.scale.y = .5; puff.position.set(Math.cos(i) * 1.6, -.2, Math.sin(i) * 1.2); group.add(puff); }
        }
        if (mode === 'open') {
            // A route is open: the island glows and calls.
            const ring = new T.Mesh(new T.TorusGeometry(2.1, .06, 8, 40), new T.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: .8 }));
            ring.rotation.x = Math.PI / 2; ring.scale.y = .8; ring.position.y = .42; group.add(ring);
            this.steps.push((now, reduced) => { const k = reduced ? .5 : .5 + Math.sin(now / 500) * .5; (ring.material as T.MeshBasicMaterial).opacity = .4 + k * .5; group.position.y = TERRAIN_SEA_LEVEL + (reduced ? 0 : k * .08); });
        }
        const gear = group.getObjectByName('archipelago-gear');
        if (gear) this.steps.push((now, reduced) => { if (!reduced) gear.rotation.y = now / 1400; });
        group.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    }

    /** A plank bridge from the island's edge to its neighbor. */
    private bridge(start: T.Vector3, end: T.Vector3) {
        const along = end.clone().sub(start), length = along.length(), yaw = Math.atan2(along.x, along.z);
        const wood = solid('#c89a6a'), rail = solid('#9a6e48'), bridge = new T.Group(); bridge.name = 'archipelago-bridge';
        const count = Math.max(2, Math.floor(length / .32));
        for (let i = 0; i <= count; i++) {
            const plank = new T.Mesh(new T.BoxGeometry(.72, .06, .24), wood);
            plank.position.copy(start).lerp(end, i / count); plank.position.y += Math.sin(i / count * Math.PI) * .12; plank.rotation.y = yaw; bridge.add(plank);
        }
        for (const side of [-1, 1]) {
            const beam = new T.Mesh(new T.BoxGeometry(.05, .05, length), rail), mid = start.clone().lerp(end, .5);
            beam.position.set(mid.x + Math.cos(yaw) * side * .36, mid.y + .28, mid.z - Math.sin(yaw) * side * .36); beam.rotation.y = yaw; bridge.add(beam);
        }
        this.root.add(bridge);
    }

    /** Glowing stepping stones in the shallows toward an island a route opened for. */
    private stones(start: T.Vector3, end: T.Vector3) {
        const count = Math.max(3, Math.round(start.distanceTo(end) / .55));
        for (let i = 1; i < count; i++) {
            const stone = new T.Mesh(new T.CylinderGeometry(.17, .2, .08, 12), solid('#fff6d0', '#ffd860'));
            stone.position.copy(start).lerp(end, i / count); stone.name = 'archipelago-stone'; this.root.add(stone);
            this.steps.push((now, reduced) => { (stone.material as T.MeshStandardMaterial).emissiveIntensity = reduced ? .6 : .35 + Math.max(0, Math.sin(now / 400 - i * .7)) * .8; });
        }
    }

    /** The island under the finger, if a neighbor was touched. */
    pick(raycaster: T.Raycaster): NeighborHit | undefined {
        let hit: T.Object3D | undefined = raycaster.intersectObjects(this.targets, true)[0]?.object;
        while (hit && !hit.userData.neighbor) hit = hit.parent ?? undefined;
        return hit?.userData.neighbor as NeighborHit | undefined;
    }

    tick(now: number, reduced: boolean) { for (const step of this.steps) step(now, reduced); }

    private clear() {
        this.root.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
        this.root.clear(); this.targets.length = 0; this.steps = [];
    }

    dispose() { this.clear(); this.root.removeFromParent(); }
}
