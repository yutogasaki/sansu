import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { placeHeight as originalHeight } from './field';
import { placeHeight, planDirectionalRamp, diagnosticPlanFor, diagnosticInfluenceContains, diagnosticMeshInfluenceContains,
    type PlaceShape, type EntranceDirection } from './directional-field';
import { replacePlace } from './model';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { HOME_CELL, approachCells, landBounds, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { CONVEX_TERRACE_DETAIL } from '../2026-10-23-place-method-comparison/terrace-convex-field';

const original = structuredClone(fixture.state) as unknown as GrowingState;
const unchanged = JSON.stringify(original), baseWorld = editableIslandWorld(original)!;
const safety = { actors: [], occupiedPlaceTargets: [] };
const low: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const scalarSample = (p: { x: number; z: number }) => .22 + .012 * p.x + .02 * p.z;
let paritySamples = 0;
for (const explicit of [false, true]) {
    const shape = { ...low, ...(explicit ? { rampDirection: 'north' as const } : {}) }, state = { trialPlace: shape };
    for (let z = 0; z <= 8; z += .125) for (let x = -3; x <= 8; x += .125) {
        const cell = { x, z }, baseline = scalarSample(cell);
        assert.equal(placeHeight(state, cell, baseline, scalarSample), originalHeight(state, cell, baseline, scalarSample)); paritySamples++;
    }
}
const short = { ...low, height: .9, rampDirection: 'east' as const };
assert.throws(() => planDirectionalRamp(original, short, () => 0), /広さが足りない/);
assert.throws(() => planDirectionalRamp(original, { ...short, rampDirection: 'west' }, () => -.4), /広さが足りない/);
assert.throws(() => planDirectionalRamp(original, { ...short, rampDirection: 'west' }, p => Math.abs(p.z - 5) > .1 ? -.4 : .6), /広さが足りない/);
assert.throws(() => planDirectionalRamp(original, { ...short, rampDirection: 'west' }, p => p.x > 2.75 && p.x < 3.05 ? -.4 : .6), /広さが足りない/);
assert.throws(() => planDirectionalRamp(original, { ...short, rampDirection: 'west' }, () => Number.NaN), /広さが足りない/);
const syntheticPlan = planDirectionalRamp(original, { ...short, rampDirection: 'west' }, () => .6);
assert.equal(syntheticPlan.direction, 'west');
assert.equal(syntheticPlan.endHeight, .6);
assert(syntheticPlan.end.x >= landBounds(original).minX + .5);

const reports: Record<string, unknown>[] = [];
const cases: { name: string; shape: PlaceShape }[] = [
    { name: 'existing-low-north', shape: low },
    ...(['north', 'west', 'east', 'south'] as EntranceDirection[]).map(rampDirection => ({ name: `high-${rampDirection}`,
        shape: { ...low, height: .9, rampDirection } })),
];
for (const { name, shape } of cases) {
    const report: Record<string, unknown> = { name, shape };
    try {
        let state = replacePlace(original, shape, safety);
        const plan = diagnosticPlanFor(state);
        report.placeAccepted = true;
        report.plan = plan ?? 'north delegates exact existing field';
        const world = editableIslandWorld(state)!;
        if (plan) {
            const vertices = [...world.floors, ...baseWorld.floors].flatMap(f => f.vertices);
            const outside = vertices.filter(v => !diagnosticInfluenceContains(shape, plan, v.cell));
            const changedOutside = outside.flatMap(v => {
                const previous = baseWorld.floorAt(v.cell)?.point, current = world.floorAt(v.cell)?.point;
                const same = !previous && !current || previous && current
                    && Math.hypot(previous.x - current.x, previous.y - current.y, previous.z - current.z) <= 1e-8;
                return !same ? [{ cell: v.cell, before: previous, after: current }] : [];
            });
            const outsideMeshClosure = changedOutside.filter(v => !diagnosticMeshInfluenceContains(shape, plan, v.cell, CONVEX_TERRACE_DETAIL));
            report.boundary = { checkedAnalyticOutsideVertices: outside.length, analyticBoundaryHalo: changedOutside,
                meshClosure: `containing cells of the fixed 1/${CONVEX_TERRACE_DETAIL} sampling lattice`, outsideMeshClosure };
            assert.equal(outsideMeshClosure.length, 0, `${name}: changed geometry outside declared mesh influence`);
        }
        const moves: Record<string, unknown>[] = [];
        for (const [id, cell] of [['starter-bench', { x: 5, z: 5 }], ['starter-flower', { x: 6, z: 5 }]] as const) {
            try {
                state = applyIntent(state, { id: `directional-${name}-${id}`, command: { type: 'move', id, cell } }, state.nature.realAt).state;
                moves.push({ id, cell, accepted: true });
            } catch (error) { moves.push({ id, cell, accepted: false, error: String(error) }); }
        }
        const occupiedWorld = editableIslandWorld(state)!, open = walkableCells(state, occupiedWorld);
        const owners = state.landmarks.filter(o => ['starter-bench', 'starter-flower'].includes(o.id)).map(owner => ({
            id: owner.id, cell: owner.cell, routes: owner.cell ? approachCells(owner.cell, occupiedWorld).filter(c => open.has(`${c.x},${c.z}`))
                .flatMap(c => { const route = occupiedWorld.route(HOME_CELL, c, open); return route ? [{ target: c, route,
                    bodySupported: route.slice(1).every((p, index) => editableTerrainSegmentSupported(occupiedWorld, route[index], p)) }] : []; }) : [],
        }));
        report.moves = moves; report.owners = owners;
        report.bothMoved = moves.every(m => m.accepted);
        report.bothUsable = owners.every(owner => owner.routes.some(route => route.bodySupported));
        assert(owners.every(owner => owner.routes.every(route => route.bodySupported)), `${name}: graph corridor mismatch`);
    } catch (error) { report.error = String(error); }
    reports.push(report);
}
assert.equal(JSON.stringify(original), unchanged, 'source fixture unchanged');
assert.equal(reports.find(r => r.name === 'existing-low-north')?.bothMoved, true);
assert.equal(reports.find(r => r.name === 'existing-low-north')?.bothUsable, true);
assert.equal(reports.find(r => r.name === 'high-west')?.bothMoved, true, 'west candidate must accept both ordinary moves');
assert.equal(reports.find(r => r.name === 'high-west')?.bothUsable, true, 'west candidate must retain supported home routes');
assert.match(String(reports.find(r => r.name === 'high-north')?.error), /広さが足りない/, 'existing high north rejection preserved');
for (const name of ['high-east', 'high-south']) assert.match(String(reports.find(r => r.name === name)?.error), /広さが足りない/);
const guardReports: Record<string, unknown>[] = [];
for (const [name, shape, actors] of [
    ['fixed-house', { ...low, center: { x: 3, z: 2 }, height: .9, rampDirection: 'west' }, []],
    ['fixed-dock', { ...low, center: { x: 7, z: 5 }, height: .9, rampDirection: 'west' }, []],
    ['actor-on-changing-floor', { ...low, height: .9, rampDirection: 'west' }, [{ x: 4, z: 5 }]],
] as const) {
    try { replacePlace(original, shape, { actors: [...actors], occupiedPlaceTargets: [] }); guardReports.push({ name, rejected: false }); }
    catch (error) { guardReports.push({ name, rejected: true, error: String(error) }); }
}
assert(guardReports.every(r => r.rejected), 'each dangerous preselected geometry must be rejected');
for (const name of ['fixed-house', 'fixed-dock']) assert.match(String(guardReports.find(r => r.name === name)?.error), /おうちと ふなつきばの 足もと/);
assert.match(String(guardReports.find(r => r.name === 'actor-on-changing-floor')?.error), /なかまが いるよ/);
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', scope: 'Directional field diagnostic with actual transformed world/model/move/route; no persistence, browser, or actor-use claim',
    constraints: { sameFixture: true, bounds: landBounds(original), actors: 'empty static precondition; live UI must still check residents', noAutomaticHeightOrRadiusChanges: true },
    scalarChecks: { paritySamples, shortSpaceRejected: true, wetLandingRejected: true, wetBodyRimRejected: true, sourceWaterStripRejected: true, nonFiniteLandingRejected: true }, reports, guardReports }, null, 2));
