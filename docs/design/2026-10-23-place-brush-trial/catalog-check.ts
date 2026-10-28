import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrowingTray } from '../../../src/components/island/growing/GrowingTray';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { compositeEditingRevision, type CompositeGrowingState } from './composite-model';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { PlaceShape } from './directional-field';

declare const __CATALOG_TRIAL_FILTER__: boolean;
const sha = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const state = structuredClone(fixture.state) as unknown as GrowingState;
const original = JSON.stringify(state), search = window.location.search;
assert.equal(state.tutorial, 'first-home');
assert(state.unlocked.includes('landmark:bench') && state.unlocked.includes('landmark:flower'));
const noop = () => undefined;
const results: Record<string, unknown>[] = [];
for (const [name, query] of [['product-like', ''], ['single-memory', search], ['single-saved', search + '&trialSave=local'],
    ['two-memory', search + '&placeSetTrial=two']] as const) {
    window.location.search = query;
    const html = renderToStaticMarkup(createElement(GrowingTray, { state, onPick: noop, onClose: noop }));
    const seedIds = [...html.matchAll(/data-growing-seed="([^"]+)"/g)].map(match => match[1]);
    const bench = html.includes('data-growing-landmark="bench"'), flower = html.includes('data-growing-flower=');
    assert.deepEqual(seedIds, ['home']);
    const homeButton = html.match(/<button[^>]*data-growing-seed="home"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert(homeButton, 'the home button remains present');
    assert(homeButton.includes('growing-free'), 'the original free first home remains free');
    assert(!homeButton.includes('aria-label="しずく 40"'), 'do not show a paid home while the command remains free');
    const expected = __CATALOG_TRIAL_FILTER__ && name === 'two-memory';
    assert.equal(bench, expected); assert.equal(flower, expected);
    assert.equal(JSON.stringify(state), original, 'render does not change tutorial, growth, learning or any state');
    results.push({ name, htmlSHA256: sha(html), seedIds, bench, flower, stateUnchanged: true });
}
if (__CATALOG_TRIAL_FILTER__) {
    for (const query of [search + '&placeSetTrial=two&trialSave=local', search.replace('&trialScene=shore', '') + '&placeSetTrial=two']) {
        window.location.search = query;
        assert.throws(() => renderToStaticMarkup(createElement(GrowingTray, { state, onPick: noop, onClose: noop })), /保存できません|初期データ/);
    }
}
window.location.search = search + '&placeSetTrial=two';
let purchase: unknown;
if (__CATALOG_TRIAL_FILTER__) {
    let current: CompositeGrowingState = { ...structuredClone(state), trialPlaceSet: {}, trialPlaceSetHistory: { version: 1, undo: [], redo: [] } };
    const shapes: [string, PlaceShape][] = [['west', { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 }],
        ['east', { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' }]];
    for (const [slot, shape] of shapes) current = applyIntent(current, { id: `catalog-shape-${slot}`, command: { type: 'place-set', action: 'apply',
        slot: slot as 'west' | 'east', shape, safety: { actors: [], occupiedPlaceTargets: [] }, expectedPlaceRevision: compositeEditingRevision(current) } }, 1000).state;
    for (const [id, cell] of [['starter-bench', { x: -1, z: 4 }], ['starter-flower', { x: 0, z: 4 }]] as const)
        current = applyIntent(current, { id: `catalog-move-${id}`, command: { type: 'move', id, cell } }, 1000).state;
    const before = structuredClone(current), ids = new Set(current.landmarks.map(item => item.id));
    for (const [kind, cell] of [['bench', { x: 5, z: 5 }], ['flower', { x: 6, z: 5 }]] as const)
        current = applyIntent(current, { id: `catalog-buy-${kind}`, command: { type: 'place', kind, cell } }, 1000).state;
    assert.equal(current.drops, before.drops - 30);
    assert.equal(current.tutorial, before.tutorial); assert.deepEqual(current.learned, before.learned); assert.deepEqual(current.growth, before.growth);
    const bought = current.landmarks.filter(item => !ids.has(item.id));
    assert.equal(bought.length, 2); assert(bought.every(item => item.growth === 0));
    assert.equal(JSON.stringify(state), original);
    purchase = { beforeDrops: before.drops, afterDrops: current.drops, bought, tutorial: current.tutorial,
        learnedUnchanged: true, growthUnchanged: true, preexistingOwners: before.landmarks };
}
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', transformedCatalog: __CATALOG_TRIAL_FILTER__, results, purchase,
    limitation: 'Research catalog presentation bypass only; first-home fixture is retained. SSR and real commands do not prove ordinary onboarding or browser interaction. New flower is not mature.' }, null, 2));
