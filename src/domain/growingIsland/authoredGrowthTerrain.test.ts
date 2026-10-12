import { describe, expect, it } from 'vitest';
import { deriveAuthoredGrowthTerrainPlan, composeAuthoredGrowthTerrainWorld, rejectAuthoredGrowthTerrainPlan, type AuthoredGrowthTerrainCatalog } from './authoredGrowthTerrain';
import { compileWorldDefinition } from './worldDefinition';
import { newIsland } from './island';
import { TREE_MATURE_HOURS } from './environment';
import type { Cell } from './types';
import type { WorldDistrict, WorldEdge, WorldFloor } from './worldTypes';

const source = { artifact: 'growth-fixture.glb', sha256: 'a'.repeat(64) };
const ref = (districtId: string, siteId: string) => ({ districtId, siteId });
const cellId = ({ x, z }: Cell) => `${x},${z}`;
function floor(id: string, xs: number[], zs: number[], height = 0): WorldFloor {
    const vertices = zs.flatMap(z => xs.map(x => ({ cell: { x, z }, point: { x, y: (x - xs[0]) / (xs.at(-1)! - xs[0]) * height, z } })));
    const indices: number[] = [];
    for (let z = 0; z < zs.length - 1; z++) for (let x = 0; x < xs.length - 1; x++) {
        const i = z * xs.length + x; indices.push(i, i + xs.length, i + 1, i + 1, i + xs.length, i + xs.length + 1);
    }
    return { id, kind: 'ground', vertices, indices, color: '#bdb6c9' };
}
function fixture() {
    const templateId = 'growing-shore', id = 'acquired-coast';
    const points = [-1, 0, 1].flatMap(z => [0, 1].map(x => ({ x, z })));
    const district: WorldDistrict = { id: templateId, templateId, turn: 0, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
        floors: [floor('base', [-.6, 2.5], [-2, 2])], sites: [
            ...points.map(cell => ({ id: cellId(cell), cell, floorId: 'base', placement: true })),
            ...[-1, 1].map(z => ({ id: `landing-${z}`, cell: { x: 2.25, z }, floorId: 'base', placement: false })),
        ], ports: [], surfaces: [-1, 1].map(z => ({ id: `bank-${z}`, kind: 'bank',
            vertices: [{ x: 2.5, y: 0, z: z - 1 }, { x: 2.5, y: 0, z: z + 1 }, { x: 2.5, y: -.5, z: z - 1 }, { x: 2.5, y: -.5, z: z + 1 }],
            indices: [0, 2, 1, 1, 2, 3], material: { color: '#bdb6c9', roughness: .9, metalness: 0 } })) };
    const edges: WorldEdge[] = [];
    for (const a of points) for (const b of points) if (a.x <= b.x && a.z <= b.z && Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1)
        edges.push({ from: ref(templateId, cellId(a)), to: ref(templateId, cellId(b)), allows: ['walk', 'join', 'water'] });
    for (const z of [-1, 1]) edges.push({ from: ref(templateId, `1,${z}`), to: ref(templateId, `landing-${z}`), allows: ['walk'] });
    const catalog: AuthoredGrowthTerrainCatalog = { version: 1, candidate: 'growing-shore-v1', revision: 'asset-v1', source,
        template: { id: templateId, label: '成長する岸', district, edges, ports: [] },
        profile: { trigger: [{ x: -.5, z: -1.5 }, { x: 1.5, z: -1.5 }, { x: 1.5, z: 1.5 }, { x: -.5, z: 1.5 }],
            scope: [{ x: 2.5, z: -3 }, { x: 6, z: -3 }, { x: 6, z: 3 }, { x: 2.5, z: 3 }], shoreFacing: 0,
            sockets: [-1, 1].map(z => ({ id: z < 0 ? 'lower' : 'upper', logicalOrigin: { x: 0, z }, worldOrigin: { x: 0, y: 0, z }, turn: 0,
                landings: [{ baseSiteId: `landing-${z}`, patchSiteId: 'entry' }], replaceSurfaceIds: [`bank-${z}`] })),
            variants: (['parallel', 'seaward'] as const).map(shape => {
                const end = shape === 'parallel' ? 3.5 : 5, width = shape === 'parallel' ? .9 : .5, height = shape === 'parallel' ? .25 : .6;
                return { id: shape, district: { id: shape, templateId: shape, turn: 0, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
                    floors: [floor('growth', [2.5, end], [-width, width], height)],
                    sites: [{ id: 'entry', cell: { x: 2.75, z: 0 }, floorId: 'growth', placement: false },
                        { id: 'tip', cell: { x: end - .2, z: 0 }, floorId: 'growth', placement: false }], ports: [] },
                    edges: [{ from: ref(shape, 'entry'), to: ref(shape, 'tip'), allows: ['walk'] }] };
            }),
        } };
    const world = compileWorldDefinition({ version: 1, id: 'world', source, districts: [{ ...district, id }],
        edges: edges.map(edge => ({ ...edge, from: { ...edge.from, districtId: id }, to: { ...edge.to, districtId: id } })) });
    const state = newIsland('terrain-test', 0);
    state.landmarks = [{ id: 'a', kind: 'sapling', growth: TREE_MATURE_HOURS, cell: { x: 1, z: -1 } },
        { id: 'b', kind: 'sapling', growth: TREE_MATURE_HOURS, cell: { x: 1, z: 0 } }];
    const compose = () => composeAuthoredGrowthTerrainWorld(world, catalog, deriveAuthoredGrowthTerrainPlan(state, world, catalog));
    return { world, catalog, state, compose };
}

