import { describe, expect, it } from 'vitest';
import { composeAuthoredWaterWorld } from './authoredWaterWorld';
import { decomposeWaterOutline, outlineArea, pointInWaterOutline } from './authoredWaterContour';
import { newIsland } from './island';
import { key } from './space';
import type { Cell, GrowingState } from './types';
import { compileWorldDefinition, isWorldWalkEdgeSupported, type IslandWorld } from './worldDefinition';
import type { WorldDefinition, WorldPoint } from './worldTypes';

function source({ water = true, rotated = false, narrowAcquisition = false, groundGap = false, longWaterEdge = false, carvingScope = false, sheared = false } = {}): IslandWorld {
    const sites = [];
    for (let z = -4; z <= -1; z += .25) for (let x = -1; x <= 7; x += .25) sites.push({
        id: `${x},${z}`, cell: { x, z }, floorId: groundGap ? x <= 1.28 ? 'left-ground' : 'right-ground' : 'source-ground',
        placement: Number.isInteger(x) && Number.isInteger(z) && (!narrowAcquisition || z === -2),
    });
    const ids = new Set(sites.map(site => site.id));
    const definition: WorldDefinition = { version: 1, id: 'water-source', source: { artifact: 'test-source.glb', sha256: 'a'.repeat(64) },
        districts: [{ id: 'shore', templateId: 'actual-source', logicalOrigin: { x: rotated ? 10 : 0, z: 0 },
            worldOrigin: { x: rotated ? 20 : 0, y: rotated ? 2 : 0, z: rotated ? -10 : 0 }, turn: rotated ? 1 : 0,
            sites, ports: [], waterCarvingScopes: carvingScope ? [{ id: 'explicit-test-hill', floorIds: ['source-ground'],
                envelope: [{ x: -1.5, z: -4.5 }, { x: 7.5, z: -4.5 }, { x: 7.5, z: -.5 }, { x: -1.5, z: -.5 }] }] : undefined, floors: (groundGap ? [['left-ground', -1.5, 1.28], ['right-ground', 1.46, 7.5]] as const
                : [['source-ground', -1.5, 7.5]] as const).map(([id, left, right]) => ({ id, kind: 'ground', color: '#b0c69a',
                vertices: [[left, -4.5], [right, -4.5], [right, -.5], [left, -.5]].map(([x, z]) => ({ cell: { x, z }, point: { x: x * 1.1 + (sheared ? .85 * (z + 2) : 0), y: x * .08, z: z * (narrowAcquisition ? .45 : sheared ? .45 : 1) } })),
                indices: [0, 2, 1, 0, 3, 2] })),
        }], edges: [] };
    for (const site of sites) for (const [dx, dz] of [[.25, 0], [0, .25], [1, 0], [0, 1]]) {
        const next = key({ x: site.cell.x + dx, z: site.cell.z + dz });
        if (!ids.has(next)) continue;
        if (dx === 1 || dz === 1) {
            if (!site.placement || !Number.isInteger(site.cell.x + dx) || !Number.isInteger(site.cell.z + dz)) continue;
            definition.edges.push({ from: { districtId: 'shore', siteId: site.id }, to: { districtId: 'shore', siteId: next },
                allows: water ? ['join', 'water'] : ['join'] });
        } else if (!groundGap) definition.edges.push({ from: { districtId: 'shore', siteId: site.id }, to: { districtId: 'shore', siteId: next }, allows: ['walk'] });
    }
    if (longWaterEdge) definition.edges.push({ from: { districtId: 'shore', siteId: '0,-2' }, to: { districtId: 'shore', siteId: '4,-2' }, allows: ['water'] });
    return compileWorldDefinition(definition);
}
function cellAt(base: IslandWorld, local: Cell) {
    return base.sites.find(site => site.ref.siteId === key(local))!.cell;
}
function owners(base: IslandWorld): GrowingState {
    const state = newIsland('water-test', 0); state.landmarks = []; state.plots = []; state.keepsakes = [];
    for (const [x, id, kind] of [[0, 'b0', 'water-bowl'], [1, 'c1', 'water-channel'], [2, 'b2', 'water-bowl'],
        [3, 'c3', 'water-channel'], [4, 'b4', 'water-bowl']] as const) state.landmarks.push({ id, kind, cell: cellAt(base, { x, z: -2 }), growth: 18 });
    return state;
}
function samePoint(actual: { x: number; y: number; z: number } | undefined, expected: { x: number; y: number; z: number }) {
    expect(actual).toBeDefined();
    for (const axis of ['x', 'y', 'z'] as const) expect(actual![axis]).toBeCloseTo(expected[axis], 8);
}
// Independent convex-footprint intersection for continuity assertions. Retain
// zero-area intersections so two adjacent trenches may share a real full mouth.
function convexIntersection(a: readonly WorldPoint[], b: readonly WorldPoint[]) {
    let out = [...a];
    for (let i = 0; i < b.length; i++) {
        const edge0 = b[i], edge1 = b[(i + 1) % b.length], input = out; out = [];
        const signed = (p: WorldPoint) => (edge1.x - edge0.x) * (p.z - edge0.z) - (edge1.z - edge0.z) * (p.x - edge0.x);
        for (let j = 0; j < input.length; j++) {
            const p = input[j], q = input[(j + 1) % input.length], dp = signed(p), dq = signed(q);
            if (dp >= -1e-8) out.push(p);
            if ((dp >= -1e-8) !== (dq >= -1e-8)) {
                const t = dp / (dp - dq);
                out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });
            }
        }
    }
    return { points: out, area: Math.abs(out.reduce((sum, p, i) => {
        const q = out[(i + 1) % out.length]; return sum + p.x * q.z - p.z * q.x;
    }, 0)) / 2, span: Math.max(0, ...out.flatMap(p => out.map(q => Math.hypot(p.x - q.x, p.z - q.z)))) };
}

