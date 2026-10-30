// Stack lab: one block grid where the look of every block is decided by its
// neighbours (terrace, house, rock, arch, stair, dome), and where residents
// can go is decided the same way: along terraces, through buildings, over
// bridges and up stairs. The child only stacks or carves.

export const W = 10;
export const D = 10;
export const H = 16;

export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ALL: readonly Dir[] = [0, 1, 2, 3];

export type Grid = Uint8Array;
type Cell = [number, number, number];

export const emptyGrid = (): Grid => new Uint8Array(W * D * H);
const at = (x: number, y: number, z: number) => x + z * W + y * W * D;
export const inside = (x: number, y: number, z: number) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;

// The island base sits under layer 0, so y = -1 is solid wherever the grid is.
export const solid = (grid: Grid, x: number, y: number, z: number) =>
    y === -1 ? x >= 0 && x < W && z >= 0 && z < D : inside(x, y, z) && grid[at(x, y, z)] === 1;

export function setBlock(grid: Grid, x: number, y: number, z: number, on: boolean): boolean {
    if (!inside(x, y, z) || solid(grid, x, y, z) === on) return false;
    grid[at(x, y, z)] = on ? 1 : 0;
    return true;
}

/** Rows of column heights, one base-36 digit per cell (so towers can reach 16). */
export function fromHeights(rows: readonly string[]): Grid {
    const grid = emptyGrid();
    rows.forEach((row, z) => [...row].forEach((c, x) => {
        for (let y = 0; y < parseInt(c, 36); y++) setBlock(grid, x, y, z, true);
    }));
    return grid;
}

const hash = (...n: number[]) => n.reduce((h, v) => Math.imul(h ^ (v + 0x9e37), 0x85ebca6b) >>> 0, 0x2545f491) % 997;

export type Kind = 'house' | 'rock' | 'arch';

export interface Block {
    key: string;
    x: number; y: number; z: number;
    kind: Kind;
    /** Open sky above: the top is a terrace people can stand on. */
    terrace: boolean;
    archAxis?: 'x' | 'z';
    dome: boolean;
    /** Low white wall along terrace edges that fall away. */
    parapets: Dir[];
    doors: Dir[];
    /** A door high up with a small ledge to step out onto. */
    balconies: Dir[];
    windows: Dir[];
    caves: Dir[];
}

export interface Stair {
    key: string;
    /** Floor height y (top of block y-1) where the flight starts. */
    x: number; y: number; z: number;
    /** Direction of the higher terrace the steps arrive at, from the last cell. */
    dir: Dir;
    /** Levels climbed: one per cell. */
    rise: number;
    /**
     * Cells the flight climbs through, foot first; x,z is the last one. Each
     * cell holds a landing and half a cell of steps, so a long flight can turn
     * corners and zigzag up a cliff.
     */
    cells: [number, number][];
}

/** A plank over a one-cell gap between two floors of the same height. */
export interface Bridge { key: string; x: number; y: number; z: number; dir: Dir }

/** A way into a building: a door onto a floor, or a door onto a ledge. */
export interface Entrance { key: string; x: number; y: number; z: number; dir: Dir; kind: 'door' | 'balcony' }

/** Waypoint; a fourth value of 1 means the resident is indoors getting there. */
export type Point = [number, number, number] | [number, number, number, 1];

/** One way a resident can go from a spot: to the next spot, through waypoints. */
export interface Walk { to: string; points: Point[] }

export interface Village {
    blocks: Block[];
    stairs: Stair[];
    bridges: Bridge[];
    entrances: Entrance[];
    walks: Map<string, Walk[]>;
    /** Where each spot residents can stand is. */
    spots: Map<string, [number, number, number]>;
    /** Floor cells no resident can reach from the ground. */
    stranded: number;
    /** Paved streets: pairs of neighbouring floors on the paths between places. */
    streets: [string, string][];
    /** Places residents set out for: the spot in front of every door. */
    places: string[];
}

