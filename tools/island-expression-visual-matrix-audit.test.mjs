import { describe, it, expect } from 'vitest';
import { PAIRS, USES, EXISTING_PAIRS, RESIDENTS, LOOKS, PATTERNS, OWNED, pairKey, makeVisualFixture,
    assertVisualMutation, assertRenderedPair, assertFurnitureUse } from './island-expression-visual-matrix-audit.mjs';

const owner = 'visual-unit-owner';
const native = () => ({ appData: [{ activeProfileId: owner, profiles: { [owner]: { id: owner, soundEnabled: true } } }],
    profiles: [{ id: owner, soundEnabled: true }], islandPlans: [{ id: 'reserved', profileId: owner, status: 'active', cursor: 3 }],
    islands: [{ profileId: owner, revision: 7, updatedAt: 100, pendingPlanId: 'reserved',
        items: ['telescope', 'hammock', 'tea-table'].map(kind => ({ kind, id: `optional-${kind}`, position: { x: 1, z: 2 }, rotation: 1 })),
        customization: { points: 4 }, unknownFutureBranch: { keep: true } }], islandEvents: [{ id: 'prior', profileId: owner }],
    logs: [{ id: 1, value: 'preserve' }], islandPhotos: [{ id: 'photo', hash: 'original' }], extraStore: [{ id: 'opaque', data: [2, 4] }] });
const ids = { otter: 'otter-uuid', rabbit: 'rabbit-uuid', fox: 'fox-uuid' };
const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const use = USES[0];
const frame = phase => ({ timestamp: 200, hidden: false, canvas: { visible: true }, camera: [...matrix, ...matrix].join(','),
    expressionCandidate: 'island-expression-v1', optionalCandidate: 'unit-geometry',
    portrait: { id: use.residentId }, residents: RESIDENTS.map(species => ({ species, look: 'original' })),
    expression: { residents: RESIDENTS.map(id => ({ id, uuid: ids[id], visible: true, outfit: use.look, pattern: use.pattern,
        groups: [{ name: 'expression-raincoat', visible: false }, { name: 'expression-star-beret', visible: true }, { name: 'expression-pattern-cloth', visible: true }] })) },
    optional: { requestId: 'request', itemId: 'optional-telescope', kind: 'telescope', radius: .9, borrowed: false, phase,
        actorIds: ['otter'], actors: [{ id: 'otter', uuid: ids.otter, eye: [0, 0, 0], hands: [[.1, 0, 0], [-.1, 0, 0]] }],
        contactSeen: phase !== 'walking', anchors: { eye: [0, 0, 0], grips: [[.1, 0, 0], [-.1, 0, 0]] } } });
const probe = () => { const frames = ['walking', 'contact', 'using', 'settled'].map(frame); return {
    gesture: { trusted: true, hidden: false }, frames, images: frames.map(frame => ({ key: frame.optional.phase, frame, file: `${frame.optional.phase}.png` })) }; };

