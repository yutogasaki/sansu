import * as THREE from 'three';
import { D, DIRS, H, W, type Block } from './stackRules';

// Buildings drawn from their plan, not their blocks. On every level the cells
// of one building are traced into outlines, the outlines are corner-cut until
// they are curves, and each level is pushed up one storey with soft edges.
// Levels swell, lean and narrow a little as they rise, and every terrace gets
// a round rim that follows the curve. The grid stays only in the rules.

type P = [number, number];

/** Closed outlines around a set of cells, outer ones counter-clockwise. */
function outlines(cells: Set<string>): P[][] {
    const has = (x: number, z: number) => cells.has(`${x},${z}`);
    const next = new Map<string, P[]>();
    const edge = (a: P, b: P) => { const k = `${a[0]},${a[1]}`; (next.get(k) ?? next.set(k, []).get(k)!).push(b); };
    for (const key of cells) {
        const [x, z] = key.split(',').map(Number);
        if (!has(x, z - 1)) edge([x, z], [x + 1, z]);
        if (!has(x + 1, z)) edge([x + 1, z], [x + 1, z + 1]);
        if (!has(x, z + 1)) edge([x + 1, z + 1], [x, z + 1]);
        if (!has(x - 1, z)) edge([x, z + 1], [x, z]);
    }
    const loops: P[][] = [];
    for (const [start, outs] of next) {
        while (outs.length) {
            const loop: P[] = [start.split(',').map(Number) as P];
            let at = outs.pop()!;
            while (`${at[0]},${at[1]}` !== start) {
                loop.push(at);
                const k = `${at[0]},${at[1]}`;
                const more = next.get(k)!;
                at = more.pop()!;
            }
            loops.push(loop);
        }
    }
    return loops;
}

/** Corner cutting: each round replaces every corner with two points a quarter in. */
function chaikin(loop: P[], rounds: number): P[] {
    let pts = loop;
    for (let r = 0; r < rounds; r++) {
        const out: P[] = [];
        pts.forEach((a, i) => {
            const b = pts[(i + 1) % pts.length];
            out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
        });
        pts = out;
    }
    return pts;
}

const area = (loop: P[]) => loop.reduce((s, a, i) => { const b = loop[(i + 1) % loop.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const insideLoop = ([x, z]: P, loop: P[]) => {
    let c = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const [xi, zi] = loop[i], [xj, zj] = loop[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
};

const BEVEL = .09;

export interface ShellLook {
    wall: (b: Block) => THREE.Material;
    rock: (y: number) => THREE.Material;
    rim: THREE.Material;
}

export function buildShell(blocks: Block[], look: ShellLook): THREE.Group {
    const group = new THREE.Group();
    const at = new Map(blocks.map(b => [`${b.x},${b.y},${b.z}`, b]));
    for (let y = 0; y < H; y++) {
        // Buildings on this level: touching cells of the same kind (arches keep their own shape).
        const seen = new Set<string>();
        for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
            const first = at.get(`${x},${y},${z}`);
            if (!first || first.kind === 'arch' || seen.has(`${x},${z}`)) continue;
            const cells = new Set<string>();
            const todo: P[] = [[x, z]];
            seen.add(`${x},${z}`);
            while (todo.length) {
                const [cx, cz] = todo.pop()!;
                cells.add(`${cx},${cz}`);
                for (const [dx, dz] of DIRS) {
                    const k = `${cx + dx},${cz + dz}`;
                    const b = at.get(`${cx + dx},${y},${cz + dz}`);
                    if (b && b.kind === first.kind && !seen.has(k)) { seen.add(k); todo.push([cx + dx, cz + dz]); }
                }
            }
            group.add(level(cells, y, first, at, look));
        }
    }
    return group;
}

function level(cells: Set<string>, y: number, first: Block, at: Map<string, Block>, look: ShellLook): THREE.Group {
    const g = new THREE.Group();
    const list = [...cells].map(k => k.split(',').map(Number) as P);
    const cx = list.reduce((s, p) => s + p[0] + .5, 0) / list.length;
    const cz = list.reduce((s, p) => s + p[1] + .5, 0) / list.length;
    const seed = Math.round(cx * 7 + cz * 13);
    const rock = first.kind === 'rock';
    // Swell and narrow in a slow wave as the building rises; lean and turn a touch.
    const swell = rock ? 1.04 : 1 + .045 * Math.sin(y * 1.1 + seed) - Math.max(0, y - 4) * .008;
    const turn = (rock ? .04 : .03) * Math.sin(y * .7 + seed * 1.3);
    const lean: P = [.04 * Math.sin(y * .6 + seed), .04 * Math.cos(y * .5 + seed * .7)];
    const place = ([x, z]: P): P => {
        const dx = (x - cx) * swell, dz = (z - cz) * swell;
        const c = Math.cos(turn), s = Math.sin(turn);
        return [cx + dx * c - dz * s + lean[0], cz + dx * s + dz * c + lean[1]];
    };

    const loops = outlines(cells).map(l => chaikin(l, 3).map(place));
    const outer = loops.filter(l => area(l) > 0);
    const holes = loops.filter(l => area(l) <= 0);
    // Shapes are drawn in (x, -z) so that turning them upright lands them on (x, z).
    const flip = (l: P[]) => l.map(([x, z]) => new THREE.Vector2(x, -z));
    // One colour per building, from its corner cell at ground level, so a
    // tower does not change colour from storey to storey.
    const [mx, mz] = list.reduce((a, b) => (a[0] + a[1] * 100 <= b[0] + b[1] * 100 ? a : b));
    const material = rock ? look.rock(y) : look.wall({ ...first, x: mx, y: 0, z: mz });
    for (const o of outer) {
        const shape = new THREE.Shape(flip(o));
        for (const h of holes) if (insideLoop(h[0], o)) shape.holes.push(new THREE.Path(flip(h)));
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 1 - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * .8, bevelSegments: 3, curveSegments: 4,
        });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, y + BEVEL, 0);
        const m = new THREE.Mesh(geo, material);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
    }

    // Round rims along the edges of this level's terraces.
    const terrace = new Set([...cells].filter(k => {
        const [x, z] = k.split(',').map(Number);
        return at.get(`${x},${y},${z}`)?.terrace;
    }));
    if (terrace.size && !rock) {
        for (const loop of outlines(terrace)) {
            const pts = chaikin(loop, 3).map(place).map(([x, z]) => new THREE.Vector3(x, y + 1.06, z));
            const curve = new THREE.CatmullRomCurve3(pts, true);
            const rim = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 2), .07, 6, true), look.rim);
            rim.castShadow = true;
            g.add(rim);
        }
    }
    return g;
}
