import * as T from 'three';
import { buildLifeItem } from '../life/itemGeometry';
import type { IslandMaterials } from '../three/primitives';
import type { ItemKind, LifeItem } from '../../../domain/islandLife/model';
import { connectedWaterChannels, waterChannelConnections } from '../../../domain/islandLife/waterChannels';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { key } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Landmark, LandmarkKind, PlotStyle, SeedKind } from '../../../domain/growingIsland';
import { buildBud, buildKeepsake, buildLighthouse, buildPlot } from './plotGeometry';
import { buildBoat, buildPier } from './pierGeometry';
import type { SceneLayout } from './sceneLayout';

export interface Ghost { kind: SeedKind | LandmarkKind; seed: boolean; cell?: Cell; valid: boolean; style: PlotStyle; allowed: Cell[] }

export type Seat = 'sit' | 'swing' | 'eat';
const SEATS: Partial<Record<LandmarkKind, Seat>> = { bench: 'sit', swing: 'swing', 'picnic-table': 'eat' };

function landmarkModel(m: IslandMaterials, state: GrowingState, landmark: Landmark, reached: Set<string>) {
    if (landmark.kind === 'lighthouse') return buildLighthouse(m);
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
    const model = ghost.seed ? buildPlot(m, ghost.kind as SeedKind, 1, ghost.style, 6)
        : ghost.kind === 'lighthouse' ? buildLighthouse(m)
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
export function buildObjectLayer(m: IslandMaterials, state: GrowingState, layout: SceneLayout, ghost?: Ghost, selectedId?: string) {
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
        add(l.id, landmarkModel(m, state, l, reached), l.cell);
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
    for (const k of state.keepsakes) if (k.cell) add(k.id, buildKeepsake(m), k.cell);
    const pier = buildPier(m); pier.position.copy(layout.pierRoot); root.add(pier);
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
        root, objects, buds, seats, arrivalBoat, visitorBoat, nextBoat,
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
