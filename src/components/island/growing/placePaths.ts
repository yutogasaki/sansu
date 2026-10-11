import * as T from 'three';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { HOME_CELL, key, approachCells, passageNeighbors, onLand, walkableCells } from '../../../domain/growingIsland/space';
import type { SceneLayout } from './sceneLayout';
import type { IslandWorld } from '../../../domain/growingIsland/worldDefinition';

/** A shared path grows between real reachable doorsteps and place entrances. It
 * is an inlay on the existing floor; it grants no new navigation or ownership. */
export function placePathEdges(state: GrowingState, places: readonly DerivedPlace[], world?: IslandWorld): [Cell, Cell][] {
    const open = walkableCells(state, world), network = new Map<string, Cell>([[key(HOME_CELL), HOME_CELL]]);
    if (world && !open.has(key(HOME_CELL))) return [];
    // Compiled authored sites already have a real dry floor. The open set grants
    // this graph access; checking those same nodes against the triangles again
    // changes no route and repeats the expensive floor query for every neighbour.
    const supported = (cell: Cell) => (world ? true : onLand(state, cell)) && open.has(key(cell));
    const targets: Cell[][] = state.plots.filter(plot => plot.kind === 'home' && plot.stage >= 2 && plot.cell)
        .map(plot => approachCells(plot.cell!, world).filter(supported));
    targets.push(...places.filter(place => place.stage === 'grown' || place.stage === 'lived')
        .map(place => place.entrances.filter(supported)));
    targets.sort((a, b) => Math.min(...a.map(cell => Math.abs(cell.x - HOME_CELL.x) + Math.abs(cell.z - HOME_CELL.z)))
        - Math.min(...b.map(cell => Math.abs(cell.x - HOME_CELL.x) + Math.abs(cell.z - HOME_CELL.z))));
    const edges = new Map<string, [Cell, Cell]>();
    for (const choices of targets) {
        const destinations = new Set(choices.map(key));
        if (!destinations.size || [...destinations].some(id => network.has(id))) continue;
        const queue = [...network.values()], previous = new Map<string, Cell | undefined>(queue.map(cell => [key(cell), undefined]));
        let end: Cell | undefined;
        for (let i = 0; i < queue.length && !end; i++) for (const next of passageNeighbors(queue[i], world)) {
            const id = key(next);
            if (!supported(next) || previous.has(id)) continue;
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
    const world = layout.authored ? layout.world : undefined, edges = placePathEdges(state, places, world);
    const water = new Set(state.landmarks.filter(item => item.kind === 'water-channel' && item.cell).map(item => key(item.cell!)));
    const vertices: number[] = [], indices: number[] = [];
    // Adjacent triangles reuse immutable vertices. Cache both dry support and
    // rejection, while each face still checks its own shoreline-spanning centre.
    const vertexSupport: (Cell | false | undefined)[] = [];
    const joints = new Map<string, Cell>();
    for (const [a, b] of edges) {
        // Existing supplied channels already carry their real stepping surface.
        // Paving never fills water or suggests a new bridge across an unsupplied gap.
        if (water.has(key(a)) || water.has(key(b))) continue;
        joints.set(key(a), a); joints.set(key(b), b);
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), steps = 12;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps, x = a.x + dx * t, z = a.z + dz * t;
            const width = world ? .10 + .005 * Math.sin(x * 2.1 + z * 1.7) : .20 + .013 * Math.sin(x * 2.1 + z * 1.7);
            const normal = world ? { x: -dz / length, z: dx / length } : { x: -dz, z: dx };
            for (const side of [-1, 1]) {
                const point = layout.point({ x: x + normal.x * width * side, z: z + normal.z * width * side }, .008);
                vertices.push(point.x, point.y, point.z);
            }
            if (i > 0) {
                const j = vertices.length / 3 - 4;
                for (const face of [[j, j + 2, j + 1], [j + 1, j + 2, j + 3]]) if (supportedFace(face)) indices.push(...face);
            }
        }
    }
    for (const cell of joints.values()) {
        const start = vertices.length / 3, center = layout.point(cell, .008);
        vertices.push(center.x, center.y, center.z);
        const radius = world ? .10 + .005 * Math.sin(cell.x * 2.1 + cell.z * 1.7) : .20 + .013 * Math.sin(cell.x * 2.1 + cell.z * 1.7);
        for (let i = 0; i <= 24; i++) {
            const angle = i / 24 * Math.PI * 2;
            const point = layout.point({ x: cell.x + Math.cos(angle) * radius, z: cell.z + Math.sin(angle) * radius }, .008);
            vertices.push(point.x, point.y, point.z);
            if (i > 0) { const face = [start, start + i + 1, start + i]; if (supportedFace(face)) indices.push(...face); }
        }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new T.MeshStandardMaterial({ color: '#c2c1dd', roughness: 1, side: T.DoubleSide });
    material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
    const path = new T.Mesh(geometry, material); path.name = 'growing-reachable-paths'; path.receiveShadow = true;
    path.userData.ownMaterial = true; path.userData.groundPathEdges = edges;
    return path;

    function supportedFace(face: number[]) {
        if (!world) return true;
        const cells: Cell[] = [];
        for (const index of face) {
            let cell = vertexSupport[index];
            if (cell === undefined) {
                const at = layout.logicalAt({ x: vertices[index * 3], z: vertices[index * 3 + 2] });
                cell = world.floorAt(at) ? at : false; vertexSupport[index] = cell;
            }
            if (cell === false) return false;
            cells.push(cell);
        }
        // Skin remains decoration on supported ground, never a spanning bridge.
        return world.floorAt({ x: cells.reduce((sum, cell) => sum + cell.x, 0) / 3, z: cells.reduce((sum, cell) => sum + cell.z, 0) / 3 }) !== undefined;
    }
}
