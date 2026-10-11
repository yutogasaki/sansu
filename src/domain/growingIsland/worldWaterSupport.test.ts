import { describe, expect, it } from 'vitest';
import { applyIntent, canPlace } from './commands';
import { newIsland } from './island';
import { key, landCells, onLand, walkableCells } from './space';
import { compileWorldDefinition, isWorldWalkEdgeSupported } from './worldDefinition';
import { waterSupportDefinition } from './worldWaterSupport.fixture';
import type { WorldDefinition, WorldFloor, WorldPoint, WorldSite, WorldSurface } from './worldTypes';

const wetCell = { x: 0, z: 2 }, dryCell = { x: 1, z: 2 };
const floorId = (id: string) => JSON.stringify(['pond', id]);
function replaceFirstSite(definition: WorldDefinition, update: (site: WorldSite) => WorldSite) {
    const district = definition.districts[0];
    definition.districts = [{ ...district, sites: district.sites.map((site, i) => i ? site : update(site)) }];
    return definition;
}

describe('composed water keeps original rights separate from current support', () => {
    it('retains acquired refs, anchors and water/join grants while refusing wet placement and walking', () => {
        const definition = waterSupportDefinition(), before = structuredClone(definition), world = compileWorldDefinition(definition), state = newIsland('wet-rights', 0);
        expect(world.owns(wetCell)).toBe(true); expect(onLand(state, wetCell, world)).toBe(true);
        expect(landCells(state, world)).toEqual([0, 1, 2].map(x => ({ x, z: 2 })));
        expect(world.sites[0].point).toEqual({ x: 0, y: 1, z: 2 }); expect(world.anchorAt(wetCell)).toEqual(world.sites[0].point);
        expect(world.sites[0].support).toBeUndefined(); expect(world.walkSites.map(site => site.cell)).toEqual([dryCell, { x: 2, z: 2 }]);
        expect(walkableCells(state, world).has(key(wetCell))).toBe(false); expect(canPlace(state, wetCell, undefined, world)).toBe(false);
        expect(world.floorAt(wetCell)).toBeUndefined(); expect(world.logicalAt({ x: 0, y: -.4, z: 2 })).toBeUndefined();
        expect(world.siteAt({ x: 0, y: -.4, z: 2 })).toBeUndefined(); expect(world.siteAt({ x: 0, y: .4, z: 2 })).toBeUndefined();
        expect(world.neighbors(wetCell, 'walk')).toEqual([]); expect(world.neighbors(wetCell, 'join')).toEqual([dryCell]); expect(world.neighbors(wetCell, 'water')).toEqual([dryCell]);
        expect(world.route(wetCell, wetCell, new Set([key(wetCell)]))).toBeUndefined();
        expect(world.route(wetCell, dryCell, new Set([key(wetCell), key(dryCell)]), 'water')).toEqual([wetCell, dryCell]);
        expect(isWorldWalkEdgeSupported(world, wetCell, dryCell)).toBe(false);
        expect(world.anchorFloorAt({ x: .1, z: 2 })?.point.y).toBe(1);
        expect(definition).toEqual(before); expect(Object.isFrozen(world.sites[0].point)).toBe(true);
        const anchor = world.anchorAt(wetCell)!; anchor.y = 99; expect(world.anchorAt(wetCell)?.y).toBe(1);
    });

    it('enforces wet rejection for actual plant/place/move/unstore commands without changing the previous state', () => {
        const state = newIsland('wet-commands', 0), world = compileWorldDefinition(waterSupportDefinition());
        state.unlocked = ['seed:wild', 'landmark:bench']; state.drops = 100;
        state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 2, z: 2 }, growth: 0 }, { id: 'stored', kind: 'bench', growth: 0 }];
        const before = structuredClone(state);
        for (const command of [
            { type: 'plant', kind: 'wild', cell: wetCell }, { type: 'place', kind: 'bench', cell: wetCell },
            { type: 'move', id: 'bench', cell: wetCell }, { type: 'unstore', id: 'stored', cell: wetCell },
        ] as const) expect(() => applyIntent(state, { id: command.type, command }, 0, world)).toThrow('ここには おけないよ');
        expect(state).toEqual(before); expect(canPlace(state, dryCell, undefined, world)).toBe(true);
    });

    it('rejects invalid anchors and unknown source floors instead of creating arbitrary acquired points', () => {
        for (const anchorPoint of [{ x: .1, y: 1, z: 2 }, { x: 0, y: 1.01, z: 2 }, { x: 0, y: NaN, z: 2 }]) {
            expect(() => compileWorldDefinition(replaceFirstSite(waterSupportDefinition(), site => ({ ...site, anchorPoint })))).toThrow(/site anchor/);
        }
        expect(() => compileWorldDefinition(replaceFirstSite(waterSupportDefinition(), site => ({ ...site, cell: { x: 3, z: 2 }, anchorPoint: { x: 3, y: 1, z: 2 } })))).toThrow('no original floor');
        expect(() => compileWorldDefinition(replaceFirstSite(waterSupportDefinition(), site => ({ ...site, floorId: 'unknown' })))).toThrow('unknown floor');
        const noOriginal = waterSupportDefinition(), district = noOriginal.districts[0];
        noOriginal.districts = [{ ...district, anchorFloors: [] }]; expect(() => compileWorldDefinition(noOriginal)).toThrow('unknown floor');
    });

    it('requires a finite height for every raw floor point and world origin, including omitted JSON heights', () => {
        const withoutHeight = ({ x, z }: WorldPoint) => ({ x, z } as WorldPoint);
        for (const original of [false, true]) for (const y of [undefined, NaN, Infinity]) {
            const definition = waterSupportDefinition(), district = definition.districts[0];
            const source = original ? district.anchorFloors! : district.floors;
            const malformed = source.map(floor => ({ ...floor, vertices: floor.vertices.map(vertex => ({ ...vertex,
                point: y === undefined ? withoutHeight(vertex.point) : { ...vertex.point, y } })) }));
            definition.districts = [{ ...district, ...(original ? { anchorFloors: malformed } : { floors: malformed }),
                sites: district.sites.map(site => ({ ...site, anchorPoint: { ...site.anchorPoint!, y: 0 } })) }];
            expect(() => compileWorldDefinition(definition)).toThrow('non-finite floor vertex');
        }
        for (const y of [undefined, NaN, Infinity]) {
            const definition = waterSupportDefinition(), district = definition.districts[0];
            definition.districts = [{ ...district, worldOrigin: y === undefined ? withoutHeight(district.worldOrigin) : { ...district.worldOrigin, y } }];
            expect(() => compileWorldDefinition(definition)).toThrow('district origin or turn');
        }
    });

    it('keeps unanchored wet and broken legacy sites invalid', () => {
        const unanchor = ({ id, cell, floorId: sourceFloor, placement }: WorldSite): WorldSite => ({ id, cell, floorId: sourceFloor, placement });
        expect(() => compileWorldDefinition(replaceFirstSite(waterSupportDefinition(), unanchor))).toThrow('no actual dry floor');
        expect(() => compileWorldDefinition(replaceFirstSite(waterSupportDefinition(false), site => ({ ...unanchor(site), cell: { x: 3, z: 2 } })))).toThrow('no actual dry floor');
    });

    it('queries each district original independently when anchored and legacy districts coexist', () => {
        const definition = waterSupportDefinition(), legacy = waterSupportDefinition(false).districts[0];
        definition.districts = [...definition.districts, { ...legacy, id: 'legacy', anchorFloors: undefined,
            logicalOrigin: { x: 8, z: 0 }, worldOrigin: { x: 8, y: 0, z: 0 },
            sites: legacy.sites.map(({ id, cell, floorId: sourceFloor, placement }) => ({ id, cell, floorId: sourceFloor, placement })) }];
        const world = compileWorldDefinition(definition);
        expect(world.floorAt(wetCell)).toBeUndefined(); expect(world.anchorFloorAt(wetCell)?.point.y).toBe(1);
        const original = world.anchorFloorAt({ x: 8.13, z: 2.21 })!, active = world.floorAt({ x: 8.13, z: 2.21 })!;
        expect(original.point).toEqual(active.point); expect(original.cell).toEqual(active.cell); expect(original.floorId).toEqual(active.floorId);
        expect(world.anchorFloorAt({ x: 4, z: 2 })).toBeUndefined();
    });

    it('walks only a genuine dry deck and validates its current support instead of the fixed anchor height', () => {
        const definition = waterSupportDefinition(true, true), world = compileWorldDefinition(definition), state = newIsland('wet-deck', 0);
        expect(world.sites[0].point.y).toBe(1); expect(world.sites[0].support?.point.y).toBe(1.2);
        expect(world.sites[0].support?.floorId).toBe(floorId('deck')); expect(world.floorAt(wetCell)?.point.y).toBe(1.2);
        expect(world.floorAt(wetCell, floorId('underwater-deck'))).toBeUndefined();
        expect(world.siteAt({ x: 0, y: 1.2, z: 2 })?.cell).toEqual(wetCell);
        expect(world.siteAt({ x: 0, y: .1, z: 2 })).toBeUndefined(); expect(world.owns({ x: .25, z: 2 })).toBe(false);
        expect(world.walkSites).toHaveLength(3); expect(walkableCells(state, world).has(key(wetCell))).toBe(true);
        expect(isWorldWalkEdgeSupported(world, wetCell, dryCell)).toBe(true);
        expect(world.route(wetCell, dryCell, new Set(world.walkSites.map(site => key(site.cell))))).toEqual([wetCell, dryCell]);
        const noDeck = waterSupportDefinition(), first = noDeck.edges[0];
        noDeck.edges = [{ ...first, allows: ['walk', ...first.allows] }, ...noDeck.edges.slice(1)];
        expect(() => compileWorldDefinition(noDeck)).toThrow('walk edge endpoint has no actual dry floor');
        // A narrow ribbon supports centres but cannot support both sides of the actual foot lane.
        const narrow = waterSupportDefinition(true, true), district = narrow.districts[0];
        narrow.districts = [{ ...district, floors: district.floors.map(floor => floor.kind === 'deck' ? { ...floor,
            vertices: floor.vertices.map(v => ({ cell: { ...v.cell, z: 2 + (v.cell.z - 2) * .1 }, point: { ...v.point, z: 2 + (v.point.z - 2) * .1 } })) } : floor) }];
        const withoutWalk = { ...narrow, edges: narrow.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })) };
        expect(isWorldWalkEdgeSupported(compileWorldDefinition(withoutWalk), wetCell, dryCell)).toBe(false);
        expect(() => compileWorldDefinition(narrow)).toThrow('crosses missing floor or water');
    });

    it('directly reads the specified active water and bed without masking, borrowing another floor or exposing original geometry', () => {
        const world = compileWorldDefinition(waterSupportDefinition());
        expect(world.sampleFloorAt(wetCell, floorId('water'))?.point).toEqual({ x: 0, y: .4, z: 2 });
        expect(world.sampleFloorAt(wetCell, floorId('ground'))?.point).toEqual({ x: 0, y: -.4, z: 2 });
        for (const id of ['', floorId('absent'), 'ground']) expect(world.sampleFloorAt(wetCell, id)).toBeUndefined();
        expect(world.sampleFloorAt({ x: 99, z: 2 }, floorId('water'))).toBeUndefined();
        expect(world.sampleFloorAt({ x: NaN, z: 2 }, floorId('water'))).toBeUndefined();
        const sample = world.sampleFloorAt(wetCell, floorId('water'))!; sample.cell.x = 99; sample.point.y = 99;
        expect(world.sampleFloorAt(wetCell, floorId('water'))?.point.y).toBe(.4);
        expect(world.floorAt(wetCell)).toBeUndefined(); expect(world.anchorFloorAt(wetCell)?.point.y).toBe(1);
    });

    it('transforms and freezes vertical non-support surfaces while excluding them and original floors from hit, footing and bounds', () => {
        const definition = waterSupportDefinition(), district = definition.districts[0], surface = district.surfaces![0];
        const high: WorldSurface = { ...surface, id: 'flow', kind: 'flow', vertices: [{ x: 90, y: 100, z: 90 }, { x: 91, y: 100, z: 90 }, { x: 90, y: 100, z: 91 }] };
        const original = district.anchorFloors![0];
        definition.districts = [{ ...district, surfaces: [surface, { ...high, indices: [0, 1, 2], material: { ...high.material, opacity: .7 } }],
            anchorFloors: [{ ...original, vertices: original.vertices.map(v => ({ ...v, cell: { x: v.cell.x * 20, z: v.cell.z }, point: { ...v.point, x: v.point.x * 20 } })) }],
            turn: 1, logicalOrigin: { x: 10, z: 4 }, worldOrigin: { x: 20, y: 2, z: 30 } }];
        const snapshot = structuredClone(definition), world = compileWorldDefinition(definition);
        expect(world.surfaces[0].vertices[0]).toEqual({ x: 18.5, y: 1.6, z: 29.5 }); expect(Object.isFrozen(world.surfaces[0].material)).toBe(true);
        expect(world.anchorAt({ x: 8, z: 4 })).toEqual({ x: 18, y: 3, z: 30 });
        expect(world.anchorFloorAt({ x: 8, z: 44 })).toBeDefined(); expect(world.floorAt({ x: 8, z: 44 })).toBeUndefined();
        expect(world.bounds.max.y).toBe(3); expect(world.bounds.max.z).toBe(32.5); expect(world.bounds.min.z).toBe(29.5);
        expect(world.logicalAt(world.surfaces[1].vertices[0])).toBeUndefined(); expect(world.siteAt(world.surfaces[1].vertices[0])).toBeUndefined();
        expect(definition).toEqual(snapshot);
        for (const material of [{ ...surface.material, opacity: NaN }, { ...surface.material, roughness: 2 }, { ...surface.material, color: 'red' }]) {
            const bad = waterSupportDefinition(), d = bad.districts[0]; bad.districts = [{ ...d, surfaces: [{ ...surface, material }] }];
            expect(() => compileWorldDefinition(bad)).toThrow('surface material');
        }
        const badIndex = waterSupportDefinition(); badIndex.districts = [{ ...district, surfaces: [{ ...surface, indices: [0, 1, 999] }] }];
        expect(() => compileWorldDefinition(badIndex)).toThrow('surface index');
        const nonFinite = waterSupportDefinition(); nonFinite.districts = [{ ...district, surfaces: [{ ...surface, vertices: [{ x: 0, y: Infinity, z: 0 }, ...surface.vertices.slice(1)] }] }];
        expect(() => compileWorldDefinition(nonFinite)).toThrow('non-finite surface');
        const vertical: WorldFloor = { id: 'vertical-floor', kind: 'ground', color: '#aabbcc', indices: [0, 1, 2],
            vertices: surface.vertices.slice(0, 3).map(point => ({ cell: { x: point.x, z: point.z }, point })) };
        expect(() => compileWorldDefinition({ ...waterSupportDefinition(), districts: [{ ...district, floors: [...district.floors, vertical] }] })).toThrow('collapsed floor triangle');
    });

    it('restores original dry support and unchanged rights/anchors when the same base is recomposed', () => {
        const base = waterSupportDefinition(false), snapshot = structuredClone(base), before = compileWorldDefinition(base), wet = compileWorldDefinition(waterSupportDefinition()), restored = compileWorldDefinition(base);
        const refs = (world: typeof before) => world.sites.map(site => ({ ref: site.ref, cell: site.cell, point: site.point, placement: site.placement }));
        expect(refs(wet)).toEqual(refs(before)); expect(refs(restored)).toEqual(refs(before));
        expect(restored.floors).toEqual(before.floors); expect(restored.walkSites).toEqual(before.walkSites);
        expect(restored.floorAt(wetCell)).toEqual(before.floorAt(wetCell)); expect(wet.floorAt(wetCell)).toBeUndefined();
        expect(before.revision).toBe('dry'); expect(wet.revision).toBe('wet'); expect(restored.revision).toBe('dry'); expect(base).toEqual(snapshot);
        const state = newIsland('wet-store', 0); state.landmarks = [{ id: 'same-bowl', kind: 'water-bowl', cell: wetCell, growth: 8 }];
        const stored = applyIntent(state, { id: 'store', command: { type: 'store', id: 'same-bowl' } }, 0, wet).state;
        expect(stored.landmarks[0]).toEqual({ id: 'same-bowl', kind: 'water-bowl', cell: undefined, growth: 8 });
        const unstore = applyIntent(stored, { id: 'unstore', command: { type: 'unstore', id: 'same-bowl', cell: wetCell } }, 0, restored).state;
        expect(unstore.landmarks[0]).toEqual(state.landmarks[0]); expect(state.landmarks[0].cell).toEqual(wetCell);
    });
});
