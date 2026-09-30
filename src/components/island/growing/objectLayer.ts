import * as T from 'three';
import { buildLifeItem } from '../life/itemGeometry';
import type { IslandMaterials } from '../three/primitives';
import type { ItemKind, LifeItem } from '../../../domain/islandLife/model';
import { connectedWaterChannels, waterChannelConnections } from '../../../domain/islandLife/waterChannels';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { key } from '../../../domain/growingIsland/space';
import type { Cell, FlowerColor, GrowingState, Landmark, LandmarkKind, PlotStyle, SeedKind } from '../../../domain/growingIsland';
import { keepsakeKind, treeAge } from '../../../domain/growingIsland';
import { buildBud, buildLighthouse, buildPlot } from './plotGeometry';
import { buildFlag, buildKeepsake } from './keepsakeGeometry';
import { wonder } from './wonderPaint';
import { buildColorFlower } from './flowerGeometry';
import { buildBoat, buildPier } from './pierGeometry';
import type { SceneLayout } from './sceneLayout';

export interface Ghost { kind: SeedKind | LandmarkKind; seed: boolean; cell?: Cell; valid: boolean; style: PlotStyle; allowed: Cell[]; keepsake?: string; color?: FlowerColor }

export type Seat = 'sit' | 'swing' | 'eat';
const SEATS: Partial<Record<LandmarkKind, Seat>> = { bench: 'sit', swing: 'swing', 'picnic-table': 'eat' };

function landmarkModel(m: IslandMaterials, state: GrowingState, landmark: Landmark, reached: Set<string>) {
    if (landmark.kind === 'lighthouse') return buildLighthouse(m);
    if (landmark.kind === 'flower' && landmark.color) return buildColorFlower(m, landmark.color, landmark.growth);
    const layout = waterLayout(state);
    const item: LifeItem = {
        id: landmark.id, kind: landmark.kind as ItemKind, cell: landmark.cell, growth: landmark.growth,
        style: landmark.legacy?.style ?? 'original', rotation: landmark.rotation,
        foodStage: landmark.legacy?.foodStage, foodStock: landmark.legacy?.foodStock,
        waterFlow: landmark.cell ? reached.has(key(landmark.cell)) : false,
        waterConnections: landmark.cell ? waterChannelConnections(layout, landmark.cell) : 0,
    };
    return buildLifeItem(item, m).root;
}

function ghostModel(m: IslandMaterials, ghost: Ghost) {
    const model = ghost.keepsake ? buildKeepsake(m, keepsakeKind(ghost.keepsake))
        : ghost.seed ? buildPlot(m, ghost.kind as SeedKind, 1, ghost.style, 6)
        : ghost.kind === 'lighthouse' ? buildLighthouse(m)
            : ghost.kind === 'flower' && ghost.color ? buildColorFlower(m, ghost.color, 6)
            : buildLifeItem({ id: 'ghost', kind: ghost.kind as ItemKind, growth: 18, style: 'original' }, m).root;
    model.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        const material = (o.material as T.Material).clone();
        material.transparent = true; material.opacity = .5; material.depthWrite = false;
        o.material = material; o.castShadow = false; o.userData.ownMaterial = true;
    });
    return model;
}

function ring(color: string, radius = .44) {
    const mesh = new T.Mesh(new T.TorusGeometry(radius, .03, 8, 40), new T.MeshBasicMaterial({ color }));
    mesh.rotation.x = Math.PI / 2; mesh.position.y = .05; mesh.userData.ownMaterial = true; return mesh;
}

/**
 * Everything placed on the island, rebuilt when the saved state changes. Materials come from
 * the shared cache; only geometries and the ghost's translucent copies belong to this layer.
 */
/** A big tree grows a size larger, and the island's lord tree much larger with a ring of flowers (§5). */
function ageTree(m: IslandMaterials, state: GrowingState, landmark: Landmark, holder: T.Object3D) {
    const age = treeAge(state, landmark.id);
    if (age !== 'big' && age !== 'lord') return;
    const model = holder.children[0]; model.scale.setScalar(age === 'lord' ? 1.75 : 1.3);
    if (age !== 'lord') return;
    const colors = ['#f6c6d4', '#fff1b0', '#b9d9ef'];
    for (let i = 0; i < 10; i++) {
        // The lord tree wears a ring of dotted wonder blooms.
        const a = i / 10 * Math.PI * 2, bloom = new T.Mesh(new T.SphereGeometry(.07, 10, 8), i % 2 ? wonder('dots-red') : m.surface(colors[i % 3], .8));
        bloom.position.set(Math.cos(a) * .42, .06, Math.sin(a) * .42); holder.add(bloom);
    }
    const glow = m.surface('#fff2a6', .3, 0, true);
    for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2, light = new T.Mesh(new T.SphereGeometry(.035, 8, 6), glow);
        light.position.set(Math.cos(a) * .5, 1.3 + (i % 2) * .3, Math.sin(a) * .5); light.name = 'lord-light'; holder.add(light);
    }
}