/** Small authored real-floor fixture, not evidence of acquisition or normal UI moves. */
function connectedFixture() {
    const base = fixture(), partId = 'outer-shore';
    const bank = (z: number) => ({ id: z < 0 ? 'side-lower' : 'side-upper', kind: 'bank' as const,
        vertices: [4, 5].flatMap(x => [{ x, y: (x - 2.5) / 2.5 * .6, z }, { x, y: (x - 2.5) / 2.5 * .6 - .3, z }]),
        indices: [0, 1, 2, 2, 1, 3], material: { color: '#bdb6c9', roughness: .9, metalness: 0 } });
    const bridgeFloor = floor('link', [4, 5], [-.5, .5]);
    const catalog: AuthoredGrowthTerrainCatalog = { ...base.catalog, revision: 'connected-asset-v1', profile: { ...base.catalog.profile,
        variants: base.catalog.profile.variants.map(variant => variant.id !== 'seaward' ? variant
            : { ...variant, district: { ...variant.district, surfaces: [bank(-.5), bank(.5)] } }),
        connections: [{ id: 'outer-shore', socketIds: ['lower', 'upper'], branchShape: 'seaward',
            district: { id: partId, templateId: partId, turn: 0, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
                floors: [{ ...bridgeFloor, vertices: bridgeFloor.vertices.map(v => ({ ...v, point: { ...v.point, y: (v.cell.x - 2.5) / 2.5 * .6 } })) }],
                sites: [{ id: 'south', cell: { x: 4.8, z: -.25 }, floorId: 'link', placement: false },
                    { id: 'north', cell: { x: 4.8, z: .25 }, floorId: 'link', placement: false }], ports: [] },
            edges: [{ from: ref(partId, 'south'), to: ref(partId, 'north'), allows: ['walk'] }],
            landings: [{ socketId: 'lower', patchSiteId: 'tip', connectionSiteId: 'south' }, { socketId: 'upper', patchSiteId: 'tip', connectionSiteId: 'north' }],
            replaceSurfaceIds: [{ socketId: 'lower', surfaceIds: ['side-upper'] }, { socketId: 'upper', surfaceIds: ['side-lower'] }] }],
    } };
    base.state.landmarks = ['a', 'b', 'c', 'd'].map(id => ({ id, kind: 'sapling', growth: TREE_MATURE_HOURS }));
    const place = (cells: readonly Cell[]) => base.state.landmarks.forEach((owner, index) => { owner.cell = cells[index]; });
    const derive = () => deriveAuthoredGrowthTerrainPlan(base.state, base.world, catalog);
    const compose = () => composeAuthoredGrowthTerrainWorld(base.world, catalog, derive());
    return { ...base, catalog, place, derive, compose };
}
function coastSpecificFixture() {
    const base = connectedFixture();
    const siteId = (id: string) => `upper-${id}`;
    const variants = base.catalog.profile.variants.map(variant => {
        const id = `upper-${variant.id}`;
        return { ...variant, district: { ...variant.district, id, templateId: id,
            floors: variant.district.floors.map(f => variant.id !== 'seaward' ? f : { ...f,
                vertices: f.vertices.map(v => v.cell.x !== 5 ? v : { cell: { ...v.cell, x: 5.5 }, point: { ...v.point, x: 5.5, y: .72 } }) }),
            sites: variant.district.sites.map(site => ({ ...site, id: siteId(site.id) })),
            surfaces: variant.district.surfaces?.map(surface => ({ ...surface, id: `upper-${surface.id}` })),
        }, edges: variant.edges.map(edge => ({ ...edge,
            from: ref(id, siteId(edge.from.siteId)), to: ref(id, siteId(edge.to.siteId)),
        })) };
    });
    const catalog: AuthoredGrowthTerrainCatalog = { ...base.catalog, revision: 'coast-specific-v1', profile: { ...base.catalog.profile,
        sockets: base.catalog.profile.sockets.map(socket => socket.id !== 'upper' ? socket : { ...socket, shoreFacing: 1, variants,
            landings: socket.landings.map(landing => ({ ...landing, patchSiteId: siteId(landing.patchSiteId) })),
        }),
        connections: base.catalog.profile.connections!.map(connection => ({ ...connection,
            landings: connection.landings.map(landing => landing.socketId !== 'upper' ? landing : { ...landing, patchSiteId: siteId(landing.patchSiteId) }),
            replaceSurfaceIds: connection.replaceSurfaceIds.map(replacement => replacement.socketId !== 'upper' ? replacement
                : { ...replacement, surfaceIds: replacement.surfaceIds.map(id => `upper-${id}`) }),
        })),
    } };
    const derive = () => deriveAuthoredGrowthTerrainPlan(base.state, base.world, catalog);
    return { ...base, catalog, derive, compose: () => composeAuthoredGrowthTerrainWorld(base.world, catalog, derive()) };
}
const single = [{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 0, z: 0 }, { x: 1, z: 0 }];
const split = [{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 0, z: 1 }, { x: 1, z: 1 }];
const joined = [{ x: 1, z: -1 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 0 }];
function cycleRank(world: ReturnType<typeof compileWorldDefinition>) {
    const edges = new Set(world.sites.flatMap(site => world.neighbors(site.cell, 'walk').map(next => [cellId(site.cell), cellId(next)].sort().join('|'))));
    return edges.size - world.sites.length + 1;
}

