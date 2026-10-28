import * as T from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { key, unkey, type Derived, type Island, type Method } from './model';

export const CELL = 2, STEP = .45, MEADOW = .82, SEA = 0;
export const top = (l: number) => l < 0 ? SEA - .45 : MEADOW + l * STEP;
export const world = (island: Island, x: number, z: number) => new T.Vector3((x + .5) * CELL - island.width * CELL / 2, 0, (z + .5) * CELL - island.depth * CELL / 2);

// native05 material colors (sRGB of the GLB factors) so both methods share one palette.
const C = {
    meadow: new T.Color('#a3cc88'), meadowLight: new T.Color('#b7d496'), terrace: new T.Color('#97c48c'), high: new T.Color('#8db89f'),
    lilac: new T.Color('#bcb8d3'), lilacDeep: new T.Color('#a29fc0'), sand: new T.Color('#e3d2ab'), sandDeep: new T.Color('#c9b48f'),
    earth: new T.Color('#98765b'), path: new T.Color('#ddd6e8'), stair: new T.Color('#c9c3dc'),
};

// ---------- Method T: level regions -> rounded contours -> beveled plates ----------
const S = 8; // samples per cell
function field(island: Island, inside: (l: number, k: string) => boolean, margin = 2) {
    const w = (island.width + margin * 2) * S, d = (island.depth + margin * 2) * S;
    let a = new Float32Array(w * d);
    const land = new Set(island.land), cellValue = new Map<string, number>();
    for (let z = -margin; z < island.depth + margin; z++) for (let x = -margin; x < island.width + margin; x++) {
        const k = key(x, z), l = land.has(k) ? island.heights[k] ?? 0 : undefined;
        cellValue.set(k, l !== undefined && inside(l, k) ? 1 : 0);
    }
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) a[j * w + i] = cellValue.get(key(Math.floor(i / S) - margin, Math.floor(j / S) - margin)) ?? 0;
    // Separable gaussian blur rounds both convex and concave corners while
    // keeping straight edges on the cell boundary (iso .5).
    const sigma = .3 * S, r = Math.ceil(sigma * 2.5), kernel: number[] = [];
    for (let k = -r; k <= r; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
    const sum = kernel.reduce((s, v) => s + v, 0); kernel.forEach((v, i) => kernel[i] = v / sum);
    for (const pass of [0, 1]) {
        const b = new Float32Array(w * d);
        for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
            let v = 0;
            for (let k = -r; k <= r; k++) {
                const ii = pass ? i : Math.min(w - 1, Math.max(0, i + k)), jj = pass ? Math.min(d - 1, Math.max(0, j + k)) : j;
                v += a[jj * w + ii] * kernel[k + r];
            }
            b[j * w + i] = v;
        }
        a = b;
    }
    return { a, w, d, margin };
}