const open = (grid: Grid, x: number, y: number, z: number) => !solid(grid, x, y, z);
/**
 * Rock is hill: buried two deep and walled in on three sides or more. A
 * tower, even a thick one, shows two faces or more, so it stays a building.
 */
const isRock = (grid: Grid, x: number, y: number, z: number) =>
    solid(grid, x, y + 1, z) && solid(grid, x, y + 2, z)
    && DIRS.filter(([dx, dz]) => !solid(grid, x + dx, y, z + dz)).length <= 1;
const floorKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Every block gets at most one way in. A door where there is ground in front;
 * higher up, where the wall faces open air, sometimes a balcony. Rock buried
 * deep in the hill opens as cave homes the same way.
 */
function entrances(grid: Grid): Entrance[] {
    const out: Entrance[] = [];
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        if (!solid(grid, x, y, z)) continue;
        if (y > 0 && open(grid, x, y - 1, z)) continue; // arches and overhangs
        const faces = ALL.filter(d => inside(x + DIRS[d][0], y, z + DIRS[d][1]) && open(grid, x + DIRS[d][0], y, z + DIRS[d][1]));
        const buried = isRock(grid, x, y, z);
        const doors = faces.filter(d => solid(grid, x + DIRS[d][0], y - 1, z + DIRS[d][1]))
            .sort((a, b) => hash(x, y, z, a, 7) - hash(x, y, z, b, 7));
        if (doors.length && (!buried || hash(x, y, z, 2) % 4 === 0)) {
            out.push({ key: `e${x},${y},${z}`, x, y, z, dir: doors[0], kind: 'door' });
            continue;
        }
        const air = faces.filter(d => !solid(grid, x + DIRS[d][0], y - 1, z + DIRS[d][1]));
        if (!buried && y >= 2 && air.length && hash(x, y, z, 9) % 3 === 0) {
            const d = air.sort((a, b) => hash(x, y, z, a, 9) - hash(x, y, z, b, 9))[0];
            out.push({ key: `e${x},${y},${z}`, x, y, z, dir: d, kind: 'balcony' });
        }
    }
    return out;
}

