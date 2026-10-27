import * as T from 'three';
import { neighbors, placeOf, type IslandKey, type Neighbor } from '../../../domain/growingIsland/journey';
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
export type NeighborHit = Pick<Neighbor, 'key' | 'mode' | 'islandId' | 'stage'>;

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
 * ひとつの群島 (island-journey.md §3.4, §3.6): the islands made, seen from here in their chart
 * directions and kept simple so only the island you are on is drawn in detail, joined to home by
 * bridges; and the shoal growing off the newest island. Islands still to come are not shown at all.
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
        const from = placeOf(state, here);
        for (const near of neighbors(state, here)) {
            const to = near.at, dx = to[0] - from[0], dz = to[1] - from[1], span = Math.hypot(dx, dz) || 1, dir = new T.Vector3(dx / span, 0, dz / span);
            // Close enough to peek in at the edge of the view; farther islands on the chart sit a little farther out.
            const at = center.clone().addScaledVector(dir, radius + 2.6 + Math.max(0, span - 30) * .08);
            const group = new T.Group(); group.position.set(at.x, sea, at.z);
            group.userData.neighbor = { key: near.key, mode: near.mode, islandId: near.islandId, stage: near.stage } satisfies NeighborHit;
            group.name = `archipelago-${near.key}`;
            if (near.key === 'shoal') this.shoal(group, near.stage ?? 1);
            else this.island(group, near.key);
            this.root.add(group); this.targets.push(group);
            // Bridges run between home and the special islands, as the chart draws them.
            if (near.key === 'shoal' || (here !== 'home' && near.key !== 'home')) continue;
            const edge = Math.max(...land.map(p => (p.x - center.x) * dir.x + (p.z - center.z) * dir.z));
            const start = center.clone().addScaledVector(dir, edge + .25), end = at.clone().addScaledVector(dir, -1.5);
            this.bridge(start.setY(land[0].y + .05), end.setY(sea + .25));
        }
    }

    /**
     * The shoal (§3.6) grows in three steps and never says what it will be: a pale shadow under
     * the sea, then a sandbar, then a grassy islet half in mist that can be crossed to.
     */
    private shoal(group: T.Group, stage: 1 | 2 | 3) {
        const shadow = new T.Mesh(new T.CylinderGeometry(2, 2.2, .05, 28), new T.MeshBasicMaterial({ color: '#8ee6d6', transparent: true, opacity: .45, depthWrite: false }));
        shadow.scale.z = .75; shadow.position.y = -.12; shadow.name = 'shoal-shadow'; group.add(shadow);
        this.steps.push((now, reduced) => { (shadow.material as T.MeshBasicMaterial).opacity = reduced ? .4 : .32 + Math.sin(now / 1300) * .1; });
        if (stage >= 2) {
            const sand = new T.Mesh(new T.CylinderGeometry(1.35, 1.55, .22, 22), solid('#f1e0b4')); sand.scale.z = .62; sand.position.y = .04; sand.name = 'shoal-sand'; group.add(sand);
            for (const [x, z, r] of [[-.8, .2, .14], [.6, -.3, .11], [.95, .25, .09]]) { const rock = new T.Mesh(new T.DodecahedronGeometry(r, 0), solid('#b9ab92')); rock.position.set(x, .16, z); group.add(rock); }
        }
        if (stage >= 3) {
            const grass = new T.Mesh(new T.CylinderGeometry(1, 1.15, .2, 20), solid('#a6d884')); grass.scale.z = .7; grass.position.y = .22; grass.name = 'shoal-grass'; group.add(grass);
            for (const [x, z, h] of [[-.35, .05, .45], [.2, -.15, .6], [.45, .2, .35]]) { const bush = new T.Mesh(new T.ConeGeometry(.16, h, 7), solid('#5f9e5a')); bush.position.set(x, .32 + h / 2, z); group.add(bush); }
            const mist = new T.Mesh(new T.SphereGeometry(1.5, 16, 10), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .3, depthWrite: false }));
            mist.scale.set(1.25, .55, 1); mist.position.y = .55; group.add(mist);
            this.steps.push((now, reduced) => { if (!reduced) { mist.rotation.y = now / 9000; (mist.material as T.MeshBasicMaterial).opacity = .26 + Math.sin(now / 1700) * .06; } });
        }
        group.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    }

    private island(group: T.Group, key: IslandKey) {
        const colors = LAND[key];
        const side = new T.Mesh(new T.CylinderGeometry(1.8, 1.5, .7, 22), solid(colors.side)); side.scale.z = .8; side.position.y = -.05; group.add(side);
        const top = new T.Mesh(new T.CylinderGeometry(1.82, 1.82, .12, 22), solid(colors.top)); top.scale.z = .8; top.position.y = .34; group.add(top);
        const mark = sign(key); mark.position.y = .4; group.add(mark);
        if (key === 'watagumo') {
            // The sky island floats on its bed of cloud.
            for (let i = 0; i < 6; i++) { const puff = new T.Mesh(new T.SphereGeometry(.6, 10, 8), solid('#ffffff')); puff.scale.y = .5; puff.position.set(Math.cos(i) * 1.6, -.2, Math.sin(i) * 1.2); group.add(puff); }
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
