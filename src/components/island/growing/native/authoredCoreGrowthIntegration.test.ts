import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { AuthoredGrowthTerrainCatalog } from '../../../../domain/growingIsland/authoredGrowthTerrain';
import type { AuthoredShoulderProfile } from '../../../../domain/growingIsland/authoredShoulderWorld';
import { withNative05WaterCarvingScope } from '../../../../domain/growingIsland/authoredWaterCarving';
import { authoredWorldFrame } from '../../../../domain/growingIsland/authoredWorldFrame';
import { applyIntent, canReachHomePlacement } from '../../../../domain/growingIsland/commands';
import { TREE_MATURE_HOURS } from '../../../../domain/growingIsland/environment';
import type { Cell, GrowingState } from '../../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld, type WorldFloorSample } from '../../../../domain/growingIsland/worldDefinition';
import { sceneLayout } from '../sceneLayout';
import { buildAuthoredGrowingGround } from './authoredGrowingGround';

const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const json = (path: string) => JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString());
const same = (a: Cell | undefined, b: Cell) => a?.x === b.x && a?.z === b.z;
const supportTriangle = (world: IslandWorld, triangle: number) => {
    let offset = 0;
    for (const floor of world.floors) {
        const count = floor.indices.length / 3;
        if (triangle < offset + count) {
            const start = (triangle - offset) * 3;
            return { floorId: floor.id, vertices: floor.indices.slice(start, start + 3).map(index => floor.vertices[index]) };
        }
        offset += count;
    }
    throw new Error(`Unknown compiled support triangle ${triangle}`);
};
const siteSignature = (world: IslandWorld, site: IslandWorld['sites'][number]) => ({
    ref: site.ref, cell: site.cell, point: site.point, floorId: site.floorId, placement: site.placement,
    support: site.support && { cell: site.support.cell, point: site.support.point, floorId: site.support.floorId,
        triangle: supportTriangle(world, site.support.triangle) },
});
const expectTriangleOnOriginalSurface = (world: IslandWorld, sample: WorldFloorSample) => {
    const triangle = supportTriangle(world, sample.triangle);
    expect(triangle.floorId).toBe(sample.floorId);
    const weights = [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6]] as const;
    for (const weight of weights) {
        const cell = { x: triangle.vertices.reduce((sum, vertex, index) => sum + vertex.cell.x * weight[index], 0),
            z: triangle.vertices.reduce((sum, vertex, index) => sum + vertex.cell.z * weight[index], 0) };
        const point = { x: triangle.vertices.reduce((sum, vertex, index) => sum + vertex.point.x * weight[index], 0),
            y: triangle.vertices.reduce((sum, vertex, index) => sum + vertex.point.y * weight[index], 0),
            z: triangle.vertices.reduce((sum, vertex, index) => sum + vertex.point.z * weight[index], 0) };
        const original = world.anchorFloorAt(cell);
        expect(original?.floorId).toBe(sample.floorId);
        expect(Math.hypot(original!.point.x - point.x, original!.point.y - point.y, original!.point.z - point.z)).toBeLessThan(1e-8);
    }
};
const floorStack = (world: IslandWorld, cell: Cell) => ({
    anchor: world.anchorFloorAt(cell),
    floors: world.floors.map(floor => ({ id: floor.id, kind: floor.kind, sample: world.sampleFloorAt(cell, floor.id) }))
        .filter(entry => entry.sample).map(entry => ({ id: entry.id, kind: entry.kind,
            point: entry.sample!.point, triangle: entry.sample!.triangle })),
});
const expectSameFloorSurface = (actualWorld: IslandWorld, actual: WorldFloorSample | undefined,
    expectedWorld: IslandWorld, expected: WorldFloorSample | undefined, context: string) => {
    if (Boolean(actual) !== Boolean(expected)) {
        const cell = actual?.cell ?? expected?.cell;
        expect(Boolean(actual), `${context}: actual=${Boolean(actual)} expected=${Boolean(expected)}${cell ? `\nactual stack=${JSON.stringify(floorStack(actualWorld, cell))}\nexpected stack=${JSON.stringify(floorStack(expectedWorld, cell))}` : ''}`)
            .toBe(Boolean(expected));
    }
    if (!actual || !expected) return;
    expect(actual.cell).toEqual(expected.cell);
    expect(actual.floorId).toBe(expected.floorId);
    expect(Math.hypot(actual.point.x - expected.point.x, actual.point.y - expected.point.y, actual.point.z - expected.point.z)).toBeLessThan(1e-8);
    if (actual.triangle !== expected.triangle) {
        expectTriangleOnOriginalSurface(actualWorld, actual);
        expectTriangleOnOriginalSurface(expectedWorld, expected);
    }
};

