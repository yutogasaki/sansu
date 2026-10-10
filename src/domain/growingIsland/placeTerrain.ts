import { key, neighbors, onLand, walkableCells } from './space';
import type { Cell, GrowingState } from './types';
import type { PlacePoint } from './placeTypes';

// Native saves and diagnostic projections share these coordinates across JS engines.
// exp/sin/cos may differ in their final bit; sub-nanometre noise must not create a
// different semantic place revision or invalidate an otherwise identical layout.
const stableCoordinate = (value: number) => Math.round(value * 1e9) / 1e9;

/** Saved coordinates keep their meaning. The original six-by-five home garden stays level;
 * newly owned districts form broad gentle banks rather than object-specific platforms. */
export function terrainHeightAt(state: Pick<GrowingState, 'land'>, cell: Cell): number {
    if (!state.land.expanded && !state.land.extra.length && !state.land.capes.length && !state.land.districts?.length) return 0;
    const height = (x: number, z: number) => {
        const east = Math.max(0, x - 5), west = Math.max(0, -x), south = Math.max(0, z - 4);
        // Forest hills retain their northern rise, then roll gently into the low
        // southern bay. Coordinates, rather than the current outer bounds, define
        // this shape so buying another district never lifts an existing garden.
        const towardBay = Math.max(0, z - 3) / 3.4;
        const forest = 1 / (1 + towardBay * towardBay);
        const bank = Math.max(east, west) * .34 * forest + south * .04;
        // Asymptotic height keeps arbitrarily many districts navigable, with no progression cap.
        return 2.3 * (1 - Math.exp(-bank / 2.3));
    };
    const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
    const a = height(x, z), b = height(x + 1, z), c = height(x, z + 1), d = height(x + 1, z + 1);
    // The same diagonal as the actual ground triangles; feet and hit positions do not
    // rely on a smoother imaginary surface than the mesh below them.
    return stableCoordinate(u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d));
}

export const PLACE_GALLERY_WIDTH = .42;

/** Absolute physical floor positions. The stair stays in one free entrance; the upper
 * branch walk follows only its connected open footprint, then returns to that entrance. */
export function placeGalleryRoute(state: GrowingState, place: { footprint: Cell[]; entrances: Cell[] }, anchorCell: Cell): PlacePoint[] {
    const open = walkableCells(state);
    const allowed = new Set(place.footprint.filter(cell => open.has(key(cell)) && onLand(state, cell)).map(key));
    const explore = (entrance: Cell) => {
        const queue = [entrance], previous = new Map<string, Cell | undefined>([[key(entrance), undefined]]);
        for (let i = 0; i < queue.length; i++) for (const cell of neighbors(queue[i])) {
            const id = key(cell);
            if (!allowed.has(id) || previous.has(id)) continue;
            previous.set(id, queue[i]); queue.push(cell);
        }
        return { entrance, queue, previous };
    };
    // A reachable courtyard centre can be an isolated island within the narrow
    // footprint. Prefer an entrance that can actually lead to a branch walk.
    const choices = place.entrances.filter(cell => open.has(key(cell)) && onLand(state, cell)).map(explore)
        .sort((a, b) => b.queue.length - a.queue.length
            || Math.hypot(a.entrance.x - anchorCell.x, a.entrance.z - anchorCell.z) - Math.hypot(b.entrance.x - anchorCell.x, b.entrance.z - anchorCell.z)
            || a.entrance.z - b.entrance.z || a.entrance.x - b.entrance.x);
    const chosen = choices[0], base = chosen?.entrance;
    if (!base) return [];
    const ground = terrainHeightAt(state, base) + .04;
    const rise = 1.35, radius = .275, steps = 28;
    const ascent: PlacePoint[] = [{ ...base, y: ground }];
    // Start and finish at the centre of the open entrance, so ground navigation has a
    // genuine junction. The narrow landing and supports leave the ground lane open.
    ascent.push({ x: base.x + radius, z: base.z, y: ground });
    for (let i = 1; i <= steps; i++) {
        const a = i / steps * Math.PI * 2;
        ascent.push({ x: base.x + Math.cos(a) * radius, z: base.z + Math.sin(a) * radius, y: ground + rise * i / steps });
    }
    const { queue, previous } = chosen;
    const branch: Cell[] = [];
    let cursor: Cell | undefined = queue[queue.length - 1];
    while (cursor) { branch.unshift(cursor); cursor = previous.get(key(cursor)); }
    const upper = branch.map(cell => ({ ...cell, y: terrainHeightAt(state, cell) + .04 + rise }));
    // Fit a genuine round upper court using the same open footprint. Test both
    // edges of its physical deck, not just the actor centre. A narrow lane retains
    // its existing branch walk and never receives an oversized ornamental ring.
    const clear = (x: number, z: number) => allowed.has(key({ x: Math.round(x), z: Math.round(z) }));
    let loop: { center: Cell; radius: number } | undefined;
    for (const radius of [1.2, .95, .72, .46]) {
        const center = queue.find(cell => Array.from({ length: 64 }, (_, i) => i * Math.PI * 2 / 64)
            .every(a => [radius - PLACE_GALLERY_WIDTH / 2, radius, radius + PLACE_GALLERY_WIDTH / 2 + .018]
                .every(r => clear(cell.x + Math.cos(a) * r, cell.z + Math.sin(a) * r))));
        if (center) { loop = { center, radius }; break; }
    }
    const roundWalk: PlacePoint[] = [];
    if (loop) {
        // BFS attachment preserves a reachable junction even when the safe centre
        // is away from the original stairs. Return over exactly the same boards.
        const approach: Cell[] = [];
        let at: Cell | undefined = loop.center;
        while (at) { approach.unshift(at); at = previous.get(key(at)); }
        roundWalk.push(...approach.map(cell => ({ ...cell, y: terrainHeightAt(state, cell) + .04 + rise })));
        for (let i = 0; i <= 48; i++) {
            const a = i / 48 * Math.PI * 2;
            const point = { x: loop.center.x + Math.cos(a) * loop.radius, z: loop.center.z + Math.sin(a) * loop.radius };
            roundWalk.push({ ...point, y: terrainHeightAt(state, point) + .04 + rise });
        }
        roundWalk.push(...approach.slice().reverse().map(cell => ({ ...cell, y: terrainHeightAt(state, cell) + .04 + rise })));
    }
    const stroll = [...roundWalk, ...upper, ...upper.slice(0, -1).reverse()];
    return [...ascent, ...stroll, ascent[ascent.length - 1], ...ascent.slice(0, -1).reverse()]
        .map(point => ({ x: stableCoordinate(point.x), y: stableCoordinate(point.y), z: stableCoordinate(point.z) }));
}
