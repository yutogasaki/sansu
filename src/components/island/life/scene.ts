import { makeLifeMotion, type LifeSeat } from './residentMotion';
import * as T from 'three';
import { makeResidentRig } from '../three/residentRig';
import { buildHomeJourney } from '../homeJourney/scene';
import { disposeGeometry } from '../three/primitives';
import { type Cell, type LifeState } from '../../../domain/islandLife/model';
import { cellKey, districts, landCells } from '../../../domain/islandLife/space';
import type { PlacementPreview } from './placement';
import { buildLandscape } from './landscape';
import { buildHeritageHouse, buildHeritageTree } from './heritageScenery';

import { buildLifeItem, tint } from './itemGeometry';
export { tint } from './itemGeometry';
export function buildLifeScene(state: LifeState, selected?: string, selectedCell?: Cell, placement?: PlacementPreview) {
    const content = buildHomeJourney(), root = content.world;
    // Pokomoko alone keeps the patchwork identity. The discarded legacy otter
    // stays in root and is disposed with the unused home-journey scenery.
    content.otter = makeResidentRig('otter', content.m, 'natural');
    const heritageHouse = buildHeritageHouse(content.m), house = heritageHouse.root;
    const actors = [content.hero, content.rabbit.pose, content.otter.pose];
    house.removeFromParent(); actors.forEach(a => a.removeFromParent());
    disposeGeometry(root); root.clear();
    const cells = landCells(state), min = Math.min(...cells.map(c => c.x)), max = Math.max(...cells.map(c => c.x));
    const center = (min + max) / 2;
    const point = (c: Cell) => new T.Vector3(c.x - center, .04, c.z - 2);
    const paint = (color: string) => content.m.surface(color, .85);
    const box = (parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const landscape = buildLandscape(state, max - min + 1, point); root.add(landscape.root);
    const bedIds = new Set(districts(state).filter(d => d.kind === 'flowers').flatMap(d => d.ids));
    const clickables: T.Object3D[] = [];
    const previewMaterials: T.Material[] = [];
    for (const c of cells) {
        const active = selectedCell && cellKey(c) === cellKey(selectedCell);
        const available = placement?.allowed.includes(cellKey(c));
        const mesh = new T.Mesh(new T.PlaneGeometry(.91, .91), new T.MeshBasicMaterial({ color: '#fff4c1', transparent: true, opacity: active ? .55 : available ? .18 : .015, depthWrite: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.copy(point(c)); mesh.position.y = .085;
        mesh.userData.cell = c; root.add(mesh); clickables.push(mesh);

    }
    house.position.set(2.5 - center, .035, -1.5); house.scale.setScalar(.8); root.add(house);
    const tree = buildHeritageTree(content.m);
    tree.position.set(2.5 - center + 1.25, -.01, -3.05);
    tree.scale.setScalar(.63); root.add(tree);
    const seats = new Map<string, LifeSeat>();
    for (const item of [...state.items, ...(placement?.item.cell ? [placement.item] : [])]) {
        if (!item.cell) continue;
        const preview = item === placement?.item;
        const g = new T.Group(); g.position.copy(point(item.cell)); root.add(g);
        g.name = preview ? 'life-placement-ghost' : `life-item-${item.id}`;
        const model = buildLifeItem(item, content.m, !bedIds.has(item.id) || preview);
        g.add(model.root);
        if (!preview && model.seat) seats.set(item.id, { seat: model.seat, pivot: model.pivot });
        if (preview) {
            g.traverse(o => {
                if (!(o instanceof T.Mesh)) return;
                const material = (o.material as T.Material).clone(); material.transparent = true; material.opacity = .48; material.depthWrite = false;
                o.material = material; o.castShadow = false; previewMaterials.push(material);
            });
            const marker = new T.Group(); marker.name = 'life-placement-marker'; marker.position.copy(point(item.cell)); root.add(marker);
            if (placement!.valid) {
                const ring = new T.Mesh(new T.TorusGeometry(.44, .03, 8, 40), paint('#fff5ac')); ring.rotation.x = Math.PI / 2; marker.add(ring);
            } else {
                for (const direction of [-1, 1]) { const bar = box(marker, '#715637', 0, .015, 0, .62, .025, .075); bar.rotation.y = direction * Math.PI / 4; }
            }
        } else if (selected === item.id) {
            const ring = new T.Mesh(new T.TorusGeometry(.43, .028, 8, 40), paint('#fff5ac')); ring.rotation.x = Math.PI / 2; ring.position.y = .045; g.add(ring);
        }
    }
    const path = new T.Group(); path.name = 'life-placement-path'; root.add(path);
    placement?.path?.forEach(c => {
        const dot = new T.Mesh(new T.CircleGeometry(.075, 16), paint('#fff9db')); dot.rotation.x = -Math.PI / 2;
        dot.position.copy(point(c)); dot.position.y += .035; path.add(dot);
    });
    const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), paint(tint(state.heroStyle)));
    scarf.name = 'life-scarf';
    scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; content.hero.add(scarf);
    actors.forEach((a, i) => { a.name = `life-resident-${state.residents[i].id}`; a.scale.setScalar(i ? .60 : .76); root.add(a); });
    const motion = makeLifeMotion(content, state, point, seats);
    return { root, clickables, width: max - min + 1, point,
        animate: (at: number, reduced: boolean) => { landscape.animate(at, reduced); motion.animate(at, reduced); }, audit: motion.audit,
        dispose() {
            // Plane overlays use separate transparent materials; shared paints are owned by content.m.
            clickables.forEach(o => ((o as T.Mesh).material as T.Material).dispose());
            previewMaterials.forEach(m => m.dispose());
            landscape.dispose(); heritageHouse.dispose(); content.dispose();
        } };
}
