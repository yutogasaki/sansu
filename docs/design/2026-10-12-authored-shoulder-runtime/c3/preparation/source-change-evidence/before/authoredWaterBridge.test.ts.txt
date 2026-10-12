import { describe, expect, it } from 'vitest';
import { authoredBridgeHeightAt, composeAuthoredWaterBridges, type AuthoredWaterBridgeInput } from './authoredWaterBridge';
import { newIsland } from './island';
import nativeBridge from './nativeWaterBridgeProfile.json';
import type { Cell, GrowingState } from './types';
import { compileWorldDefinition, isWorldWalkEdgeSupported } from './worldDefinition';
import type { WorldDefinition, WorldFloor, WorldPoint } from './worldTypes';

function fixture({ rotated = false, landingGap = false, highWater = false, nonlinearMapping = false } = {}) {
    const mapRows = [[0, 0], [.13, .1], [.25, .31], [.37, .42], [1.5, 1.56]];
    const physicalX = (x: number) => {
        if (!nonlinearMapping) return x * 1.04;
        const i = mapRows.findIndex(row => row[0] >= Math.abs(x)), a = mapRows[Math.max(0, i - 1)], b = mapRows[i];
        return (x < 0 ? -1 : 1) * (a[1] + (b[1] - a[1]) * (Math.abs(x) - a[0]) / (b[0] - a[0] || 1));
    };
    const ground = (id: string, minX: number, maxX: number, minZ: number, maxZ: number, kind: 'ground' | 'water' = 'ground', y?: number): WorldFloor => {
        const knots = [minX, ...nonlinearMapping ? [-.37, -.25, -.13, 0, .13, .25, .37].filter(x => x > minX && x < maxX) : [], maxX], vertices = [], indices = [];
        for (let i = 0; i + 1 < knots.length; i++) {
            const offset = vertices.length;
            vertices.push(...[[knots[i], minZ], [knots[i + 1], minZ], [knots[i + 1], maxZ], [knots[i], maxZ]].map(([x, z]) => ({ cell: { x, z }, point: { x: physicalX(x), y: y ?? .02 * x, z } })));
            indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
        }
        return { id, kind, color: '#abcdef', vertices, indices };
    };
    const sites = [];
    for (let z = -3; z <= -1; z += .25) for (let x = -1; x <= 1; x += .25) sites.push({ id: `${x},${z}`, cell: { x, z }, floorId: 'ground', placement: Number.isInteger(x) && Number.isInteger(z) });
    const definition: WorldDefinition = { version: 1, id: 'bridge-original', source: { artifact: 'fixture-source.glb', sha256: 'a'.repeat(64) }, districts: [{ id: 'district', templateId: 'original',
        logicalOrigin: { x: rotated ? 10 : 0, z: rotated ? 10 : 0 }, worldOrigin: { x: rotated ? 20 : 0, y: rotated ? 2 : 0, z: rotated ? -10 : 0 }, turn: rotated ? 1 : 0,
        floors: [ground('ground', -1.5, 1.5, -3.5, -.5)], sites, ports: [], waterCarvingScopes: [{ id: 'explicit-original-ground', floorIds: ['ground'],
            envelope: [{ x: -1.5, z: -3.5 }, { x: 1.5, z: -3.5 }, { x: 1.5, z: -.5 }, { x: -1.5, z: -.5 }] }] }], edges: [] };
    const ids = new Set(sites.map(site => site.id));
    for (const site of sites) for (const [dx, dz] of [[.25, 0], [0, .25]]) {
        const id = `${site.cell.x + dx},${site.cell.z + dz}`;
        if (ids.has(id)) definition.edges.push({ from: { districtId: 'district', siteId: site.id }, to: { districtId: 'district', siteId: id }, allows: ['walk'] });
    }
    definition.edges.push({ from: { districtId: 'district', siteId: '0,-3' }, to: { districtId: 'district', siteId: '0,-2' }, allows: ['join', 'water'] });
    const base = compileWorldDefinition(definition), cell = (id: string): Cell => base.sites.find(site => site.ref.siteId === id)!.cell;
    const state: GrowingState = newIsland('bridge-owner', 0); state.plots = []; state.keepsakes = []; state.landmarks = [
        { id: 'upstream', kind: 'water-bowl', growth: 18, cell: cell('0,-3') }, { id: 'terminal', kind: 'water-channel', growth: 18, cell: cell('0,-2') },
    ];
    const cutDefinition = structuredClone(definition), district = cutDefinition.districts[0];
    district.anchorFloors = district.floors;
    district.sites = district.sites.map(site => ({ ...site, anchorPoint: { x: physicalX(site.cell.x), y: site.cell.x * .02, z: site.cell.z } }));
    district.floors = [ground('left', -1.5, -.135, -3.5, -.5), ground('right', .135, 1.5, -3.5, -.5),
        ground('lower', -.135, .135, -2, -.5), ground('wet', -.135, .135, -3.5, -2, 'water', highWater ? .6 : .025), ground('bed', -.135, .135, -3.5, -2, 'ground', -.155)];
    if (landingGap) district.floors = district.floors.filter(floor => floor.id !== 'left').concat([
        ground('left-a', -1.5, -.135, -3.5, -1.929), ground('left-b', -1.5, -.135, -1.921, -.5),
    ]);
    cutDefinition.edges = cutDefinition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
    const cut = compileWorldDefinition(cutDefinition), from = base.anchorAt(cell('0,-3'))!, to = base.anchorAt(cell('0,-2'))!, floorId = (id: string) => JSON.stringify(['district', id]);
    const localOutline = [[physicalX(-.135), -3.5], [physicalX(.135), -3.5], [physicalX(.135), -2], [physicalX(-.135), -2]].map(([x, z]) => ({ x, y: .025, z }));
    const worldPoint = (p: WorldPoint): WorldPoint => rotated ? { x: 20 - p.z, y: p.y + 2, z: p.x - 10 } : p;
    const water: AuthoredWaterBridgeInput = { ownerIds: ['upstream', 'terminal'], pools: [], grottos: [], streams: [{ id: 'stream', ownerIds: ['upstream', 'terminal'], from, to,
        width: .27, falling: false, centerline: [from, to], outline: localOutline.map(worldPoint), waterFloorIds: [floorId('wet')], bedFloorIds: [floorId('bed')] }] };
    return { base, cut, state, water, cell, floorId };
}

