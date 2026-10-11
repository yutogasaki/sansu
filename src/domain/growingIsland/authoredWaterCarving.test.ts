import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { authoredAccessWorld } from './authoredWorldAccess.fixture';
import { authoredWaterCarvingFloorIds, isAuthoredWaterCarvingSafe, withNative05WaterCarvingScope } from './authoredWaterCarving';
import { compileWorldDefinition } from './worldDefinition';
import type { WorldDefinition, WorldPoint } from './worldTypes';

const physical = (cells: readonly { x: number; z: number }[], y = 0): WorldPoint[] => cells.map(cell => ({ ...cell, y }));
const rectangle = (x0: number, x1: number, z0: number, z1: number) => physical([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
function source(scoped = true) {
    const { definition } = authoredAccessWorld(), district = definition.districts[0];
    definition.districts = [{ ...district, sites: district.sites.map(site => ({ ...site, placement: site.cell.x === 1 && site.cell.z === -1 })),
        waterCarvingScopes: scoped ? [{ id: 'hill', floorIds: ['sloped-ground'], envelope: rectangle(.5, 3.5, -2.5, .5) }] : undefined }];
    return compileWorldDefinition(definition);
}

describe('explicit water carving uses original ground without granting acquired sites', () => {
    it('permits actual unplantable ground only inside an explicit scope and keeps old strict bounds otherwise', () => {
        const wide = source(), strict = source(false), outline = rectangle(2.1, 2.4, -1.3, -.7);
        expect(wide.floorAt({ x: 2.25, z: -1 })).toBeDefined(); expect(wide.owns({ x: 2, z: -1 })).toBe(false);
        expect(isAuthoredWaterCarvingSafe(wide, 'authored-access', outline, [])).toBe(true);
        expect(isAuthoredWaterCarvingSafe(strict, 'authored-access', outline, [])).toBe(false);
        expect(isAuthoredWaterCarvingSafe(strict, 'authored-access', rectangle(.8, 1.2, -1.2, -.8), [])).toBe(true);
        expect(isAuthoredWaterCarvingSafe(wide, 'authored-access', rectangle(3.4, 3.6, -1.2, -.8), [])).toBe(false);
        expect(isAuthoredWaterCarvingSafe(wide, 'other-district', outline, [])).toBe(false);
        expect(authoredWaterCarvingFloorIds(wide, 'authored-access')).toEqual([JSON.stringify(['authored-access', 'sloped-ground'])]);
        expect(authoredWaterCarvingFloorIds(strict, 'authored-access')).toBeUndefined();
    });

    it('rejects a completely enclosed owner/door and a thin interior crossing missed by boundary samples', () => {
        const world = source(), outline = rectangle(.6, 3.4, -2.4, .4);
        for (const protection of [{ cell: { x: 2, z: -1 }, half: .46 }, { cell: { x: 2, z: -.25 }, half: .18 }, { cell: { x: 1.53, z: -1 }, half: .015 }]) {
            expect(outline.every(p => Math.abs(p.x - protection.cell.x) > protection.half || Math.abs(p.z - protection.cell.z) > protection.half)).toBe(true);
            expect(isAuthoredWaterCarvingSafe(world, 'authored-access', outline, [protection])).toBe(false);
        }
        expect(isAuthoredWaterCarvingSafe(world, 'authored-access', outline, [{ cell: { x: 4, z: 2 }, half: .58 }])).toBe(true);
        const concave = physical([{ x: .6, z: -2 }, { x: 3.4, z: -2 }, { x: 3.4, z: .4 }, { x: 2.2, z: .4 }, { x: 2.2, z: -.7 }, { x: .6, z: -.7 }]);
        expect(isAuthoredWaterCarvingSafe(world, 'authored-access', concave, [{ cell: { x: 1.2, z: 0 }, half: .18 }])).toBe(true);
        expect(isAuthoredWaterCarvingSafe(world, 'authored-access', concave, [{ cell: { x: 2.8, z: 0 }, half: .18 }])).toBe(false);
    });

    it('uses each original triangle physical/logical mapping and district turn instead of physical rectangles for owners', () => {
        const { definition } = authoredAccessWorld(), district = definition.districts[0];
        definition.districts = [{ ...district, turn: 1, logicalOrigin: { x: 10, z: 20 }, worldOrigin: { x: 100, y: 5, z: 200 },
            floors: district.floors.map(floor => ({ ...floor, vertices: floor.vertices.map(vertex => ({ ...vertex, point: { ...vertex.point, x: vertex.point.x * 2, z: vertex.point.z * 3 } })) })),
            waterCarvingScopes: [{ id: 'hill', floorIds: ['sloped-ground'], envelope: rectangle(.5, 3.5, -2.5, .5) }] }];
        const world = compileWorldDefinition(definition), outline = rectangle(10.7, 11.3, 21.7, 22.3).map(cell => world.floorAt(cell)!.point);
        expect(isAuthoredWaterCarvingSafe(world, 'authored-access', outline, [])).toBe(true);
        expect(isAuthoredWaterCarvingSafe(world, 'authored-access', outline, [{ cell: { x: 11, z: 22 }, half: .18 }])).toBe(false);
    });

    it('does not fill an interior missing floor or accept malformed geometry/source IDs', () => {
        const definition: WorldDefinition = { version: 1, id: 'gap', edges: [], districts: [{ id: 'gap', templateId: 'gap', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
            floors: [{ id: 'ground', kind: 'ground', color: '#aabbcc', vertices: [...rectangle(0, .9, 0, 2), ...rectangle(1.1, 2, 0, 2)].map(point => ({ point, cell: { x: point.x, z: point.z } })),
                indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7] }], sites: [{ id: 'site', cell: { x: 0, z: 0 }, floorId: 'ground', placement: true }], ports: [],
            waterCarvingScopes: [{ id: 'gap', floorIds: ['ground'], envelope: rectangle(0, 2, 0, 2) }] }] };
        const world = compileWorldDefinition(definition);
        expect(isAuthoredWaterCarvingSafe(world, 'gap', rectangle(.2, 1.8, .2, 1.8), [])).toBe(false);
        expect(isAuthoredWaterCarvingSafe(world, 'gap', rectangle(.2, .8, .2, 1.8), [])).toBe(true);
        expect(isAuthoredWaterCarvingSafe(world, 'gap', rectangle(-1e9, 1e9, -1e9, 1e9), [])).toBe(false);
        for (const outline of [rectangle(2 ** 53, 2 ** 53 + 4, 0, 1), rectangle(0, 1, 2 ** 53, 2 ** 53 + 4)]) {
            expect(isAuthoredWaterCarvingSafe(world, 'gap', outline, [])).toBe(false);
            expect(isAuthoredWaterCarvingSafe(world, 'unknown', outline, [{ cell: { x: 0, z: 0 }, half: 1 }])).toBe(false);
        }
        expect(isAuthoredWaterCarvingSafe(world, 'gap', physical([{ x: .2, z: .2 }, { x: .8, z: 1.8 }, { x: .8, z: .2 }, { x: .2, z: 1.8 }]), [])).toBe(false);
        const unknown = structuredClone(definition), d = unknown.districts[0]; unknown.districts = [{ ...d, waterCarvingScopes: [{ id: 'bad', floorIds: ['unknown'], envelope: rectangle(0, 2, 0, 2) }] }];
        expect(() => compileWorldDefinition(unknown)).toThrow('water carving original ground');
        const bad = structuredClone(definition); bad.districts = [{ ...d, waterCarvingScopes: [{ id: 'bad', floorIds: ['ground'], envelope: physical([{ x: 0, z: 0 }, { x: NaN, z: 1 }, { x: 1, z: 0 }]) }] }];
        expect(() => compileWorldDefinition(bad)).toThrow('water carving envelope');
    });

    it('adds the native05 DEV scope without changing any floor, site, anchor or explicit passage', () => {
        const base = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString()));
        const scoped = withNative05WaterCarvingScope(base);
        expect(scoped.id).toBe(base.id); expect(scoped.definition.source).toEqual(base.definition.source); expect(scoped.definition.edges).toEqual(base.definition.edges);
        expect(scoped.floors).toEqual(base.floors); expect(scoped.sites).toEqual(base.sites); expect(scoped.sites.filter(site => site.placement)).toHaveLength(73);
        expect(base.definition.districts[0].waterCarvingScopes).toBeUndefined(); expect(scoped.definition.districts[0].waterCarvingScopes).toHaveLength(1);
        const outline = rectangle(4.9, 5.1, -8.1, -7.9);
        expect(base.owns({ x: 5, z: -8 })).toBe(false); expect(isAuthoredWaterCarvingSafe(base, 'native05-inlet-core', outline, [])).toBe(false);
        expect(isAuthoredWaterCarvingSafe(scoped, 'native05-inlet-core', outline, [])).toBe(true);
        expect(() => withNative05WaterCarvingScope(source())).toThrow('fixed original world');
    });
});