/** Marching squares on sample centers; returns closed loops in world xz, inside on the left. */
function contours(f: ReturnType<typeof field>, island: Island, iso: number): T.Vector2[][] {
    const { a, w, d, margin } = f, segs = new Map<string, [string, T.Vector2, T.Vector2]>();
    const pt = (i: number, j: number) => new T.Vector2(((i + .5) / S - margin) * CELL - island.width * CELL / 2, ((j + .5) / S - margin) * CELL - island.depth * CELL / 2);
    const v = (i: number, j: number) => a[j * w + i] - iso;
    const lerp = (p: T.Vector2, q: T.Vector2, s: number, t: number) => p.clone().lerp(q, s / (s - t));
    const out: [T.Vector2, T.Vector2, string, string][] = [];
    for (let j = 0; j < d - 1; j++) for (let i = 0; i < w - 1; i++) {
        const v0 = v(i, j), v1 = v(i + 1, j), v2 = v(i + 1, j + 1), v3 = v(i, j + 1);
        const p0 = pt(i, j), p1 = pt(i + 1, j), p2 = pt(i + 1, j + 1), p3 = pt(i, j + 1);
        const e = [() => lerp(p0, p1, v0, v1), () => lerp(p1, p2, v1, v2), () => lerp(p2, p3, v2, v3), () => lerp(p3, p0, v3, v0)];
        const ek = [`h${i},${j}`, `v${i + 1},${j}`, `h${i},${j + 1}`, `v${i},${j}`];
        const c = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
        // Segment table oriented so the inside lies on the left when walking a->b (in x,z with z down).
        const table: Record<number, [number, number][]> = {
            1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
            8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
        };
        for (const [s, t] of table[c] ?? []) out.push([e[s](), e[t](), ek[s], ek[t]]);
    }
    for (const [p, q, ks, kt] of out) segs.set(ks, [kt, p, q]);
    const loops: T.Vector2[][] = [];
    while (segs.size) {
        const [startKey] = segs.keys(); let k = startKey; const loop: T.Vector2[] = [];
        for (let guard = 0; guard < 100000; guard++) {
            const s = segs.get(k); if (!s) break;
            segs.delete(k); loop.push(s[1]); k = s[0];
            if (k === startKey) break;
        }
        if (loop.length > 3) loops.push(loop);
    }
    return loops;
}
const area = (loop: T.Vector2[]) => loop.reduce((s, p, i) => { const q = loop[(i + 1) % loop.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2;
function inside(p: T.Vector2, loop: T.Vector2[]) {
    let c = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const a = loop[i], b = loop[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
}
function shapes(loops: T.Vector2[][]) {
    // Shape space is (x, -z) so that rotating -90deg about X maps back to world xz.
    const flip = (l: T.Vector2[]) => l.map(p => new T.Vector2(p.x, -p.y));
    // A loop nested in an odd number of loops is a hole; this does not rely on winding.
    const depth = (l: T.Vector2[]) => loops.filter(o => o !== l && inside(l[0], o)).length;
    const outers = loops.filter(l => depth(l) % 2 === 0), holes = loops.filter(l => depth(l) % 2 === 1);
    const result = outers.map(o => ({ o, s: new T.Shape(flip(o)) }));
    for (const h of holes) {
        const owner = result.filter(r => inside(h[0], r.o)).sort((a, b) => Math.abs(area(a.o)) - Math.abs(area(b.o)))[0];
        if (owner) owner.s.holes.push(new T.Path(flip(h)));
    }
    return result.map(r => r.s);
}
function plate(loops: T.Vector2[][], bottom: number, height: number, bevel: number, color: (y: number, ny: number, x: number, z: number) => T.Color) {
    const list: T.BufferGeometry[] = [];
    for (const shape of shapes(loops)) {
        const g = new T.ExtrudeGeometry(shape, { depth: Math.max(.01, height - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
            bevelOffset: -bevel, bevelSegments: 4, curveSegments: 1, steps: 1 });
        g.rotateX(-Math.PI / 2); g.translate(0, bottom + bevel, 0);
        g.deleteAttribute('uv'); list.push(g);
    }
    if (!list.length) return undefined;
    let g = mergeGeometries(list)!; list.forEach(x => x.dispose());
    g = toCreasedNormals(g, Math.PI / 4.2);
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const c = color(p.getY(i), n.getY(i), p.getX(i), p.getZ(i)); colors.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    return g;
}
const wobble = (x: number, z: number) => .5 + .5 * Math.sin(x * .9 + Math.sin(z * 1.3)) * Math.sin(z * .7 + x * .2);

const poolCells = (island: Island) => new Set(island.owners.filter(o => o.kind === 'pool').map(o => key(...o.cell)));
export function terraceGeometry(island: Island) {
    const list: T.BufferGeometry[] = [], pools = poolCells(island);
    const max = Math.max(0, ...Object.values(island.heights));
    // Sand foundation reaches a little past the grass so a soft beach ring shows.
    // An owned pool is a hole cut through its own level, so its basin has real walls.
    const sand = plate(contours(field(island, (l, k) => l >= 0 && !(l === 0 && pools.has(k))), island, .34), SEA - .6, MEADOW - .1 + .6, .16, (y, ny) => {
        const c = C.sand.clone().lerp(C.sandDeep, T.MathUtils.smoothstep(-y, -.4, .4));
        return ny > .6 ? c.lerp(C.sand, .5) : c;
    });
    if (sand) list.push(sand);
    for (let l = 0; l <= max; l++) {
        const base = l === 0 ? MEADOW - .3 : top(l - 1) - .12, roof = top(l);
        const g = plate(contours(field(island, (v, k) => v >= l && !(v === l && pools.has(k))), island, .5), base, roof - base, l === 0 ? .1 : .13, (y, ny, x, z) => {
            const grass = (l === 0 ? C.meadow : l === 1 ? C.terrace : C.high).clone().lerp(C.meadowLight, wobble(x, z) * .35);
            if (ny > .72) return grass;
            const side = l === 0 ? C.sand.clone().lerp(C.sandDeep, .3) : C.lilac.clone().lerp(C.lilacDeep, T.MathUtils.smoothstep(roof - y, .1, .5));
            return side.lerp(grass, T.MathUtils.smoothstep(ny, .35, .72));
        });
        if (g) list.push(g);
    }
    const g = mergeGeometries(list)!; list.forEach(x => x.dispose());
    return g;
}

/** Water surfaces of owned pools and the falls between neighbouring pools one level apart. */
export function poolGeometry(island: Island, method: Method) {
    const pools = island.owners.filter(o => o.kind === 'pool'), water: T.BufferGeometry[] = [], falls: T.BufferGeometry[] = [];
    const levels = [...new Set(pools.map(o => island.heights[key(...o.cell)] ?? 0))];
    for (const l of levels) {
        const cells = new Set(pools.filter(o => (island.heights[key(...o.cell)] ?? 0) === l).map(o => key(...o.cell)));
        for (const shape of shapes(contours(field(island, (_, k) => cells.has(k)), island, method === 'T' ? .5 : .62))) {
            const g = new T.ShapeGeometry(shape, 6); g.rotateX(-Math.PI / 2);
            const p = g.getAttribute('position');
            for (let i = 0; i < p.count; i++) p.setY(i, method === 'T' ? top(l) - .07 : fieldHeight(island, p.getX(i), p.getZ(i)) + .02);
            g.deleteAttribute('uv'); water.push(g);
        }
    }
    if (method === 'T') for (const a of pools) for (const b of pools) {
        const la = island.heights[key(...a.cell)] ?? 0, lb = island.heights[key(...b.cell)] ?? 0;
        if (la - lb !== 1 || Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1]) !== 1) continue;
        const pa = world(island, ...a.cell), pb = world(island, ...b.cell), edge = pa.clone().lerp(pb, .5), dir = pb.clone().sub(pa).normalize();
        const side = new T.Vector3(-dir.z, 0, dir.x).multiplyScalar(.46), pos: number[] = [], idx: number[] = [], n = 8;
        for (let i = 0; i <= n; i++) {
            const t = i / n, y = top(la) - .07 - (top(la) - top(lb)) * t * t, out = .12 * Math.sin(t * Math.PI * .5);
            for (const sgn of [1, -1]) { const q = edge.clone().addScaledVector(dir, out - .05).addScaledVector(side, sgn); pos.push(q.x, y, q.z); }
        }
        for (let i = 0; i < n; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); falls.push(g.toNonIndexed());
    }
    const merge = (list: T.BufferGeometry[]) => { if (!list.length) return undefined; const g = mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x))!; g.computeVertexNormals(); return g; };
    return { water: merge(water), falls: merge(falls) };
}

// ---------- Method G: the current continuous height field (smoothstep bilinear) ----------
const smooth = (v: number) => v * v * (3 - 2 * v);
export function fieldHeight(island: Island, wx: number, wz: number) {
    // Cell-center samples, smoothstep-interpolated like editableTerrainWorld.rawHeight.
    const cx = wx / CELL + island.width / 2 - .5, cz = wz / CELL + island.depth / 2 - .5;
    const x0 = Math.floor(cx), z0 = Math.floor(cz), u = smooth(cx - x0), v = smooth(cz - z0);
    const h = (x: number, z: number) => {
        if (!island.land.includes(key(x, z))) return SEA - .5;
        return top(island.heights[key(x, z)] ?? 0);
    };
    return (1 - u) * (1 - v) * h(x0, z0) + u * (1 - v) * h(x0 + 1, z0) + (1 - u) * v * h(x0, z0 + 1) + u * v * h(x0 + 1, z0 + 1);
}
export function fieldGeometry(island: Island) {
    const R = 6, margin = 1, w = (island.width + margin * 2) * R + 1, d = (island.depth + margin * 2) * R + 1;
    const positions: number[] = [], colors: number[] = [], index: number[] = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
        const wx = (i / R - margin) * CELL - island.width * CELL / 2, wz = (j / R - margin) * CELL - island.depth * CELL / 2;
        positions.push(wx, fieldHeight(island, wx, wz), wz);
    }
    for (let j = 0; j < d - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i; index.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setIndex(index); g.computeVertexNormals();
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), slope = 1 - Math.abs(n.getY(i));
        const c = C.meadow.clone().lerp(C.meadowLight, wobble(p.getX(i), p.getZ(i)) * .35);
        c.lerp(C.earth, T.MathUtils.smoothstep(slope, .09, .32));
        c.lerp(C.sand, 1 - T.MathUtils.smoothstep(y, SEA + .05, SEA + .3));
        colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return g;
}

