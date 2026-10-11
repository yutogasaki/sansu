import { describe, expect, it } from 'vitest';
import { hasAuthoredPlacementSupport } from './authoredPlacementSupport';
import { applyIntent, canPlace } from './commands';
import { newIsland } from './island';
import { compileWorldDefinition } from './worldDefinition';
import { waterSupportDefinition } from './worldWaterSupport.fixture';
import type { WorldFloor, WorldPoint } from './worldTypes';

const cell = { x: 0, z: 2 };
function rectangle(id: string, kind: WorldFloor['kind'], y: number, x0: number, x1: number, z0 = 1.6, z1 = 2.4): WorldFloor {
    return { id, kind, color: '#aabbcc', vertices: [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]
        .map(([x, z]) => ({ cell: { x, z }, point: { x, y, z } })), indices: [0, 1, 2, 2, 1, 3] };
}
function thinWaterWorld(deck?: 'partial' | 'full', deckHeight = 1.2, lowerDeck = false, transform?: (point: WorldPoint) => WorldPoint) {
    const definition = waterSupportDefinition(false), district = definition.districts[0];
    const actualDeck = rectangle('actual-deck', 'deck', deckHeight, .1, deck === 'full' ? .2 : .15, 1.55, 2.45);
    if (transform) actualDeck.vertices = actualDeck.vertices.map(vertex => ({ ...vertex, point: transform(vertex.point) }));
    definition.districts = [{ ...district, floors: [...district.floors, rectangle('thin-flow', 'water', 1.1, .12, .18),
        ...(deck ? [actualDeck] : []),
        ...(lowerDeck ? [rectangle('lower-deck', 'deck', 1.2, .1, .2, 1.55, 2.45)] : [])] }];
    definition.edges = definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') }));
    return compileWorldDefinition(definition);
}

