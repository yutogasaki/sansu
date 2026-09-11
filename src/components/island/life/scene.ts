import { makeLifeMotion, type LifeSeat } from './residentMotion';
import * as T from 'three';
import { makeResidentRig } from '../three/residentRig';
import { buildHomeJourney } from '../homeJourney/scene';
import { batch, cylinder, disposeGeometry, ellipsoid } from '../three/primitives';
import { growthStage, type Cell, type LifeState, type Style } from '../../../domain/islandLife/model';
import { cellKey, districts, landCells } from '../../../domain/islandLife/space';
import type { PlacementPreview } from './placement';
import { buildLandscape } from './landscape';

export const tint = (style: Style) => style === 'sunshine' ? '#f5bf60' : style === 'starlight' ? '#a998d8' : '#eb8f9e';
export function buildLifeScene(state: LifeState, selected?: string, selectedCell?: Cell, placement?: PlacementPreview) {
    const content = buildHomeJourney(), root = content.world;
    // Pokomoko alone keeps the patchwork identity. The discarded legacy otter
    // stays in root and is disposed with the unused home-journey scenery.
    content.otter = makeResidentRig('otter', content.m, 'natural');
    const house = root.getObjectByName('home')!;
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
    const seats = new Map<string, LifeSeat>();
    for (const item of [...state.items, ...(placement?.item.cell ? [placement.item] : [])]) {
        if (!item.cell) continue;
        const preview = item === placement?.item;
        const g = new T.Group(); g.position.copy(point(item.cell)); root.add(g);
        g.name = preview ? 'life-placement-ghost' : `life-item-${item.id}`;
        const color = tint(item.style);
        if (item.kind === 'flower') {
            const stage = growthStage(item);
            if (!bedIds.has(item.id) || preview) ellipsoid(g, paint('#bba178'), [0, -.005, 0], [.37, .028, .34], 12);
            const stems = [[-.20, -.13], [.18, -.17], [0, .02], [-.17, .19], [.19, .18]];
            stems.forEach(([x, z], i) => {
                const h = .13 + stage * .15 + (i % 3) * .045;
                cylinder(g, paint('#478762'), [x, h / 2, z], .015, h);
                for (const side of [-1, 1]) {
                    const leaf = ellipsoid(g, paint(side < 0 ? '#4f8a55' : '#80ad65'), [x + side * .07, h * .48, z], [.12, .035, .06], 10);
                    leaf.rotation.z = side * .35; leaf.rotation.y = i * .7;
                }
                if (stage === 1) ellipsoid(g, paint(color), [x, h, z], [.06, .085, .06], 12);
                if (stage === 2) {
                    for (let j = 0; j < 6; j++) {
                        const a = j * Math.PI / 3 + i * .4;
                        const petal = ellipsoid(g, paint(color), [x + Math.cos(a) * .087, h, z + Math.sin(a) * .087], [.078, .045, .10], 12);
                        petal.rotation.y = -a + Math.PI / 2; petal.rotation.z = Math.cos(a) * .2;
                    }
                    ellipsoid(g, paint('#ffe895'), [x, h + .041, z], [.052, .033, .052], 12);
                }
            });
            batch(g);
        } else if (item.kind === 'bench') {
            const seat = box(g, '#b48258', 0, .29, 0, .7, .10, .35); if (!preview) seats.set(item.id, { seat }); box(g, color, 0, .49, -.14, .7, .33, .08);
            for (const x of [-.26, .26]) box(g, '#b48258', x, .12, 0, .07, .24, .3);
        } else if (item.kind === 'swing') {
            for (const x of [-.31, .31]) for (const z of [-.23, .23]) {
                const leg = box(g, '#b4865d', x, .71, z, .055, 1.43, .055); leg.rotation.x = z * -.45;
            }
            box(g, color, 0, 1.42, 0, .78, .09, .08);
            const pivot = new T.Group(); pivot.position.y = 1.42; g.add(pivot);
            for (const x of [-.24, .24]) cylinder(pivot, paint('#f0e0bb'), [x, -.575, 0], .014, 1.15);
            const seat = box(pivot, color, 0, -1.15, 0, .52, .10, .32); seat.name = 'swing-seat';
            if (!preview) seats.set(item.id, { seat, pivot });
        } else {
            cylinder(g, paint('#a88054'), [0, .46, 0], .055, .9);
            ellipsoid(g, content.m.surface('#fff2a1', .4, 0, true), [0, .92, 0], [.18, .18, .18]);
            for (const x of [-.13, .13]) box(g, '#dab46a', x, .91, 0, .025, .38, .2);
        }
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
            landscape.dispose(); content.dispose();
        } };
}
