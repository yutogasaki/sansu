import * as T from 'three';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { HOME_CELL, key, neighbors, onLand, walkableCells } from '../../../domain/growingIsland/space';
import type { SceneLayout } from './sceneLayout';

/** A shared path grows between real reachable doorsteps and place entrances. It
 * is an inlay on the existing floor; it grants no new navigation or ownership. */
export function placePathEdges(state: GrowingState, places: readonly DerivedPlace[]): [Cell, Cell][] {
    const open = walkableCells(state), network = new Map<string, Cell>([[key(HOME_CELL), HOME_CELL]]);
    const targets: Cell[][] = state.plots.filter(plot => plot.kind === 'home' && plot.stage >= 2 && plot.cell)
        .map(plot => neighbors(plot.cell!).filter(cell => onLand(state, cell) && open.has(key(cell))));
    targets.push(...places.filter(place => place.stage === 'grown' || place.stage === 'lived')
        .map(place => place.entrances.filter(cell => onLand(state, cell) && open.has(key(cell)))));
    targets.sort((a, b) => Math.min(...a.map(cell => Math.abs(cell.x - HOME_CELL.x) + Math.abs(cell.z - HOME_CELL.z)))
        - Math.min(...b.map(cell => Math.abs(cell.x - HOME_CELL.x) + Math.abs(cell.z - HOME_CELL.z))));
    const edges = new Map<string, [Cell, Cell]>();
    for (const choices of targets) {
        const destinations = new Set(choices.map(key));
        if (!destinations.size || [...destinations].some(id => network.has(id))) continue;
        const queue = [...network.values()], previous = new Map<string, Cell | undefined>(queue.map(cell => [key(cell), undefined]));
        let end: Cell | undefined;
        for (let i = 0; i < queue.length && !end; i++) for (const next of neighbors(queue[i])) {
            const id = key(next);
            if (!onLand(state, next) || !open.has(id) || previous.has(id)) continue;
            previous.set(id, queue[i]); queue.push(next);
            if (destinations.has(id)) { end = next; break; }
        }
        while (end) {
            network.set(key(end), end);
            const before = previous.get(key(end));
            if (!before) break;
            const id = [key(before), key(end)].sort().join('|');
            edges.set(id, [before, end]); end = before;
        }
    }
    return [...edges.values()];
}

export function buildPlacePaths(state: GrowingState, layout: SceneLayout, places: readonly DerivedPlace[]) {
    const edges = placePathEdges(state, places);
    const water = new Set(state.landmarks.filter(item => item.kind === 'water-channel' && item.cell).map(item => key(item.cell!)));
    const vertices: number[] = [], indices: number[] = [];
    const joints = new Map<string, Cell>();
    for (const [a, b] of edges) {
        // Existing supplied channels already carry their real stepping surface.
        // Paving never fills water or suggests a new bridge across an unsupplied gap.
        if (water.has(key(a)) || water.has(key(b))) continue;
        joints.set(key(a), a); joints.set(key(b), b);
        const dx = b.x - a.x, dz = b.z - a.z, steps = 12;
        const start = vertices.length / 3;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps, x = a.x + dx * t, z = a.z + dz * t;
            const width = .20 + .013 * Math.sin(x * 2.1 + z * 1.7);
            for (const side of [-1, 1]) {
                const point = layout.point({ x: x - dz * width * side, z: z + dx * width * side }, .008);
                vertices.push(point.x, point.y, point.z);
            }
            if (i < steps) { const j = start + i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
        }
    }
    for (const cell of joints.values()) {
        const start = vertices.length / 3, center = layout.point(cell, .008);
        vertices.push(center.x, center.y, center.z);
        const radius = .20 + .013 * Math.sin(cell.x * 2.1 + cell.z * 1.7);
        for (let i = 0; i <= 24; i++) {
            const angle = i / 24 * Math.PI * 2;
            const point = layout.point({ x: cell.x + Math.cos(angle) * radius, z: cell.z + Math.sin(angle) * radius }, .008);
            vertices.push(point.x, point.y, point.z);
            if (i < 24) indices.push(start, start + i + 2, start + i + 1);
        }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new T.MeshStandardMaterial({ color: '#c2c1dd', roughness: 1, side: T.DoubleSide });
    material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
    const path = new T.Mesh(geometry, material); path.name = 'growing-reachable-paths'; path.receiveShadow = true;
    path.userData.ownMaterial = true; path.userData.groundPathEdges = edges;
    return path;
}
