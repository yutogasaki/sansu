import assert from 'node:assert/strict';

export const RESIDENTS = ['otter', 'rabbit', 'fox'];
export const LOOKS = ['original', 'scarf', 'cap', 'raincoat', 'star-beret'];
export const PATTERNS = ['river-check', 'butterfly-stitch'];
export const OWNED = ['raincoat', 'star-beret', ...PATTERNS];
export const EXISTING_PAIRS = [
    ...['original', 'cap', 'raincoat', 'star-beret'].map(look => ({ residentId: 'otter', look, pattern: 'river-check' })),
    { residentId: 'otter', look: 'original', pattern: 'butterfly-stitch' },
];
export const pairKey = ({ residentId, look, pattern }) => `${residentId}-${look}-${pattern}`;
export const PAIRS = RESIDENTS.flatMap(residentId => PATTERNS.flatMap(pattern => LOOKS.map(look => ({ residentId, look, pattern }))))
    .filter(pair => !EXISTING_PAIRS.some(old => pairKey(old) === pairKey(pair)));
// Nine uses, not a new clothing x furniture x ordered-partner Cartesian product.
export const USES = [
    ['telescope', 'otter', 'star-beret', 'butterfly-stitch'], ['telescope', 'rabbit', 'raincoat', 'river-check'], ['telescope', 'fox', 'star-beret', 'river-check'],
    ['hammock', 'otter', 'raincoat', 'river-check'], ['hammock', 'rabbit', 'star-beret', 'butterfly-stitch'], ['hammock', 'fox', 'raincoat', 'butterfly-stitch'],
    ['tea-table', 'otter', 'raincoat', 'river-check', 'rabbit'], ['tea-table', 'rabbit', 'star-beret', 'butterfly-stitch', 'fox'],
    ['tea-table', 'fox', 'raincoat', 'butterfly-stitch', 'otter'],
].map(([kind, residentId, look, pattern, partnerId]) => ({ kind, residentId, look, pattern, ...(partnerId ? { partnerId } : {}) }));
export const islandFor = (state, owner) => state.islands.find(value => value.profileId === owner);
const emptySelection = () => ({ version: 1, residents: Object.fromEntries(RESIDENTS.map(id => [id, { outfit: null, pattern: null, trail: null }])),
    soundscape: null, environment: { period: null, season: null }, album: { cover: null, stamp: null }, flagTrim: null });

/** This is explicitly an injected visual fixture, never an acquisition result.
 * Keep the complete real final DB and all furniture positions/reservations. */
export function makeVisualFixture(native) {
    const fixture = structuredClone(native);
    assert.equal(fixture.islands.length, 1); assert.equal(fixture.profiles.length, 1);
    const island = fixture.islands[0], owner = island.profileId;
    assert.equal(fixture.profiles[0].id, owner);
    assert.equal(fixture.appData[0].activeProfileId, owner);
    assert(fixture.islandPlans.some(plan => plan.id === island.pendingPlanId && plan.profileId === owner && plan.status === 'active'));
    assert.equal(island.expression, undefined); assert.equal(island.experience, undefined);
    for (const kind of ['telescope', 'hammock', 'tea-table']) assert(island.items.some(item => item.id === `optional-${kind}` && item.kind === kind && item.position));
    island.expression = { version: 1, ownedItemIds: [...OWNED], selection: emptySelection() };
    island.experience = { version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off', layouts: [],
        residents: { otter: { name: 'カワウソ', look: 'original' }, rabbit: { name: 'ウサギ', look: 'original' }, fox: { name: 'キツネ', look: 'original' } } };
    fixture.profiles[0].soundEnabled = false; fixture.appData[0].profiles[owner].soundEnabled = false;
    return fixture;
}

/** No whitelist of world fields: compare every row in every native table. */
export function assertVisualMutation(before, after, owner, action) {
    if (!action) { assert.deepEqual(after, before, 'Viewing/use/cancel cannot replace the verified all-store baseline'); return; }
    assert(RESIDENTS.includes(action.residentId));
    const expected = structuredClone(before), old = islandFor(before, owner), next = islandFor(after, owner), island = islandFor(expected, owner);
    assert(old && next && island); assert(Number.isSafeInteger(next.updatedAt) && next.updatedAt >= old.updatedAt);
    const resident = island.expression.selection.residents[action.residentId];
    if (action.type === 'resident-look') {
        assert(['original', 'scarf', 'cap'].includes(action.look));
        island.experience.residents[action.residentId].look = action.look; resident.outfit = null;
    } else if (action.type === 'equip-outfit') {
        assert(['raincoat', 'star-beret'].includes(action.itemId)); resident.outfit = action.itemId;
    } else { assert.equal(action.type, 'equip-pattern'); assert(PATTERNS.includes(action.itemId)); resident.pattern = action.itemId; }
    island.revision++; island.updatedAt = next.updatedAt;
    const family = action.type === 'resident-look' ? 'experience' : 'expression';
    expected.islandEvents.push({ id: JSON.stringify([`island-${family}-v1`, owner, old.revision]), profileId: owner,
        type: `${family}_changed`, timestamp: next.updatedAt, action });
    expected.islandEvents.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    assert.deepEqual(after, expected, 'Only the chosen look/pattern and its single canonical receipt may change');
}

