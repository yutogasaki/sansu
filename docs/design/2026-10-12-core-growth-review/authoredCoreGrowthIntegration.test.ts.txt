import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { AuthoredGrowthTerrainCatalog } from '../../../../domain/growingIsland/authoredGrowthTerrain';
import type { AuthoredShoulderProfile } from '../../../../domain/growingIsland/authoredShoulderWorld';
import { withNative05WaterCarvingScope } from '../../../../domain/growingIsland/authoredWaterCarving';
import { authoredWorldFrame } from '../../../../domain/growingIsland/authoredWorldFrame';
import { applyIntent } from '../../../../domain/growingIsland/commands';
import { TREE_MATURE_HOURS } from '../../../../domain/growingIsland/environment';
import type { Cell, GrowingState } from '../../../../domain/growingIsland/types';
import { compileWorldDefinition } from '../../../../domain/growingIsland/worldDefinition';
import { sceneLayout } from '../sceneLayout';
import { buildAuthoredGrowingGround } from './authoredGrowingGround';

const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const json = (path: string) => JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString());
const same = (a: Cell | undefined, b: Cell) => a?.x === b.x && a?.z === b.z;

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
    const frameFor = (state: GrowingState) => authoredWorldFrame(state, base, options);
    const command = (state: GrowingState, id: string, cell: Cell, receipt: string) => applyIntent(state,
        { id: receipt, command: { type: state.landmarks.find(owner => owner.id === id)!.cell ? 'move' : 'unstore', id, cell } },
        state.nature.realAt, frameFor(state).world).state;
    // This bench relocation is identical in all three comparisons, frees an
    // original planting cell, and uses the same ordinary command as the UI.
    const bench = initial.landmarks.find(owner => owner.kind === 'bench' && same(owner.cell, { x: 12, z: -4 }))!;
    initial = command(initial, bench.id, { x: 7, z: -3 }, 'core-growth-bench');
    const baseline = frameFor(initial), rights = baseline.world.sites.filter(site => site.placement);
    expect(rights).toHaveLength(75);
    expect(baseline.growthTerrainPlan?.assemblies).toEqual([]);
    const invariant = (state: GrowingState) => ({ plots: state.plots, landmarks: state.landmarks.map(owner => {
        const copy = { ...owner }; if (ids.includes(copy.id)) delete copy.cell; return copy;
    }), land: state.land, villagers: state.villagers, drops: state.drops, town: state.town, nature: state.nature, nextId: state.nextId });
    const fixed = invariant(initial);
    const snapshots = new Map<string, { state: GrowingState; frame: ReturnType<typeof frameFor>; geometry: string }>();
    for (const name of ['north', 'east', 'loop']) {
        const cells = manifest.variationCases[name].localCells as Cell[];
        expect(cells).toHaveLength(4);
        let state = initial;
        for (let i = 0; i < ids.length; i++) state = command(state, ids[i], cells[i], `${name}-${i}`);
        expect(invariant(state)).toEqual(fixed);
        const frame = frameFor(state), plan = frame.growthTerrainPlan!;
        expect(plan.rejectedReason).toBeUndefined();
        expect(plan.assemblies).toHaveLength(name === 'loop' ? 2 : 1);
        expect(plan.connections).toHaveLength(name === 'loop' ? 1 : 0);
        for (const assembly of plan.assemblies) {
            expect(assembly.districtId).toBe(parent.id);
            expect([...assembly.ownerIds].sort()).toEqual([...ids].sort());
        }
        expect(frame.world.sites.filter(site => site.placement)).toEqual(rights);
        for (const site of rights) {
            expect(frame.world.anchorAt(site.cell)).toEqual(baseline.world.anchorAt(site.cell));
            for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
                const cell = { x: site.cell.x + dx, z: site.cell.z + dz };
                expect(frame.world.floorAt(cell)).toEqual(baseline.world.floorAt(cell));
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
