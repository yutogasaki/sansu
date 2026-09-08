import assert from 'node:assert/strict';

const clone = structuredClone;
const namespace = 'island-workshop:v1:';
const specimenIds = ['driftwood', 'seaglass', 'striped-shell'];
const partIds = ['straight', 'elbow', 'wheel', 'bell'];
const identityResults = { driftwood: 'float', seaglass: 'transmit', 'striped-shell': 'opaque' };
const scoped = (owner, kind, key) => `${namespace}${kind}:${encodeURIComponent(owner)}:${key}`;
export const islandFor = (state, owner) => state.islands.find(value => value.profileId === owner);
// These stores have string IDs. IDB key order is code-unit order, never locale collation.
export const orderEvents = events => events.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function emptyWorkshop(owner) {
    const layout = { parts: Object.fromEntries(partIds.map(id => [id, { assembled: false, rotation: 0 }])) };
    return { version: 1, specimens: Object.fromEntries(specimenIds.map(id => [id,
        { id: scoped(owner, 'specimen', id), cleanedMask: 0, observations: [] }])),
    shelves: { 'shelf-1': null, 'shelf-2': null, 'shelf-3': null },
    draftCheckpoint: { draft: { layout: clone(layout), undo: [], redo: [] }, baseLayout: layout }, works: {}, creations: [] };
}
function firstRecord(state, owner, kind, key, timestamp) {
    const records = [...Object.values(state.specimens).flatMap(value => [...value.observations, ...(value.identity ? [value.identity] : [])]), ...state.creations];
    return { id: scoped(owner, kind, key), observedAt: Math.max(timestamp, ...records.map(value => value.observedAt)), order: records.length + 1 };
}
// Only the finite gestures in this scenario are audited. No app reducer is imported.
// The final whole-store equality also protects shelves, prior works, history and other specimens.
export function assertWorkshopDelta(before, after, owner, expectedActions) {
    assert(expectedActions.length, 'An explicit list of canonical gestures/results is required');
    const expected = clone(before), island = islandFor(expected, owner), old = islandFor(before, owner);
    const oldIds = new Set(before.islandEvents.map(value => value.id));
    const added = after.islandEvents.filter(value => !oldIds.has(value.id)).sort((a, b) => {
        const revision = value => JSON.parse(value.id.slice(`${namespace}operation:`.length))[1];
        return revision(a) - revision(b);
    });
    assert.equal(added.length, expectedActions.length, 'Exactly the intended receipts must be added');
    island.workshop = island.workshop ?? emptyWorkshop(owner);
    for (const [index, action] of expectedActions.entries()) {
        const event = added[index], timestamp = event.timestamp, state = island.workshop;
        assert(Number.isSafeInteger(timestamp) && timestamp >= 0);
        assert.deepEqual(event, { id: `${namespace}operation:${JSON.stringify([owner, old.revision + index])}`,
            profileId: owner, type: 'workshop_changed', timestamp, action });
        if (action.type === 'brush') state.specimens[action.specimenId].cleanedMask |= 1 << action.section;
        else if (action.type === 'observe-specimen') {
            const specimen = state.specimens[action.specimenId];
            assert.equal(specimen.cleanedMask, action.cleanedMask);
            assert(!specimen.observations.some(value => value.result === action.result), 'This scenario requires a new visible result');
            specimen.observations.push({ ...firstRecord(state, owner, 'observation', `${action.specimenId}:${action.result}`, timestamp), result: action.result });
            if (!specimen.identity && ['clean', identityResults[action.specimenId]].every(result => specimen.observations.some(value => value.result === result))) {
                specimen.identity = firstRecord(state, owner, 'identity', action.specimenId, timestamp);
            }
        } else if (action.type === 'edit-draft') {
            const draft = state.draftCheckpoint.draft, priorLayout = clone(draft.layout), edit = action.edit;
            assert(['assemble', 'move'].includes(edit.type));
            if (edit.type === 'assemble') draft.layout.parts[edit.partId].assembled = true;
            else draft.layout.parts[edit.partId].position = clone(edit.position);
            assert.notDeepEqual(draft.layout, priorLayout, 'Every audited edit changes the chosen part');
            draft.undo = [...draft.undo, priorLayout].slice(-20); draft.redo = [];
        } else if (action.type === 'observe-creation') {
            assert(['wheel', 'bell'].includes(action.partId));
            assert.deepEqual(JSON.parse(action.layoutKey), state.draftCheckpoint.draft.layout);
            assert(!state.creations.some(value => value.partId === action.partId));
            state.creations.push({ ...firstRecord(state, owner, 'creation', action.partId, timestamp), partId: action.partId,
                layout: clone(state.draftCheckpoint.draft.layout) });
        } else throw new Error(`Unaudited workshop action ${action.type}`);
        island.revision++; island.updatedAt = timestamp; expected.islandEvents.push(event);
    }
    orderEvents(expected.islandEvents);
    assert.deepEqual(after, expected, 'Only exact gestures, first observations, draft history and receipts may change');
    return added;
}
export function assertSettingsSoundDelta(before, after, owner, enabled) {
    const expected = clone(before), profile = expected.profiles.find(value => value.id === owner);
    assert(profile); profile.soundEnabled = enabled;
    const mirrors = expected.appData.filter(value => value.profiles?.[owner]);
    assert.equal(mirrors.length, 1); mirrors[0].profiles[owner].soundEnabled = enabled;
    assert.deepEqual(after, expected, 'Settings sound writes both profile representations and no unrelated field');
}
export function assertDiscoveryDelta(before, after, owner) {
    const expected = clone(before), old = islandFor(before, owner), current = islandFor(after, owner), island = islandFor(expected, owner);
    const records = current.growth.discoveries.filter(value => !old.growth.discoveries.some(prior => prior.id === value.id));
    for (const record of records) {
        assert.deepEqual(Object.keys(record).sort(), ['discoveredAt', 'id', 'itemId'].sort());
        assert(Number.isSafeInteger(record.discoveredAt));
        island.growth.discoveries.push(record); island.revision++;
        expected.islandEvents.push({ id: JSON.stringify(['island-discovery-v1', owner, record.id]), profileId: owner,
            type: 'discovery_observed', timestamp: record.discoveredAt, itemId: record.itemId, discoveryId: record.id });
    }
    if (records.length) island.updatedAt = records.at(-1).discoveredAt;
    orderEvents(expected.islandEvents);
    assert.deepEqual(after, expected, 'Across live home only exact first-discovery additions are authorized');
    return records;
}