it('grows the original whole-island coast from the same mature owners while sharing real ground with the renderer', () => {
    const manifest = json('prototypes/place-qa/authored-core-growth-terrain-manifest.json');
    const compressed = readFileSync(manifest.artifact.path.slice(1)), expanded = gunzipSync(compressed);
    expect(sha(compressed)).toBe(manifest.artifact.sha256);
    expect(sha(expanded)).toBe(manifest.artifact.expandedSha256);
    const catalog = JSON.parse(expanded.toString()) as AuthoredGrowthTerrainCatalog;
    expect(catalog.candidate).toBe(manifest.candidate);
    const base = withNative05WaterCarvingScope(compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
    const shoulder = json('prototypes/place-qa/authored-shoulder-profile.json.gz') as AuthoredShoulderProfile;
    const options = { water: true, cove: true, shoulder, growthTerrain: catalog };
    const controlOptions = { water: true, cove: true, shoulder };
    const parent = base.definition.districts.find(district => district.templateId === catalog.template.id)!;
    expect(parent.id).toBe('native05-inlet-core');
    const baseBefore = JSON.stringify(base.definition);
    let initial = json('prototypes/place-qa/authored-shoulder-reference-mature.json').state as GrowingState;
    const originalCells = [{ x: 3, z: -9 }, { x: 4, z: -9 }, { x: 3, z: -8 }, { x: 4, z: -8 }];
    const ids = originalCells.map(cell => {
        const tree = initial.landmarks.find(owner => owner.kind === 'sapling' && same(owner.cell, cell))!;
        expect(tree.growth).toBeGreaterThanOrEqual(TREE_MATURE_HOURS); return tree.id;
    });
    expect(new Set(ids).size).toBe(4);
    const homeIds = initial.plots.filter(owner => owner.kind === 'home').map(owner => owner.id);
    expect(homeIds).toHaveLength(8);
    const movableIds = [...ids, ...homeIds];
    const frameFor = (state: GrowingState) => authoredWorldFrame(state, base, options);
    const owner = (state: GrowingState, id: string) => [...state.plots, ...state.landmarks].find(item => item.id === id)!;
    const command = (state: GrowingState, id: string, cell: Cell, receipt: string, world = frameFor(state).world) => {
        try {
            return applyIntent(state, { id: receipt, command: { type: owner(state, id).cell ? 'move' : 'unstore', id, cell } },
                state.nature.realAt, world).state;
        } catch (error) {
            throw new Error(`${receipt}: ${id} -> (${cell.x},${cell.z}): ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const store = (state: GrowingState, id: string, receipt: string, world = frameFor(state).world) => applyIntent(state,
        { id: receipt, command: { type: 'store', id } }, state.nature.realAt, world).state;
    const spareHomeCells = [{ x: 3, z: -7 }, { x: 3, z: -2 }, { x: 4, z: -1 }];
    const arrange = (start: GrowingState, desired: readonly { id: string; cell: Cell }[], name: string) => {
        let state = start, parkingCursor = 0;
        const trace: string[] = [];
        for (let attempt = 0; attempt < movableIds.length * 2 + 4; attempt++) {
            const all = [...state.plots, ...state.landmarks];
            const pending = desired.map(item => ({ ...item, current: all.find(owner => owner.id === item.id)?.cell }))
                .filter(item => !same(item.current, item.cell));
            if (!pending.length) return state;
            const world = frameFor(state).world;
            const free = pending.find(item => !all.some(owner => owner.id !== item.id && owner.cell && same(owner.cell, item.cell))
                && (ids.includes(item.id) || canReachHomePlacement(state, item.cell, item.id, world)));
            if (free) {
                trace.push(`${attempt}: ${free.id} -> ${free.cell.x},${free.cell.z}`);
                state = command(state, free.id, free.cell, `${name}-${attempt}-${free.id}`, world);
            }
            else {
                const tree = pending.find(item => ids.includes(item.id));
                if (tree) { trace.push(`${attempt}: store ${tree.id}`); state = store(state, tree.id, `${name}-${attempt}-store-${tree.id}`, world); }
                else {
                    const parking = pending[parkingCursor++ % pending.length];
                    const reserved = new Set(desired.map(item => `${item.cell.x},${item.cell.z}`));
                    const candidates = [...spareHomeCells, ...world.sites.filter(site => site.placement
                        && Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)).map(site => site.cell)];
                    const seen = new Set<string>();
                    const spare = candidates.find(cell => {
                        const key = `${cell.x},${cell.z}`;
                        if (seen.has(key) || reserved.has(key)) return false;
                        seen.add(key);
                        return !all.some(item => item.cell && same(item.cell, cell))
                            && canReachHomePlacement(state, cell, parking.id, world);
                    });
                    if (!spare) throw new Error(`${name}: no reachable spare home cell after ${trace.join(' | ')}`);
                    trace.push(`${attempt}: park ${parking.id} -> ${spare.x},${spare.z}`);
                    state = command(state, parking.id, spare, `${name}-${attempt}-spare-${parking.id}`, world);
                }
            }
        }
        const actual = [...state.plots, ...state.landmarks].filter(item => movableIds.includes(item.id)).map(item => [item.id, item.cell]);
        throw new Error(`${name} tree/home rearrangement did not settle: ${JSON.stringify({ trace, desired, actual })}`);
    };
    // This bench relocation is identical in all three comparisons, frees an
    // original planting cell, and uses the same ordinary command as the UI.
    const bench = initial.landmarks.find(owner => owner.kind === 'bench' && same(owner.cell, { x: 12, z: -4 }))!;
    initial = command(initial, bench.id, { x: 7, z: -3 }, 'core-growth-bench');
    const baseline = frameFor(initial), rights = baseline.world.sites.filter(site => site.placement);
    expect(rights).toHaveLength(75);
    expect(baseline.growthTerrainPlan?.assemblies).toEqual([]);
    const invariant = (state: GrowingState) => ({ plots: state.plots.map(owner => {
        const copy = { ...owner }; if (movableIds.includes(copy.id)) delete copy.cell; return copy;
    }), landmarks: state.landmarks.map(owner => {
        const copy = { ...owner }; if (movableIds.includes(copy.id)) delete copy.cell; return copy;
    }), land: state.land, villagers: state.villagers, drops: state.drops, town: state.town, nature: state.nature, nextId: state.nextId });
    const fixed = invariant(initial);
    const snapshots = new Map<string, { state: GrowingState; frame: ReturnType<typeof frameFor>; geometry: string }>();
    let current = initial;
    for (const name of ['north', 'east', 'loop']) {
        const cells = manifest.variationCases[name].localCells as Cell[];
        const homeCells = manifest.variationCases[name].homeCells as Cell[];
        expect(cells).toHaveLength(4); expect(homeCells).toHaveLength(8);
        expect(new Set([...cells, ...homeCells].map(cell => `${cell.x},${cell.z}`)).size).toBe(12);
        const fixedCells = new Set([...initial.plots, ...initial.landmarks]
            .filter(owner => owner.cell && !movableIds.includes(owner.id)).map(owner => `${owner.cell!.x},${owner.cell!.z}`));
        expect([...cells, ...homeCells].filter(cell => fixedCells.has(`${cell.x},${cell.z}`))).toEqual([]);
        const desired = [...ids.map((id, i) => ({ id, cell: cells[i] })),
            ...homeIds.map((id, i) => ({ id, cell: homeCells[i] }))];
        const state = arrange(current, desired, name);
        expect(invariant(state)).toEqual(fixed);
        const frame = frameFor(state), control = authoredWorldFrame(state, base, controlOptions), plan = frame.growthTerrainPlan!;
        expect(plan.rejectedReason).toBeUndefined();
        expect(plan.assemblies).toHaveLength(name === 'loop' ? 2 : 1);
        expect(plan.connections).toHaveLength(name === 'loop' ? 1 : 0);
        for (const assembly of plan.assemblies) {
            expect(assembly.districtId).toBe(parent.id);
            expect([...assembly.ownerIds].sort()).toEqual([...ids].sort());
        }
        // The same moved trees may legitimately change the water garden. Isolate
        // growth terrain against the identical state and full composition, not
        // against a different tree arrangement whose dry support can differ.
        const controlRights = control.world.sites.filter(site => site.placement);
        expect(controlRights).toHaveLength(rights.length);
        expect(frame.world.sites.filter(site => site.placement).map(site => siteSignature(frame.world, site)))
            .toEqual(controlRights.map(site => siteSignature(control.world, site)));
        for (const site of controlRights) {
            expect(frame.world.anchorAt(site.cell)).toEqual(baseline.world.anchorAt(site.cell));
            for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
                const cell = { x: site.cell.x + dx, z: site.cell.z + dz };
                const actual = frame.world.floorAt(cell), expected = control.world.floorAt(cell);
                expectSameFloorSurface(frame.world, actual, control.world, expected,
                    `${name} placement=${JSON.stringify(site.ref)} right=(${site.cell.x},${site.cell.z}) sample=(${cell.x},${cell.z})`);
            }
        }
        const layout = sceneLayout(state, false, frame.world, frame.waterPlan, base,
            { options, covePlan: frame.covePlan, revision: frame.revision });
        const ground = buildAuthoredGrowingGround(layout);
        let geometry: string;
        try {
            const floors = frame.world.floors.filter(floor => floor.kind === 'ground' || floor.kind === 'deck');
            const positions = ground.floor.geometry.getAttribute('position').array;
            expect(Array.from(positions)).toEqual(Array.from(new Float32Array(floors.flatMap(floor =>
                floor.vertices.flatMap(({ point }) => [point.x - layout.center, point.y, point.z - 2])))));
            let offset = 0;
            const indices = floors.flatMap(floor => { const next = floor.indices.map(index => index + offset); offset += floor.vertices.length; return next; });
            expect(Array.from(ground.floor.geometry.index!.array)).toEqual(indices);
            geometry = sha(JSON.stringify([Array.from(positions), indices]));
        } finally { ground.dispose(); }
        snapshots.set(name, { state, frame, geometry });
        current = state;
    }
    expect(new Set([...snapshots.values()].map(snapshot => snapshot.geometry)).size).toBe(3);
    const loop = snapshots.get('loop')!, middle = ids[1], cell = loop.state.landmarks.find(owner => owner.id === middle)!.cell!;
    const separated = applyIntent(loop.state, { id: 'core-growth-store', command: { type: 'store', id: middle } },
        loop.state.nature.realAt, loop.frame.world).state;
    expect(frameFor(separated).growthTerrainPlan?.connections).toEqual([]);
    const restored = command(separated, middle, cell, 'core-growth-restore');
    expect(frameFor(restored).growthTerrainPlan).toEqual(loop.frame.growthTerrainPlan);
    expect(frameFor(restored).revision).toBe(loop.frame.revision);
    expect(invariant(restored)).toEqual(fixed);
    expect(JSON.stringify(base.definition)).toBe(baseBefore);
}, 30_000);
