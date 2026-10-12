import { describe, expect, it } from 'vitest';
import { compileWorldDefinition } from './worldDefinition';
import { availableAuthoredDistrictPorts, composeAuthoredDistrictWorld, planAuthoredDistrict, type AuthoredDistrictCatalog, type AuthoredDistrictTemplate } from './authoredDistrictWorld';
import type { WorldDistrict } from './worldTypes';
import type { Cell } from './types';

const source = { artifact: 'authored-test-fixture', sha256: 'a'.repeat(64) };
function template(id: string, hill = 0): AuthoredDistrictTemplate {
    const vertices = [-1.3, 0, 1.3].flatMap(z => [-1.3, 0, 1.3].map(x => ({ cell: { x, z }, point: { x, y: x === 0 && z === 0 ? hill : 0, z }, normal: { x: 0, y: 1, z: 0 } })));
    const indices = [0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8];
    const district: WorldDistrict = { id, templateId: id, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [{ id: 'ground', kind: 'ground', vertices, indices, color: '#a1b7b0' }],
        sites: [{ id: 'center', cell: { x: 0, z: 0 }, floorId: 'ground', placement: true },
            { id: 'east', cell: { x: 1, z: 0 }, floorId: 'ground', placement: false },
            { id: 'west', cell: { x: -1, z: 0 }, floorId: 'ground', placement: false },
            { id: 'north', cell: { x: 0, z: -1 }, floorId: 'ground', placement: false }], ports: [] };
    return { id, label: id, district, ports: [{ id: 'east', siteId: 'east', facing: 0 }, { id: 'west', siteId: 'west', facing: 2 }, { id: 'north', siteId: 'north', facing: 3 }],
        edges: ['east', 'west', 'north'].map(siteId => ({ from: { districtId: id, siteId: 'center' }, to: { districtId: id, siteId }, allows: ['walk'] })) };
}
function fixture() {
    const seed = template('base'), catalog: AuthoredDistrictCatalog = { version: 1, candidate: 'test-regions-v1', source,
        templates: [template('shore'), template('hill', .4)], basePorts: seed.ports.map(port => ({ ...port, districtId: seed.id })) };
    return { base: compileWorldDefinition({ version: 1, id: 'world', source, districts: [seed.district], edges: seed.edges }), catalog };
}
describe('authored district assembly', () => {
    it('makes three different outlines from the same acquired shapes while retaining the starting district', () => {
        const { base, catalog } = fixture(), before = JSON.stringify(base.definition);
        const results = ['east', 'north', 'west'].map(portId => {
            const first = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId } });
            return planAuthoredDistrict(base, catalog, first.grants, { id: 'land-2', templateId: 'hill', parent: { districtId: 'land-1', portId: 'east' } });
        });
        expect(new Set(results.map(result => JSON.stringify(result.world.bounds))).size).toBe(3);
        for (const result of results) {
            expect(result.world.definition.districts[0]).toEqual(base.definition.districts[0]);
            expect(result.world.sites.filter(site => site.placement)).toHaveLength(3);
            expect(result.world.anchorAt({ x: 0, z: 0 })).toEqual(base.anchorAt({ x: 0, z: 0 }));
            const visit = [{ x: 0, z: 0 }], seen = new Set(['0,0']);
            for (let i = 0; i < visit.length; i++) for (const cell of result.world.neighbors(visit[i], 'walk')) {
                const key = `${cell.x},${cell.z}`; if (!seen.has(key)) { seen.add(key); visit.push(cell); }
            }
            expect(result.world.sites.filter(site => site.placement).every(site => seen.has(`${site.cell.x},${site.cell.z}`))).toBe(true);
            expect(composeAuthoredDistrictWorld(base, catalog, result.grants).definition).toEqual(result.world.definition);
        }
        expect(JSON.stringify(base.definition)).toBe(before);
    });
    it('keeps entry geometry and walking separate from ownership, joining and water', () => {
        const { base, catalog } = fixture();
        const result = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'hill', parent: { districtId: 'base', portId: 'east' } });
        const bridge = result.world.definition.districts.find(district => district.id === 'land-1:entry')!;
        expect(bridge.floors[0].indices.length).toBeGreaterThan(0);
        expect(bridge.surfaces![0].indices.length).toBeGreaterThan(0);
        expect(bridge.sites.every(site => !site.placement)).toBe(true);
        const middle = bridge.sites[Math.floor(bridge.sites.length / 2)].cell;
        expect(result.world.floorAt(middle)).toBeDefined();
        expect(result.world.owns(middle)).toBe(false);
        expect(result.world.neighbors(middle, 'water')).toHaveLength(0);
        expect(result.world.neighbors(middle, 'join')).toHaveLength(0);
        expect(result.world.definition.districts.find(district => district.id === 'land-1')!.floors).toEqual(catalog.templates[1].district.floors);
    });
    it('does not consume a port during preview and rejects reuse after confirmation', () => {
        const { base, catalog } = fixture(), grants: [] = [];
        const result = planAuthoredDistrict(base, catalog, grants, { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } });
        expect(grants).toEqual([]);
        expect(availableAuthoredDistrictPorts(base, catalog, grants)).toHaveLength(3);
        expect(availableAuthoredDistrictPorts(base, catalog, result.grants).some(port => port.districtId === 'land-1' && port.id === 'west')).toBe(false);
        expect(() => planAuthoredDistrict(base, catalog, result.grants, { id: 'land-2', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } })).toThrow('occupied');
        expect(composeAuthoredDistrictWorld(base, catalog, [])).toBe(base);
    });
    it('reuses fine landing points and their existing walking edges without granting extra land', () => {
        const { base: original, catalog } = fixture(), definition = structuredClone(original.definition);
        const district = definition.districts[0];
        definition.districts = [{ ...district, sites: [...district.sites, { id: 'shore-step', cell: { x: 1.25, z: 0 }, floorId: 'ground', placement: false }] }];
        definition.edges = [...definition.edges, { from: { districtId: 'base', siteId: 'east' }, to: { districtId: 'base', siteId: 'shore-step' }, allows: ['walk'] }];
        const base = compileWorldDefinition(definition);
        const result = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } });
        expect(result.world.sites.filter(site => site.cell.x === 1.25 && site.cell.z === 0)).toHaveLength(1);
        expect(result.world.anchorAt({ x: 1.25, z: 0 })).toEqual(base.anchorAt({ x: 1.25, z: 0 }));
        expect(result.world.owns({ x: 1.25, z: 0 })).toBe(false);
    });
    it('keeps authored terrain at its sea datum when the existing entrance is higher', () => {
        const { base: original, catalog } = fixture(), definition = structuredClone(original.definition);
        definition.districts = definition.districts.map(district => ({ ...district, worldOrigin: { ...district.worldOrigin, y: 1.2 } }));
        const base = compileWorldDefinition(definition);
        const result = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } });
        expect(result.grant.worldOrigin.y).toBe(0);
        expect(result.world.floorAt(result.grant.logicalOrigin)!.point.y).toBe(0);
        expect(result.world.anchorAt({ x: 1, z: 0 })).toEqual(base.anchorAt({ x: 1, z: 0 }));
        expect(result.world.definition.districts.find(district => district.id === 'land-1:entry')!.sites.length).toBeGreaterThan(3);
    });
    it('rejects tampered overlap, unknown sources, invalid ports and altered old support', () => {
        const { base, catalog } = fixture();
        const { grant } = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } });
        expect(() => composeAuthoredDistrictWorld(base, catalog, [{ ...grant, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 } }])).toThrow('overlaps');
        expect(() => composeAuthoredDistrictWorld(base, { ...catalog, source: { ...source, sha256: 'b'.repeat(64) } }, [])).toThrow('source differs');
        expect(() => planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'unknown' } })).toThrow('missing');
        expect(() => composeAuthoredDistrictWorld(base, catalog, [{ ...grant, turn: 1 }])).toThrow('face each other');
        expect(() => composeAuthoredDistrictWorld(base, catalog, [{ ...grant, worldOrigin: { ...grant.worldOrigin, y: .3 } }])).toThrow();
        expect(() => composeAuthoredDistrictWorld(base, catalog, [{ ...grant, logicalOrigin: { ...grant.logicalOrigin, x: grant.logicalOrigin.x + 1000 },
            worldOrigin: { ...grant.worldOrigin, x: grant.worldOrigin.x + 1000 } }])).toThrow('fixed port alignment');
    });
    it('rejects a crossing over a tiny unowned floor between the walking samples', () => {
        const { base, catalog } = fixture();
        const { grant } = planAuthoredDistrict(base, catalog, [], { id: 'land-1', templateId: 'shore', parent: { districtId: 'base', portId: 'east' } });
        const original = base.definition.districts[0];
        const fragment: WorldDistrict = { ...original, id: 'fragment', sites: [], ports: [], floors: [{ id: 'tiny', kind: 'ground', color: '#aabbcc',
            vertices: [[2.1, -.05], [2.1, .05], [2.15, -.05], [2.15, .05]].map(([x, z]) => ({ cell: { x, z }, point: { x, y: -.1, z } })), indices: [0, 1, 2, 1, 3, 2] }] };
        const changed = compileWorldDefinition({ ...base.definition, districts: [original, fragment] });
        expect(() => composeAuthoredDistrictWorld(changed, catalog, [{ ...grant, logicalOrigin: { ...grant.logicalOrigin, x: grant.logicalOrigin.x + 2 },
            worldOrigin: { ...grant.worldOrigin, x: grant.worldOrigin.x + 2 } }])).toThrow('crosses existing terrain');
    });
});