// ---------- shared: ocean with a shallow halo, paths, stairs ----------
export function oceanGeometry(island: Island) {
    const f = field(island, l => l >= 0, 6), R = 2;
    const size = 140, n = size * R, positions: number[] = [], colors: number[] = [], index: number[] = [];
    const deep = new T.Color('#3f7fae'), mid = new T.Color('#4f9cc4'), shallow = new T.Color('#8fd6d6'), foam = new T.Color('#d9f1ee');
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const x = (i / n - .5) * size, z = (j / n - .5) * size;
        const si = Math.round((x + island.width * CELL / 2) / CELL * S + f.margin * S - .5), sj = Math.round((z + island.depth * CELL / 2) / CELL * S + f.margin * S - .5);
        const near = si >= 0 && sj >= 0 && si < f.w && sj < f.d ? f.a[sj * f.w + si] : 0;
        positions.push(x, SEA + .012 * Math.sin(x * 2.1 - z * 1.3), z);
        const c = deep.clone().lerp(mid, T.MathUtils.smoothstep(near, .0, .08)).lerp(shallow, T.MathUtils.smoothstep(near, .06, .3)).lerp(foam, T.MathUtils.smoothstep(near, .3, .42) * .6);
        colors.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; index.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.setIndex(index); g.computeVertexNormals();
    return g;
}

