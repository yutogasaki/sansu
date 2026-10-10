import * as T from 'three';
import { buildGrowingTree } from './treeSilhouettes';
import { buildLifeItem } from '../life/itemGeometry';
import type { IslandMaterials } from '../three/primitives';
import type { ItemKind, LifeItem } from '../../../domain/islandLife/model';
import { connectedWaterChannels, waterChannelConnections } from '../../../domain/islandLife/waterChannels';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { HOME_CELL, bridgeAnchor, key } from '../../../domain/growingIsland/space';
import type { Cell, FlowerColor, GrowingState, Landmark, LandmarkKind, PlotStyle, SeedKind } from '../../../domain/growingIsland';
import { keepsakeKind, treeAge } from '../../../domain/growingIsland';
import { buildBud, buildLighthouse, buildPlot } from './plotGeometry';
import { buildBandstand, buildFlag, buildKeepsake } from './keepsakeGeometry';
import { buildBakery, buildFountain, buildPostbox, buildSlide, buildTrampoline } from './ownLandmarks';
import { wonder } from './wonderPaint';
import { buildColorFlower } from './flowerGeometry';
import { buildBoat, buildPier } from './pierGeometry';
import type { SceneLayout } from './sceneLayout';
import { buildBridge } from './bridgeGeometry';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { derivePlaceRelations } from '../../../domain/growingIsland/placeRelations';
import { buildPlaceGeometry } from './placeGeometry';
import { buildPlacePaths } from './placePaths';

export interface Ghost { kind: SeedKind | LandmarkKind; seed: boolean; cell?: Cell; valid: boolean; style: PlotStyle; allowed: Cell[]; keepsake?: string; color?: FlowerColor; ownerId?: string }

export type Seat = 'sit' | 'swing' | 'eat' | 'bounce' | 'slide' | 'tend' | 'play';
const SEATS: Partial<Record<LandmarkKind, Seat>> = { bench: 'sit', swing: 'swing', 'picnic-table': 'eat', slide: 'slide', trampoline: 'bounce' };
const OWN_MODELS: Partial<Record<LandmarkKind, (m: IslandMaterials) => T.Group>> = {
    slide: buildSlide, trampoline: buildTrampoline, fountain: buildFountain, bakery: buildBakery, postbox: buildPostbox,
};

function landmarkModel(m: IslandMaterials, state: GrowingState, landmark: Landmark, reached: Set<string>) {
    if (landmark.kind === 'sapling') return buildGrowingTree(m, landmark.id, landmark.growth);
    if (landmark.kind === 'lighthouse') return buildLighthouse(m);
    if (landmark.kind === 'bandstand') return buildBandstand(m);
    const own = OWN_MODELS[landmark.kind]; if (own) return own(m);
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
            : ghost.kind === 'bandstand' ? buildBandstand(m)
            : OWN_MODELS[ghost.kind as LandmarkKind] ? OWN_MODELS[ghost.kind as LandmarkKind]!(m)
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

/** Release owned resources once, leaving shared palette materials and textures alive. */
function disposeRoots(roots: readonly T.Object3D[]) {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    for (const root of roots) {
        root.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            geometries.add(object.geometry);
            if (object.userData.ownMaterial) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
            if (object.userData.ownTexture) textures.add(object.userData.ownTexture as T.Texture);
        });
        root.removeFromParent();
    }
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
}