describe('growth changes real terrain from current owned trees', () => {
    it('uses maturity, current join direction and position to choose actual relief and coastline', () => {
        const { state, world, catalog, compose } = fixture();
        state.landmarks[1].growth--;
        expect(compose()).toBe(world);
        state.landmarks[1].growth++;
        const along = compose(), alongPlan = deriveAuthoredGrowthTerrainPlan(state, world, catalog);
        expect(alongPlan.assemblies[0]).toMatchObject({ shape: 'parallel', socketId: 'lower', ownerIds: ['a', 'b'] });
        expect(along.floorAt({ x: 3.1, z: -1 })).toBeDefined();
        expect(along.floorAt({ x: 3.1, z: 1 })).toBeUndefined();
        state.landmarks[0].cell = { x: 1, z: 0 }; state.landmarks[1].cell = { x: 1, z: 1 };
        const shifted = compose();
        expect(deriveAuthoredGrowthTerrainPlan(state, world, catalog).assemblies[0].socketId).toBe('upper');
        expect(shifted.floorAt({ x: 3.1, z: 1 })).toBeDefined();
        expect(shifted.floorAt({ x: 3.1, z: -1 })).toBeUndefined();
        state.landmarks[0].cell = { x: 0, z: -1 }; state.landmarks[1].cell = { x: 1, z: -1 };
        const out = compose();
        expect(deriveAuthoredGrowthTerrainPlan(state, world, catalog).assemblies[0].shape).toBe('seaward');
        expect(out.bounds.max.x).toBeGreaterThan(along.bounds.max.x);
        expect(out.bounds.max.y).toBeGreaterThan(along.bounds.max.y);
    });

    it('keeps rights, full old supports and original floors while making the added real ground reachable', () => {
        const { state, world, catalog, compose } = fixture(), before = JSON.stringify(state), original = JSON.stringify(world.definition);
        const grown = compose();
        expect(grown.sites.filter(site => site.placement)).toEqual(world.sites.filter(site => site.placement));
        expect(grown.definition.districts[0].floors).toEqual(world.definition.districts[0].floors);
        expect(grown.definition.districts[0].surfaces?.map(s => s.id)).toEqual(['bank-1']);
        for (const old of world.sites) expect(grown.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(old.ref))).toEqual(old);
        const reached = new Set(['0,0']), queue = [{ x: 0, z: 0 }];
        for (let i = 0; i < queue.length; i++) for (const cell of grown.neighbors(queue[i])) if (!reached.has(cellId(cell))) { reached.add(cellId(cell)); queue.push(cell); }
        const added = grown.sites.filter(site => site.ref.districtId === 'acquired-coast:growth-terrain:lower');
        expect(added).toHaveLength(2);
        for (const site of added) {
            expect(reached.has(cellId(site.cell))).toBe(true); expect(grown.floorAt(site.cell)).toBeDefined(); expect(grown.owns(site.cell)).toBe(false);
            expect(grown.neighbors(site.cell, 'join')).toEqual([]); expect(grown.neighbors(site.cell, 'water')).toEqual([]);
        }
        expect(JSON.stringify(state)).toBe(before); expect(JSON.stringify(world.definition)).toBe(original);
        expect(JSON.stringify(deriveAuthoredGrowthTerrainPlan(state, world, catalog))).not.toMatch(/vertices|indices|floors/);
        expect(composeAuthoredGrowthTerrainWorld(world, catalog, deriveAuthoredGrowthTerrainPlan(JSON.parse(before), world, catalog)).definition).toEqual(grown.definition);
    });

    it('restores the original shore on separation/storage and produces the same preview after reconnecting', () => {
        const { state, world, compose } = fixture(), grown = compose();
        state.landmarks[1].cell = { x: 1, z: 1 }; expect(compose()).toBe(world);
        state.landmarks[1].cell = undefined; expect(compose()).toBe(world);
        state.landmarks[1].cell = { x: 1, z: 0 };
        expect(compose().definition).toEqual(grown.definition);
        expect(state.landmarks.every(tree => tree.growth === TREE_MATURE_HOURS)).toBe(true);
    });

    it('works for arbitrary owner IDs and a rotated acquired district, and requires explicit join edges', () => {
        const { state, world, catalog } = fixture(), definition = structuredClone(world.definition);
        definition.districts = definition.districts.map(d => ({ ...d, turn: 1, logicalOrigin: { x: 10, z: 5 }, worldOrigin: { x: 10, y: 0, z: 5 } }));
        const rotated = compileWorldDefinition(definition);
        state.landmarks = state.landmarks.map((tree, i) => ({ ...tree, id: `new-owner-${i}`, cell: { x: 10 - tree.cell!.z, z: 5 + tree.cell!.x } }));
        const plan = deriveAuthoredGrowthTerrainPlan(state, rotated, catalog), grown = composeAuthoredGrowthTerrainWorld(rotated, catalog, plan);
        expect(plan.assemblies[0]).toMatchObject({ shape: 'parallel', socketId: 'lower', ownerIds: ['new-owner-0', 'new-owner-1'] });
        expect(grown.floorAt({ x: 11, z: 8.1 })).toBeDefined();
        definition.edges = definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'join') }));
        expect(deriveAuthoredGrowthTerrainPlan(state, compileWorldDefinition(definition), catalog).assemblies).toEqual([]);
    });

    it('rejects rights, out-of-scope geometry, overlapping terrain and stale plans without modifying inputs', () => {
        const { state, world, catalog } = fixture(), plan = deriveAuthoredGrowthTerrainPlan(state, world, catalog);
        const changeVariants = (fn: (variant: AuthoredGrowthTerrainCatalog['profile']['variants'][number]) => AuthoredGrowthTerrainCatalog['profile']['variants'][number]) =>
            ({ ...catalog, profile: { ...catalog.profile, variants: catalog.profile.variants.map(fn) } });
        const rights = changeVariants(v => ({ ...v, district: { ...v.district, sites: v.district.sites.map(site => ({ ...site, placement: true })) } }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, rights)).toThrow('walking');
        const out = { ...catalog, profile: { ...catalog.profile, scope: [{ x: 2.5, z: -2 }, { x: 3, z: -2 }, { x: 3, z: 2 }, { x: 2.5, z: 2 }] } };
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, out)).toThrow('scope');
        const overlap = changeVariants(v => ({ ...v, district: { ...v.district, floors: v.district.floors.map(f => ({ ...f,
            vertices: f.vertices.map(vertex => ({ cell: { ...vertex.cell, x: vertex.cell.x - .01 }, point: { ...vertex.point, x: vertex.point.x - .01 } })) })) } }));
        const overlappingCatalog = { ...overlap, profile: { ...overlap.profile, scope: [{ x: 2.4, z: -3 }, { x: 6, z: -3 }, { x: 6, z: 3 }, { x: 2.4, z: 3 }] } };
        expect(() => composeAuthoredGrowthTerrainWorld(world, overlappingCatalog, deriveAuthoredGrowthTerrainPlan(state, world, overlappingCatalog))).toThrow('overlaps');
        expect(() => composeAuthoredGrowthTerrainWorld(world, { ...catalog, revision: 'changed-art' }, plan)).toThrow('stale');
        const grown = composeAuthoredGrowthTerrainWorld(world, catalog, plan);
        expect(() => deriveAuthoredGrowthTerrainPlan(state, grown, catalog)).toThrow('immutable');
    });

    it('retains a rejection reason for the frame without making the rejected candidate composable', () => {
        const { state, world, catalog } = fixture(), plan = deriveAuthoredGrowthTerrainPlan(state, world, catalog);
        const rejected = rejectAuthoredGrowthTerrainPlan(plan, 'growth floor overlaps existing terrain');
        expect(rejected.assemblies).toEqual([]); expect(rejected.rejectedReason).toBe('growth floor overlaps existing terrain');
        expect(rejected.connections).toEqual([]);
        expect(rejected.revision).not.toBe(plan.revision); expect(plan.assemblies).toHaveLength(1);
        expect(() => composeAuthoredGrowthTerrainWorld(world, catalog, rejected)).toThrow('rejected');
        expect(composeAuthoredGrowthTerrainWorld(world, catalog, plan).sites.filter(site => site.placement)).toHaveLength(6);
    });
});

