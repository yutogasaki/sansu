import { test } from 'vitest';
import assert from 'node:assert/strict';
import { makePlacePack, loadPlaceDomain, PLACE_FIXTURE_SCHEMA } from './growing-place-fixtures.mjs';
import { hash, stableJSON } from './growing-fixture-data.mjs';

test('all fifteen catalog layouts, four real relations and a whole island have honest reusable native diagnostics', async () => {
    const pack = await makePlacePack(), { domain } = await loadPlaceDomain();
    assert.equal(pack.schema, PLACE_FIXTURE_SCHEMA); assert.equal(pack.synthetic, true);
    assert.equal(pack.cases.length, 20);
    assert.equal(pack.payloadHash, hash(stableJSON(pack.cases)));
    const variants = pack.cases.filter(item => item.expected.places?.length);
    assert.equal(variants.length, 15);
    for (const item of pack.cases) {
        assert.equal(item.island.version, 4); assert.equal(item.profile.id, item.island.profileId);
        assert.deepEqual(item.island.state.learned, []); assert.equal(item.profile.todayCount, 0);
        assert.deepEqual(item.profile.recentAttempts, []);
        assert.deepEqual(item.island.state.placeProgress.uses, {});
        assert.deepEqual(item.island.state.placeProgress.shown, {});
        assert(!item.island.state.placeProgress.milestones.P06, 'maturity must not invent real actor use');
        assert.deepEqual(domain.derivePlaces(item.island.state), item.projection.places);
        assert.deepEqual(domain.derivePlaceRelations(item.island.state), item.projection.relations);
        assert(item.conditions.some(condition => condition.includes('No invented learning')));
    }
    for (const id of ['C01', 'C02', 'C03', 'C04']) assert(pack.cases.some(item => item.expected.relations?.includes(id)));
    const whole = pack.cases.at(-1);
    assert.equal(new Set(whole.projection.places.filter(place => place.stage === 'grown').map(place => place.family)).size, 4);
    assert.equal(whole.island.state.plots.filter(plot => plot.kind === 'home').length, 8);
    assert.equal(whole.expected.homeStage, 4);
    assert(whole.island.state.plots.filter(plot => plot.kind === 'home').every(plot => plot.stage === 4));
    assert(variants.flatMap(item => item.island.state.plots).filter(plot => plot.kind === 'home').every(plot => plot.stage === 2));
    assert.equal(new Set(whole.island.state.plots.filter(plot => plot.kind === 'home').map(plot => plot.id)).size, 8);
    assert.equal(whole.island.state.villagers.length, 8);
    const styles = whole.island.state.plots.filter(plot => plot.kind === 'home').map(plot => plot.style);
    assert.deepEqual(new Set(styles), new Set(['tree', 'plain', 'water', 'flower', 'light']));
    for (const expected of whole.expected.wholePlaces) assert(whole.projection.places.some(place => place.ruleId === expected.ruleId && place.variant === expected.variant && place.stage === 'grown'));
});

test('fixture payload is deterministic and reports the complete source lineage', async () => {
    const a = await makePlacePack(), b = await makePlacePack();
    assert.equal(a.payloadHash, b.payloadHash); assert.equal(a.sourceHash, b.sourceHash);
    assert(a.sources['docs/product/island-place-goals.json']);
    assert(a.sources['src/domain/growingIsland/placeTerrain.ts']);
    assert(a.sources['src/domain/growingIsland/placeGoals.ts']);
    assert.equal(a.sourceHash, hash(stableJSON(a.sources)));
});
