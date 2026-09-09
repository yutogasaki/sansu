/** Shore-garden: visual land only. Saved placement and walking ellipses remain
 * authoritative in domain/island/catalog; every old point stays on the y=0 cap. */
export type IslandTerrainProfile = 'main' | 'east' | 'west';
export type TerrainPoint = [number, number, number];
export interface TerrainArea { x: number; z: number; radiusX: number; radiusZ: number }
export const ISLAND_TERRAIN_SEGMENTS = 64;
export const ISLAND_TERRAIN_PROFILES: readonly IslandTerrainProfile[] = ['main', 'east', 'west'];
/** Existing stones retain their coordinates and shapes. Their raised tips also
 * belong to the camera envelope, even though they are outside the level cap. */
export const ISLAND_MAIN_TERRAIN_STONES = {
    ground: [[-4.3, 1.63, .34], [-4.64, .37, .42], [3.29, 2.64, .35], [2.78, 2.95, .23], [3.79, -2.05, .43], [-2.84, -3.13, .24]],
    shore: [[-4.6, 1.72, .57], [-4.9, 1.25, .35], [3.55, 2.92, .43], [3.93, 2.52, .56]],
} as const;

const profiles = {
    main: { phase: .2, beach: 1.22, lobes: [[1.95, .34, .245], [.56, .28, .16], [4.27, .42, .16]], rocks: [.32, .69, 2.48, 2.78, 3.84, 4.96] },
    // Side islands keep a small asymmetric edge; their saved ellipses already
    // provide the full usable land, so large extra lobes need not rival the main.
    east: { phase: 1.4, beach: 1.62, lobes: [[.21, .44, .045], [1.85, .32, .065], [4.75, .35, .06]], rocks: [.6, 2.28, 4.36] },
    // This profile is authored in the existing east builder's local coordinates;
    // the complete west group still rotates PI so its bridge/props never move.
    west: { phase: 2.7, beach: 4.62, lobes: [[.64, .37, .045], [2.0, .31, .055], [4.85, .38, .06]], rocks: [.25, 3.9, 5.58] },
} as const;
const bump = (angle: number, center: number, width: number) => {
    const distance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
    return Math.exp(-.5 * (distance / width) ** 2);
};

/** Minimum radius > sec(PI/64), including polygon chords, not only vertices.
 * Positive lobes shape the exterior without cutting into old land. */
export function terrainContour(angle: number, profile: IslandTerrainProfile = 'main') {
    const p = profiles[profile];
    return 1.018 + .006 * Math.sin(angle * 5 + p.phase)
        + p.lobes.reduce((sum, [center, width, amount]) => sum + amount * bump(angle, center, width), 0);
}

export type TerrainEdge = 'cap' | 'turf' | 'sand' | 'beach' | 'rock' | 'foot' | 'wet' | 'shelf' | 'sea';
export const ISLAND_TERRAIN_EDGES: readonly TerrainEdge[] = ['cap', 'turf', 'sand', 'beach', 'rock', 'foot', 'wet', 'shelf', 'sea'];
/** Every layer joins the same angular samples. Broad sand is concentrated on
 * one side; the rock wall has low, uneven ledges rather than stacked cylinders. */
export function terrainEdge(angle: number, edge: TerrainEdge, profile: IslandTerrainProfile = 'main') {
    const p = profiles[profile], cap = terrainContour(angle, profile);
    const beach = bump(angle, p.beach, .56);
    const worn = Math.sin(angle * 9 + p.phase) * .012 + Math.sin(angle * 13 - p.phase) * .005;
    const relief = Math.sin(angle * 5 + p.phase) * .025;
    switch (edge) {
        case 'cap': return { radius: cap, y: 0 };
        case 'turf': return { radius: cap + .003, y: -.04 };
        case 'sand': return { radius: cap + .015 + beach * .025, y: -.085 };
        case 'beach': return { radius: cap + .029 + beach * .225, y: -.23 + relief };
        case 'rock': return { radius: cap + .012 + beach * .205 + worn, y: -.53 + relief };
        case 'foot': return { radius: cap - .012 + beach * .19 + worn * .6, y: -.83 };
        case 'wet': return { radius: cap + .028 + beach * .205, y: -.815 };
        case 'shelf': return { radius: cap + .096 + beach * .235 + .015 * Math.sin(angle * 3 + p.phase), y: -.829 };
        case 'sea': return { radius: cap + .21 + beach * .26 + .035 * Math.sin(angle * 3 + p.phase), y: -.852 };
    }
}

export function terrainEdgePoint(angle: number, edge: TerrainEdge, radiusX: number, radiusZ: number,
    profile: IslandTerrainProfile = 'main'): TerrainPoint {
    const point = terrainEdge(angle, edge, profile);
    return [Math.cos(angle) * radiusX * point.radius, point.y, Math.sin(angle) * radiusZ * point.radius];
}

/** Low connected rock chunks, all below the saved floor. These are not new
 * destinations or collision obstacles. Scale is the unit rock's outer bound. */
export function terrainRocks(radiusX: number, radiusZ: number, profile: IslandTerrainProfile = 'main') {
    return profiles[profile].rocks.map((angle, index) => {
        const point = terrainEdgePoint(angle, 'beach', radiusX, radiusZ, profile);
        const size = .27 + (index % 3) * .065;
        return { position: [point[0], -.54 - (index % 2) * .075, point[2]] as TerrainPoint,
            scale: [size * 1.18, size * .82, size] as TerrainPoint };
    });
}

export function terrainProfileForArea(area: Pick<TerrainArea, 'x'>): IslandTerrainProfile {
    return area.x < -4 ? 'west' : area.x > 4 ? 'east' : 'main';
}

/** Fixed world-space camera envelope shared by home, comparison and appearance.
 * Includes every real layer sample and rock bounding corner, independent of
 * style, maturity and ownership. West applies the actual builder's PI rotation. */
export function islandTerrainEnvelope(area: TerrainArea): TerrainPoint[] {
    const profile = terrainProfileForArea(area), sign = profile === 'west' ? -1 : 1;
    const points: TerrainPoint[] = [];
    for (const edge of ISLAND_TERRAIN_EDGES) for (let i = 0; i < ISLAND_TERRAIN_SEGMENTS; i++) {
        points.push(terrainEdgePoint(i / ISLAND_TERRAIN_SEGMENTS * Math.PI * 2, edge, area.radiusX, area.radiusZ, profile));
    }
    for (const rock of terrainRocks(area.radiusX, area.radiusZ, profile)) {
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
            points.push([rock.position[0] + x * rock.scale[0], rock.position[1] + y * rock.scale[1], rock.position[2] + z * rock.scale[2]]);
        }
    }
    if (profile === 'main') for (const slot of ['ground', 'shore'] as const) {
        const height = slot === 'ground' ? -.13 : -.4, scale = slot === 'ground' ? [1, .65, .8] : [1, .82, .88];
        for (const [cx, cz, size] of ISLAND_MAIN_TERRAIN_STONES[slot]) {
            for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
                points.push([cx + x * size * scale[0], height + y * size * scale[1], cz + z * size * scale[2]]);
            }
        }
    }
    return points.map(([x, y, z]) => [area.x + x * sign, y, area.z + z * sign]);
}