export function surfaceY(island: Island, method: Method, x: number, z: number) {
    if (method === 'G') { const p = world(island, x, z); return fieldHeight(island, p.x, p.z); }
    return top(island.heights[key(x, z)] ?? 0);
}

export function pathGeometry(island: Island, derived: Derived, method: Method) {
    // Each route (door -> hub over the real graph) becomes curved ribbons, split where it
    // changes level so a ribbon never drapes over a terrace lip; stairs carry the rest.
    const list: T.BufferGeometry[] = [], half = .36;
    const lv = (k: string) => island.heights[k] ?? 0;
    const y = (wx: number, wz: number, l: number) => (method === 'G' ? fieldHeight(island, wx, wz) : top(l)) + .025;
    const runs: string[][] = [];
    for (const route of derived.routes) {
        let run = [route[0]];
        for (let i = 1; i < route.length; i++) {
            if (method === 'T' && lv(route[i]) !== lv(route[i - 1])) { runs.push(run); run = [route[i]]; } else run.push(route[i]);
        }
        runs.push(run);
    }
    for (const run of runs) {
        const l = lv(run[0]);
        const points = run.map(k => { const p = world(island, ...unkey(k)); return new T.Vector3(p.x, 0, p.z); });
        if (points.length === 1) points.push(points[0].clone().add(new T.Vector3(.01, 0, 0)));
        const curve = new T.CatmullRomCurve3(points, false, 'centripetal', .5);
        const n = Math.max(2, Math.ceil(curve.getLength() / .22)), pos: number[] = [], idx: number[] = [];
        for (let i = 0; i <= n; i++) {
            const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), side = new T.Vector3(-t.z, 0, t.x).normalize();
            // Soft, slightly irregular edges like a trodden path rather than a printed strip.
            const w = half * (1 + .12 * Math.sin(p.x * 3.1 + p.z * 2.3));
            for (const s of [1, -1]) { const q = p.clone().addScaledVector(side, w * s); pos.push(q.x, y(q.x, q.z, l), q.z); }
        }
        for (let i = 0; i < n; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        list.push(g.toNonIndexed());
        for (const end of [points[0], points[points.length - 1]]) {
            const disc = new T.CircleGeometry(half * 1.02, 16); disc.rotateX(-Math.PI / 2);
            const dp = disc.getAttribute('position');
            for (let i = 0; i < dp.count; i++) { const wx = dp.getX(i) + end.x, wz = dp.getZ(i) + end.z; dp.setXYZ(i, wx, y(wx, wz, l) + .001, wz); }
            disc.deleteAttribute('uv'); disc.deleteAttribute('normal'); list.push(disc.toNonIndexed());
        }
    }
    if (!list.length) return undefined;
    const g = mergeGeometries(list)!; g.computeVertexNormals();
    return g;
}

/** An authored stair module: rounded stone treads stepping from the lower cell up to the terrace lip. */
export function stairGeometry(island: Island, derived: Derived) {
    const list: T.BufferGeometry[] = [];
    for (const s of derived.stairs) {
        const pu = world(island, ...s.upper), pl = world(island, ...s.lower);
        const dir = pu.clone().sub(pl).normalize(), lowY = top(island.heights[key(...s.lower)] ?? 0), highY = top(island.heights[key(...s.upper)] ?? 0);
        const edge = pl.clone().lerp(pu, .5), treads = 4, run = .78;
        for (let t = 0; t < treads; t++) {
            const h = (highY - lowY) * (t + 1) / treads, depth = run / treads;
            const center = edge.clone().addScaledVector(dir, -run + depth * (t + .5));
            const box = new T.BoxGeometry(1.0, h, depth + .02, 1, 1, 1);
            box.translate(0, lowY + h / 2, 0);
            box.applyMatrix4(new T.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
            box.translate(center.x, 0, center.z);
            box.deleteAttribute('uv'); list.push(box.toNonIndexed());
        }
    }
    if (!list.length) return undefined;
    const g = mergeGeometries(list)!; g.computeVertexNormals();
    return g;
}
export const COLORS = C;
