import { describe, expect, it } from 'vitest';
import { authoredAccessWorld } from './authoredWorldAccess.fixture';
import { authoredApproachCells, authoredPointBlocked, findAuthoredShoreEntries, isAuthoredShoreEntrySupported, walkPathDistance } from './authoredWorldAccess';
import { waterSupportDefinition } from './worldWaterSupport.fixture';
import { newIsland } from './island';
import { approachCells, HOME_CELL, isReachable, isVacant, key, landCells, onLand, passageNeighbors, reachableFromHome, walkableCells } from './space';
import { compileWorldDefinition, isWorldWalkEdgeSupported } from './worldDefinition';
import type { WorldDefinition, WorldFloor } from './worldTypes';

const bankCell = { x: 1, z: .25 }, waterOwner = { x: 1, z: -1 }, districtId = 'authored-access';
const waterId = JSON.stringify([districtId, 'wide-water']);
const rectangleFloor = (id: string, x0: number, x1: number, z0: number, z1: number, kind: WorldFloor['kind'] = 'ground', y = 1): WorldFloor => ({
    id, kind, color: '#aabbcc', vertices: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => ({ cell: { x, z }, point: { x, y, z } })), indices: [0, 1, 2, 0, 2, 3],
});
function wideShoreDefinition(): WorldDefinition {
    const { definition } = authoredAccessWorld(), district = definition.districts[0];
    const original = rectangleFloor('sloped-ground', -1.5, 5.5, -3.5, 4.5);
    definition.districts = [{ ...district, anchorFloors: [original], floors: [original, rectangleFloor('wide-water', -.5, 2.5, -2, 0, 'water', 1.025)],
        sites: district.sites.map(site => ({ ...site, anchorPoint: { ...site.cell, y: 1 } })) }];
    const edges = definition.edges;
    definition.edges = edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
    const supported = compileWorldDefinition(definition), refs = new Map(supported.sites.map(site => [site.ref.siteId, site.cell]));
    definition.edges = edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk'
        || isWorldWalkEdgeSupported(supported, refs.get(edge.from.siteId)!, refs.get(edge.to.siteId)!)) })).filter(edge => edge.allows.length);
    return definition;
}
function withBankEntry(definition: WorldDefinition, entrySiteIds = ['1,0.25'], waterFloorIds = ['wide-water']) {
    definition.districts = definition.districts.map(district => ({ ...district, shoreAccess: [{ ownerSiteId: '1,-1', waterFloorIds, entrySiteIds }] }));
    return definition;
}