/** Saved objects persist while selection, placement and hints change. */
export function buildObjectLayer(m: IslandMaterials, state: GrowingState, layout: SceneLayout, ghost?: Ghost, selectedId?: string, hints: readonly Cell[] = []) {
    const root = new T.Group(); root.name = 'growing-objects';
    const objects = new Map<string, T.Object3D>(), buds = new Map<string, T.Object3D>(), seats = new Map<string, Seat>();
    const swingPivots = new Map<string, T.Object3D>(), fingerTargets: T.Mesh[] = [];
    const places = derivePlaces(state), relations = derivePlaceRelations(state, places);
    const visiblePlaces = places.filter(place => !(place.ruleId === 'P01' && places.some(other => other.ruleId === 'P02'
        && (other.stage === 'grown' || other.stage === 'lived') && other.mainIds.some(id => place.mainIds.includes(id)))));
    const grownBasins = new Set(visiblePlaces.filter(place => place.ruleId === 'P03' && (place.stage === 'grown' || place.stage === 'lived'))
        .flatMap(place => [...place.mainIds, ...place.waterRefs]));
    const grownTrees = new Set(visiblePlaces.filter(place => (place.ruleId === 'P01' || place.ruleId === 'P02') && (place.stage === 'grown' || place.stage === 'lived'))
        .flatMap(place => place.mainIds));
    const reached = connectedWaterChannels(waterLayout(state));
    const add = (id: string, model: T.Object3D, cell: Cell) => {
        const holder = new T.Group(); holder.position.copy(layout.point(cell)); holder.add(model);
        holder.traverse(o => { o.userData.objectId = id; }); root.add(holder); objects.set(id, holder);
        return holder;
    };
    for (const l of state.landmarks) {
        if (!l.cell) continue;
        const holder = add(l.id, landmarkModel(m, state, l, reached), l.cell);
        // The same owned water grows into a shallow pool and stream. Old raised
        // rims/strips must not protrude through it; holder and owner ID stay selectable.
        if ((l.kind === 'water-bowl' || l.kind === 'water-channel') && grownBasins.has(l.id)) holder.children[0].visible = false;
        if (l.kind === 'sapling') ageTree(m, state, l, holder);
        // The connected grove supplies the actual selectable tree meshes under
        // these same owner IDs. Avoid stacking the solitary crown over them.
        if (l.kind === 'sapling' && grownTrees.has(l.id)) holder.children[0].visible = false;
        if ((l.kind === 'sapling' || l.kind === 'flower') && l.growth < 6) {
            // Young plants keep their real silhouette. This invisible sphere scales
            // with the camera to remain reachable with a finger at the whole-island view.
            const hit = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
            hit.position.y = l.kind === 'sapling' ? .26 : .15;
            hit.userData = { objectId: l.id, ownMaterial: true, placementHitOnly: true };
            hit.name = 'growing-young-plant-finger-target'; holder.add(hit); fingerTargets.push(hit);
        }
        if (l.from) {
            // A gift flower wears a small ribbon.
            const bow = new T.Mesh(new T.TorusGeometry(.07, .022, 6, 14), m.surface('#e58ea3', .7));
            bow.position.set(.16, .12, .16); holder.add(bow);
        }
        const seat = SEATS[l.kind]; if (seat) seats.set(key(l.cell), seat);
        if (l.kind === 'swing') {
            const pivot = holder.getObjectByName('swing-seat')?.parent;
            if (pivot) swingPivots.set(key(l.cell), pivot);
        }
    }
    for (const p of state.plots) {
        if (!p.cell) continue;
        if (state.unopened.includes(p.id)) {
            const bud = buildBud(m); bud.scale.setScalar(2.2); bud.position.y = .42;
            const holder = add(p.id, bud, p.cell); buds.set(p.id, holder);
            holder.traverse(o => { o.userData.budId = p.id; });
            continue;
        }
        const model = buildPlot(m, p.kind, p.stage, p.style ?? 'plain', p.growth, p.roof);
        if (p.stage === 0) {
            // A new seed can be just a few narrow stakes. Keep its refund/move sheet
            // reachable with a finger without changing the visible model.
            const hit = new T.Mesh(new T.BoxGeometry(.7, .65, .7), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
            hit.position.y = .32; hit.userData.ownMaterial = true; hit.userData.placementHitOnly = true; model.add(hit);
        }
        add(p.id, model, p.cell);
        // Friends stop by built fields to tend them.
        if ((p.kind === 'farm' || p.kind === 'market') && p.stage > 0 && !seats.has(key(p.cell))) seats.set(key(p.cell), 'tend');
        if (p.kind === 'play' && p.stage > 0) seats.set(key(p.cell), 'play');
    }
    for (const k of state.keepsakes) if (k.cell) add(k.id, buildKeepsake(m, keepsakeKind(k.unitId)), k.cell);
    const placeRoot = buildPlaceGeometry(state, layout, visiblePlaces, relations); root.add(placeRoot);
    root.add(buildPlacePaths(state, layout, visiblePlaces));
    if (state.bridge) add('bridge', buildBridge(m), bridgeAnchor(state));
    const pier = buildPier(m, layout.pierRoot.y - .02); pier.position.copy(layout.pierRoot); root.add(pier);
    const flag = buildFlag(m, state.flagColor ?? 0, state.flagPattern ?? 0, state.emblem?.image);
    flag.position.copy(layout.pierRoot).add(new T.Vector3(-.36, .02, .1));
    flag.traverse(o => { o.userData.objectId = 'flag'; }); root.add(flag);
    // A few dotted wonder mushrooms on the shore from the first day: "ふしぎ" here and there.
    for (const [x, z, size] of [[layout.bounds.minX - .55, .2, 1.5], [layout.bounds.maxX + .5, 1.4, 1.2], [layout.bounds.minX - .45, layout.depth - 1.3, 1.05]] as const) {
        const shroom = new T.Group(); shroom.position.copy(layout.point({ x, z }));
        const stem = new T.Mesh(new T.CylinderGeometry(.05 * size, .07 * size, .2 * size, 8), m.surface('#f3ecdc', .8)); stem.position.y = .1 * size;
        const cap = new T.Mesh(new T.SphereGeometry(.16 * size, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), wonder(size > 1.3 ? 'dots-red' : 'dots-yellow'));
        cap.position.y = .18 * size; shroom.add(stem, cap); shroom.name = 'wonder-mushroom'; root.add(shroom);
    }
    const glows: T.Mesh[] = [];
    const arrivalBoat = buildBoat(m); arrivalBoat.position.copy(layout.dock); arrivalBoat.visible = state.arrivals.length > 0;
    arrivalBoat.traverse(o => { o.userData.boat = 'arrival'; }); root.add(arrivalBoat);
    const visitorBoat = buildBoat(m); visitorBoat.visible = false; root.add(visitorBoat);
    const nextBoat = buildBoat(m, true); nextBoat.position.copy(layout.farther); nextBoat.scale.setScalar(.8); root.add(nextBoat);
    nextBoat.traverse(o => { if (o instanceof T.Mesh) o.userData.ownMaterial = true; });
    const previews: T.Object3D[] = [];
    let disposed = false;
    const clearPreview = () => {
        disposeRoots(previews); previews.length = 0; glows.length = 0;
    };
    const addPreview = (object: T.Object3D, parent: T.Object3D = root) => { parent.add(object); previews.push(object); };
    const updatePreview = (nextGhost?: Ghost, selected?: string, nextHints: readonly Cell[] = []) => {
        if (disposed) return;
        clearPreview();
        const holder = selected ? objects.get(selected) : undefined;
        if (selected && holder) {
            const outline = ring('#fff5ac');
            // Bud rings were part of their opening target; normal selection rings
            // remain visual only. Keep the original parent for pop/scale animation.
            if (buds.has(selected)) outline.userData.budId = selected;
            addPreview(outline, holder);
        }
        if (selected === 'flag') { const outline = ring('#fff5ac', .3); outline.position.copy(flag.position); addPreview(outline); }
        if (selected === 'house' && !nextGhost) {
            const outline = ring('#fff5ac', .95); outline.name = 'growing-house-selection';
            outline.position.copy(layout.point({ x: HOME_CELL.x + .5, z: HOME_CELL.z - .5 }, .08)); addPreview(outline);
        }
        for (const cell of nextHints) {
            // "ここ" — the place a friend could not reach or a home is needed (§11.3).
            const glow = ring('#ffe27a', .46); glow.position.copy(layout.point(cell, .08)); glow.name = 'growing-hint'; addPreview(glow); glows.push(glow);
        }
        if (nextGhost) {
            for (const cell of nextGhost.allowed) {
                const tile = new T.Mesh(new T.PlaneGeometry(.9, .9), new T.MeshBasicMaterial({ color: '#fff4c1', transparent: true, opacity: .2, depthWrite: false }));
                tile.rotation.x = -Math.PI / 2; tile.position.copy(layout.point(cell, .07)); tile.userData.ownMaterial = true; addPreview(tile);
            }
            if (nextGhost.cell) {
                const preview = new T.Group(); preview.name = 'growing-ghost'; preview.position.copy(layout.point(nextGhost.cell)); addPreview(preview);
                preview.add(ghostModel(m, nextGhost), ring(nextGhost.valid ? '#fff5ac' : '#8a5a3a'));
                if (nextGhost.valid && !nextGhost.keepsake) {
                    // Predict the same owned IDs/ages used by confirmation. A purchase
                    // is shown as young; it never pretends to have earned maturity.
                    const future = { ...state, plots: state.plots.map(p => p.id === nextGhost.ownerId ? { ...p, cell: nextGhost.cell } : p),
                        landmarks: state.landmarks.map(l => l.id === nextGhost.ownerId ? { ...l, cell: nextGhost.cell } : l) };
                    if (!nextGhost.ownerId) {
                        if (nextGhost.seed) future.plots = [...future.plots, { id: 'place-preview', kind: nextGhost.kind as SeedKind, cell: nextGhost.cell,
                            plantedAt: state.town.clock, stage: 0, style: nextGhost.style, growth: 0, origin: 'seed', paid: 0 }];
                        else future.landmarks = [...future.landmarks, { id: 'place-preview', kind: nextGhost.kind as LandmarkKind, cell: nextGhost.cell, growth: 0, color: nextGhost.color }];
                    }
                    const predicted = derivePlaces(future);
                    const changes = predicted.filter(place => !places.some(before => before.id === place.id && before.revision === place.revision));
                    if (changes.length) {
                        const projection = buildPlaceGeometry(future, layout, changes, derivePlaceRelations(future, predicted), true);
                        projection.userData.previewRevisions = changes.map(place => place.revision); addPreview(projection);
                    }
                }
            }
        }
    };
    updatePreview(ghost, selectedId, hints);
    return {
        root, objects, buds, seats, swingPivots, fingerTargets, arrivalBoat, visitorBoat, nextBoat, glows, flag, places, relations, placeRoot, updatePreview,
        dispose() {
            if (disposed) return;
            disposed = true;
            // Selection rings may be parented to saved objects. Detach their owned
            // resources before disposing the base, so nothing is released twice.
            clearPreview(); disposeRoots([root]);
        },
    };
}
export type ObjectLayer = ReturnType<typeof buildObjectLayer>;
