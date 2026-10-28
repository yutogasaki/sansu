import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { coastalTrialMode, createCoastalPlaceSection, coastalBypassesPlaceField } from './coastal-section';
import { bayDisplacement, createBayCoastalSection, smoothPositivePart } from './bay-section';
import { shapeOf, type PlaceShape } from './directional-field';
import { placeEditingRevision } from './persistent-model';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { HOME_CELL, approachCells, walkableCells, landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';

const original = structuredClone(fixture.state) as unknown as GrowingState, originalJSON = JSON.stringify(original);
const mode = coastalTrialMode();
assert(mode === 'bay08' || mode === 'bay12' || mode === 'bay08spread');
const depth = mode === 'bay12' ? 1.2 : .8, beta = mode === 'bay08spread' ? .5 : 0;
const floorSHA256 = (world: IslandWorld) => createHash('sha256').update(JSON.stringify(world.floors.map(f => [f.kind, f.vertices, f.indices]))).digest('hex');
const compile = editableIslandWorld as unknown as (state: GrowingState, curved: boolean, method: 'H', coast?: string) => IslandWorld;
const before = compile(original, true, 'H');
const safety = { actors: [], occupiedPlaceTargets: [] };
const applyShape = (state: GrowingState, shape: PlaceShape | undefined, id: string, actors: Cell[] = []) => applyIntent(state,
    { id, command: { type: 'place-outline', action: 'apply', shape, safety: { ...safety, actors }, expectedPlaceRevision: placeEditingRevision(state) } }, state.nature.realAt).state;
const ownersAndRoutes = (state: GrowingState) => {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return state.landmarks.filter(o => ['starter-bench', 'starter-flower'].includes(o.id)).map(owner => ({ id: owner.id, cell: owner.cell,
        routes: owner.cell ? approachCells(owner.cell, world).filter(c => open.has(`${c.x},${c.z}`)).flatMap(c => {
            const route = world.route(HOME_CELL, c, open); return route ? [{ target: c, route,
                bodySupported: route.slice(1).every((p, i) => editableTerrainSegmentSupported(world, route[i], p)) }] : [];
        }) : [] }));
};
const originalOwners = ownersAndRoutes(original);
assert(originalOwners.every(o => o.routes.some(r => r.bodySupported)), 'fixture owners initially usable');
const reports: Record<string, unknown>[] = [];
for (const [name, center, radius, actor] of [
    ['west', { x: -1, z: 4 }, 1.6, { x: -3, z: 4 }],
    ['south', { x: -1, z: 7 }, 2, { x: -1, z: 7 }],
] as const) {
    const shape: PlaceShape = { center, radius, height: -.55, entrance: 1.2 };
    assert(coastalBypassesPlaceField({ trialPlace: shape }));
    const state = { ...original, trialPlace: shape }, after = compile(state, true, 'H');
    const unusedInputs = compile({ ...original, trialPlace: { ...shape, height: -.2, entrance: 2, flatRadius: 1.75 } } as GrowingState, true, 'H');
    assert.deepEqual(unusedInputs.floors.map(f => [f.kind, f.vertices, f.indices]), after.floors.map(f => [f.kind, f.vertices, f.indices]),
        'bay must not apply the old negative ellipse/entrance or flat field');
    const metadata = createCoastalPlaceSection(state, () => 0, mode);
    const vertices = [...before.floors, ...after.floors].flatMap(f => f.vertices), seen = new Set<string>();
    let checked = 0, changed = 0, newlyDry = 0, raised = 0, outsideChanged = 0, dryLost = 0, largestRetainedDrop = 0;
    for (const v of vertices) {
        const id = `${v.cell.x},${v.cell.z}`; if (seen.has(id)) continue; seen.add(id); checked++;
        const old = before.floorAt(v.cell)?.point, next = after.floorAt(v.cell)?.point;
        const differs = Boolean(old) !== Boolean(next) || old && next && Math.hypot(old.x - next.x, old.y - next.y, old.z - next.z) > 1e-8;
        if (!differs) continue; changed++;
        if (!old && next) newlyDry++;
        if (old && !next) dryLost++;
        if (old && next) { if (next.y > old.y + 1e-8) raised++; largestRetainedDrop = Math.max(largestRetainedDrop, old.y - next.y); }
        if (!metadata.meshInfluenceContains(v.cell, 12)) outsideChanged++;
    }
    assert.equal(newlyDry, 0); assert.equal(raised, 0); assert.equal(outsideChanged, 0); assert(changed > 0);
    const report: Record<string, unknown> = { name, mode, shape, direction: metadata.direction, bay: metadata.bay,
        geometry: { checked, changed, newlyDry, raised, dryLost, outsideChanged, largestRetainedDrop },
        floorSHA256: floorSHA256(after), baselineFloorSHA256: floorSHA256(before),
        unusedNegativeHeightEntranceFlatParity: true,
        landPreserved: JSON.stringify(state.land) === JSON.stringify(original.land), terrainPreserved: JSON.stringify(state.terrain) === JSON.stringify(original.terrain) };
    if (beta) {
        const oldBay = compile(state, true, 'H', 'bay08'), oldSection = createCoastalPlaceSection(state, () => 0, 'bay08');
        assert.equal(metadata.direction, oldSection.direction);
        assert.deepEqual({ ...metadata.bay, curveBeta: undefined }, { ...oldSection.bay, curveBeta: undefined }, 'one curve factor only');
        assert.notEqual(floorSHA256(after), floorSHA256(oldBay), 'spread must change actual shared triangles');
        report.spreadComparison = { baselineMode: 'bay08', baselineFloorSHA256: floorSHA256(oldBay), actualMeshChanged: true,
            widthDepthBandsDirectionPreserved: true };
    }
    try {
        let accepted = applyShape(original, shape, `bay-${mode}-${name}`);
        report.accepted = true; report.ownersUnmoved = JSON.stringify(accepted.landmarks) === JSON.stringify(original.landmarks);
        const originalPositionRoutes = ownersAndRoutes(accepted);
        report.originalPositionRoutes = originalPositionRoutes;
        assert(originalPositionRoutes.every(o => o.routes.some(r => r.bodySupported)), 'accepted bay strands a fixture owner');
        const undone: GrowingState = applyIntent(accepted, { id: `bay-undo-${mode}-${name}`, command: { type: 'place-outline', action: 'undo',
            safety, expectedPlaceRevision: placeEditingRevision(accepted) } }, accepted.nature.realAt).state;
        assert.equal(shapeOf(undone), undefined); assert.deepEqual(undone.landmarks, accepted.landmarks);
        const redone: GrowingState = applyIntent(undone, { id: `bay-redo-${mode}-${name}`, command: { type: 'place-outline', action: 'redo',
            safety, expectedPlaceRevision: placeEditingRevision(undone) } }, undone.nature.realAt).state;
        assert.deepEqual(shapeOf(redone), shape); assert.deepEqual(redone.landmarks, accepted.landmarks);
        assert.equal(compile(redone, true, 'H').revision, after.revision);
        report.undoRedo = true;
        const moves: Record<string, unknown>[] = [];
        let baselineMoving = original;
        const pool: Cell[] = [{ x: -1, z: 4 }, { x: 0, z: 4 }, { x: 0, z: 5 }, { x: 1, z: 5 }, { x: 2, z: 4 }, { x: 0, z: 6 }, { x: 1, z: 6 }];
        for (const id of ['starter-bench', 'starter-flower']) {
            const attempts: Record<string, unknown>[] = [];
            for (const cell of pool) {
                if (accepted.landmarks.some(o => o.cell?.x === cell.x && o.cell.z === cell.z)) continue;
                try {
                    // Require the target to be legal in the baseline too; record
                    // rejected candidates rather than silently changing the goal.
                    const baselineNext = applyIntent(baselineMoving, { id: `baseline-${id}-${cell.x}-${cell.z}`, command: { type: 'move', id, cell } }, baselineMoving.nature.realAt).state;
                    accepted = applyIntent(accepted, { id: `move-${mode}-${name}-${id}`, command: { type: 'move', id, cell } }, accepted.nature.realAt).state;
                    baselineMoving = baselineNext;
                    attempts.push({ cell, accepted: true }); break;
                } catch (error) { attempts.push({ cell, accepted: false, error: String(error) }); }
            }
            moves.push({ id, attempts, moved: attempts.some(a => a.accepted) });
        }
        const routes = ownersAndRoutes(accepted);
        report.moves = moves; report.routesAfterMove = routes;
        report.bothMoved = moves.every(m => m.moved); report.bothUsable = routes.every(o => o.routes.some(r => r.bodySupported));
        assert(routes.every(o => o.routes.every(r => r.bodySupported)), 'graph reports an unsupported body segment');
    } catch (error) { report.error = String(error); }
    try { applyShape(original, shape, `actor-${mode}-${name}`, [actor]); report.actorGuard = { actor, rejected: false }; }
    catch (error) { report.actorGuard = { actor, rejected: true, error: String(error) }; }
    const axis = name === 'west' ? { x: -1, z: 0 } : { x: 0, z: 1 };
    const b = landBounds(original), boundary = name === 'west' ? { x: b.minX - .5, z: center.z } : { x: center.x, z: b.depth - .5 };
    report.crossSection = Array.from({ length: 41 }, (_, i) => {
        const outward = -2 + i / 10, cell = { x: boundary.x + axis.x * outward, z: boundary.z + axis.z * outward };
        return { outward, before: before.floorAt(cell)?.point.y ?? null, after: after.floorAt(cell)?.point.y ?? null };
    });
    // Algebraic endpoint/inner-edge evidence is separate from mesh halo evidence.
    const sample = (p: Cell) => 1 - .6 * (p.x * axis.x + p.z * axis.z);
    const pure = createBayCoastalSection(state, sample, mode), zero = createBayCoastalSection(state, sample, mode, 0);
    assert.equal(zero.heightAt, sample, 'zero displacement exactly preserves original sample function');
    const continuity: Record<string, unknown>[] = [];
    for (const sign of [-1, 1]) {
        const endpoint = { x: boundary.x - axis.z * radius * sign, z: boundary.z + axis.x * radius * sign };
        assert.equal(pure.heightAt(endpoint), sample(endpoint));
        const differences = [.01, .005, .0025].map(e => {
            const p = { x: endpoint.x + axis.z * e * sign, z: endpoint.z - axis.x * e * sign };
            return { epsilon: e, lowering: sample(p) - pure.heightAt(p), slopeDifference: (sample(p) - pure.heightAt(p)) / e };
        });
        assert(Math.abs(differences.at(-1)!.slopeDifference) < 1e-6);
        continuity.push({ endpoint, exactHeight: true, differences });
    }
    report.endpointContinuity = continuity;
    reports.push(report);
}
assert(reports.every(report => report.accepted && report.ownersUnmoved && report.undoRedo), 'both bay locations must accept and preserve owners');
assert(reports.every(report => report.bothMoved && report.bothUsable), 'ordinary moves and body routes must succeed in both scenes');
assert(reports.every(report => /なかまが いるよ/.test(String((report.actorGuard as { error?: string }).error))), 'both changing actor supports must refuse');
const fixed: PlaceShape = { center: { x: 7, z: 7 }, radius: 2, height: -.55, entrance: 1.2 };
assert.throws(() => applyShape(original, fixed, 'fixed-bay'), /おうちと ふなつきばの 足もと/);
assert.throws(() => applyShape(original, { ...fixed, height: .5 }, 'positive-bay'), /高さを「入り江」/);
for (const v of [-1, -.01, 0, .001, .005, .1, 1]) assert(smoothPositivePart(v, .005) >= 0 && smoothPositivePart(v, .005) <= Math.max(0, v));
for (const radius of [1.6, 2]) for (const lateral of [-radius, radius]) assert.equal(bayDisplacement(lateral, radius, depth), 0);
let curveComparison: Record<string, unknown> | undefined;
if (beta) {
    let largestExtraDisplacement = 0;
    for (const radius of [1.6, 2]) {
        assert.equal(bayDisplacement(0, radius, depth, beta), depth, 'maximum depth stays fixed');
        for (let i = -1200; i <= 1200; i++) {
            const lateral = radius * i / 1000, old = bayDisplacement(lateral, radius, depth);
            const next = bayDisplacement(lateral, radius, depth, beta);
            assert(next >= old && next <= depth + 1e-12);
            if (Math.abs(lateral) >= radius) assert.equal(next, 0, 'finite lateral support unchanged');
            largestExtraDisplacement = Math.max(largestExtraDisplacement, next - old);
        }
    }
    assert(Math.abs(largestExtraDisplacement - depth * .052734375) < 1e-10);
    curveComparison = { beta, widthAndMaximumDepthPreserved: true, largestExtraDisplacement,
        interpretation: 'Spreads central curvature toward shoulders. It can narrow the left land; actual image comparison is required.' };
}
assert.equal(JSON.stringify(original), originalJSON);
const query = window.location.search;
try {
    window.location.search = `?shoreTrial=${mode}&trialSave=local`; assert.throws(coastalTrialMode, /保存を使わない/);
    window.location.search = `?shoreTrial=${mode}&placeSetTrial=two`; assert.throws(coastalTrialMode, /2つの高台/);
    for (const activeMode of ['soft08', 'soft12', 'contour', 'bay08', 'bay12', ...(beta ? ['bay08spread'] : [])]) {
        for (const incomplete of ['', '&terrainTrial=H', '&terrainTrial=H&trialScene=unknown', '&trialScene=shore', '&terrainTrial=A&trialScene=shore']) {
            window.location.search = `?shoreTrial=${activeMode}${incomplete}`;
            assert.throws(coastalTrialMode, /専用の地形H・shore/, 'recognized shore mode must not fall through to personal island');
        }
        window.location.search = `?shoreTrial=${activeMode}&terrainTrial=H&trialScene=shore`;
        assert.equal(coastalTrialMode(), activeMode);
    }
} finally { window.location.search = query; }
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', mode, scope: 'Actual shared geometry, static ordinary commands, endpoint formula and mesh locality. No visual/live-use/save acceptance.',
    originalOwners, reports, curveComparison, negativeControls: { fixedDockRejected: true, positiveShapeRejected: true, saveRejected: true, compositeRejected: true,
        recognizedModesRequireFixture: true, incompleteModeCases: beta ? 30 : 25 } }, null, 2));