function intersection(a: readonly WorldPoint[], b: readonly WorldPoint[]) {
    const intersections = decomposeWaterOutline(a).flatMap(left => decomposeWaterOutline(b).map(right => convexIntersection(left, right)));
    return { area: intersections.reduce((sum, result) => sum + result.area, 0), span: Math.max(0, ...intersections.map(result => result.span)) };
}

describe('pure authored water geometry composition', () => {
    it('interpolates the original shading field through cuts without changing support or copying grass normals to new beds', () => {
        const plain = source(), state = owners(plain), original = plain.definition.districts[0];
        const normalAt = ({ x, z }: WorldPoint) => ({ x: x * .01, y: .9, z: z * .02 });
        const sourceMaterial = { roughness: .78, metalness: 0, doubleSided: true };
        const shaded = compileWorldDefinition({ ...plain.definition, districts: [{ ...original, floors: original.floors.map(floor => ({ ...floor,
            vertices: floor.vertices.map(vertex => ({ ...vertex, normal: normalAt(vertex.point) })), material: sourceMaterial })) }] });
        const before = composeAuthoredWaterWorld(state, plain), after = composeAuthoredWaterWorld(state, shaded);
        const geometry = (world: IslandWorld) => world.floors.map(floor => ({ id: floor.id, kind: floor.kind, color: floor.color,
            indices: floor.indices, vertices: floor.vertices.map(({ cell, point }) => ({ cell, point })) }));
        expect(geometry(after.world)).toEqual(geometry(before.world)); expect(after.plan).toEqual(before.plan);
        expect(after.world.sites).toEqual(before.world.sites); expect(after.world.walkSites).toEqual(before.world.walkSites);
        const remaining = after.world.floors.find(floor => floor.id === shaded.floors[0].id)!;
        expect(remaining.vertices.length).toBeGreaterThan(shaded.floors[0].vertices.length);
        expect(remaining.material).toEqual(sourceMaterial);
        for (const vertex of remaining.vertices) {
            const expected = normalAt(vertex.point);
            for (const axis of ['x', 'y', 'z'] as const) expect(vertex.normal?.[axis]).toBeCloseTo(expected[axis], 8);
        }
        const added = after.world.floors.filter(floor => floor.id !== remaining.id);
        expect(added.some(floor => floor.kind === 'water')).toBe(true);
        expect(added.every(floor => !floor.material && floor.vertices.every(vertex => !vertex.normal))).toBe(true);
    });

    it('cuts real source triangles and keeps fixed acquired anchors over three different water/bed floors', () => {
        const base = source(), state = owners(base), definition = structuredClone(base.definition), saved = structuredClone(state);
        const { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3); expect([...plan.ownerIds].sort()).toEqual(['b0', 'b2', 'b4', 'c1', 'c3']);
        expect(plan.pools.every(pool => pool.color === '#287ca6')).toBe(true);
        expect(plan.pools.map(pool => pool.sourceRole)).toEqual(['upper', 'middle', 'lower']);
        expect(plan.pools.every(pool => pool.outline.length === 72)).toBe(true);
        expect(new Set(plan.pools.map(pool => pool.radius)).size).toBeGreaterThan(1);
        expect(world.id).toBe(base.id); expect(world.definition.source).toEqual(base.definition.source);
        expect(world.revision).toBe(plan.revision);
        expect(world.sites.map(site => [site.ref, site.cell, site.point, site.placement])).toEqual(base.sites.map(site => [site.ref, site.cell, site.point, site.placement]));
        for (const pool of plan.pools) {
            const owner = state.landmarks.find(owner => owner.id === pool.ownerId)!;
            expect(pool.center).toEqual(base.anchorAt(owner.cell!)); expect(world.owns(owner.cell!)).toBe(true);
            expect(world.anchorAt(owner.cell!)).toEqual(pool.center);
            expect(world.sampleFloorAt(owner.cell!, pool.waterFloorId)?.point.y).toBeCloseTo(pool.center.y + .025, 8);
            expect(world.sampleFloorAt(owner.cell!, pool.bedFloorId)?.point.y).toBeCloseTo(pool.waterY - .18, 8);
            expect(world.sampleFloorAt(owner.cell!, base.floors[0].id)).toBeUndefined();
            expect(world.floorAt(owner.cell!)).toBeUndefined();
            expect(world.logicalAt({ ...pool.center, y: pool.bedY })).toBeUndefined();
            expect(world.siteAt({ ...pool.center, y: pool.waterY })).toBeUndefined();
            expect(world.walkSites.some(site => key(site.cell) === key(owner.cell!))).toBe(false);
            expect(pool.outline.some(p => Math.abs(Math.hypot(p.x - pool.center.x, p.z - pool.center.z) - pool.radius) > .02)).toBe(true);
        }
        const dry = cellAt(base, { x: -1, z: -4 });
        expect(world.floorAt(dry)?.point).toEqual(base.floorAt(dry)?.point);
        expect(world.definition.districts[0].surfaces?.some(surface => surface.kind === 'bank')).toBe(true);
        expect(world.definition.districts[0].surfaces?.some(surface => surface.kind === 'flow')).toBe(true);
        expect(world.floors.every(floor => !floor.id.includes('bank') && !floor.id.includes('flow'))).toBe(true);
        expect(base.definition).toEqual(definition); expect(state).toEqual(saved);
        expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.pools[0].outline[0])).toBe(true);
    });

    it('retains only actually dry foot-band edges while leaving joining/water grants unchanged', () => {
        const base = source(), { world, plan } = composeAuthoredWaterWorld(owners(base), base);
        expect(plan.streams).toHaveLength(4);
        for (const stream of plan.streams) {
            expect(stream.waterFloorIds.length).toBeGreaterThan(0); expect(stream.bedFloorIds.length).toBeGreaterThan(0);
            const mid = { x: (stream.from.x + stream.to.x) / 2, z: (stream.from.z + stream.to.z) / 2 };
            expect(world.logicalAt(mid)).toBeUndefined();
        }
        for (const site of base.sites) for (const kind of ['join', 'water'] as const) expect(world.neighbors(site.cell, kind)).toEqual(base.neighbors(site.cell, kind));
        const cells = new Map(world.sites.map(site => [JSON.stringify([site.ref.districtId, site.ref.siteId]), site.cell]));
        for (const edge of world.definition.edges.filter(edge => edge.allows.includes('walk'))) {
            const from = cells.get(JSON.stringify([edge.from.districtId, edge.from.siteId]))!;
            const to = cells.get(JSON.stringify([edge.to.districtId, edge.to.siteId]))!;
            expect(isWorldWalkEdgeSupported(world, from, to)).toBe(true);
        }
        expect(world.definition.edges.filter(edge => edge.allows.includes('walk')).length).toBeLessThan(base.definition.edges.filter(edge => edge.allows.includes('walk')).length);
    });

    it('joins every organic pool mouth and adjacent channel cuts with actual continuous water', () => {
        const base = source(), state = owners(base), { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        for (const pool of plan.pools) for (const stream of plan.streams.filter(stream => stream.ownerIds.includes(pool.ownerId))) {
            expect(intersection(pool.outline, stream.outline).area).toBeGreaterThan(1e-6);
            const end = Math.hypot(stream.from.x - pool.center.x, stream.from.z - pool.center.z)
                < Math.hypot(stream.to.x - pool.center.x, stream.to.z - pool.center.z) ? stream.from : stream.to;
            const cell = base.logicalAt(end)!;
            expect(world.sampleFloorAt(cell, pool.waterFloorId)).toBeDefined();
            // Sample the whole centreline from inside the pool to the next
            // owner, including each falling part's shared boundary.
            const floors = [pool.waterFloorId, ...stream.waterFloorIds, ...plan.pools.filter(other => stream.ownerIds.includes(other.ownerId)).map(other => other.waterFloorId)];
            for (let i = 0; i <= 40; i++) {
                const point = { x: stream.from.x + (stream.to.x - stream.from.x) * i / 40, z: stream.from.z + (stream.to.z - stream.from.z) * i / 40 };
                const at = base.logicalAt(point)!;
                expect(floors.some(id => !!world.sampleFloorAt(at, id))).toBe(true);
            }
        }
        for (const channel of state.landmarks.filter(owner => owner.kind === 'water-channel')) {
            const adjoining = plan.streams.filter(stream => stream.ownerIds.includes(channel.id));
            expect(adjoining.length).toBeGreaterThan(1);
            for (let i = 0; i < adjoining.length; i++) for (let j = i + 1; j < adjoining.length; j++) {
                const footprint = intersection(adjoining[i].outline, adjoining[j].outline);
                expect(footprint.area > 1e-6 || footprint.span > .18).toBe(true);
            }
        }
    });

    it('resolves the existing cut floors at L/T junctions without duplicating water or creating support', () => {
        const base = source(), state = owners(base);
        const positions: Record<string, Cell> = { b0: { x: 0, z: -2 }, b2: { x: 1, z: -2 }, b4: { x: 3, z: -2 },
            c1: { x: 2, z: -2 }, c3: { x: 2, z: -3 } };
        state.landmarks.forEach(owner => { owner.cell = cellAt(base, positions[owner.id]); });
        const { world, plan } = composeAuthoredWaterWorld(state, base), branch = plan.streams.find(stream => stream.ownerIds.includes('c1') && stream.ownerIds.includes('c3'))!;
        expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        // The later vertical trench uses an earlier horizontal trench's actual
        // water at the T mouth. The floor ID remains that one shared mesh.
        const ownId = encodeURIComponent(`stream:${branch.id}`);
        expect(branch.waterFloorIds.some(id => !id.includes(ownId))).toBe(true);
        expect(new Set(branch.waterFloorIds).size).toBe(branch.waterFloorIds.length);
        for (const stream of plan.streams) for (let i = 0; i <= 40; i++) {
            const point = { x: stream.from.x + (stream.to.x - stream.from.x) * i / 40, z: stream.from.z + (stream.to.z - stream.from.z) * i / 40 };
            const cell = base.logicalAt(point)!;
            expect(stream.waterFloorIds.some(id => !!world.sampleFloorAt(cell, id))).toBe(true);
            expect(stream.bedFloorIds.some(id => !!world.sampleFloorAt(cell, id))).toBe(true);
            const support = world.floorAt(cell);
            if (support) expect(plan.bridges.some(bridge => bridge.deckFloorId === support.floorId)).toBe(true);
        }
        expect(world.floors.filter(floor => floor.kind === 'water').length).toBeLessThan(plan.streams.reduce((sum, stream) => sum + stream.waterFloorIds.length, 0));
        const junction = positions.c1;
        const generatedHere = world.floors.filter(floor => floor.kind === 'water' && world.sampleFloorAt(junction, floor.id));
        expect(generatedHere).toHaveLength(2); // two meeting arms; no new vertical duplicate
        expect(world.sites.filter(site => site.placement).map(site => site.cell)).toEqual(base.sites.filter(site => site.placement).map(site => site.cell));
    });

    it('keeps pool mouths and the whole shared junction level before the actual falling strips', () => {
        const base = source({ carvingScope: true }), state = owners(base);
        const positions: Record<string, Cell> = { b0: { x: 0, z: -2 }, b2: { x: 1, z: -2 }, b4: { x: 3, z: -2 },
            c1: { x: 2, z: -2 }, c3: { x: 2, z: -3 } };
        state.landmarks.forEach(owner => { owner.cell = cellAt(base, positions[owner.id]); });
        const { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        let flatPoolSamples = 0, fallingSamples = 0;
        for (const stream of plan.streams) {
            const vx = stream.to.x - stream.from.x, vz = stream.to.z - stream.from.z, length = Math.hypot(vx, vz);
            for (const p of stream.centerline) {
                // Height knots subdivide the accepted original eight XZ
                // segments; they never shrink or widen their physical outline.
                const t = ((p.x - stream.from.x) * vx + (p.z - stream.from.z) * vz) / (length * length), i = Math.min(7, Math.floor(t * 8 + 1e-8)), u = t * 8 - i;
                const bend = .035 * (Math.sin(Math.PI * i / 8) + (Math.sin(Math.PI * (i + 1) / 8) - Math.sin(Math.PI * i / 8)) * u);
                expect(p.x).toBeCloseTo(stream.from.x + vx * t + vz / length * bend, 8);
                expect(p.z).toBeCloseTo(stream.from.z + vz * t - vx / length * bend, 8);
            }
            for (let segment = 0; segment + 1 < stream.centerline.length; segment++) for (let i = 0; i <= 20; i++) {
                const a = stream.centerline[segment], b = stream.centerline[segment + 1], t = i / 20, point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, cell = base.logicalAt(point)!;
                const actual = stream.waterFloorIds.map(id => world.sampleFloorAt(cell, id)).filter(sample => !!sample);
                expect(actual.length).toBeGreaterThan(0);
                for (const sample of actual) expect(sample.point.y).toBeCloseTo(point.y, 7);
                const pool = plan.pools.find(pool => pointInWaterOutline(point, pool.outline));
                if (pool) { expect(point.y).toBeCloseTo(pool.waterY, 7); flatPoolSamples++; }
                if (Math.abs(a.y - b.y) > .001) fallingSamples++;
            }
            const surface = world.surfaces.find(surface => surface.id === JSON.stringify(['shore', `authored-water:flow:${encodeURIComponent(stream.id)}`]));
            if (stream.falling) {
                expect(surface).toBeDefined();
                const group = plan.groups.find(group => stream.ownerIds.every(id => group.ownerIds.includes(id)))!;
                const groupWaterIds = [...new Set([...plan.pools.filter(pool => group.ownerIds.includes(pool.ownerId)).map(pool => pool.waterFloorId),
                    ...plan.streams.filter(other => other.ownerIds.every(id => group.ownerIds.includes(id))).flatMap(other => other.waterFloorIds)])];
                for (const vertex of surface!.vertices) {
                    // A zero-area arm boundary may belong to the other actual
                    // junction floor. It must still be this group's same water.
                    const cell = base.logicalAt(vertex)!, actual = groupWaterIds.map(id => world.sampleFloorAt(cell, id)).filter(sample => !!sample);
                    expect(actual.length).toBeGreaterThan(0);
                    for (const sample of actual) expect(vertex.y - sample.point.y).toBeCloseTo(.002, 7);
                }
            }
        }
        expect(flatPoolSamples).toBeGreaterThan(20); expect(fallingSamples).toBeGreaterThan(20);
    });

    it('keeps a bowl junction level when mapped arms overlap beyond the pool contour', () => {
        const base = source({ carvingScope: true, sheared: true }), state = owners(base);
        const positions: Record<string, Cell> = { b0: { x: 0, z: -2 }, b2: { x: 1, z: -2 }, b4: { x: 3, z: -2 }, c1: { x: 2, z: -2 }, c3: { x: 1, z: -3 } };
        state.landmarks.forEach(owner => { owner.cell = cellAt(base, positions[owner.id]); });
        const { world, plan } = composeAuthoredWaterWorld(state, base), pool = plan.pools.find(pool => pool.ownerId === 'b2')!;
        expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        const arms = plan.streams.filter(stream => stream.ownerIds.includes('b2'));
        const left = arms.find(stream => stream.ownerIds.includes('b0'))!, branch = arms.find(stream => stream.ownerIds.includes('c3'))!;
        const overlaps = decomposeWaterOutline(left.outline).flatMap(a => decomposeWaterOutline(branch.outline).map(b => convexIntersection(a, b)))
            .filter(overlap => overlap.area > 1e-8);
        let beyondPool = 0;
        for (const overlap of overlaps) for (let edge = 0; edge < overlap.points.length; edge++) for (let i = 1; i < 20; i++) {
            const a = overlap.points[edge], b = overlap.points[(edge + 1) % overlap.points.length], t = i / 20,
                p = { x: a.x + (b.x - a.x) * t, y: pool.waterY, z: a.z + (b.z - a.z) * t };
            if (pointInWaterOutline(p, pool.outline)) continue;
            beyondPool++;
            const cell = base.logicalAt(p)!, floors = [...new Set([...left.waterFloorIds, ...branch.waterFloorIds])].map(id => world.sampleFloorAt(cell, id)).filter(Boolean);
            expect(floors.length).toBeGreaterThan(0); for (const floor of floors) expect(floor!.point.y).toBeCloseTo(pool.waterY, 7);
        }
        expect(beyondPool).toBeGreaterThan(0);
    });

    it('starts from the original ground on store/split and restores the same revision and geometry', () => {
        const base = source(), state = owners(base), first = composeAuthoredWaterWorld(state, base);
        for (const id of ['b2', 'c1']) {
            const stored = structuredClone(state); delete stored.landmarks.find(owner => owner.id === id)!.cell;
            const after = composeAuthoredWaterWorld(stored, base);
            expect(after.plan.pools).toEqual([]); expect(after.plan.ownerIds).toEqual([]);
            expect(after.world.floors).toEqual(base.floors);
            expect(after.world.revision).not.toBe(first.world.revision);
            expect(after.world.floorAt(cellAt(base, { x: 2, z: -2 }))?.point).toEqual(base.anchorAt(cellAt(base, { x: 2, z: -2 })));
        }
        const restored = composeAuthoredWaterWorld(state, base);
        expect(restored.plan).toEqual(first.plan); expect(restored.world.floors).toEqual(first.world.floors);
        expect(restored.world.definition.edges).toEqual(first.world.definition.edges);
    });

    it('derives the terminal bridge from the same cut world and removes it with its supplying owner', () => {
        const base = source(), state = owners(base);
        const positions: Record<string, Cell> = { b0: { x: 0, z: -2 }, b2: { x: 1, z: -2 }, b4: { x: 3, z: -2 },
            c1: { x: 2, z: -2 }, c3: { x: 2, z: -3 } };
        state.landmarks.forEach(owner => { owner.cell = cellAt(base, positions[owner.id]); });
        const saved = structuredClone(state), original = structuredClone(base.definition), first = composeAuthoredWaterWorld(state, base);
        expect(first.plan.bridges).toHaveLength(1);
        const bridge = first.plan.bridges[0], deckCell = base.logicalAt(bridge.center)!;
        expect(bridge.ownerId).toBe('c3'); expect(Object.isFrozen(bridge)).toBe(true);
        expect(first.world.floorAt(deckCell)?.floorId).toBe(bridge.deckFloorId);
        const edgeId = (edge: WorldDefinition['edges'][number]) => JSON.stringify([JSON.stringify([edge.from.districtId, edge.from.siteId]), JSON.stringify([edge.to.districtId, edge.to.siteId])].sort());
        for (const id of bridge.restoredEdgeIds) {
            const edge = first.world.definition.edges.find(edge => edgeId(edge) === id && edge.allows.includes('walk'))!;
            expect(edge).toBeDefined(); expect(base.definition.edges.some(source => edgeId(source) === id && source.allows.includes('walk'))).toBe(true);
            const [from, to] = [edge.from, edge.to].map(ref => first.world.sites.find(site => site.ref.districtId === ref.districtId && site.ref.siteId === ref.siteId)!.cell);
            expect(isWorldWalkEdgeSupported(first.world, from, to)).toBe(true);
        }
        const stored = structuredClone(state); delete stored.landmarks.find(owner => owner.id === 'c3')!.cell;
        const after = composeAuthoredWaterWorld(stored, base);
        expect(after.plan.bridges).toEqual([]); expect(after.plan.pools).toEqual([]);
        expect(after.world.floors).toEqual(base.floors); expect(after.world.revision).not.toBe(first.world.revision);
        const restored = composeAuthoredWaterWorld(state, base);
        expect(restored.plan).toEqual(first.plan); expect(restored.world.definition).toEqual(first.world.definition);
        expect(state).toEqual(saved); expect(base.definition).toEqual(original);
    });

    it('does not remove existing pools when a fourth bowl and a third fed channel join', () => {
        const base = source(), state = owners(base);
        state.landmarks.push({ id: 'c5', kind: 'water-channel', cell: cellAt(base, { x: 5, z: -2 }), growth: 18 },
            { id: 'b6', kind: 'water-bowl', cell: cellAt(base, { x: 6, z: -2 }), growth: 18 });
        const { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(4); expect(plan.groups[0].channelIds).toHaveLength(3);
        expect(plan.pools[3].color).toBe(plan.pools[0].color);
        for (const pool of plan.pools) expect(world.sampleFloorAt(state.landmarks.find(owner => owner.id === pool.ownerId)!.cell!, pool.waterFloorId)).toBeDefined();
    });

    it('keeps individual bodies if there are no explicit water grants or only smaller components', () => {
        const base = source({ water: false }), result = composeAuthoredWaterWorld(owners(base), base);
        expect(result.plan.pools).toEqual([]); expect(result.plan.ownerIds).toEqual([]);
        expect(result.plan.groups.every(group => !group.cut && group.reason === 'individual-bodies')).toBe(true);
        expect(result.world.floors).toEqual(base.floors);
        const dryChannel = owners(base); dryChannel.landmarks.find(owner => owner.id === 'c1')!.cell = cellAt(base, { x: 1, z: -4 });
        expect(composeAuthoredWaterWorld(dryChannel, source()).plan.pools).toEqual([]);
    });

    it('falls back the whole garden when a required logical link crosses missing original ground', () => {
        const base = source({ groundGap: true }), state = owners(base), { world, plan } = composeAuthoredWaterWorld(state, base);
        // Both endpoint owners remain acquired and supplied, but the actual
        // source has a sea gap inside the c1↔b2 trench, between logical x1.28..1.46.
        expect(base.floorAt({ x: 1.37, z: -2 })).toBeUndefined();
        expect(base.neighbors({ x: 1, z: -2 }, 'water')).toContainEqual({ x: 2, z: -2 });
        expect(plan.groups).toHaveLength(1);
        expect(plan.groups[0]).toMatchObject({ cut: false, reason: 'insufficient-clearance', ownerIds: ['b0', 'b2', 'b4', 'c1', 'c3'] });
        expect(plan.pools).toEqual([]); expect(plan.streams).toEqual([]); expect(plan.ownerIds).toEqual([]);
        expect(world.floors).toEqual(base.floors);
        expect(world.definition.edges).toEqual(base.definition.edges);
        for (const owner of state.landmarks) expect(world.anchorAt(owner.cell!)).toEqual(base.anchorAt(owner.cell!));
    });

    it('does not cut a distant trench for a nonadjacent explicit water grant', () => {
        const base = source({ longWaterEdge: true }), state = owners(base), { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(base.neighbors({ x: 0, z: -2 }, 'water')).toContainEqual({ x: 4, z: -2 });
        expect(plan.groups[0].cut).toBe(true); expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        expect(plan.streams.some(stream => stream.ownerIds.includes('b0') && stream.ownerIds.includes('b4'))).toBe(false);
        for (const stream of plan.streams) {
            const [a, b] = stream.ownerIds.map(id => state.landmarks.find(owner => owner.id === id)!.cell!);
            expect(Number.isInteger(a.x) && Number.isInteger(a.z) && Number.isInteger(b.x) && Number.isInteger(b.z)).toBe(true);
            expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(1);
        }
        // Geometry ignores the invalid physical link, while existing logical
        // grants and acquired rights remain unchanged.
        expect(world.neighbors({ x: 0, z: -2 }, 'water')).toEqual(base.neighbors({ x: 0, z: -2 }, 'water'));
        const ordinary = composeAuthoredWaterWorld(owners(source()), source());
        expect(plan.pools).toEqual(ordinary.plan.pools); expect(plan.streams).toEqual(ordinary.plan.streams);
        expect(world.floors).toEqual(ordinary.world.floors);
    });

    it('reduces a pool around another owner and its doorstep without changing acquired rights', () => {
        const base = source(), state = owners(base), clear = composeAuthoredWaterWorld(state, base);
        state.plots.push({ id: 'neighbor-home', kind: 'home', cell: cellAt(base, { x: 5, z: -2 }), stage: 3, growth: 18, plantedAt: 0, origin: 'seed', paid: 40 });
        const near = composeAuthoredWaterWorld(state, base);
        expect(near.plan.pools).toHaveLength(3);
        expect(outlineArea(near.plan.pools.find(pool => pool.ownerId === 'b4')!.outerOutline)).toBeLessThan(outlineArea(clear.plan.pools.find(pool => pool.ownerId === 'b4')!.outerOutline));
        const home = state.plots[0].cell!;
        samePoint(near.world.floorAt(home)?.point, base.floorAt(home)!.point);
        samePoint(near.world.floorAt({ x: home.x, z: home.z + .75 })?.point, base.floorAt({ x: home.x, z: home.z + .75 })!.point);
        expect(near.world.sites.filter(site => site.placement).map(site => site.cell)).toEqual(base.sites.filter(site => site.placement).map(site => site.cell));
    });

    it('preserves each original anchor and floor interpolation in a rotated/translated district', () => {
        const base = source({ rotated: true }), state = owners(base), { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3);
        for (const pool of plan.pools) {
            const cell = state.landmarks.find(owner => owner.id === pool.ownerId)!.cell!;
            expect(world.anchorAt(cell)).toEqual(base.anchorAt(cell));
            expect(pool.center).toEqual(base.anchorAt(cell));
            samePoint(world.sampleFloorAt(cell, pool.waterFloorId)?.point, { ...pool.center, y: pool.waterY });
            expect(world.floorAt(cell)).toBeUndefined();
        }
    });

    it('adapts only the connection axis between nearby bowls while retaining wide transverse wings', () => {
        const base = source(), state = owners(base);
        const positions: Record<string, Cell> = { b0: { x: 0, z: -2 }, b2: { x: 1, z: -2 }, b4: { x: 3, z: -2 },
            c1: { x: 2, z: -2 }, c3: { x: 2, z: -3 } };
        state.landmarks.forEach(owner => { owner.cell = cellAt(base, positions[owner.id]); });
        const { plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3);
        for (const a of plan.pools) for (const b of plan.pools) {
            if (a.ownerId === b.ownerId) continue;
            expect(intersection(a.outerOutline, b.outerOutline).area).toBeLessThan(1e-8);
            const d = Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z);
            expect(a.outerOutline.every(p => ((p.x - a.center.x) * (b.center.x - a.center.x) + (p.z - a.center.z) * (b.center.z - a.center.z)) / d <= d / 2 - .024)).toBe(true);
        }
    });

    it('uses an explicit original-floor carving scope without granting new placement rights or saved state', () => {
        const base = source({ narrowAcquisition: true, carvingScope: true }), state = owners(base), saved = structuredClone(state), original = structuredClone(base.definition);
        const { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.pools).toHaveLength(3);
        expect(world.sites.filter(site => site.placement).map(site => site.cell)).toEqual(base.sites.filter(site => site.placement).map(site => site.cell));
        expect(world.owns(cellAt(base, { x: 0, z: -3 }))).toBe(false);
        expect(state).toEqual(saved); expect(base.definition).toEqual(original);
        expect(plan.pools.some(pool => pool.outline.some(point => Math.abs(point.z - pool.center.z) > .225))).toBe(true);
        for (const pool of plan.pools) {
            const district = world.definition.districts.find(district => district.id === pool.districtId)!;
            const bands = district.surfaces!.filter(surface => surface.id.startsWith(`authored-water:bank:pool%3A${pool.ownerId}`));
            expect(bands).toHaveLength(3);
            for (const point of pool.outerOutline) {
                const insideBank = { x: pool.center.x + (point.x - pool.center.x) * .98, y: point.y,
                    z: pool.center.z + (point.z - pool.center.z) * .98 };
                const cell = base.logicalAt(insideBank)!;
                // The outer bank annulus is removed from support and is not a
                // walkable bed disguised as a bank surface.
                expect(world.sampleFloorAt(cell, base.floors[0].id)).toBeUndefined();
            }
        }
        expect(plan.grottos).toHaveLength(1);
        for (const grotto of plan.grottos) {
            const pool = plan.pools.find(pool => pool.ownerId === grotto.ownerId)!;
            expect(grotto.scale).toBeGreaterThanOrEqual(.6);
            expect(grotto.surfaceIds).toHaveLength(3);
            expect(world.surfaces.filter(surface => grotto.surfaceIds.includes(surface.id)).reduce((sum, surface) => sum + surface.indices.length / 3, 0)).toBe(116);
            expect(world.sampleFloorAt(base.logicalAt(grotto.pivot)!, pool.bedFloorId)).toBeDefined();
        }
    });

    it('never applies an accepted stream stencil to a different district at the same physical coordinates', () => {
        const original = source({ carvingScope: true }), definition = structuredClone(original.definition), district = definition.districts[0];
        const foreign = { ...structuredClone(district), id: 'foreign', logicalOrigin: { x: 30, z: 0 },
            worldOrigin: { x: 0, y: 4, z: 0 }, sites: structuredClone(district.sites), waterCarvingScopes: undefined };
        definition.districts = [...definition.districts, foreign];
        const base = compileWorldDefinition(definition), { world, plan } = composeAuthoredWaterWorld(owners(base), base);
        expect(plan.pools).toHaveLength(3); expect(plan.streams).toHaveLength(4);
        expect(world.definition.districts.find(district => district.id === 'foreign')!.floors).toEqual(foreign.floors);
        expect(world.definition.districts.find(district => district.id === 'foreign')!.surfaces ?? []).toEqual([]);
        expect(world.floors.filter(floor => JSON.parse(floor.id)[0] === 'foreign' && floor.kind === 'water')).toEqual([]);
    });

    it('refuses an enlarged shape when visible ground lacks the acquired width for a dry shore', () => {
        const base = source({ narrowAcquisition: true }), state = owners(base), { world, plan } = composeAuthoredWaterWorld(state, base);
        expect(plan.groups).toHaveLength(1);
        expect(plan.groups[0]).toMatchObject({ cut: false, reason: 'insufficient-clearance' });
        expect(plan.pools).toEqual([]); expect(plan.ownerIds).toEqual([]);
        expect(world.floors).toEqual(base.floors);
        expect(world.owns(cellAt(base, { x: 0, z: -3 }))).toBe(false);
        expect(world.sites.filter(site => site.placement).map(site => site.cell)).toEqual(base.sites.filter(site => site.placement).map(site => site.cell));
    });
});
