import * as T from 'three';
import type { GrowingState, Cell } from '../../../domain/growingIsland';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { GardenGeometry, type V3 } from '../three/garden/geometry';
import type { SceneLayout } from './sceneLayout';

const tuple = (point: T.Vector3): V3 => [point.x, point.y, point.z];
const LENGTH_STEPS = 32, WIDTH_STEPS = 24, THICKNESS = .14;

/** A closed, thick shell panel. A real courtyard opening has its own edge faces;
 * opaque pearl sides and the translucent upper cap use the same outer surface. */
function panelGeometry(pointAt: (u: number, v: number) => T.Vector3, from: number, to: number, court: boolean) {
    const widthSteps = Math.round((to - from) / 2 * WIDTH_STEPS), rows = widthSteps + 1;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    for (const layer of [0, 1]) for (let l = 0; l <= LENGTH_STEPS; l++) for (let w = 0; w <= widthSteps; w++) {
        const u = l / LENGTH_STEPS, v = from + (to - from) * w / widthSteps, point = pointAt(u, v);
        const du = pointAt(Math.min(1, u + .001), v).sub(pointAt(Math.max(0, u - .001), v));
        const dv = pointAt(u, Math.min(1, v + .001)).sub(pointAt(u, Math.max(-1, v - .001)));
        const normal = dv.cross(du).normalize();
        if (layer) point.addScaledVector(normal, -THICKNESS);
        positions.push(...tuple(point));
        const color = new T.Color(layer ? '#8a9bc2' : '#92b9dc').lerp(new T.Color('#7c82bb'), Math.abs(v) * .24 + (1 - u) * .24);
        colors.push(color.r, color.g, color.b);
    }
    const layerSize = (LENGTH_STEPS + 1) * rows, edges = new Map<string, [number, number]>();
    const edge = (a: number, b: number) => { const id = [a, b].sort((left, right) => left - right).join(':'); if (edges.has(id)) edges.delete(id); else edges.set(id, [a, b]); };
    for (let l = 0; l < LENGTH_STEPS; l++) for (let w = 0; w < widthSteps; w++) {
        const u = (l + .5) / LENGTH_STEPS, v = from + (to - from) * (w + .5) / widthSteps;
        if (court && Math.abs(u - .5) < .17 && Math.abs(v) < .30) continue;
        const a = l * rows + w, b = a + rows, c = a + 1, d = b + 1;
        indices.push(a, c, b, c, d, b, a + layerSize, b + layerSize, c + layerSize, c + layerSize, b + layerSize, d + layerSize);
        edge(a, c); edge(c, d); edge(d, b); edge(b, a);
    }
    for (const [a, b] of edges.values()) indices.push(b, a, a + layerSize, b, a + layerSize, b + layerSize);
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

/** Homes retain their exact owners, front doors and roofs. The shared pearl body
 * sits above the real head-clear common ground rather than enclosing it in glass. */
export function buildPlaceShell(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace) {
    const ownedHomes = state.plots.filter(plot => place.mainIds.includes(plot.id) && plot.kind === 'home' && plot.cell);
    const cells = place.mainIds.map(id => state.plots.find(plot => plot.id === id)?.cell).filter((cell): cell is Cell => Boolean(cell));
    const homes = cells.map(cell => layout.point(cell));
    if (!homes.length) return;
    if (place.stage !== 'grown' && place.stage !== 'lived') {
        for (let i = 1; i < homes.length; i++) g.branch([tuple(homes[i - 1].clone().add(new T.Vector3(0, .015, 0))), tuple(homes[i].clone().add(new T.Vector3(0, .015, 0)))], .022, '#b09acb');
        return;
    }
    const center = homes.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / homes.length);
    let xx = 0, zz = 0, xz = 0;
    for (const point of homes) { const dx = point.x - center.x, dz = point.z - center.z; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
    const angle = Math.atan2(2 * xz, xx - zz) / 2, along = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
    if (along.z < -.01) along.multiplyScalar(-1);
    const across = new T.Vector3(-along.z, 0, along.x);
    const halfLength = Math.max(1.05, ...homes.map(point => Math.abs(point.clone().sub(center).dot(along)) + .65));
    const halfWidth = Math.max(1.25, ...homes.map(point => Math.abs(point.clone().sub(center).dot(across)) + .80));
    const eaves = Math.max(...[...cells, ...place.entrances].map(cell => layout.point(cell).y)) + 1.40;
    const rise = Math.min(1.35, 1.04 + halfWidth * .16);
    const vaultPoint = (u: number, v: number) => {
        const taper = .44 + .56 * Math.sin(Math.PI * u / 2), bend = place.variant === 'bay' ? Math.sin(Math.PI * u) * Math.min(.42, halfWidth * .24) : 0;
        const scallop = .10 * Math.cos(u * Math.PI * 5) * Math.pow(Math.abs(v), 4);
        const point = center.clone().addScaledVector(along, (u * 2 - 1) * halfLength).addScaledVector(across, v * halfWidth * taper + bend);
        point.y = eaves + Math.cos(v * Math.PI / 2) * rise * (.76 + .42 * Math.sin(Math.PI * u)) + scallop;
        return point;
    };
    const pearl = new T.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .31, metalness: .06, clearcoat: .82, transmission: 0, side: T.FrontSide });
    const cap = new T.MeshPhysicalMaterial({ color: '#b9c8ec', vertexColors: true, roughness: .30, transparent: true, opacity: .76, transmission: .10, thickness: THICKNESS, clearcoat: .78, side: T.DoubleSide, depthWrite: false });
    const roof = new T.Group(); roof.name = 'place-translucent-shell'; roof.userData.shellThickness = THICKNESS; roof.userData.shellEaves = eaves; g.root.add(roof);
    // The opaque body carries most of the visual mass. Only the slim high crest
    // transmits light, so the island contains a pearl shell instead of a greenhouse.
    for (const [from, to] of [[-1, -1 / 3], [1 / 3, 1]]) g.mesh(panelGeometry(vaultPoint, from, to, place.variant === 'court'), pearl, [0, 0, 0], roof).name = 'place-shell-pearl-body';
    g.mesh(panelGeometry(vaultPoint, -1 / 3, 1 / 3, place.variant === 'court'), cap, [0, 0, 0], roof).name = 'place-shell-luminous-crest';
    for (const u of [0, 1]) {
        const mouth = Array.from({ length: WIDTH_STEPS + 1 }, (_, w) => tuple(vaultPoint(u, w / WIDTH_STEPS * 2 - 1)));
        g.branch(mouth, u === 1 ? .115 : .075, u === 1 ? '#b4c9e3' : '#919eca', roof).name = 'place-shell-pearl-mouth';
    }
    for (const u of [.14, .50, .86]) {
        const bands = place.variant === 'court' && Math.abs(u - .5) < .17 ? [[-1, -.31], [.31, 1]] : [[-1, 1]];
        for (const [from, to] of bands) {
            const points = Array.from({ length: WIDTH_STEPS + 1 }, (_, w) => tuple(vaultPoint(u, from + (to - from) * w / WIDTH_STEPS).add(new T.Vector3(0, .012, 0))));
            g.branch(points, .055, '#b5c9e5', roof).name = 'place-shell-curved-rib';
        }
    }
    for (const side of [-1, 1]) g.branch(Array.from({ length: LENGTH_STEPS + 1 }, (_, l) => tuple(vaultPoint(l / LENGTH_STEPS, side))), .075, '#a7b5da', roof).name = 'place-shell-thick-eave';
    if (place.variant === 'court') {
        const opening: V3[] = [];
        for (const [u, v] of [[.33, -.30], [.67, -.30], [.67, .30], [.33, .30], [.33, -.30]]) opening.push(tuple(vaultPoint(u, v)));
        g.branch(opening, .035, '#c2cae9', roof).name = 'place-shell-sky-opening';
    }
    ownedHomes.forEach((home, i) => {
        const p = layout.point(home.cell!), delta = p.clone().sub(center), u = T.MathUtils.clamp((delta.dot(along) / halfLength + 1) / 2, 0, 1);
        const taper = .44 + .56 * Math.sin(Math.PI * u / 2), bend = place.variant === 'bay' ? Math.sin(Math.PI * u) * Math.min(.42, halfWidth * .24) : 0;
        const v = T.MathUtils.clamp((delta.dot(across) - bend) / (halfWidth * taper), -1, 1), tip = vaultPoint(u, v);
        const supports = new T.Group(); supports.name = 'place-shell-owner-supports'; supports.userData.ownerId = home.id; roof.add(supports);
        for (const side of [-1, 1]) {
            const base = p.clone().add(new T.Vector3(side * .27, .05, -.20));
            const high = new T.Vector3(base.x, eaves - .04, base.z), color = i % 2 ? '#9c9fc8' : '#8daccb';
            // A vertical stem remains inside the original blocked home cell until
            // above the tallest rabbit's ears; only then can its arm lean outward.
            g.mesh(new T.CylinderGeometry(.050, .061, high.y - base.y, 12), g.paint(color), tuple(base.clone().lerp(high, .5)), supports).name = 'place-shell-owner-support';
            g.taperedBranch([tuple(high), tuple(tip)], .050, .043, color, supports).name = 'place-shell-owner-support';
        }
    });
}