function paths(grid: Grid, doors: Entrance[]) {
    const floor = (x: number, y: number, z: number) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y <= H
        && solid(grid, x, y - 1, z) && open(grid, x, y, z);

    // Terraces of one height that touch form a group.
    const region = new Map<string, number>();
    const members: Cell[][] = [];
    for (let y = 0; y <= H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        if (!floor(x, y, z) || region.has(floorKey(x, y, z))) continue;
        const id = members.length;
        const list: Cell[] = [];
        const todo: [number, number][] = [[x, z]];
        region.set(floorKey(x, y, z), id);
        while (todo.length) {
            const [cx, cz] = todo.pop()!;
            list.push([cx, y, cz]);
            for (const [dx, dz] of DIRS) {
                const nx = cx + dx, nz = cz + dz;
                if (floor(nx, y, nz) && !region.has(floorKey(nx, y, nz))) { region.set(floorKey(nx, y, nz), id); todo.push([nx, nz]); }
            }
        }
        members.push(list);
    }
    const groupOf = (c: Cell) => region.get(floorKey(...c));

    // Spots: every floor, plus every balcony ledge.
    const spots = new Map<string, [number, number, number]>();
    for (const list of members) for (const [x, y, z] of list) spots.set(floorKey(x, y, z), [x + .5, y, z + .5]);
    const spotOf = (e: Entrance) => {
        const [dx, dz] = DIRS[e.dir];
        if (e.kind === 'door') return floorKey(e.x + dx, e.y, e.z + dz);
        const k = `b${e.x},${e.y},${e.z},${e.dir}`;
        spots.set(k, [e.x + .5 + dx * .72, e.y, e.z + .5 + dz * .72]);
        return k;
    };

    const walks = new Map<string, Walk[]>();
    const go = (from: string, to: string, points: Point[]) =>
        (walks.get(from) ?? walks.set(from, []).get(from)!).push({ to, points });
    // Links between groups, for reachability. Balconies join through their building.
    const links: [string, string][] = [];
    const groupKey = (spot: string) => {
        const g = region.get(spot);
        return g === undefined ? spot : `g${g}`;
    };

    // Through buildings: entrances stacked in one unbroken column are joined
    // inside, so a resident goes in one door and comes out another.
    const byColumn = new Map<string, Entrance[]>();
    for (const e of doors) (byColumn.get(`${e.x},${e.z}`) ?? byColumn.set(`${e.x},${e.z}`, []).get(`${e.x},${e.z}`)!).push(e);
    for (const list of byColumn.values()) {
        list.sort((a, b) => a.y - b.y);
        for (let i = 0; i + 1 < list.length; i++) {
            const a = list[i], b = list[i + 1];
            let whole = true;
            for (let y = a.y; y <= b.y && whole; y++) whole = solid(grid, a.x, y, a.z);
            if (!whole) continue;
            const face = (e: Entrance): Point => [e.x + .5 + DIRS[e.dir][0] * .5, e.y, e.z + .5 + DIRS[e.dir][1] * .5];
            const core = (e: Entrance): Point => [e.x + .5, e.y, e.z + .5, 1];
            const [fa, fb] = [face(a), face(b)];
            const sa = spotOf(a), sb = spotOf(b);
            go(sa, sb, [fa, core(a), core(b), [fb[0], fb[1], fb[2], 1], spots.get(sb)!]);
            go(sb, sa, [fb, core(b), core(a), [fa[0], fa[1], fa[2], 1], spots.get(sa)!]);
            links.push([groupKey(sa), groupKey(sb)]);
        }
        // The highest door also leads up inside to the roof.
        const last = list[list.length - 1];
        let ty = last.y;
        while (solid(grid, last.x, ty + 1, last.z)) ty++;
        const roof = floorKey(last.x, ty + 1, last.z);
        if (spots.has(roof)) {
            const s0 = spotOf(last);
            const face: Point = [last.x + .5 + DIRS[last.dir][0] * .5, last.y, last.z + .5 + DIRS[last.dir][1] * .5];
            const up: Point = [last.x + .5, ty + 1, last.z + .5, 1];
            go(s0, roof, [face, [last.x + .5, last.y, last.z + .5, 1], up, spots.get(roof)!]);
            go(roof, s0, [[last.x + .5, ty + .2, last.z + .5, 1], [last.x + .5, last.y, last.z + .5, 1], [face[0], face[1], face[2], 1], spots.get(s0)!]);
            links.push([groupKey(s0), groupKey(roof)]);
        }
        // A ledge with no other door in its building is only a window box.
        for (const e of list) if (e.kind === 'balcony' && !walks.has(spotOf(e))) spots.delete(spotOf(e));
    }

    // Bridges over one-cell gaps between floors of the same height.
    const bridges: Bridge[] = [];
    for (const list of members) for (const [x, y, z] of list) for (const d of [0, 2] as Dir[]) {
        const [dx, dz] = DIRS[d];
        const mx = x + dx, mz = z + dz, cx = x + 2 * dx, cz = z + 2 * dz;
        if (!floor(cx, y, cz) || y < 1 || !inside(mx, y, mz) || solid(grid, mx, y, mz) || solid(grid, mx, y - 1, mz)) continue;
        if (groupOf([x, y, z]) === groupOf([cx, y, cz]) && hash(x, y, z, d, 4) % 3) continue;
        bridges.push({ key: `r${x},${y},${z},${d}`, x, y, z, dir: d });
        const a = floorKey(x, y, z), c = floorKey(cx, y, cz);
        go(a, c, [[mx + .5, y, mz + .5], spots.get(c)!]);
        go(c, a, [[mx + .5, y, mz + .5], spots.get(a)!]);
        links.push([groupKey(a), groupKey(c)]);
    }

    const reach = (stairs: Stair[]) => {
        const adj = new Map<string, Set<string>>();
        const link = (a: string, b: string) => {
            (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
            (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
        };
        links.forEach(([a, b]) => link(a, b));
        for (const st of stairs) link(`g${groupOf([st.cells[0][0], st.y, st.cells[0][1]])}`, `g${groupOf([st.x + DIRS[st.dir][0], st.y + st.rise, st.z + DIRS[st.dir][1]])}`);
        const seen = new Set(members.map((m, id) => (m[0][1] === 0 ? `g${id}` : '')).filter(Boolean));
        const todo = [...seen];
        while (todo.length) for (const n of adj.get(todo.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
        return seen;
    };

    // Stairs: one between touching groups a level apart (often skipped when a
    // building or bridge already joins them); then long flights for whatever
    // the ground still cannot reach.
    const stairs: Stair[] = [];
    const stairOn = new Set<string>();
    const arrives = new Set<string>();
    const joined = new Set(links.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    const pairs = new Map<string, { score: number; lo: Cell; up: Dir }[]>();
    members.forEach((list, id) => {
        for (const [x, y, z] of list) for (const d of ALL) {
            const other = groupOf([x + DIRS[d][0], y + 1, z + DIRS[d][1]]);
            // Joined inside a building already: an outdoor stair only now and then,
            // so the village still shows people climbing in the open.
            if (other === undefined || (joined.has(`g${id}|g${other}`) && hash(id, other, 13) % 2)) continue;
            const key = `${floorKey(...members[id][0])}>${floorKey(...members[other][0])}`;
            (pairs.get(key) ?? pairs.set(key, []).get(key)!).push({ score: hash(x, y, z, d), lo: [x, y, z], up: d });
        }
    });
    const arriveOf = (st: Stair) => `${st.x + DIRS[st.dir][0]},${st.y + st.rise - 1},${st.z + DIRS[st.dir][1]},${st.dir ^ 1}`;
    const ordered = [...pairs.values()].map(c => c.sort((a, b) => a.score - b.score)).sort((a, b) => a[0].score - b[0].score);
    for (const candidates of ordered) {
        const pick = candidates.find(c => !stairOn.has(floorKey(...c.lo)));
        if (!pick) continue;
        const [x, y, z] = pick.lo;
        stairOn.add(floorKey(x, y, z));
        const st: Stair = { key: `s${x},${y},${z},${pick.up}`, x, y, z, dir: pick.up, rise: 1, cells: [[x, z]] };
        arrives.add(arriveOf(st));
        stairs.push(st);
    }

    // A long flight may run over a short stair's cell; that stair then goes.
    const shortAt = (x: number, y: number, z: number) => stairs.findIndex(st => st.rise === 1 && st.x === x && st.y === y && st.z === z);
    const takenByFlight = (x: number, y: number, z: number) => stairOn.has(floorKey(x, y, z)) && shortAt(x, y, z) < 0;
    // Free cells on one level, walked back from the wall, `n` long.
    const chain = (x: number, y: number, z: number, n: number, seed: number): [number, number][] | undefined => {
        const path: [number, number][] = [[x, z]];
        const used = new Set([`${x},${z}`]);
        const grow = (): boolean => {
            if (path.length === n) return true;
            const [cx, cz] = path[path.length - 1];
            const ways = [...ALL].sort((a, b) => hash(cx, cz, a, seed) - hash(cx, cz, b, seed));
            for (const d of ways) {
                const nx = cx + DIRS[d][0], nz = cz + DIRS[d][1];
                if (used.has(`${nx},${nz}`) || !floor(nx, y, nz) || takenByFlight(nx, y, nz)) continue;
                path.push([nx, nz]); used.add(`${nx},${nz}`);
                if (grow()) return true;
                path.pop(); used.delete(`${nx},${nz}`);
            }
            return false;
        };
        return grow() ? path.reverse() : undefined;
    };
    for (let reached = reach(stairs), added = true, round = 0; added && round < 40; reached = reach(stairs), round++) {
        added = false;
        const wanted: { score: number; end: Cell; up: Dir; rise: number }[] = [];
        members.forEach((list, id) => {
            for (const [x, y, z] of list) for (const d of ALL) for (let rise = 1; rise <= H; rise++) {
                const h = groupOf([x + DIRS[d][0], y + rise, z + DIRS[d][1]]);
                if (h === undefined || reached.has(`g${h}`) === reached.has(`g${id}`) || takenByFlight(x, y, z)) continue;
                wanted.push({ score: rise * 1000 + hash(x, y, z, d, 5), end: [x, y, z], up: d, rise });
            }
        });
        for (const w of wanted.sort((a, b) => a.score - b.score)) {
            const [x, y, z] = w.end;
            const cells = chain(x, y, z, w.rise, w.up);
            if (!cells) continue;
            for (const [cx, cz] of cells) {
                const old = shortAt(cx, y, cz);
                if (old >= 0) arrives.delete(arriveOf(stairs.splice(old, 1)[0]));
                stairOn.add(floorKey(cx, y, cz));
            }
            const flight: Stair = { key: `S${x},${y},${z},${w.up},${cells.flat().join('.')}`, x, y, z, dir: w.up, rise: w.rise, cells };
            arrives.add(arriveOf(flight));
            stairs.push(flight);
            added = true;
            break;
        }
    }
    const reached = reach(stairs);
    const stranded = members.reduce((n, list, id) => n + (reached.has(`g${id}`) ? 0 : list.length), 0);

    // Along a level, and up or down the stairs.
    for (const list of members) for (const [x, y, z] of list) for (const [dx, dz] of DIRS) {
        if (floor(x + dx, y, z + dz)) go(floorKey(x, y, z), floorKey(x + dx, y, z + dz), [spots.get(floorKey(x + dx, y, z + dz))!]);
    }
    for (const st of stairs) {
        const lo = floorKey(st.cells[0][0], st.y, st.cells[0][1]);
        const hi = floorKey(st.x + DIRS[st.dir][0], st.y + st.rise, st.z + DIRS[st.dir][1]);
        const points: Point[] = [];
        st.cells.forEach(([cx, cz], i) => {
            const [ex, ez] = i + 1 < st.cells.length ? [st.cells[i + 1][0] - cx, st.cells[i + 1][1] - cz] : DIRS[st.dir];
            points.push([cx + .5, st.y + i, cz + .5], [cx + .5 + ex * .5, st.y + i + 1, cz + .5 + ez * .5]);
        });
        go(lo, hi, [...points, spots.get(hi)!]);
        go(hi, lo, [...points.reverse(), spots.get(lo)!]);
    }
    return { stairs, bridges, arrives, walks, spots, stranded };
}

const outdoors = (w: Walk) => !w.points.some(p => p[3] === 1);

/**
 * Streets grow like a tree: start at one door, then again and again pave the
 * shortest outdoor way from the streets so far to the nearest door not yet on
 * them. Doors only reachable through buildings start networks of their own.
 */
function streetsOf(walks: Map<string, Walk[]>, places: string[]): [string, string][] {
    const want = new Set(places.filter(p => walks.has(p)));
    const paved = new Set<string>();
    const streets: [string, string][] = [];
    const first = [...want].sort()[0];
    if (!first) return streets;
    paved.add(first);
    want.delete(first);
    while (want.size) {
        const from = new Map<string, string>();
        const todo = [...paved];
        todo.forEach(k => from.set(k, ''));
        let found = '';
        for (let i = 0; i < todo.length && !found; i++) {
            for (const w of walks.get(todo[i]) ?? []) {
                if (!outdoors(w) || from.has(w.to)) continue;
                from.set(w.to, todo[i]);
                if (want.has(w.to)) { found = w.to; break; }
                todo.push(w.to);
            }
        }
        if (!found) {
            // Nothing left reachable from these streets: start another network.
            const seed = [...want].sort()[0];
            want.delete(seed);
            paved.add(seed);
            continue;
        }
        want.delete(found);
        for (let k = found; from.get(k); k = from.get(k)!) {
            streets.push([from.get(k)!, k]);
            paved.add(k);
        }
        paved.add(found);
    }
    return streets;
}

export function derive(grid: Grid): Village {
    const doors = entrances(grid);
    const { stairs, bridges, arrives, walks, spots, stranded } = paths(grid, doors);
    const doorAt = new Map(doors.map(e => [`${e.x},${e.y},${e.z}`, e]));

    const blocks: Block[] = [];
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        if (!solid(grid, x, y, z)) continue;
        const terrace = open(grid, x, y + 1, z);
        let kind: Kind = isRock(grid, x, y, z) ? 'rock' : 'house';
        let archAxis: Block['archAxis'];
        if (y > 0 && open(grid, x, y - 1, z)) {
            if (solid(grid, x - 1, y, z) && solid(grid, x + 1, y, z)) archAxis = 'z';
            else if (solid(grid, x, y, z - 1) && solid(grid, x, y, z + 1)) archAxis = 'x';
            if (archAxis) kind = 'arch';
        }
        const faces = ALL.filter(d => open(grid, x + DIRS[d][0], y, z + DIRS[d][1]));
        const parapets = terrace ? faces.filter(d => !arrives.has(`${x},${y},${z},${d}`)) : [];
        const way = doorAt.get(`${x},${y},${z}`);
        const doors: Dir[] = way?.kind === 'door' && kind !== 'rock' ? [way.dir] : [];
        const caves: Dir[] = way?.kind === 'door' && kind === 'rock' ? [way.dir] : [];
        const balconies: Dir[] = way?.kind === 'balcony' ? [way.dir] : [];
        const windows: Dir[] = [];
        if (kind === 'rock') {
            for (const d of faces) if (!caves.includes(d) && hash(x, y, z, d) % 6 === 0) caves.push(d);
        } else if (kind === 'house') {
            for (const d of faces) if (d !== way?.dir && hash(x, y, z, d, 3) % 3 === 0) windows.push(d);
        }
        let dome = false;
        if (terrace && kind === 'house' && y >= 2) {
            // A block standing up on its own gets a dome, most of the time.
            const alone = DIRS.every(([dx, dz]) => !solid(grid, x + dx, y, z + dz));
            dome = alone && hash(x, y, z, 11) % 3 !== 0;
        }
        blocks.push({ key: `b${x},${y},${z}`, x, y, z, kind, terrace, archAxis, dome, parapets, doors, balconies, windows, caves });
    }
    const places = doors.filter(e => e.kind === 'door').map(e => floorKey(e.x + DIRS[e.dir][0], e.y, e.z + DIRS[e.dir][1]));
    const streets = streetsOf(walks, places);
    return { blocks, stairs, bridges, entrances: doors, walks, spots, stranded, streets, places };
}

/** Everything that looks different between two villages, by key. */
export function changed(before: Village, after: Village): Set<string> {
    const sign = (v: Village) => new Map<string, string>([
        ...v.blocks.map(b => [b.key, JSON.stringify(b)] as const),
        ...v.stairs.map(s => [s.key, `${s.rise}`] as const),
        ...v.bridges.map(b => [b.key, b.key] as const),
        ...v.streets.map(([a, b]) => [`p${[a, b].sort().join('|')}`, ''] as const),
    ]);
    const a = sign(before), b = sign(after);
    const out = new Set<string>();
    for (const [k, v] of b) if (a.get(k) !== v) out.add(k);
    for (const k of a.keys()) if (!b.has(k)) out.add(k);
    return out;
}
