import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import type { AuthoredGrowthTerrainCatalog } from '../../../../domain/growingIsland/authoredGrowthTerrain';
import { authoredWorldFrame } from '../../../../domain/growingIsland/authoredWorldFrame';
import { applyIntent } from '../../../../domain/growingIsland/commands';
import { TREE_MATURE_HOURS } from '../../../../domain/growingIsland/environment';
import { newIsland } from '../../../../domain/growingIsland/island';
import type { Cell, GrowingState } from '../../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import type { WorldFloorVertex } from '../../../../domain/growingIsland/worldTypes';
import { sceneLayout } from '../sceneLayout';
import { buildAuthoredGrowingGround } from './authoredGrowingGround';

const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const districtOffset = 10;
let catalog: AuthoredGrowthTerrainCatalog, acquired: IslandWorld;
beforeAll(() => {
    const manifest = JSON.parse(readFileSync('prototypes/place-qa/authored-growth-terrain-manifest.json', 'utf8'));
    const compressed = readFileSync(manifest.artifact.path.slice(1)), bytes = gunzipSync(compressed);
    expect(sha(compressed)).toBe(manifest.artifact.sha256);
    expect(sha(bytes)).toBe(manifest.artifact.expandedSha256);
    expect(bytes.length).toBe(manifest.artifact.expandedBytes);
    catalog = JSON.parse(bytes.toString()) as AuthoredGrowthTerrainCatalog;
    expect(catalog.candidate).toBe(manifest.candidate);
    // Explicitly acquired diagnostic asset: this does not exercise purchase or save.
    // Keep its local planting sites away from the fixed starter-house cells so
    // ordinary store/unstore commands exercise legal ownership coordinates.
    acquired = compileWorldDefinition({ version: 1, id: 'growth-terrain-renderer-fixture', source: catalog.source,
        districts: [{ ...catalog.template.district, logicalOrigin: { x: districtOffset, z: 0 },
            worldOrigin: { x: districtOffset, y: 0, z: 0 } }], edges: catalog.template.edges });
});

function fixture(cells: readonly Cell[], mature: boolean): GrowingState {
    const state = newIsland('growth-terrain-renderer-fixture', 0);
    state.landmarks = cells.map((cell, i) => ({ id: `diagnostic-tree-${i + 1}`, kind: 'sapling', cell: { x: cell.x + districtOffset, z: cell.z },
        growth: mature ? TREE_MATURE_HOURS : 0, ...(mature ? { maturedAt: 0 } : {}) }));
    state.soil = {};
    return state;
}