describe('authored placement requires a supported whole owner footprint', () => {
    it('rejects a thin water strip between all nine dry probe points', () => {
        const world = thinWaterWorld(), state = newIsland('thin-water', 0);
        for (const x of [-.46, 0, .46]) for (const z of [-.46, 0, .46]) expect(world.floorAt({ x, z: cell.z + z })).toBeDefined();
        expect(world.floorAt({ x: .15, z: 2 })).toBeUndefined(); expect(world.owns(cell)).toBe(true);
        expect(hasAuthoredPlacementSupport(world, cell)).toBe(false); expect(canPlace(state, cell, undefined, world)).toBe(false);
        state.unlocked = ['landmark:bench']; state.drops = 100;
        expect(() => applyIntent(state, { id: 'thin-water', command: { type: 'place', kind: 'bench', cell } }, 0, world)).toThrow('ここには おけないよ');
    });

    it('permits fully covered water only when actual dry deck triangles cover the whole intersection', () => {
        const partial = thinWaterWorld('partial'), full = thinWaterWorld('full');
        expect(partial.floorAt({ x: .14, z: 2 })?.point.y).toBe(1.2); expect(partial.floorAt({ x: .17, z: 2 })).toBeUndefined();
        expect(hasAuthoredPlacementSupport(partial, cell)).toBe(false);
        expect(hasAuthoredPlacementSupport(full, cell)).toBe(true); expect(canPlace(newIsland('covered-water', 0), cell, undefined, full)).toBe(true);
        expect(hasAuthoredPlacementSupport(compileWorldDefinition(waterSupportDefinition(true, true)), cell)).toBe(true);
        // The geometry cache belongs to each immutable world, so a different composition cannot inherit approval.
        expect(hasAuthoredPlacementSupport(partial, cell)).toBe(false); expect(hasAuthoredPlacementSupport(full, cell)).toBe(true);
    });

    it('rejects an excessive interior deck height missed by all nine probes, including a lower deck beneath it', () => {
        for (const lowerDeck of [false, true]) {
            const world = thinWaterWorld('full', 11, lowerDeck);
            for (const x of [-.46, 0, .46]) for (const z of [-.46, 0, .46]) expect(world.floorAt({ x, z: cell.z + z })?.point.y).toBe(1);
            expect(world.floorAt({ x: .15, z: 2 })?.point.y).toBe(11);
            expect(hasAuthoredPlacementSupport(world, cell)).toBe(false); expect(canPlace(newIsland('high-interior-deck', 0), cell, undefined, world)).toBe(false);
        }
        expect(hasAuthoredPlacementSupport(thinWaterWorld('full'), cell)).toBe(true);
    });

    it('rejects a physically separated cover over its whole region, including a valid lower deck beneath it', () => {
        for (const lowerDeck of [false, true]) {
            const world = thinWaterWorld('full', 1.25, lowerDeck, point => ({ ...point, x: point.x + 100 }));
            for (const x of [-.46, 0, .46]) for (const z of [-.46, 0, .46]) expect(world.floorAt({ x, z: cell.z + z })?.point.y).toBe(1);
            expect(world.floorAt({ x: .15, z: 2 })?.point).toEqual({ x: 100.15, y: 1.25, z: 2 });
            expect(hasAuthoredPlacementSupport(world, cell)).toBe(false); expect(canPlace(newIsland('far-interior-deck', 0), cell, undefined, world)).toBe(false);
        }
        // Matching at one point cannot prove matching over the covered region.
        const skew = thinWaterWorld('full', 1.2, false, point => ({ ...point, x: point.x + (point.z - 2) * .2 }));
        expect(skew.floorAt({ x: .15, z: 2 })?.point).toEqual({ x: .15, y: 1.2, z: 2 });
        expect(hasAuthoredPlacementSupport(skew, cell)).toBe(false);
        // A separated lower overlay is harmless when a higher real deck supplies the whole region.
        expect(hasAuthoredPlacementSupport(thinWaterWorld('full', 1.15, true, point => ({ ...point, x: point.x + 100 })), cell)).toBe(true);
        const reachable = compileWorldDefinition(waterSupportDefinition(true, true));
        expect(reachable.route(cell, { x: 1, z: 2 }, new Set(reachable.walkSites.map(site => `${site.cell.x},${site.cell.z}`)))).toEqual([cell, { x: 1, z: 2 }]);
        expect(hasAuthoredPlacementSupport(reachable, cell)).toBe(true);
    });

    it('rejects missing edge support and more than .28 height difference across the .46 footprint', () => {
        const steep = waterSupportDefinition(false), district = steep.districts[0];
        steep.districts = [{ ...district, floors: district.floors.map(floor => ({ ...floor,
            vertices: floor.vertices.map(v => ({ ...v, point: { ...v.point, y: 1 + v.cell.x * .8 } })) })) }];
        const world = compileWorldDefinition(steep); expect(world.floorAt(cell)?.point.y).toBe(1);
        expect(hasAuthoredPlacementSupport(world, cell)).toBe(false);
        const edge = waterSupportDefinition(false), edgeDistrict = edge.districts[0];
        edge.districts = [{ ...edgeDistrict, floors: [rectangle('ground', 'ground', 1, -.5, .4, 1.5, 2.5)] }];
        edge.edges = edge.edges.map(e => ({ ...e, allows: e.allows.filter(kind => kind !== 'walk') }));
        const missing = compileWorldDefinition(edge); expect(missing.floorAt(cell)).toBeDefined(); expect(missing.floorAt({ x: .46, z: 2 })).toBeUndefined();
        expect(hasAuthoredPlacementSupport(missing, cell)).toBe(false);
    });

    it('retains ordinary dry placement and does not turn floor support into acquired rights', () => {
        const world = compileWorldDefinition(waterSupportDefinition(false)), state = newIsland('dry-footprint', 0);
        expect(hasAuthoredPlacementSupport(world, cell)).toBe(true); expect(canPlace(state, cell, undefined, world)).toBe(true);
        expect(hasAuthoredPlacementSupport(world, { x: .25, z: 2 })).toBe(true); expect(canPlace(state, { x: .25, z: 2 }, undefined, world)).toBe(false);
        expect(canPlace(state, cell)).toBe(true);
    });
});