export function buildObjectLayer(m: IslandMaterials, state: GrowingState, layout: SceneLayout, ghost?: Ghost, selectedId?: string, hints: readonly Cell[] = []) {
    const root = new T.Group(); root.name = 'growing-objects';
    const objects = new Map<string, T.Object3D>(), buds = new Map<string, T.Object3D>(), seats = new Map<string, Seat>();
    const reached = connectedWaterChannels(waterLayout(state));
    const add = (id: string, model: T.Object3D, cell: Cell) => {
        const holder = new T.Group(); holder.position.copy(layout.point(cell)); holder.add(model);
        holder.traverse(o => { o.userData.objectId = id; }); root.add(holder); objects.set(id, holder);
        if (selectedId === id) holder.add(ring('#fff5ac'));
        return holder;
    };
    for (const l of state.landmarks) {
        if (!l.cell) continue;
        const holder = add(l.id, landmarkModel(m, state, l, reached), l.cell);
        if (l.kind === 'sapling') ageTree(m, state, l, holder);
        if (l.from) {
            // A gift flower wears a small ribbon.
            const bow = new T.Mesh(new T.TorusGeometry(.07, .022, 6, 14), m.surface('#e58ea3', .7));
            bow.position.set(.16, .12, .16); holder.add(bow);
        }
        const seat = SEATS[l.kind]; if (seat) seats.set(key(l.cell), seat);
    }
    for (const p of state.plots) {
        if (!p.cell) continue;
        if (state.unopened.includes(p.id)) {
            const bud = buildBud(m); bud.scale.setScalar(2.2); bud.position.y = .42;
            const holder = add(p.id, bud, p.cell); buds.set(p.id, holder);
            holder.traverse(o => { o.userData.budId = p.id; });
            continue;
        }
        add(p.id, buildPlot(m, p.kind, p.stage, p.style ?? 'plain', p.growth, p.roof), p.cell);
    }
    for (const k of state.keepsakes) if (k.cell) add(k.id, buildKeepsake(m, keepsakeKind(k.unitId)), k.cell);
    const pier = buildPier(m); pier.position.copy(layout.pierRoot); root.add(pier);
    const flag = buildFlag(m, state.flagColor ?? 0, state.flagPattern ?? 0);
    flag.position.copy(layout.pierRoot).add(new T.Vector3(-.36, .02, .1));
    flag.traverse(o => { o.userData.objectId = 'flag'; }); root.add(flag);
    if (selectedId === 'flag') { const r = ring('#fff5ac', .3); r.position.copy(flag.position); root.add(r); }
    // A few dotted wonder mushrooms on the shore from the first day: "ふしぎ" here and there.
    for (const [x, z, size] of [[layout.bounds.minX - .55, .2, 1.5], [layout.bounds.maxX + .5, 1.4, 1.2], [layout.bounds.minX - .45, layout.depth - 1.3, 1.05]] as const) {
        const shroom = new T.Group(); shroom.position.copy(layout.point({ x, z }));
        const stem = new T.Mesh(new T.CylinderGeometry(.05 * size, .07 * size, .2 * size, 8), m.surface('#f3ecdc', .8)); stem.position.y = .1 * size;
        const cap = new T.Mesh(new T.SphereGeometry(.16 * size, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), wonder(size > 1.3 ? 'dots-red' : 'dots-yellow'));
        cap.position.y = .18 * size; shroom.add(stem, cap); shroom.name = 'wonder-mushroom'; root.add(shroom);
    }
    const glows: T.Mesh[] = [];
    for (const cell of hints) {
        // "ここ" — the place a friend could not reach or a home is needed (§11.3).
        const glow = ring('#ffe27a', .46); glow.position.copy(layout.point(cell, .08)); glow.name = 'growing-hint'; root.add(glow); glows.push(glow);
    }
    const arrivalBoat = buildBoat(m); arrivalBoat.position.copy(layout.dock); arrivalBoat.visible = state.arrivals.length > 0;
    arrivalBoat.traverse(o => { o.userData.boat = 'arrival'; }); root.add(arrivalBoat);
    const visitorBoat = buildBoat(m); visitorBoat.visible = false; root.add(visitorBoat);
    const nextBoat = buildBoat(m, true); nextBoat.position.copy(layout.farther); nextBoat.scale.setScalar(.8); root.add(nextBoat);
    nextBoat.traverse(o => { if (o instanceof T.Mesh) o.userData.ownMaterial = true; });
    if (ghost) {
        for (const cell of ghost.allowed) {
            const tile = new T.Mesh(new T.PlaneGeometry(.9, .9), new T.MeshBasicMaterial({ color: '#fff4c1', transparent: true, opacity: .2, depthWrite: false }));
            tile.rotation.x = -Math.PI / 2; tile.position.copy(layout.point(cell, .07)); tile.userData.ownMaterial = true; root.add(tile);
        }
        if (ghost.cell) {
            const holder = new T.Group(); holder.name = 'growing-ghost'; holder.position.copy(layout.point(ghost.cell)); root.add(holder);
            holder.add(ghostModel(m, ghost), ring(ghost.valid ? '#fff5ac' : '#8a5a3a'));
        }
    }
    return {
        root, objects, buds, seats, arrivalBoat, visitorBoat, nextBoat, glows, flag,
        dispose() {
            root.traverse(o => {
                if (!(o instanceof T.Mesh)) return;
                o.geometry.dispose();
                if (o.userData.ownMaterial) (o.material as T.Material).dispose();
            });
            root.removeFromParent();
        },
    };
}
export type ObjectLayer = ReturnType<typeof buildObjectLayer>;