describe('mature groups assemble branches and an authored two-mouth shore', () => {
    it('derives single, split and joined real ground from the same four owners, then separates and restores it', () => {
        const { state, world, place, derive, compose } = connectedFixture(), original = JSON.stringify(world.definition);
        const owners = () => state.landmarks.map(owner => Object.fromEntries(Object.entries(owner).filter(([field]) => field !== 'cell')));
        const before = owners();
        place(single);
        expect(derive().assemblies).toEqual([expect.objectContaining({ id: 'acquired-coast:growth-terrain:lower',
            socketId: 'lower', shape: 'seaward', ownerIds: ['a', 'b', 'c', 'd'] })]);
        expect(derive().connections).toEqual([]);
        const one = compose();
        place(split);
        const splitPlan = derive(), separated = compose();
        expect(splitPlan.assemblies).toEqual([
            expect.objectContaining({ socketId: 'lower', shape: 'seaward', ownerIds: ['a', 'b'] }),
            expect.objectContaining({ socketId: 'upper', shape: 'seaward', ownerIds: ['c', 'd'] }),
        ]);
        expect(splitPlan.connections).toEqual([]);
        expect(separated.floorAt({ x: 4.8, z: 0 })).toBeUndefined();
        expect(cycleRank(separated)).toBe(cycleRank(one));
        place(joined);
        const plan = derive(), loop = compose();
        for (const assembly of plan.assemblies) expect(assembly).toMatchObject({ shape: 'seaward', ownerIds: ['a', 'b', 'c', 'd'] });
        expect(plan.connections).toEqual([{ id: 'acquired-coast:growth-connection:outer-shore', districtId: 'acquired-coast',
            connectionId: 'outer-shore', ownerIds: ['a', 'b', 'c', 'd'] }]);
        expect(loop.floorAt({ x: 4.8, z: 0 })).toBeDefined();
        expect(cycleRank(loop)).toBe(cycleRank(separated) + 1);
        expect(loop.definition.districts.find(d => d.id.endsWith('growth-terrain:lower'))?.surfaces?.map(s => s.id)).toEqual(['side-lower']);
        expect(loop.definition.districts.find(d => d.id.endsWith('growth-terrain:upper'))?.surfaces?.map(s => s.id)).toEqual(['side-upper']);
        for (const grown of [one, separated, loop]) {
            expect(grown.sites.filter(site => site.placement)).toEqual(world.sites.filter(site => site.placement));
            expect(grown.definition.districts[0].floors).toEqual(world.definition.districts[0].floors);
            for (const old of world.sites) {
                expect(grown.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(old.ref))).toEqual(old);
                if (old.placement) for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
                    const cell = { x: old.cell.x + dx, z: old.cell.z + dz };
                    expect(grown.floorAt(cell)?.point).toEqual(world.floorAt(cell)?.point);
                }
            }
            const queue = [world.sites[0].cell], reached = new Set(queue.map(cellId));
            for (let i = 0; i < queue.length; i++) for (const next of grown.neighbors(queue[i], 'walk')) {
                if (!reached.has(cellId(next))) { reached.add(cellId(next)); queue.push(next); }
                // Every graph edge in this synthetic fixture also crosses visible floor.
                for (let step = 0; step <= 8; step++) expect(grown.floorAt({
                    x: queue[i].x + (next.x - queue[i].x) * step / 8, z: queue[i].z + (next.z - queue[i].z) * step / 8,
                })).toBeDefined();
            }
            expect(reached.size).toBe(grown.sites.length);
            for (const site of grown.sites.filter(site => site.ref.districtId !== 'acquired-coast')) {
                expect(grown.owns(site.cell)).toBe(false); expect(grown.neighbors(site.cell, 'join')).toEqual([]);
                expect(grown.neighbors(site.cell, 'water')).toEqual([]);
            }
        }
        place(split); expect(compose().definition).toEqual(separated.definition);
        place(joined); expect(compose().definition).toEqual(loop.definition);
        expect(owners()).toEqual(before); expect(JSON.stringify(world.definition)).toBe(original);
    });

    it('uses every connected owner and treats equidistant centre trees as one-mouth evidence only', () => {
        const { state, world, catalog, place, derive } = connectedFixture();
        place(joined);
        const before = derive();
        state.landmarks[3].cell = undefined;
        const three = derive();
        expect(three.revision).not.toBe(before.revision);
        expect(three.connections[0].ownerIds).toEqual(['a', 'b', 'c']);
        for (const assembly of three.assemblies) expect(assembly.ownerIds).toEqual(['a', 'b', 'c']);
        state.landmarks[1].cell = undefined;
        expect(derive().assemblies).toEqual([]); expect(derive().connections).toEqual([]);
        place([{ x: 0, z: 0 }, { x: 1, z: 0 }]);
        expect(derive().assemblies).toEqual([expect.objectContaining({ socketId: 'lower', shape: 'seaward', ownerIds: ['a', 'b'] })]);
        expect(derive().connections).toEqual([]);
        // A catalog without connection parts still supports the original pair behavior.
        const legacy = { ...catalog, profile: { ...catalog.profile, connections: undefined } };
        expect(deriveAuthoredGrowthTerrainPlan(state, world, legacy).assemblies).toEqual(derive().assemblies);
    });

    it('is independent of owner enumeration and IDs, and carries full groups through rotated instances', () => {
        const { state, world, catalog, place, derive } = connectedFixture();
        place(joined);
        const plan = derive();
        state.landmarks.reverse();
        expect(derive()).toEqual(plan);
        const reversed = { ...catalog, profile: { ...catalog.profile, sockets: [...catalog.profile.sockets].reverse() } };
        expect(deriveAuthoredGrowthTerrainPlan(state, world, reversed)).toEqual(plan);
        const definition = { ...world.definition, districts: world.definition.districts.map(d => ({ ...d, turn: 1 as const,
            logicalOrigin: { x: 10, z: 5 }, worldOrigin: { x: 10, y: 0, z: 5 } })) };
        const rotated = compileWorldDefinition(definition);
        state.landmarks = state.landmarks.map((tree, i) => ({ ...tree, id: `unrelated-${i}`, cell: { x: 10 - tree.cell!.z, z: 5 + tree.cell!.x } }));
        const rotatedPlan = deriveAuthoredGrowthTerrainPlan(state, rotated, catalog);
        for (const assembly of [...rotatedPlan.assemblies, ...rotatedPlan.connections]) expect(assembly.ownerIds).toEqual(['unrelated-0', 'unrelated-1', 'unrelated-2', 'unrelated-3']);
        expect(rotatedPlan.assemblies.map(a => [a.socketId, a.shape])).toEqual(plan.assemblies.map(a => [a.socketId, a.shape]));
        const grown = composeAuthoredGrowthTerrainWorld(rotated, catalog, rotatedPlan);
        expect(grown.floorAt({ x: 10, z: 9.8 })).toBeDefined();
        expect(grown.sites.filter(site => site.placement)).toEqual(rotated.sites.filter(site => site.placement));
    });

    it('reports unsupported connections and competing groups instead of silently choosing one group', () => {
        const { state, world, catalog, place } = connectedFixture();
        place(joined);
        const legacy = { ...catalog, profile: { ...catalog.profile, connections: undefined } };
        const rejected = deriveAuthoredGrowthTerrainPlan(state, world, legacy);
        expect(rejected.rejectedReason).toContain('no authored connection');
        expect(rejected.assemblies).toEqual([]); expect(rejected.connections).toEqual([]);
        expect(() => composeAuthoredGrowthTerrainWorld(world, legacy, rejected)).toThrow('rejected');
        place(single);
        const separateRows = compileWorldDefinition({ ...world.definition, edges: world.definition.edges.map(edge => {
            const from = world.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(edge.from))?.cell;
            const to = world.sites.find(site => JSON.stringify(site.ref) === JSON.stringify(edge.to))?.cell;
            return from && to && from.z !== to.z ? { ...edge, allows: edge.allows.filter(kind => kind !== 'join') } : edge;
        }) });
        const conflict = deriveAuthoredGrowthTerrainPlan(state, separateRows, catalog);
        expect(conflict.rejectedReason).toContain('multiple mature groups');
        expect(conflict.assemblies).toEqual([]); expect(conflict.connections).toEqual([]);
    });

    it('rejects a connection whose opposite landings only reach each other through the original shore', () => {
        const { state, world, catalog, place } = connectedFixture(); place(joined);
        const broken = { ...catalog, profile: { ...catalog.profile,
            connections: catalog.profile.connections!.map(part => ({ ...part, edges: [] })),
        } };
        const plan = deriveAuthoredGrowthTerrainPlan(state, world, broken), before = JSON.stringify([state, world.definition, broken]);
        expect(plan.assemblies).toHaveLength(2); expect(plan.connections).toHaveLength(1);
        // Both connection sites have their own branch landing, so a multi-source
        // search over the whole island could still reach every site without this edge.
        expect(broken.profile.connections[0].district.sites.map(site => site.id).sort()).toEqual(
            broken.profile.connections[0].landings.map(landing => landing.connectionSiteId).sort());
        expect(() => composeAuthoredGrowthTerrainWorld(world, broken, plan)).toThrow('connection walking sites are disconnected between landings');
        expect(JSON.stringify([state, world.definition, broken])).toBe(before);
        expect(() => composeAuthoredGrowthTerrainWorld(world, catalog, deriveAuthoredGrowthTerrainPlan(state, world, catalog))).not.toThrow();
    });

    it('selects a single coast shape using its own district-local axis and uses its distinct real mesh', () => {
        const { place, derive, compose, world, state, catalog } = coastSpecificFixture();
        place([{ x: 1, z: -1 }, { x: 1, z: 0 }]);
        expect(derive().assemblies[0]).toMatchObject({ socketId: 'lower', shape: 'parallel' });
        place([{ x: 1, z: 0 }, { x: 1, z: 1 }]);
        expect(derive().assemblies[0]).toMatchObject({ socketId: 'upper', shape: 'seaward' });
        const grown = compose();
        expect(grown.floorAt({ x: 5.3, z: 1 })).toBeDefined();
        expect(grown.sites.some(site => site.ref.siteId === 'upper-entry')).toBe(true);
        const definition = { ...world.definition, districts: world.definition.districts.map(d => ({ ...d, turn: 1 as const,
            logicalOrigin: { x: 10, z: 5 }, worldOrigin: { x: 10, y: 0, z: 5 } })) };
        const rotated = compileWorldDefinition(definition);
        state.landmarks = state.landmarks.map(tree => ({ ...tree, cell: tree.cell && { x: 10 - tree.cell.z, z: 5 + tree.cell.x } }));
        expect(deriveAuthoredGrowthTerrainPlan(state, rotated, catalog).assemblies[0]).toMatchObject({ socketId: 'upper', shape: 'seaward' });
    });

    it('joins asymmetric branches through each socket-specific landing and bank while preserving the original island', () => {
        const { world, catalog, place, derive, compose } = coastSpecificFixture(); place(joined);
        const plan = derive(), grown = compose();
        expect(plan.connections).toHaveLength(1);
        expect(plan.assemblies.every(assembly => assembly.shape === 'seaward')).toBe(true);
        const upper = grown.definition.districts.find(d => d.id === 'acquired-coast:growth-terrain:upper')!;
        expect(upper.floors).toEqual(catalog.profile.sockets.find(s => s.id === 'upper')!.variants!.find(v => v.id === 'seaward')!.district.floors);
        expect(upper.surfaces?.map(surface => surface.id)).toEqual(['upper-side-upper']);
        expect(grown.floorAt({ x: 5.3, z: 1 })).toBeDefined(); expect(grown.floorAt({ x: 5.3, z: -1 })).toBeUndefined();
        expect(grown.neighbors({ x: 4.8, z: 1 })).toContainEqual({ x: 4.8, z: .25 });
        expect(grown.sites.filter(site => site.placement)).toEqual(world.sites.filter(site => site.placement));
        expect(grown.definition.districts[0].floors).toEqual(world.definition.districts[0].floors);
        for (const site of world.sites) expect(grown.sites.find(candidate => JSON.stringify(candidate.ref) === JSON.stringify(site.ref))).toEqual(site);
    });

    it('rejects incomplete or unknown socket overrides and references belonging to the shared variant only', () => {
        const { state, world, catalog, place } = coastSpecificFixture(); place(joined);
        const socketChange = (update: (socket: AuthoredGrowthTerrainCatalog['profile']['sockets'][number]) => AuthoredGrowthTerrainCatalog['profile']['sockets'][number]) =>
            ({ ...catalog, profile: { ...catalog.profile, sockets: catalog.profile.sockets.map(socket => socket.id === 'upper' ? update(socket) : socket) } });
        const invalidPair = socketChange(socket => ({ ...socket, variants: socket.variants!.slice(0, 1) }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, invalidPair)).toThrow('both authored growth shapes');
        const unknownShape = socketChange(socket => ({ ...socket, variants: socket.variants!.map(v => ({ ...v, id: 'unknown' as typeof v.id })) }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, unknownShape)).toThrow('both authored growth shapes');
        const invalidAxis = socketChange(socket => ({ ...socket, shoreFacing: 4 as 0 }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, invalidAxis)).toThrow('socket shoreline');
        const sharedLanding = socketChange(socket => ({ ...socket, landings: socket.landings.map(landing => ({ ...landing, patchSiteId: 'entry' })) }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, sharedLanding)).toThrow('unknown or duplicate landing');
        const invalidGround = socketChange(socket => ({ ...socket, variants: socket.variants!.map(v => ({ ...v,
            district: { ...v.district, sites: v.district.sites.map(site => ({ ...site, placement: true })) },
        })) }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, invalidGround)).toThrow('walking');
        const sharedConnectionLanding = { ...catalog, profile: { ...catalog.profile, connections: catalog.profile.connections!.map(part => ({ ...part,
            landings: part.landings.map(landing => ({ ...landing, patchSiteId: 'tip' })),
        })) } };
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, sharedConnectionLanding)).toThrow('connection landing');
        const sharedBank = { ...catalog, profile: { ...catalog.profile, connections: catalog.profile.connections!.map(part => ({ ...part,
            replaceSurfaceIds: [{ socketId: 'upper', surfaceIds: ['side-lower'] }],
        })) } };
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, sharedBank)).toThrow('connection bank');
    });

    it('rejects invalid connection rights, bank references, disconnected sites and overlapping real floors', () => {
        const { state, world, catalog, place } = connectedFixture(); place(joined);
        const changeConnection = (update: (part: NonNullable<AuthoredGrowthTerrainCatalog['profile']['connections']>[number]) => NonNullable<AuthoredGrowthTerrainCatalog['profile']['connections']>[number]) =>
            ({ ...catalog, profile: { ...catalog.profile, connections: catalog.profile.connections!.map(update) } });
        const rights = changeConnection(part => ({ ...part, district: { ...part.district, sites: part.district.sites.map(site => ({ ...site, placement: true })) } }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, rights)).toThrow('walking');
        const unknown = changeConnection(part => ({ ...part, replaceSurfaceIds: [{ socketId: 'lower', surfaceIds: ['invented-bank'] }] }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, unknown)).toThrow('connection bank');
        const unknownSocket = changeConnection(part => ({ ...part, replaceSurfaceIds: [{ socketId: 'unknown', surfaceIds: [] }] }));
        expect(() => deriveAuthoredGrowthTerrainPlan(state, world, unknownSocket)).toThrow('connection bank socket');
        const disconnected = changeConnection(part => ({ ...part, district: { ...part.district,
            sites: [...part.district.sites, { id: 'isolated', cell: { x: 4.2, z: 0 }, floorId: 'link', placement: false }] } }));
        expect(() => composeAuthoredGrowthTerrainWorld(world, disconnected, deriveAuthoredGrowthTerrainPlan(state, world, disconnected))).toThrow('disconnected');
        const overlap = changeConnection(part => ({ ...part, district: { ...part.district, floors: part.district.floors.map(f => ({ ...f,
            vertices: f.vertices.map(v => ({ cell: { ...v.cell, z: v.cell.z * 1.01 }, point: { ...v.point, z: v.point.z * 1.01 } })) })) } }));
        expect(() => composeAuthoredGrowthTerrainWorld(world, overlap, deriveAuthoredGrowthTerrainPlan(state, world, overlap))).toThrow('overlaps');
    });
});