describe('source-shaped actual authored water bridges', () => {
    it('supports the real original foot bands with one continuous arch without adding rights or edges', () => {
        const { base, cut, state, water, cell } = fixture(), original = structuredClone(base.definition), saved = structuredClone(state);
        // The source IDs are decimal strings, independent of any specific owner ID.
        const left = [cell('-0.25,-2'), cell('-0.25,-1.75')], right = [cell('0.25,-2'), cell('0.25,-1.75')];
        expect(isWorldWalkEdgeSupported(cut, left[0], left[1])).toBe(false);
        expect(isWorldWalkEdgeSupported(cut, right[0], right[1])).toBe(false);
        const result = composeAuthoredWaterBridges(state, base, cut, water), world = compileWorldDefinition(result.definition);
        expect(result.bridges).toHaveLength(1);
        const bridge = result.bridges[0];
        expect(bridge.ownerId).toBe('terminal'); expect(bridge.sourceId).toBe(nativeBridge.source.id); expect(bridge.sourceSHA).toBe(nativeBridge.source.sha256);
        expect(bridge.span).toBeGreaterThan(.74); expect(bridge.width).toBeGreaterThanOrEqual(nativeBridge.width);
        expect(bridge.restoredEdgeIds.length).toBeGreaterThan(1);
        expect(isWorldWalkEdgeSupported(world, left[0], left[1])).toBe(true);
        expect(isWorldWalkEdgeSupported(world, right[0], right[1])).toBe(true);
        expect(world.definition.edges).toEqual(cut.definition.edges);
        expect(world.sites.map(site => [site.ref, site.cell, site.point, site.placement])).toEqual(base.sites.map(site => [site.ref, site.cell, site.point, site.placement]));
        expect(world.definition.source).toEqual(base.definition.source);
        const floor = world.floors.find(floor => floor.id === bridge.deckFloorId)!;
        expect(floor.kind).toBe('deck'); expect(floor.color).toBe(nativeBridge.material.color);
        for (let i = 0; i < floor.indices.length; i += 3) {
            const [a, b, c] = floor.indices.slice(i, i + 3).map(index => floor.vertices[index].point);
            expect((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)).toBeLessThan(0);
        }
        for (const vertex of floor.vertices) {
            const localX = (vertex.point.x - bridge.center.x) * Math.cos(bridge.yaw) - (vertex.point.z - bridge.center.z) * Math.sin(bridge.yaw);
            expect(vertex.point.y).toBeCloseTo(authoredBridgeHeightAt(bridge, localX), 7);
        }
        for (let i = 0; i <= 200; i++) {
            const localX = (i / 200 - .5) * bridge.span, point = { x: bridge.center.x + localX * Math.cos(bridge.yaw), z: bridge.center.z - localX * Math.sin(bridge.yaw) }, at = base.logicalAt(point)!;
            const support = world.sampleFloorAt(at, bridge.deckFloorId)!;
            expect(support).toBeDefined(); expect(support.point.x).toBeCloseTo(point.x, 8); expect(support.point.z).toBeCloseTo(point.z, 8);
            expect(support.point.y).toBeCloseTo(authoredBridgeHeightAt(bridge, localX), 7);
            const wet = world.sampleFloorAt(at, water.streams[0].waterFloorIds[0]);
            if (wet) expect(support.point.y - wet.point.y).toBeGreaterThanOrEqual(.018 - 1e-8);
        }
        const centerCell = base.logicalAt(bridge.center)!;
        expect(world.floorAt(centerCell)?.floorId).toBe(bridge.deckFloorId);
        expect(base.definition).toEqual(original); expect(state).toEqual(saved);
        expect(world.sampleFloorAt(cell('0,-2.75'), water.streams[0].waterFloorIds[0])).toBeDefined();
        expect(world.floorAt(cell('0,-2.75'))).toBeUndefined();
    });

    it('uses the same source profile and original mapping in a turned translated district', () => {
        const ordinary = fixture(), turned = fixture({ rotated: true });
        const a = composeAuthoredWaterBridges(ordinary.state, ordinary.base, ordinary.cut, ordinary.water), b = composeAuthoredWaterBridges(turned.state, turned.base, turned.cut, turned.water);
        expect(a.bridges).toHaveLength(1); expect(b.bridges).toHaveLength(1);
        expect(b.bridges[0].span).toBe(a.bridges[0].span); expect(b.bridges[0].width).toBe(a.bridges[0].width);
        expect(b.bridges[0].yaw).toBeCloseTo(a.bridges[0].yaw - Math.PI / 2, 8);
        expect(b.bridges[0].deckY).toBeCloseTo(a.bridges[0].deckY + 2, 8);
        const world = compileWorldDefinition(b.definition);
        expect(isWorldWalkEdgeSupported(world, turned.cell('-0.25,-2'), turned.cell('-0.25,-1.75'))).toBe(true);
        expect(world.anchorAt(turned.cell('0,-2'))).toEqual(turned.base.anchorAt(turned.cell('0,-2')));
    });

    it('uses the actual mapped foot band when a nonlinear source moves its midpoint beyond a logical-width estimate', () => {
        const f = fixture({ nonlinearMapping: true }), from = f.cell('-0.25,-2'), to = f.cell('-0.25,-1.75');
        expect(Math.abs(f.base.anchorAt(from)!.x)).toBeGreaterThan(f.water.streams[0].width / 2 + .12 + .015);
        expect(isWorldWalkEdgeSupported(f.cut, from, to)).toBe(false);
        const result = composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water);
        expect(result.bridges).toHaveLength(1);
        expect(isWorldWalkEdgeSupported(compileWorldDefinition(result.definition), from, to)).toBe(true);
    });

    it('rejects a thin unsupported landing, excessive water height and protected occupants', () => {
        for (const options of [{ landingGap: true }, { highWater: true }]) {
            const f = fixture(options); expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water).bridges).toEqual([]);
        }
        const f = fixture();
        f.state.plots.push({ id: 'home', kind: 'home', cell: f.cell('1,-2'), growth: 18, stage: 3, plantedAt: 0, origin: 'seed', paid: 40 });
        const blocked = composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water);
        // Move that same home onto the bridge's dry landing region; no water
        // or ownership is granted as a workaround.
        f.state.plots[0].cell = f.cell('0,-2');
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water).bridges).toEqual([]);
        expect(blocked.bridges).toHaveLength(1);
    });

    it('does not build without a retained owner, actual water crossing, source walk edges or a terminal', () => {
        const f = fixture(), first = composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water);
        expect(first.bridges).toHaveLength(1);
        const stored = structuredClone(f.state); delete stored.landmarks.find(owner => owner.id === 'terminal')!.cell;
        expect(composeAuthoredWaterBridges(stored, f.base, f.cut, f.water).bridges).toEqual([]);
        const split = { ...f.water, streams: [] };
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, split).bridges).toEqual([]);
        expect(composeAuthoredWaterBridges(f.state, f.base, f.base, f.water).bridges).toEqual([]);
        const junction = { ...f.water, streams: [...f.water.streams, { ...f.water.streams[0], id: 'second' }] };
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, junction).bridges).toEqual([]);
        const noEdges = compileWorldDefinition({ ...f.base.definition, edges: f.base.definition.edges.filter(edge => !edge.allows.includes('walk')) });
        expect(composeAuthoredWaterBridges(f.state, noEdges, f.cut, f.water).bridges).toEqual([]);
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water)).toEqual(first);
    });

    it('keeps a basin and the supported mineral base clear of the bridge body', () => {
        const f = fixture(), result = composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water), bridge = result.bridges[0];
        f.water.grottos = [{ ownerId: 'ore-owner', pivot: bridge.center, scale: 1, yaw: 0, surfaceIds: [], footprint: bridge.outline }];
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water).bridges).toEqual([]);
        f.water.grottos = [];
        f.water.pools = [{ ownerId: 'bowl-owner', ownerIds: ['bowl-owner'], districtId: 'district', center: bridge.center, radius: .3,
            waterY: .025, bedY: -.155, outline: bridge.outline, outerOutline: bridge.outline, sourceRole: 'upper', axes: [.3, .3, .3, .3], waterFloorId: f.floorId('wet'), bedFloorId: f.floorId('bed'), color: '#abc', bedColor: '#def' }];
        expect(composeAuthoredWaterBridges(f.state, f.base, f.cut, f.water).bridges).toEqual([]);
    });
});
