import { test } from 'vitest';
import assert from 'node:assert/strict';
import { confirmStoredPlacement, currentWholeIslandUseEvidence, main, matchesPlaceUse, parseOptions, until } from './e2e-growing-places.mjs';

test('runtime harness accepts only explicit loopback DEV or identified build targets and fresh external evidence', () => {
    assert.equal(parseOptions(['--url', 'http://127.0.0.1:5198', '--output-dir', '/private/tmp/place-evidence', '--development']).development, true);
    assert.equal(parseOptions(['--url', 'http://localhost:5219', '--output-dir', '/private/tmp/place-evidence', '--build-dir', '/private/tmp/build']).url, 'http://localhost:5219');
    assert.throws(() => parseOptions(['--url', 'https://example.com', '--output-dir', '/private/tmp/place-evidence', '--development']), /loopback/);
    assert.throws(() => parseOptions(['--url', 'http://127.0.0.1:5198', '--output-dir', '/private/tmp/place-evidence']), /Identify/);
    assert.throws(() => parseOptions(['--url', 'http://127.0.0.1:5198', '--output-dir', '/private/tmp/build/evidence', '--build-dir', '/private/tmp/build']), /outside/);
    assert.throws(() => parseOptions(['--url', 'http://127.0.0.1:5198', '--url', 'http://localhost:5198', '--output-dir', '/private/tmp/place-evidence', '--development']), /Duplicate/);
});

test('plan prepares exact reusable diagnostics while explicitly declining to claim runtime or external gates', async () => {
    const plan = await main(['--plan']);
    assert.equal(plan.runtimeExecuted, false); assert.equal(plan.diagnosticCases, 20); assert.equal(plan.catalogLayouts, 15);
    assert.equal(plan.combinations, 4); assert.equal(plan.currentTable, 'placedIslands'); assert.equal(plan.recordVersion, 4);
    assert.equal(plan.gates.runtime, 'NOT_EXECUTED'); assert.equal(plan.gates.naturalSevenDayGrowth, 'NOT_EVALUATED');
    assert.equal(plan.gates.comprehensionSafety, 'NOT_EVALUATED');
});

test('stored-owner driver waits through a busy control and a missed confirmation, then verifies the original mature owner', async () => {
    let taps = 0, polls = 0;
    const state = { drops: 9940, plots: [], landmarks: [{ id: 'l1', kind: 'sapling', growth: 18, maturedAt: 0 }], keepsakes: [] };
    const button = { isVisible: async () => true, isEnabled: async () => ++polls > 1,
        tap: async () => { if (++taps === 2) state.landmarks[0].cell = { x: 7, z: 2 }; } };
    const page = { locator: () => ({ getByRole: () => button }), waitForTimeout: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) };
    const result = await confirmStoredPlacement(page, async () => structuredClone({ state }), 'l1', { x: 7, z: 2 }, 2500);
    assert.equal(result.confirmationTaps, 2);
    assert.deepEqual(result.record.state.landmarks, [{ id: 'l1', kind: 'sapling', growth: 18, maturedAt: 0, cell: { x: 7, z: 2 } }]);
    assert.equal(result.record.state.drops, 9940);
});

test('stored-owner driver rejects a substituted purchase instead of accepting the new tree', async () => {
    const state = { drops: 9940, plots: [], landmarks: [{ id: 'l1', kind: 'sapling', growth: 18, maturedAt: 0 }], keepsakes: [] };
    const button = { isVisible: async () => true, isEnabled: async () => true,
        tap: async () => { state.drops -= 20; state.landmarks.push({ id: 'l4', kind: 'sapling', growth: 0, cell: { x: 7, z: 2 } }); } };
    const page = { locator: () => ({ getByRole: () => button }), waitForTimeout: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) };
    await assert.rejects(confirmStoredPlacement(page, async () => structuredClone({ state }), 'l1', { x: 7, z: 2 }, 2500), /must not buy another object/);
});