const rectangle = (minX: number, maxX: number, minZ: number, maxZ: number): Cell[] => [
    { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ },
];
function growingFixture(logical = rectangle(1.2, 3.4, .3, 1.25), physical = logical) {
    const { base, catalog: original } = fixture(), shore = template('growing');
    const catalog: AuthoredDistrictCatalog = { ...original, templates: [
        { ...shore, growthReservation: { logical, physical } }, template('plain'),
    ] };
    return { base, catalog };
}
describe('acquired growth reservations', () => {
    it('reserves the mature outline before any sapling exists while retaining old floors and rights', () => {
        const { base, catalog } = growingFixture(), before = JSON.stringify([base.definition, catalog]);
        const first = planAuthoredDistrict(base, catalog, [], { id: 'young-shore', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } });
        const old = JSON.stringify([first.grants, first.world.definition]);
        const result = planAuthoredDistrict(base, catalog, first.grants, { id: 'later', templateId: 'plain', parent: { districtId: 'young-shore', portId: 'east' } });
        expect(first.grant.logicalOrigin).toEqual({ x: 3, z: 0 });
        expect(result.grant.logicalOrigin).toEqual({ x: 8, z: 0 });
        expect(result.grants[0]).toEqual(first.grant);
        expect(result.world.definition.districts.slice(0, first.world.definition.districts.length)).toEqual(first.world.definition.districts);
        expect(result.world.sites.filter(site => site.placement)).toHaveLength(3);
        expect(result.world.floorAt({ x: 5, z: .8 })).toBeUndefined();
        expect(result.world.owns({ x: 5, z: .8 })).toBe(false);
        expect(result.world.neighbors({ x: 5, z: .8 }, 'walk')).toEqual([]);
        expect(result.world.neighbors({ x: 5, z: .8 }, 'join')).toEqual([]);
        expect(result.world.neighbors({ x: 5, z: .8 }, 'water')).toEqual([]);
        for (const site of first.world.sites) expect(result.world.anchorAt(site.cell)).toEqual(first.world.anchorAt(site.cell));
        expect(composeAuthoredDistrictWorld(base, catalog, result.grants).definition).toEqual(result.world.definition);
        expect(JSON.stringify([first.grants, first.world.definition])).toBe(old);
        expect(JSON.stringify([base.definition, catalog])).toBe(before);
    });
    it.each(['logical', 'physical'] as const)('checks the %s envelope after a quarter turn with separate physical coordinates', frame => {
        const distant = rectangle(1.2, 1.3, .3, .4), reserved = rectangle(1.2, 3.4, .3, 1.25);
        const { base: originalBase, catalog: original } = growingFixture(frame === 'logical' ? reserved : distant, frame === 'physical' ? reserved : distant);
        const shift = { x: 11, z: -7 };
        const base = compileWorldDefinition({ ...originalBase.definition, districts: originalBase.definition.districts.map(district => ({ ...district,
            worldOrigin: { x: shift.x, y: 0, z: shift.z } })) });
        const first = planAuthoredDistrict(base, original, [], { id: 'north-shore', templateId: 'growing', parent: { districtId: 'base', portId: 'north' } });
        const result = planAuthoredDistrict(base, original, first.grants, { id: 'north-next', templateId: 'plain', parent: { districtId: 'north-shore', portId: 'east' } });
        expect(first.grant.turn).toBe(3);
        expect(result.grant.logicalOrigin).toEqual({ x: 0, z: -8 });
        expect(result.grant.worldOrigin).toEqual({ x: shift.x, y: 0, z: shift.z - 8 });
        const shortened = { ...result.grant, logicalOrigin: { x: 0, z: -6 }, worldOrigin: { x: shift.x, y: 0, z: shift.z - 6 } };
        expect(() => composeAuthoredDistrictWorld(base, original, [...first.grants, shortened])).toThrow('growth reservation overlaps new terrain');
    });
    it('rejects new reservations over acquired floor but allows its own base floor to meet its growth', () => {
        const { base, catalog } = growingFixture(rectangle(-3, -1.2, .3, 1.25));
        const result = planAuthoredDistrict(base, catalog, [], { id: 'growing', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } });
        expect(result.grant.logicalOrigin.x).toBe(5);
        const shortened = { ...result.grant, logicalOrigin: { x: 3, z: 0 }, worldOrigin: { x: 3, y: 0, z: 0 } };
        expect(() => composeAuthoredDistrictWorld(base, catalog, [shortened])).toThrow('growth reservation overlaps acquired terrain');
    });
    it('rejects reservation-to-reservation intersection even where neither district has a floor', () => {
        const { base, catalog: original } = growingFixture(rectangle(1, 4, 2, 3));
        const catalog: AuthoredDistrictCatalog = { ...original, templates: [original.templates[0], {
            ...original.templates[1], growthReservation: { logical: rectangle(-2, -.5, 2, 3), physical: rectangle(-2, -.5, 2, 3) },
        }] };
        const first = planAuthoredDistrict(base, catalog, [], { id: 'growing', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } });
        const result = planAuthoredDistrict(base, catalog, first.grants, { id: 'next', templateId: 'plain', parent: { districtId: 'growing', portId: 'east' } });
        expect(result.grant.logicalOrigin.x).toBe(9);
        expect(result.world.floorAt({ x: 6, z: 2.5 })).toBeUndefined();
        expect(() => composeAuthoredDistrictWorld(base, catalog, [...first.grants, { ...result.grant,
            logicalOrigin: { x: 8, z: 0 }, worldOrigin: { x: 8, y: 0, z: 0 } }])).toThrow('another growth reservation');
    });
    it('tests actual triangle edges, allowing boundary contact and empty bounding-box corners', () => {
        const triangle = [{ x: 1, z: 1 }, { x: 4, z: 4 }, { x: 1, z: 4 }];
        const { base, catalog } = growingFixture(triangle);
        const first = planAuthoredDistrict(base, catalog, [], { id: 'growing', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } });
        const result = planAuthoredDistrict(base, catalog, first.grants, { id: 'later', templateId: 'plain', parent: { districtId: 'growing', portId: 'east' } });
        expect(result.grant.logicalOrigin.x).toBe(6);
        // These bounding boxes have positive overlap, but the slanted triangle leaves this corner empty.
        const boundary = rectangle(1, 4, 1.3, 3);
        const touchingCatalog: AuthoredDistrictCatalog = { ...catalog, templates: [{ ...catalog.templates[0],
            growthReservation: { logical: boundary, physical: boundary } }, catalog.templates[1]] };
        expect(() => composeAuthoredDistrictWorld(base, touchingCatalog, result.grants)).not.toThrow();
        // Move the tiny triangular tip to the second district's far edge, between sites.
        const tip = [{ x: 4.2999, z: 1.2999 }, { x: 4.3001, z: 1.2999 }, { x: 4.2999, z: 1.3001 }];
        const edgeCatalog: AuthoredDistrictCatalog = { ...catalog, templates: [{ ...catalog.templates[0],
            growthReservation: { logical: tip, physical: tip } }, catalog.templates[1]] };
        expect(() => composeAuthoredDistrictWorld(base, edgeCatalog, result.grants)).toThrow('growth reservation overlaps new terrain');
    });
    it('rejects a connection crossing a reserved region and leaves previous grants intact', () => {
        const { base, catalog } = growingFixture(rectangle(1.4, 1.6, -.1, .1));
        const first = planAuthoredDistrict(base, catalog, [], { id: 'growing', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } });
        const before = JSON.stringify(first.grants);
        expect(() => planAuthoredDistrict(base, catalog, first.grants, { id: 'later', templateId: 'plain', parent: { districtId: 'growing', portId: 'east' } })).toThrow('no supported district position');
        const without = { ...catalog, templates: catalog.templates.map(item => ({ ...item, growthReservation: undefined })) };
        const unreserved = planAuthoredDistrict(base, without, first.grants, { id: 'later', templateId: 'plain', parent: { districtId: 'growing', portId: 'east' } });
        expect(() => composeAuthoredDistrictWorld(base, catalog, unreserved.grants)).toThrow('growth reservation overlaps entry floor');
        expect(JSON.stringify(first.grants)).toBe(before);
        expect(composeAuthoredDistrictWorld(base, catalog, first.grants).definition).toEqual(first.world.definition);
    });
    it('does not permit its own entry to cross its future growth envelope', () => {
        const { base, catalog } = growingFixture(rectangle(-1.6, -1.4, -.1, .1));
        expect(() => planAuthoredDistrict(base, catalog, [], { id: 'growing', templateId: 'growing', parent: { districtId: 'base', portId: 'east' } })).toThrow('no supported district position');
    });
    it.each([
        [], [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }],
        [{ x: 0, z: 0 }, { x: Infinity, z: 0 }, { x: 0, z: 1 }],
        [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 1, z: .5 }, { x: 2, z: 2 }, { x: 0, z: 2 }],
        [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }, { x: 2, z: 0 }],
        [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 0 }],
    ].map(polygon => ({ polygon })))('rejects malformed reservations before granting anything (%#)', ({ polygon }) => {
        const { base, catalog } = growingFixture(polygon);
        expect(() => composeAuthoredDistrictWorld(base, catalog, [])).toThrow('growth reservation');
        expect(() => availableAuthoredDistrictPorts(base, catalog, [])).toThrow('growth reservation');
    });
});