describe('authored planting and walking access', () => {
    it('grants only explicit integer planting sites, including negative z, without changing a save', () => {
        const state = newIsland('authored-access', 0), before = structuredClone(state), { world } = authoredAccessWorld();
        expect(onLand(state, { x: 1, z: -1 })).toBe(false);
        expect(onLand(state, { x: 1, z: -1 }, world)).toBe(true);
        expect(isVacant(state, { x: 1, z: -1 }, undefined, world)).toBe(true);
        expect(onLand(state, { x: 1.25, z: -1 }, world)).toBe(false);
        expect(onLand(state, { x: 6, z: 1 }, world)).toBe(false);
        expect(landCells(state, world).every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z))).toBe(true);
        expect(state).toEqual(before);
    });

    it('keeps quarter walks separate from integer join and water grants', () => {
        const { world } = authoredAccessWorld(), cell = { x: 1, z: -1 };
        expect(passageNeighbors(cell, world).every(next => Math.abs(next.x - cell.x) + Math.abs(next.z - cell.z) === .25)).toBe(true);
        expect(passageNeighbors(cell, world, 'join').every(next => Number.isInteger(next.x) && Number.isInteger(next.z))).toBe(true);
        expect(passageNeighbors({ x: 1.25, z: -1 }, world, 'water')).toEqual([]);
    });

    it('routes around an occupied home with its foot band instead of through quarter interior nodes', () => {
        const state = newIsland('authored-access', 0), { world } = authoredAccessWorld(), home = { x: 1, z: -1 };
        state.landmarks = [];
        state.plots.push({ id: 'native-home', kind: 'home', cell: home, plantedAt: 0, stage: 2, growth: 0, origin: 'seed', paid: 4 });
        const open = walkableCells(state, world), reached = reachableFromHome(state, open, world);
        expect(open.has(key(home))).toBe(false);
        expect(open.has('1.5,-1')).toBe(false);
        expect(open.has('1.75,-1')).toBe(true);
        expect(open.has(key(HOME_CELL))).toBe(true);
        expect(open.has('2.5,0')).toBe(false);
        const path = world.route({ x: 0, z: -1 }, { x: 2, z: -1 }, open)!;
        expect(path.length).toBeGreaterThan(9);
        expect(path.every(cell => !authoredPointBlocked(cell, home))).toBe(true);
        expect(isReachable(home, reached, world)).toBe(true);
        expect(approachCells(home, world)[1]).toEqual({ x: 1, z: -.25 });
    });

    it('does not infer passage across a removed district connection', () => {
        const state = newIsland('authored-access', 0), { definition } = authoredAccessWorld();
        definition.edges = definition.edges.filter(edge => {
            const [a] = edge.from.siteId.split(',').map(Number), [b] = edge.to.siteId.split(',').map(Number);
            return !edge.allows.includes('walk') || !(a <= 3.5 && b > 3.5);
        });
        const world = compileWorldDefinition(definition), reached = reachableFromHome(state, undefined, world);
        expect(onLand(state, { x: 4, z: -1 }, world)).toBe(true);
        expect(reached.has('4,-1')).toBe(false);
        expect(isReachable({ x: 5, z: -1 }, reached, world)).toBe(false);
    });

    it('measures the same walking distance at integer and quarter resolutions', () => {
        const quarter = Array.from({ length: 13 }, (_, i) => ({ x: i / 4, z: -1 }));
        expect(walkPathDistance(quarter)).toBe(3);
        expect(walkPathDistance([{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 2, z: -1 }, { x: 3, z: -1 }])).toBe(3);
    });

    it('approaches a wet owner on its actual dry bank without reviving a walk edge through water', () => {
        const world = compileWorldDefinition(waterSupportDefinition());
        expect(world.neighbors({ x: 0, z: 2 }, 'walk')).toEqual([]);
        expect(authoredApproachCells({ x: 0, z: 2 }, world)).toEqual([{ x: 1, z: 2 }]);
        expect(isReachable({ x: 0, z: 2 }, new Set(['1,2']), world)).toBe(true);
    });

    it('does not call a logically nearby but physically separated floor the wet owner bank', () => {
        const definition = waterSupportDefinition(), district = definition.districts[0];
        district.floors = district.floors.map((floor, serial) => serial ? floor : { ...floor,
            vertices: floor.vertices.map((vertex, i) => i < 4 ? { ...vertex, point: { ...vertex.point, x: vertex.point.x + 100 } } : vertex) });
        const world = compileWorldDefinition(definition);
        expect(world.floorAt({ x: 1, z: 2 })?.point.x).toBe(101);
        expect(authoredApproachCells({ x: 0, z: 2 }, world)).toEqual([]);
        expect(isReachable({ x: 0, z: 2 }, new Set(['1,2']), world)).toBe(false);
    });

    it('uses an existing actual bank beyond the old owner radius without adding rights or a water crossing', () => {
        const definition = wideShoreDefinition(), before = compileWorldDefinition(definition), world = compileWorldDefinition(withBankEntry(definition));
        expect(Math.hypot(bankCell.x - waterOwner.x, bankCell.z - waterOwner.z)).toBeGreaterThan(1.1);
        expect(before.floorAt(waterOwner)).toBeUndefined(); expect(authoredApproachCells(waterOwner, before)).toEqual([]);
        expect(isAuthoredShoreEntrySupported(world, bankCell, [waterId])).toBe(true);
        expect(findAuthoredShoreEntries(world, [waterId])).toContainEqual({ districtId, siteId: '1,0.25' });
        expect(authoredApproachCells(waterOwner, world)).toEqual([waterOwner, bankCell]);
        const state = newIsland('wide-shore', 0); state.landmarks = [];
        expect(reachableFromHome(state, undefined, world).has(key(bankCell))).toBe(true);
        expect(isReachable(waterOwner, reachableFromHome(state, undefined, world), world)).toBe(true);
        expect(world.owns(bankCell)).toBe(false); expect(world.owns(waterOwner)).toBe(true);
        expect(world.sites).toEqual(before.sites); expect(world.definition.edges).toEqual(before.definition.edges);
        expect(world.neighbors(waterOwner, 'walk')).toEqual([]);
        expect(world.route({ x: 1, z: -2.25 }, bankCell, new Set(['1,-2.25', key(waterOwner), key(bankCell)]))).toBeUndefined();
        const returned = world.shoreApproachCells(waterOwner)!; returned[0].x = 100;
        expect(world.shoreApproachCells(waterOwner)).toEqual([bankCell]);
    });

    it('rejects unproven water/entry references and leaves explicit empty entries unavailable', () => {
        for (const [entryIds, waterIds] of [[['1,-1'], ['wide-water']], [['unknown'], ['wide-water']], [['1,0.25'], ['unknown']]]) {
            expect(() => compileWorldDefinition(withBankEntry(wideShoreDefinition(), entryIds, waterIds))).toThrow('shore');
        }
        const world = compileWorldDefinition(withBankEntry(wideShoreDefinition(), []));
        expect(world.shoreApproachCells(waterOwner)).toEqual([]); expect(authoredApproachCells(waterOwner, world)).toEqual([]);
        expect(isReachable(waterOwner, new Set([key(bankCell)]), world)).toBe(false);
        expect(isAuthoredShoreEntrySupported(world, bankCell, [JSON.stringify([districtId, 'unknown'])])).toBe(false);
    });

    it('rejects remote or floating current bank floors while preserving original anchors', () => {
        for (const change of [{ x: 100, y: 0 }, { x: 0, y: 10 }]) {
            const definition = wideShoreDefinition(), district = definition.districts[0];
            definition.districts = [{ ...district, floors: district.floors.map(floor => floor.kind === 'water' ? floor : { ...floor,
                vertices: floor.vertices.map(vertex => ({ ...vertex, point: { ...vertex.point, x: vertex.point.x + change.x, y: vertex.point.y + change.y } })) }) }];
            definition.edges = definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
            const world = compileWorldDefinition(definition);
            expect(world.anchorAt(bankCell)).toEqual({ ...bankCell, y: 1 });
            expect(isAuthoredShoreEntrySupported(world, bankCell, [waterId])).toBe(false);
            expect(() => compileWorldDefinition(withBankEntry(definition))).toThrow('shore entry');
        }
    });

    it('proves the whole foot square and rejects an interior hole missed by nine probes', () => {
        const definition = wideShoreDefinition(), district = definition.districts[0];
        definition.districts = [{ ...district, floors: [rectangleFloor('left', -1.5, .93, -3.5, 4.5), rectangleFloor('right', .97, 5.5, -3.5, 4.5),
            ...district.floors.filter(floor => floor.kind === 'water')] }];
        definition.edges = definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
        const world = compileWorldDefinition(definition);
        for (const dx of [-.12, 0, .12]) for (const dz of [-.12, 0, .12]) expect(world.floorAt({ x: bankCell.x + dx, z: bankCell.z + dz })).toBeDefined();
        expect(world.floorAt({ x: .95, z: .25 })).toBeUndefined();
        expect(isAuthoredShoreEntrySupported(world, bankCell, [waterId])).toBe(false);
        expect(() => compileWorldDefinition(withBankEntry(definition))).toThrow('shore entry');
    });
});