export function assertRenderedPair(frame, pair, rigIds, requirePortrait = true) {
    assert.equal(frame.hidden, false); assert(frame.canvas.visible);
    assert.equal(frame.expressionCandidate, 'island-expression-v1');
    assert(Number.isFinite(frame.timestamp));
    if (requirePortrait) assert.equal(frame.portrait?.id, pair.residentId, 'Actual camera must focus the selected real resident');
    assert.equal(frame.camera?.split(',').length, 32);
    const resident = frame.expression?.residents.find(value => value.id === pair.residentId);
    assert(resident?.visible); assert.equal(resident.uuid, rigIds[pair.residentId]);
    assert.equal(resident.pattern, pair.pattern);
    const outfit = ['raincoat', 'star-beret'].includes(pair.look) ? pair.look : null;
    assert.equal(resident.outfit, outfit);
    if (!outfit) assert.equal(frame.residents.find(value => value.species === pair.residentId)?.look, pair.look);
    for (const [name, visible] of [['expression-raincoat', outfit === 'raincoat'], ['expression-star-beret', outfit === 'star-beret'], ['expression-pattern-cloth', true]]) {
        assert.equal(resident.groups.find(group => group.name === name)?.visible, visible, name);
    }
    for (const other of frame.expression.residents) assert.equal(other.uuid, rigIds[other.id], 'No replacement rig while changing clothes');
    // Actual PNGs are reviewed separately; visible=true is not proof of an unobscured face or fabric.
}
const distance = (a, b) => { assert(a?.length === 3 && b?.length === 3); return Math.hypot(...a.map((value, i) => value - b[i])); };
// Camera is an orthonormal Object3D transform. Same viewport/contact boundary as the existing furniture QA.
function inFrame(frame, points) {
    const values = frame.camera?.split(',').map(Number); assert(values?.length === 32 && values.every(Number.isFinite));
    const m = values.slice(0, 16), p = values.slice(16);
    return frame.canvas.visible && !frame.hidden && points.every(point => {
        assert(point?.length === 3 && point.every(Number.isFinite));
        const v = point.map((value, i) => value - m[12 + i]);
        const eye = [0, 4, 8].map(offset => v.reduce((sum, value, i) => sum + value * m[offset + i], 0));
        const clip = [0, 1, 2, 3].map(i => eye.reduce((sum, value, j) => sum + value * p[j * 4 + i], p[12 + i]));
        return clip[3] > 0 && Math.abs(clip[0] / clip[3]) < .985 && Math.abs(clip[1] / clip[3]) < .985 && Math.abs(clip[2] / clip[3]) <= 1;
    });
}
export function assertFurnitureUse(probe, use, rigIds, requestId) {
    assert(probe.gesture?.trusted && !probe.gesture.hidden);
    const frames = probe.frames.filter(frame => frame.optional?.requestId === requestId), visits = frames.map(frame => frame.optional);
    assert(frames.length > 2); const actorIds = use.partnerId ? [use.residentId, use.partnerId] : [use.residentId];
    for (const frame of frames) {
        const visit = frame.optional;
        assert(typeof frame.optionalCandidate === 'string' && frame.optionalCandidate.length > 0);
        assert.equal(visit.itemId, `optional-${use.kind}`); assert.equal(visit.kind, use.kind); assert.equal(visit.borrowed, false);
        assert.equal(visit.radius, { telescope: .90, hammock: 1.05, 'tea-table': 1.20 }[use.kind]);
        assert.deepEqual(visit.actorIds, actorIds); assert.deepEqual(visit.actors.map(actor => actor.id), actorIds);
        assert.deepEqual(visit.actors.map(actor => actor.uuid), actorIds.map(id => rigIds[id]));
        assertRenderedPair(frame, use, rigIds, false);
    }
    for (const phase of ['walking', 'settled']) assert(visits.some(visit => visit.phase === phase), `Missing actual ${phase} frame`);
    const contact = frames.find(frame => frame.optional.contactSeen && ['contact', 'pickup'].includes(frame.optional.phase)); assert(contact);
    const first = contact.optional.actors[0], anchors = contact.optional.anchors;
    if (use.kind === 'telescope') {
        assert(distance(first.eye, anchors.eye) < .005);
        assert(first.hands.every((hand, i) => distance(hand, anchors.grips[i]) < .005));
        assert(inFrame(contact, [first.eye, anchors.eye, ...first.hands, ...anchors.grips]));
        assert(visits.some(visit => visit.phase === 'using'));
    } else if (use.kind === 'hammock') {
        assert(inFrame(contact, [anchors.seat])); assert(visits.some(visit => visit.phase === 'mounting')); assert(visits.some(visit => visit.phase === 'using'));
    } else {
        const handoff = frames.find(frame => frame.optional.phase === 'handoff' && frame.optional.transferSeen); assert(handoff);
        assert.equal(new Set(visits.map(visit => visit.cup.uuid)).size, 1);
        for (const id of actorIds) assert(visits.some(visit => visit.cup.holder === id));
        assert.equal(visits.at(-1).cup.holder, 'table');
        const hands = [handoff.optional.actors[0].hands[1], handoff.optional.actors[1].hands[0]];
        assert(hands.every((hand, i) => distance(hand, handoff.optional.anchors.cupGrips[i]) < .008));
        assert(inFrame(handoff, [...hands, ...handoff.optional.anchors.cupGrips]));
        assert(probe.images.some(image => image.frame.optional?.requestId === requestId && image.frame.optional.phase === 'handoff' && image.frame.optional.transferSeen));
    }
    const phases = [...new Set(visits.map(visit => visit.phase))];
    for (const phase of phases) assert(probe.images.some(image => image.key === phase && image.frame.optional?.requestId === requestId), `Missing actual phase PNG: ${phase}`);
    assert(probe.images.some(image => image.frame.optional?.requestId === requestId && image.frame.optional.contactSeen));
    return { requestId, actorIds, actorUuids: actorIds.map(id => rigIds[id]), phases, contactTimestamp: contact.timestamp, runtimePass: true, visualReview: 'pending' };
}