describe('finite visual fixture and exact oracle', () => {
    it('adds only the 25 missing comparisons to the five existing ones, without another Cartesian product', () => {
        expect(PAIRS).toHaveLength(25); expect(EXISTING_PAIRS).toHaveLength(5);
        const keys = [...PAIRS, ...EXISTING_PAIRS].map(pairKey);
        expect(new Set(keys).size).toBe(30);
        expect(keys.sort()).toEqual(RESIDENTS.flatMap(residentId => LOOKS.flatMap(look => PATTERNS.map(pattern => pairKey({ residentId, look, pattern })))).sort());
        expect(USES).toHaveLength(9); expect(new Set(USES.map(use => `${use.kind}-${use.residentId}`)).size).toBe(9);
        for (const resident of RESIDENTS) {
            expect(new Set(USES.filter(use => use.residentId === resident).map(use => use.look)).size).toBe(2);
            expect(new Set(USES.filter(use => use.residentId === resident).map(use => use.pattern)).size).toBe(2);
        }
    });
    it('does not edit source data, furniture, old history or the active reservation when building the declared fixture', () => {
        const before = native(), original = structuredClone(before), fixture = makeVisualFixture(before);
        expect(before).toEqual(original); expect(fixture.islands[0].expression.ownedItemIds).toEqual(OWNED);
        const expected = structuredClone(before); expected.islands[0].expression = fixture.islands[0].expression;
        expected.islands[0].experience = fixture.islands[0].experience; expected.profiles[0].soundEnabled = false;
        expected.appData[0].profiles[owner].soundEnabled = false; expect(fixture).toEqual(expected);
        const wrong = native(); wrong.islandPlans[0].status = 'finished'; expect(() => makeVisualFixture(wrong)).toThrow();
    });
    for (const action of [{ type: 'resident-look', residentId: 'rabbit', look: 'scarf' },
        { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }, { type: 'equip-pattern', residentId: 'fox', itemId: 'butterfly-stitch' }]) {
        it(`checks the whole native DB for ${action.type}, including unknown fields and other owners`, () => {
            const before = makeVisualFixture(native()), after = structuredClone(before), island = after.islands[0];
            if (action.type === 'resident-look') island.experience.residents.rabbit.look = 'scarf';
            if (action.type === 'equip-outfit') island.expression.selection.residents.otter.outfit = 'raincoat';
            if (action.type === 'equip-pattern') island.expression.selection.residents.fox.pattern = 'butterfly-stitch';
            island.revision++; island.updatedAt = 101; const family = action.type === 'resident-look' ? 'experience' : 'expression';
            after.islandEvents.unshift({ id: JSON.stringify([`island-${family}-v1`, owner, 7]), profileId: owner,
                type: `${family}_changed`, timestamp: 101, action });
            expect(() => assertVisualMutation(before, after, owner, action)).not.toThrow();
            for (const corrupt of [value => value.islandPlans[0].cursor++, value => value.islands[0].items[0].position.x++,
                value => delete value.islands[0].unknownFutureBranch, value => value.islands.push({ profileId: 'other' }),
                value => value.extraStore[0].data.pop(), value => value.islandPhotos[0].hash = 'changed',
                value => value.islandEvents[0].profileId = 'other']) {
                const invalid = structuredClone(after); corrupt(invalid); expect(() => assertVisualMutation(before, invalid, owner, action)).toThrow();
            }
            expect(() => assertVisualMutation(before, after, owner)).toThrow();
        });
    }
    it('rejects stale focus, hidden cloth, wrong look and replacement rigs even if the chosen item string matches', () => {
        const actual = frame('contact'); expect(() => assertRenderedPair(actual, use, ids)).not.toThrow();
        for (const corrupt of [value => value.portrait.id = 'rabbit', value => value.expression.residents[0].groups[2].visible = false,
            value => value.expression.residents[0].uuid = 'replacement', value => value.expression.residents[0].outfit = 'raincoat',
            value => value.hidden = true]) {
            const invalid = structuredClone(actual); corrupt(invalid); expect(() => assertRenderedPair(invalid, use, ids)).toThrow();
        }
    });
    it('requires actual walking/contact/settled phase images and real contact geometry for the chosen dressed resident', () => {
        expect(() => assertFurnitureUse(probe(), use, ids, 'request')).not.toThrow();
        for (const corrupt of [value => value.images.shift(), value => value.frames[1].optional.actors[0].eye[0] = 1,
            value => value.frames[2].optional.actorIds[0] = 'rabbit', value => value.frames[2].expression.residents[0].pattern = 'river-check',
            value => value.frames[1].optional.borrowed = true, value => value.gesture.trusted = false]) {
            const invalid = probe(); corrupt(invalid); expect(() => assertFurnitureUse(invalid, use, ids, 'request')).toThrow();
        }
    });
});
