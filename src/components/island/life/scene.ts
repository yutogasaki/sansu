import { buildHomeProps } from './homeProps';
import { gardenRuntimeAsset, runtimeAssetSlot } from './runtimeAssetSlots';
import { isolationMarker } from './isolationMarker';
import { buildLanternLight } from './lanternLight';
import { isFacility, occupiedCells } from '../../../domain/islandLife/footprint';
import type { SandScene } from './sandboxGeometry';
import { buildCanopyScenery } from './canopyScenery';
import { makeLifeMotion, type LifeSeat } from './residentMotion';
import * as T from 'three';
import { buildHomeJourney } from '../homeJourney/scene';
import { type Cell, type LifeState } from '../../../domain/islandLife/model';
import { cellKey, districts, homeCell, isolatedItems, landCells, pathToActivity } from '../../../domain/islandLife/space';
import { plantGatherings } from '../../../domain/islandLife/discovery';
import type { PlacementPreview } from './placement';
import { buildLandscape } from './landscape';
import { buildHeritageHouse, buildHeritageTree } from './heritageScenery';

import { buildLifeItem, tint } from './itemGeometry';
export { tint } from './itemGeometry';
export function buildLifeScene(state: LifeState, selected?: string, selectedCell?: Cell, placement?: PlacementPreview) {
    const content = buildHomeJourney(undefined, { residentsOnly: true, naturalOtter: true }), root = content.world;
    const heritageHouse = buildHeritageHouse(content.m, state.worldStyle === 'canopy-dots-c3-v1'), house = heritageHouse.root;
    const actors = [content.hero, content.rabbit.pose, content.otter.pose];
    house.removeFromParent(); actors.forEach(a => a.removeFromParent());
    root.clear();
    const cells = landCells(state), min = Math.min(...cells.map(c => c.x)), max = Math.max(...cells.map(c => c.x));
    const center = (min + max) / 2;
    const point = (c: Cell) => new T.Vector3(c.x - center, .04, c.z - 2);
    const paint = (color: string) => content.m.surface(color, .85);
    const box = (parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const landscape = buildLandscape(state, max - min + 1, point); root.add(landscape.root);
    const bedIds = new Set([...districts(state).filter(d => d.kind === 'flowers').flatMap(d => d.ids),
        ...plantGatherings(state).flatMap(group => group.map(item => item.id))]);
    const clickables: T.Object3D[] = [];
    const previewMaterials: T.Material[] = [];
    for (const c of cells) {
        const highlighted = placement?.item.cell ? occupiedCells(placement.item) : selected ? occupiedCells(state.items.find(i => i.id === selected) ?? { kind: 'flower' }) : selectedCell ? [selectedCell] : [];
        const active = highlighted.some(p => cellKey(c) === cellKey(p));
        const available = placement?.allowed.includes(cellKey(c));
        const mesh = new T.Mesh(new T.PlaneGeometry(.91, .91), new T.MeshBasicMaterial({ color: '#fff4c1', transparent: true, opacity: active ? .55 : available ? .18 : .015, depthWrite: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.copy(point(c)); mesh.position.y = .085;
        mesh.userData.cell = c; root.add(mesh); clickables.push(mesh);

    }
    house.add(buildHomeProps(content.m));
    house.position.set(2.5 - center, .035, -1.5); house.scale.setScalar(.8); root.add(house);
    const canopy = state.worldStyle === 'canopy-dots-c3-v1' ? buildCanopyScenery(center) : undefined;
    root.userData.worldStyle = state.worldStyle ?? 'moon-garden-v1';
    if (canopy) root.add(canopy.root);
    else {
        const tree = buildHeritageTree(content.m);
        tree.position.set(2.5 - center + 1.25, -.01, -3.05);
        tree.scale.setScalar(.63); runtimeAssetSlot(tree, 'tree'); root.add(tree);
    }
    const sandboxes = new Map<string, SandScene>();
    const seats = new Map<string, LifeSeat>(), rotors: T.Group[] = [];
    for (const item of [...state.items, ...(placement?.item.cell ? [placement.item] : [])]) {
        if (!item.cell) continue;
        const preview = item === placement?.item;
        const g = new T.Group(); g.position.copy(point(item.cell)); root.add(g);
        g.name = preview ? 'life-placement-ghost' : `life-item-${item.id}`;
        const model = buildLifeItem(item, content.m, !bedIds.has(item.id) || preview, Boolean(state.encounterVersion));
        g.add(model.root);
        if (!preview && item.kind === 'bench' && item.style === 'original') {
            runtimeAssetSlot(model.root, 'bench');
            model.root.userData.runtimeAssetSeatY = model.seat!.position.y + .05;
        }
        if (!preview && item.kind === 'garden-hut' && item.style === 'original') runtimeAssetSlot(model.root, 'garden-hut');
        const gardenAsset = gardenRuntimeAsset(item, preview);
        if (gardenAsset) runtimeAssetSlot(model.root, gardenAsset);
        if (model.sandbox && !preview) sandboxes.set(item.id, model.sandbox);
        if (model.rotor && !preview) rotors.push(model.rotor);
        if (!preview && model.seat) seats.set(item.id, { seat: model.seat, pivot: model.pivot, picnic: model.picnic });
        if (preview) {
            g.traverse(o => {
                if (!(o instanceof T.Mesh)) return;
                const material = (o.material as T.Material).clone(); material.transparent = true; material.opacity = .48; material.depthWrite = false;
                o.material = material; o.castShadow = false; previewMaterials.push(material);
            });
            const marker = new T.Group(); marker.name = 'life-placement-marker'; marker.position.copy(point(item.cell)); root.add(marker);
            if (isFacility(item.kind)) {
                marker.position.x += .5; marker.position.z += .5;
                for (const side of [-1, 1]) { box(marker, placement!.valid ? '#fff5ac' : '#715637', side * .97, .015, 0, .035, .025, 1.94); box(marker, placement!.valid ? '#fff5ac' : '#715637', 0, .015, side * .97, 1.94, .025, .035); }
            } else if (placement!.valid) {
                const ring = new T.Mesh(new T.TorusGeometry(.44, .03, 8, 40), paint('#fff5ac')); ring.rotation.x = Math.PI / 2; marker.add(ring);
            } else {
                for (const direction of [-1, 1]) { const bar = box(marker, '#715637', 0, .015, 0, .62, .025, .075); bar.rotation.y = direction * Math.PI / 4; }
            }
        } else if (selected === item.id) {
            const ring = new T.Mesh(new T.TorusGeometry(isFacility(item.kind) ? 1.03 : .43, .028, 8, 40), paint('#fff5ac')); ring.rotation.x = Math.PI / 2; ring.position.y = .045; if (isFacility(item.kind)) { ring.position.x = .5; ring.position.z = .5; } g.add(ring);
        }
    }
    const isolated = placement?.item.cell && placement.valid ? placement.isolated : state.placementVersion === 1 ? isolatedItems(state) : [];
    const isolationSigns: T.Object3D[] = [];
    for (const item of isolated) {
        if (!item.cell) continue;
        const marker = isolationMarker(item, paint); marker.position.add(point(item.cell)); root.add(marker);
        marker.traverse(o => { o.userData.cell = item.cell; }); clickables.push(marker);
        isolationSigns.push(marker.getObjectByName('life-isolation-sign')!);
    }
    const selectedItem = state.items.find(i => i.id === selected);
    const selectedPath = !placement && state.placementVersion === 1 && selectedItem && !isolated.some(i => i.id === selected) ? pathToActivity(state, homeCell, selectedItem) : undefined;
    const path = new T.Group(); path.name = 'life-placement-path'; root.add(path);
    (placement?.path ?? selectedPath)?.forEach(c => {
        const dot = new T.Mesh(new T.CircleGeometry(.12, 16), paint(placement?.valid ? '#fff9db' : '#715637')); dot.rotation.x = -Math.PI / 2;
        dot.position.copy(point(c)); dot.position.y = .10; path.add(dot);
    });
    const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), paint(tint(state.heroStyle)));
    scarf.name = 'life-scarf';
    scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; content.hero.add(scarf);
    actors.forEach((a, i) => { a.name = `life-resident-${state.residents[i].id}`; a.scale.setScalar(i ? .60 : .76); root.add(a); });
    const lightGround = state.footstepMagicVersion && !placement ? buildLanternLight(state, point) : undefined;
    if (lightGround) root.add(lightGround.root);
    const motion = makeLifeMotion(content, state, point, seats, sandboxes);
    return { root, clickables, lightGround, faceIsolationSigns: (camera: T.Camera) => { isolationSigns.forEach(sign => sign.quaternion.copy(camera.quaternion)); }, feet: () => {
        root.updateMatrixWorld(true);
        return content.heroFeet.map(foot => {
            const box = new T.Box3().setFromObject(foot), center = box.getCenter(new T.Vector3());
            return { point: new T.Vector3(center.x, .094, center.z), bottom: box.min.y };
        });
    }, width: max - min + 1, depth: Math.max(...cells.map(c => c.z)) + 1, point,
        animate: (at: number, reduced: boolean, decorationAt = at) => { const frozen = state.scenePose === 'captured-v1';
            rotors.forEach(rotor => { rotor.rotation.z = (frozen && state.poseReducedMotion !== undefined ? state.poseReducedMotion : reduced) ? .2 : (frozen ? state.now : decorationAt) / 2300 % (Math.PI * 2); });
            landscape.animate(decorationAt, reduced); motion.animate(at, reduced, decorationAt); }, audit: motion.audit, snapshot: motion.snapshot,
        dispose() {
            // Plane overlays use separate transparent materials; shared paints are owned by content.m.
            clickables.filter(o => o instanceof T.Mesh).forEach(o => ((o as T.Mesh).material as T.Material).dispose());
            previewMaterials.forEach(m => m.dispose());
            lightGround?.dispose(); canopy?.dispose(); landscape.dispose(); heritageHouse.dispose(); content.dispose();
        } };
}
