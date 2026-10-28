import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { coastalTrialMode, createCoastalPlaceSection, type CoastalMode } from './coastal-section';
import { type PlaceShape } from './directional-field';
import { replacePlace } from './model';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { HOME_CELL, approachCells, walkableCells } from '../../../src/domain/growingIsland/space';
import { HOUSE_CELLS, landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';

// The runner adds the fourth explicit mode parameter only to this diagnostic
// bundle. Normal model/command imports use the same real query-selected mode.
const compile = editableIslandWorld as unknown as
    (state: GrowingState, curved: boolean, method: 'H', mode: CoastalMode) => IslandWorld;
const original = structuredClone(fixture.state) as unknown as GrowingState, unchanged = JSON.stringify(original);
const mode = coastalTrialMode(), safety = { actors: [], occupiedPlaceTargets: [] };
const scalarSample = (cell: Cell) => .1 + cell.x * .03 + cell.z * .05;
assert.equal(createCoastalPlaceSection(original, scalarSample, 'off').heightAt, scalarSample, 'off exact no-op');
assert.equal(createCoastalPlaceSection(original, scalarSample, mode).heightAt, scalarSample, 'no place exact no-op');
const shapes: { name: string; shape: PlaceShape; flower: Cell }[] = [
    { name: 'west-low', shape: { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 }, flower: { x: 0, z: 4 } },
    { name: 'east-high', shape: { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' }, flower: { x: 6, z: 5 } },
];
const reports: Record<string, unknown>[] = [];
for (const { name, shape, flower } of shapes) {
    const state = { ...original, trialPlace: shape };
    const before = compile(state, true, 'H', 'off'), after = compile(state, true, 'H', mode);
    const operator = createCoastalPlaceSection(state, () => shape.height, mode);
    const vertices = [...before.floors, ...after.floors].flatMap(f => f.vertices), seen = new Set<string>();
    let checked = 0, changed = 0, raised = 0, newlyDry = 0, reservedChanged = 0, outsideChanged = 0, largestDrop = 0;
    const examples: Record<string, unknown>[] = [];
    for (const v of vertices) {
        const id = `${v.cell.x},${v.cell.z}`; if (seen.has(id)) continue; seen.add(id);
        const old = before.floorAt(v.cell)?.point, next = after.floorAt(v.cell)?.point;
        checked++;
        const differs = Boolean(old) !== Boolean(next) || old && next && Math.hypot(old.x - next.x, old.y - next.y, old.z - next.z) > 1e-8;
        if (!differs) continue;
        changed++;
        if (!old && next) newlyDry++;
        if (old && next && next.y > old.y + 1e-8) raised++;
        if (old && next) largestDrop = Math.max(largestDrop, old.y - next.y);
        if (operator.reserved(v.cell)) reservedChanged++;
        if (!operator.meshInfluenceContains(v.cell, 12)) outsideChanged++;
        if (examples.length < 6) examples.push({ cell: v.cell, old, next });
    }
    assert.equal(newlyDry, 0, `${name} additional shore creates dry floor`);
    assert.equal(raised, 0, `${name} additional shore raises floor`);
    assert.equal(outsideChanged, 0, `${name} outside mesh closure`);
    // Reserved analytic halo may contain affected triangles at its outer edge;
    // the actual top ellipse and ramp strip below must be exactly unchanged.
    let protectedSamples = 0, protectedChanges = 0;
    for (const v of vertices) {
        const dx = v.cell.x - shape.center.x, dz = v.cell.z - shape.center.z;
        const top = Math.hypot(dx, dz / .8) <= shape.flatRadius!;
        const ramp = shape.rampDirection === 'west' ? dx <= 0 && Math.abs(dz) <= shape.entrance / 2 + .5
            : dz <= 0 && Math.abs(dx) <= shape.entrance / 2 + .5;
        if (!top && !ramp) continue;
        protectedSamples++;
        const old = before.floorAt(v.cell)?.point, next = after.floorAt(v.cell)?.point;
        if (Boolean(old) !== Boolean(next) || old && next && Math.hypot(old.x - next.x, old.y - next.y, old.z - next.z) > 1e-8) protectedChanges++;
    }
    assert.equal(protectedChanges, 0, `${name} top or ramp changed`);
    const report: Record<string, unknown> = { name, mode, shape, direction: operator.direction, requestedWidth: operator.requestedWidth,
        coastDistance: operator.coastDistance, centerStart: operator.centerStart, centerShoulderWidth: operator.centerShoulderWidth,
        contour: operator.contour,
        geometry: { checked, changed, raised, newlyDry, reservedHaloChanges: reservedChanged, outsideChanged, largestDrop,
            protectedSamples, protectedChanges, examples } };
    const b = landBounds(state), fixed = [...HOUSE_CELLS, { x: b.maxX - 1, z: b.depth - 1 }];
    report.fixedFooting = fixed.map(cell => {
        const probes = [-.46, -.23, 0, .23, .46].flatMap(x => [-.46, -.23, 0, .23, .46].map(z => {
            const p = { x: cell.x + x, z: cell.z + z };
            return { old: before.floorAt(p)?.point.y, next: after.floorAt(p)?.point.y };
        }));
        return { cell, lostDryProbes: probes.filter(p => p.old !== undefined && p.next === undefined).length,
            maxRetainedHeightDifference: Math.max(0, ...probes.flatMap(p => p.old === undefined || p.next === undefined ? [] : [Math.abs(p.old - p.next)])) };
    });
    try {
        let accepted = replacePlace(original, shape, safety);
        const moves: Record<string, unknown>[] = [];
        for (const [id, cell] of [['starter-bench', shape.center], ['starter-flower', flower]] as const) {
            try { accepted = applyIntent(accepted, { id: `coast-${mode}-${name}-${id}`, command: { type: 'move', id, cell } }, accepted.nature.realAt).state;
                moves.push({ id, cell, accepted: true }); }
            catch (error) { moves.push({ id, cell, accepted: false, error: String(error) }); }
        }
        const world = editableIslandWorld(accepted)!, open = walkableCells(accepted, world);
        const owners = accepted.landmarks.filter(o => ['starter-bench', 'starter-flower'].includes(o.id)).map(owner => ({ id: owner.id,
            cell: owner.cell, routes: owner.cell ? approachCells(owner.cell, world).filter(c => open.has(`${c.x},${c.z}`)).flatMap(c => {
                const route = world.route(HOME_CELL, c, open); return route ? [{ target: c, route,
                    bodySupported: route.slice(1).every((p, i) => editableTerrainSegmentSupported(world, route[i], p)) }] : [];
            }) : [] }));
        report.placeAccepted = true; report.moves = moves; report.owners = owners;
        report.bothMoved = moves.every(m => m.accepted); report.bothUsable = owners.every(o => o.routes.some(r => r.bodySupported));
        assert(owners.every(o => o.routes.every(r => r.bodySupported)), `${name} route support mismatch`);
    } catch (error) { report.error = String(error); }
    if (name === 'west-low') {
        try { replacePlace(original, shape, { actors: [{ x: -3, z: 4 }], occupiedPlaceTargets: [] });
            report.actorFootingGuard = 'not rejected'; }
        catch (error) { report.actorFootingGuard = String(error); }
    }
    const axis = operator.direction === 'west' ? { x: -1, z: 0 } : { x: 0, z: 1 };
    report.centerSection = Array.from({ length: 29 }, (_, i) => {
        const d = i / 8, cell = { x: shape.center.x + axis.x * d, z: shape.center.z + axis.z * d };
        return { d, cell, before: before.floorAt(cell)?.point.y ?? null, after: after.floorAt(cell)?.point.y ?? null };
    });
    reports.push(report);
}
assert.equal(JSON.stringify(original), unchanged);
assert.equal(reports[0].bothMoved, true, 'west-low keeps both ordinary moves');
assert.equal(reports[0].bothUsable, true, 'west-low keeps body-supported routes');
if (mode === 'off') {
    assert.equal(reports[1].bothMoved, true); assert.equal(reports[1].bothUsable, true);
} else if (mode === 'soft08' || mode === 'soft12') {
    assert.match(String(reports[1].error), /おうちと ふなつきばの 足もと/, 'east-high must reject dock interference');
    assert.match(String(reports[0].actorFootingGuard), /なかまが いるよ/, 'actor on changed shore must block edit');
} else {
    // Contour is a new candidate. It must report the existing guard outcome,
    // rather than turn a geometry failure into a forced acceptance.
    assert(reports[1].bothMoved && reports[1].bothUsable || /おうちと ふなつきばの 足もと/.test(String(reports[1].error)));
    assert.match(String(reports[0].actorFootingGuard), /なかまが いるよ/);
}
const query = window.location.search;
try {
    for (const activeMode of ['soft08', 'soft12', 'contour']) {
        window.location.search = '?shoreTrial=' + activeMode + '&trialSave=local';
        assert.throws(() => coastalTrialMode(), /保存を使わない/, 'saved v3 must not be reinterpreted');
        window.location.search = '?shoreTrial=' + activeMode + '&terrainTrial=H';
        assert.throws(() => coastalTrialMode(), /専用の地形H・shore/, 'missing fixture must fail closed');
    }
    window.location.search = '?shoreTrial=unknown';
    assert.equal(coastalTrialMode(), 'off', 'unknown flag has no effect');
} finally { window.location.search = query; }
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', mode,
    finding: mode === 'off' ? 'Both unchanged controls accepted.' : reports[1].bothMoved && reports[1].bothUsable
        ? 'Both static scenes accepted; visual and live interaction acceptance remains open.'
        : 'West accepted; east rejected for dock interference. Two-scene acceptance is NOT achieved.',
    queryContract: { savedTrialRejected: true, unknownFlagIsOff: true, missingFixtureRejected: true },
    scope: 'Actual transformed shared triangles and ordinary static commands. No saved-state, browser, resident-use or art acceptance.',
    reports }, null, 2));