function renderSnapshot(state: GrowingState) {
    const before = JSON.stringify(state), options = { water: false, cove: false, growthTerrain: catalog };
    const frame = authoredWorldFrame(state, acquired, options);
    const layout = sceneLayout(state, false, frame.world, frame.waterPlan, acquired,
        { options, covePlan: frame.covePlan, revision: frame.revision });
    const ground = buildAuthoredGrowingGround(layout);
    try {
        expect(frame.world.sites.filter(site => site.placement)).toEqual(acquired.sites.filter(site => site.placement));
        for (const floor of acquired.floors) expect(frame.world.floors.find(next => next.id === floor.id)).toEqual(floor);
        for (const site of acquired.sites) {
            expect(frame.world.anchorAt(site.cell)).toEqual(acquired.anchorAt(site.cell));
            expect(frame.world.floorAt(site.cell)).toEqual(acquired.floorAt(site.cell));
        }
        ground.root.updateMatrixWorld(true);
        // Pointer-visible triangles must agree with actual acquired support; no actor walking is inferred.
        for (const site of acquired.sites.filter(site => site.placement)) {
            for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
                const cell = { x: site.cell.x + dx, z: site.cell.z + dz };
                expect(frame.world.floorAt(cell)).toEqual(acquired.floorAt(cell));
            }
            const point = layout.point(site.cell, 0);
            const hit = new T.Raycaster(point.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
            expect(hit?.point.y).toBeCloseTo(point.y, 5);
            expect(layout.cellAt(hit.point)).toEqual(site.cell);
        }
        const floors = frame.world.floors.filter(floor => floor.kind === 'ground' || floor.kind === 'deck');
        const expectedPositions = new Float32Array(floors.flatMap(floor => floor.vertices.flatMap(({ point }) => [point.x - layout.center, point.y, point.z - 2])));
        const positions = ground.floor.geometry.getAttribute('position').array;
        expect(Array.from(positions)).toEqual(Array.from(expectedPositions));
        let offset = 0;
        const expectedIndices = floors.flatMap(floor => {
            const indices = floor.indices.map(index => index + offset); offset += floor.vertices.length; return indices;
        });
        expect(Array.from(ground.floor.geometry.index!.array)).toEqual(expectedIndices);
        const grownSites = frame.world.sites.filter(site => !acquired.sites.some(old => old.ref.districtId === site.ref.districtId && old.ref.siteId === site.ref.siteId));
        expect(grownSites.every(site => !site.placement)).toBe(true);
        if (grownSites.length) {
            const site = grownSites.find(site => !acquired.floorAt(site.cell))!;
            expect(site).toBeDefined();
            const point = layout.point(site.cell, 0);
            const hit = new T.Raycaster(point.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
            expect(hit?.point.y).toBeCloseTo(frame.world.floorAt(site.cell)!.point.y, 5);
        }
        expect(JSON.stringify(state)).toBe(before);
        return { frame, geometry: sha(JSON.stringify([Array.from(positions), expectedIndices])), grownSites: grownSites.length };
    } finally { ground.dispose(); }
}

describe('shipped growth terrain through the shared frame and ground renderer', () => {
    it('makes a branch, two branches and an outer walking loop from the same four mature trees', () => {
        const single = fixture([{ x: 1, z: -1 }, { x: 2, z: -1 }, { x: 1, z: 0 }, { x: 2, z: 0 }], true);
        const split = fixture([{ x: 1, z: -1 }, { x: 2, z: -1 }, { x: 1, z: 1 }, { x: 2, z: 1 }], true);
        const loop = fixture([{ x: 2, z: -1 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 0 }], true);
        const withoutCells = (state: GrowingState) => state.landmarks.map(item => { const owner = { ...item }; delete owner.cell; return owner; });
        expect(withoutCells(split)).toEqual(withoutCells(single));
        expect(withoutCells(loop)).toEqual(withoutCells(single));
        const original = JSON.stringify(acquired.definition);
        const one = renderSnapshot(single), two = renderSnapshot(split), ring = renderSnapshot(loop);
        expect(one.frame.growthTerrainPlan?.rejectedReason).toBeUndefined();
        expect(two.frame.growthTerrainPlan?.rejectedReason).toBeUndefined();
        expect(ring.frame.growthTerrainPlan?.rejectedReason).toBeUndefined();
        expect(one.frame.growthTerrainPlan?.assemblies).toMatchObject([{ socketId: 'south', shape: 'seaward' }]);
        expect(two.frame.growthTerrainPlan?.assemblies).toHaveLength(2);
        expect(ring.frame.growthTerrainPlan?.assemblies).toHaveLength(2);
        expect(two.frame.growthTerrainPlan?.connections).toEqual([]);
        expect(ring.frame.growthTerrainPlan?.connections).toHaveLength(1);
        expect(new Set([one.geometry, two.geometry, ring.geometry]).size).toBe(3);

        // A real outer route must connect the existing south and north landings
        // without passing through any other original acquired-floor site.
        const outerRoute = (world: IslandWorld) => {
            const from = acquired.sites.find(site => site.ref.siteId === 'seam-south')!;
            const to = acquired.sites.find(site => site.ref.siteId === 'seam-north')!;
            const key = (cell: Cell) => `${cell.x},${cell.z}`;
            const old = new Set(acquired.sites.map(site => key(site.cell)));
            const allowed = new Set(world.walkSites.filter(site => !old.has(key(site.cell))).map(site => key(site.cell)));
            allowed.add(key(from.cell)); allowed.add(key(to.cell));
            const queue = [from.cell], reached = new Set([key(from.cell)]);
            for (let i = 0; i < queue.length; i++) for (const cell of world.neighbors(queue[i], 'walk')) {
                const id = key(cell);
                if (allowed.has(id) && !reached.has(id)) { reached.add(id); queue.push(cell); }
            }
            return reached.has(key(to.cell));
        };
        expect(outerRoute(one.frame.world)).toBe(false);
        expect(outerRoute(two.frame.world)).toBe(false);
        expect(outerRoute(ring.frame.world)).toBe(true);

        const options = { water: false, cove: false, growthTerrain: catalog };
        const id = loop.landmarks[1].id, cell = loop.landmarks[1].cell!;
        const stored = applyIntent(loop, { id: 'four-trees-store', command: { type: 'store', id } }, 0, ring.frame.world).state;
        const removed = authoredWorldFrame(stored, acquired, options);
        expect(removed.growthTerrainPlan?.connections).toEqual([]);
        expect(outerRoute(removed.world)).toBe(false);
        const restored = applyIntent(stored, { id: 'four-trees-restore', command: { type: 'unstore', id, cell } }, 0, removed.world).state;
        const back = renderSnapshot(restored);
        expect(back.frame.growthTerrainPlan).toEqual(ring.frame.growthTerrainPlan);
        expect(back.geometry).toBe(ring.geometry);
        expect(withoutCells(restored)).toEqual(withoutCells(loop));
        expect(JSON.stringify(acquired.definition)).toBe(original);
    });

    it('keeps the original land and the specific reason when a connected grove has no matching authored connection', () => {
        const state = fixture([{ x: 2, z: -1 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 0 }], true);
        const incomplete = { ...catalog, revision: `${catalog.revision}:without-connections`,
            profile: { ...catalog.profile, connections: [] } };
        const frame = authoredWorldFrame(state, acquired, { water: false, cove: false, growthTerrain: incomplete });
        expect(frame.world).toBe(acquired);
        expect(frame.growthTerrainPlan?.assemblies).toEqual([]);
        expect(frame.growthTerrainPlan?.connections).toEqual([]);
        expect(frame.growthTerrainPlan?.rejectedReason).toMatch(/connection/i);
        expect(frame.growthTerrainPlan?.rejectedReason).not.toMatch(/rejected plan cannot be composed/i);
    });

    it('changes real shore geometry with maturity and arrangement, then restores it without changing acquired ground', () => {
        const parallelCells = [{ x: 2, z: -1 }, { x: 2, z: 0 }] as const;
        const young = fixture(parallelCells, false), parallel = fixture(parallelCells, true);
        const seaward = fixture([{ x: 1, z: -1 }, { x: 2, z: -1 }], true);
        const separated = fixture([{ x: 1, z: -1 }, { x: 2, z: 1 }], true);
        const restored = structuredClone(parallel), acquiredBefore = sha(JSON.stringify(acquired.definition));
        expect(acquired.sites.filter(site => site.placement)).toHaveLength(6);
        for (const state of [young, parallel, seaward, separated, restored]) {
            expect(state.landmarks.map(tree => tree.id)).toEqual(['diagnostic-tree-1', 'diagnostic-tree-2']);
            expect(state.landmarks.every(tree => acquired.owns(tree.cell!))).toBe(true);
            expect([state.drops, state.nextId, state.land]).toEqual([young.drops, young.nextId, young.land]);
        }
        const y = renderSnapshot(young), p = renderSnapshot(parallel), s = renderSnapshot(seaward);
        const split = renderSnapshot(separated), back = renderSnapshot(restored);
        expect(y.frame.growthTerrainPlan?.assemblies).toEqual([]);
        expect(y.frame.world).toBe(acquired);
        expect(p.frame.growthTerrainPlan?.assemblies).toMatchObject([{ shape: 'parallel', ownerIds: ['diagnostic-tree-1', 'diagnostic-tree-2'] }]);
        expect(s.frame.growthTerrainPlan?.assemblies).toMatchObject([{ shape: 'seaward', ownerIds: ['diagnostic-tree-1', 'diagnostic-tree-2'] }]);
        expect(p.grownSites).toBeGreaterThan(0); expect(s.grownSites).toBeGreaterThan(0);
        expect(p.frame.world.bounds.max.x).toBeGreaterThan(acquired.bounds.max.x);
        expect(s.frame.world.bounds.max.x).toBeGreaterThan(acquired.bounds.max.x);
        expect(p.frame.world.bounds).not.toEqual(s.frame.world.bounds);
        expect(new Set([y.geometry, p.geometry, s.geometry]).size).toBe(3);
        expect(split.frame.growthTerrainPlan?.assemblies).toEqual([]);
        expect(split.frame.world).toBe(acquired); expect(split.geometry).toBe(y.geometry);
        expect(back.frame.growthTerrainPlan).toEqual(p.frame.growthTerrainPlan);
        expect(back.frame.revision).toBe(p.frame.revision); expect(back.geometry).toBe(p.geometry);
        expect(sha(JSON.stringify(acquired.definition))).toBe(acquiredBefore);
    });

    it('rejects a colliding mature patch while keeping the acquired world and owner state', () => {
        const state = fixture([{ x: 2, z: -1 }, { x: 2, z: 0 }], true), before = JSON.stringify(state);
        const options = { water: false, cove: false, growthTerrain: catalog };
        const grown = authoredWorldFrame(state, acquired, options);
        const floor = grown.world.floors.find(floor => !acquired.floors.some(old => old.id === floor.id))!;
        expect(floor).toBeDefined();
        // A small explicit obstacle inside the shipped patch, outside all original ground.
        let vertices: WorldFloorVertex[] | undefined;
        for (let i = 0; i < floor.indices.length; i += 3) {
            const corners = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]);
            const center = corners.reduce((p, vertex) => ({ x: p.x + vertex.point.x / 3, y: p.y + vertex.point.y / 3, z: p.z + vertex.point.z / 3 }), { x: 0, y: 0, z: 0 });
            const triangle = corners.map(vertex => {
                const point = { x: center.x + (vertex.point.x - center.x) * .2, y: center.y + (vertex.point.y - center.y) * .2, z: center.z + (vertex.point.z - center.z) * .2 };
                return { cell: { x: point.x, z: point.z }, point };
            });
            const [a, b, c] = triangle.map(vertex => vertex.cell);
            const twiceArea = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
            if (twiceArea > 1e-6 && triangle.every(vertex => !acquired.floorAt(vertex.cell))) { vertices = triangle; break; }
        }
        expect(vertices).toBeDefined();
        const blocked = compileWorldDefinition({ ...acquired.definition, revision: 'explicit-growth-collision-fixture', districts: [...acquired.definition.districts,
            { id: 'diagnostic-obstacle', templateId: 'diagnostic-obstacle', turn: 0, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
                floors: [{ id: 'obstacle-floor', kind: 'ground', color: '#a0b1c2', vertices: vertices!, indices: [0, 1, 2] }], sites: [], ports: [] }] });
        const rejected = authoredWorldFrame(state, blocked, options);
        expect(rejected.growthTerrainPlan?.rejectedReason).toMatch(/overlap/);
        expect(rejected.growthTerrainPlan?.assemblies).toEqual([]);
        expect(rejected.world).toBe(blocked);
        expect(rejected.world.sites.filter(site => site.placement)).toEqual(acquired.sites.filter(site => site.placement));
        expect(JSON.stringify(state)).toBe(before);
    });
});