test('real-use acceptance keeps actor, target and complete shape revision exact', () => {
    const expected = { ruleId: 'P01', actorId: 'pokomoko', targetId: 'l3', revision: '[1,"P01","lane",18]' };
    const record = fact => ({ state: { placeProgress: { uses: { P01: { pokomoko: fact } } } } });
    assert.equal(matchesPlaceUse(record(expected), expected), true);
    for (const changed of [{ actorId: 'friend' }, { targetId: 'l4' }, { revision: '[1,"P01","lane",19]' }]) {
        assert.equal(matchesPlaceUse(record({ ...expected, ...changed }), expected), false);
    }
    assert.equal(matchesPlaceUse({ state: {} }, expected), false);
});

test('native polling accepts an exact receipt saved at the final deadline poll', async () => {
    let reads = 0;
    const page = { waitForTimeout: () => new Promise(resolve => setTimeout(resolve, 10)) };
    const result = await until(page, async () => ({ saved: ++reads > 1 }), value => value.saved, 'deadline receipt', 5);
    assert.equal(result.saved, true); assert.equal(reads, 2);
});

test('native polling still fails when the final deadline poll does not match', async () => {
    let reads = 0;
    const page = { waitForTimeout: () => new Promise(resolve => setTimeout(resolve, 10)) };
    await assert.rejects(until(page, async () => ({ saved: (++reads, false) }), value => value.saved, 'wrong receipt', 5), /Unproved runtime condition/);
    assert.equal(reads, 2);
});

test('whole-island use accepts real current actors in different mature places without prescribing P05', () => {
    const places = ['grove', 'spring', 'community'].map((family, i) => ({ id: `place-${i}`, ruleId: `P0${i + 1}`, family,
        stage: 'grown', revision: `shape-${i}`, anchorId: `owner-${i}`, memberIds: [`owner-${i}`],
        entrances: [{ x: i, z: 0 }], useTargets: [{ id: `target-${i}` }] }));
    const fact = (index, actorId) => ({ ruleId: places[index].ruleId, revision: places[index].revision,
        anchorId: places[index].anchorId, memberIds: [...places[index].memberIds], targetId: places[index].useTargets[0].id, actorId });
    const record = { state: { villagers: [{ id: 'friend', home: 'home' }], plots: [{ id: 'home', kind: 'home', stage: 4, cell: { x: 3, z: 0 } }],
        arrivals: [], unopened: [], placeProgress: { useHistory: [fact(0, 'pokomoko'), fact(1, 'friend')], uses: {} } } };
    const reachable = new Set(['0,0', '1,0', '2,0']);
    assert.equal(currentWholeIslandUseEvidence(record, places, reachable)?.pokomoko.targetId, 'target-0');
    assert.equal(currentWholeIslandUseEvidence(record, places, reachable)?.villager.targetId, 'target-1');
    for (const change of [{ revision: 'obsolete' }, { anchorId: 'removed-owner' }, { memberIds: ['substituted-owner'] }, { targetId: 'removed-seat' }, { actorId: 'absent' }]) {
        const changed = structuredClone(record); Object.assign(changed.state.placeProgress.useHistory[1], change);
        assert.equal(currentWholeIslandUseEvidence(changed, places, reachable), undefined);
    }
    for (const change of [{ away: true }, { home: 'removed-home' }]) {
        const changed = structuredClone(record); Object.assign(changed.state.villagers[0], change);
        assert.equal(currentWholeIslandUseEvidence(changed, places, reachable), undefined);
    }
    const arriving = structuredClone(record); arriving.state.arrivals = ['friend'];
    assert.equal(currentWholeIslandUseEvidence(arriving, places, reachable), undefined);
    const unopened = structuredClone(record); unopened.state.unopened = ['home'];
    assert.equal(currentWholeIslandUseEvidence(unopened, places, reachable), undefined);
    assert.equal(currentWholeIslandUseEvidence(record, places, new Set(['0,0', '1,0'])), undefined);
    assert.equal(currentWholeIslandUseEvidence(record, places.map(place => ({ ...place, family: 'grove' })), reachable), undefined);
    assert.equal(currentWholeIslandUseEvidence(record, places.map(place => ({ ...place, stage: 'connected' })), reachable), undefined);
});
