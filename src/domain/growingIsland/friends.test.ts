import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { deliverKeepsakes, keepsakeKind, receiveGifts } from './gifts';
import { ingestCompletions, newIsland } from './island';
import { RULES } from './rules';
import { dayMoment, friendOf, momentCandidates } from './moments';
import { arrivalName, NAME_CANDIDATES } from './names';
import { rollVisitor } from './pier';
import { isKid, KID, LIKES } from './rules';
import { HOME_CELL, distance } from './space';
import type { Command, GrowingState, Villager } from './types';

const T0 = Date.UTC(2026, 8, 29, 9);
let intentId = 0;
const act = (state: GrowingState, command: Command) => applyIntent(state, { id: `f${intentId++}`, command });
function started() {
    return act(newIsland('kid-f', T0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } }).state;
}
function friend(state: GrowingState, patch: Partial<Villager>): Villager {
    const villager: Villager = { id: `v${state.nextId++}`, species: 'rabbit', variant: { color: 0, accessory: 0, sparkle: false },
        trait: 'mellow', home: 'pokomoko', arrivedAt: 0, ...patch };
    state.villagers.push(villager);
    return villager;
}

describe('えま and えいた', () => {
    it('sail in on the second and third boats, once each, in an order that differs between islands', () => {
        const firsts = new Set<string>();
        for (const kid of ['kid-f', 'kid-g', 'kid-h', 'kid-i', 'kid-j', 'kid-k']) {
            let state = act(newIsland(kid, T0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } }).state;
            expect(isKid(state.pier.visitor.species)).toBe(true);
            expect(isKid(state.pier.next.species)).toBe(true);
            expect(state.pier.visitor.species).not.toBe(state.pier.next.species);
            firsts.add(state.pier.visitor.species);
            state = { ...state, villagers: [...state.villagers, friend(state, { species: 'girl' }), friend(state, { species: 'boy' })] };
            const later = Array.from({ length: 200 }, (_, i) => rollVisitor(state, i + 3).species);
            expect(later.some(isKid)).toBe(false);
        }
        expect(firsts.size).toBe(2);
    });

    it('keep their own names, looks and favourites', () => {
        const state = started();
        expect(arrivalName(state, { species: 'girl', ordinal: 1 })).toBe('えま');
        expect(arrivalName(state, { species: 'boy', ordinal: 2 })).toBe('えいた');
        expect(state.pier.visitor.variant).toEqual(KID[state.pier.visitor.species as 'girl'].variant);
        const ema = friend(state, { species: 'girl', name: 'えま' });
        expect(() => act(state, { type: 'name', target: ema.id, name: 'はな' })).toThrow('そのまま');
        expect(LIKES.girl).not.toEqual(LIKES.boy);
    });

    it('still come to an older island that met other friends first', () => {
        const state = started();
        state.pier.visitor = { ...state.pier.visitor, species: 'fox' }; state.pier.next = { ...state.pier.next, species: 'duck' };
        const later = Array.from({ length: 60 }, (_, i) => rollVisitor(state, i + 3).species);
        expect(later.filter(isKid).length).toBeGreaterThan(5);
    });
});

describe('arrival names', () => {
    it('gives every newcomer a name from their own list, avoiding names already in use', () => {
        const state = started();
        const arrived = state.villagers[0];
        expect(NAME_CANDIDATES[arrived.species]).toContain(arrived.name);
        const list = NAME_CANDIDATES.girl;
        for (let i = 0; i < list.length; i++) state.villagers.push({ ...arrived, id: `g${i}`, species: 'girl', name: arrivalName(state, { species: 'girl', ordinal: 9 }) });
        expect(new Set(state.villagers.filter(v => v.species === 'girl').map(v => v.name)).size).toBe(list.length);
    });
});

describe('keepsakes', () => {
    it('starts from the levels a child already has, then brings one per new level, once', () => {
        const state = started();
        expect(deliverKeepsakes(state, { math: 8, vocab: 2 })).toEqual([]);
        expect(state.keepsakes).toEqual([]);
        const events = deliverKeepsakes(state, { math: 10, vocab: 3 });
        expect(events.map(e => e.type === 'keepsake' && e.unitId)).toEqual(['math:9', 'math:10', 'vocab:3']);
        expect(state.keepsakes.every(k => k.cell === undefined)).toBe(true);
        // A level lowered and reached again does not bring a second keepsake.
        deliverKeepsakes(state, { math: 7, vocab: 3 });
        expect(deliverKeepsakes(state, { math: 10, vocab: 3 })).toEqual([]);
        expect(keepsakeKind('math:9')).toBe('fountain');
        expect(keepsakeKind('math:13')).toBe('clock');
    });
});

describe('flowers from a visiting sibling', () => {
    it('bloom by Pokomoko\'s door once, naming who left them', () => {
        const state = started();
        const gift = { id: 'g1', to: 'kid-f', from: 'sis', fromName: 'はるか', at: T0 };
        const events = receiveGifts(state, [gift]);
        expect(events).toEqual([{ type: 'gift', from: 'はるか', landmarkId: expect.any(String) }]);
        const flower = state.landmarks.find(l => l.from === 'はるか')!;
        expect(flower).toMatchObject({ kind: 'flower', growth: 6 });
        expect(distance(flower.cell!, HOME_CELL)).toBe(1);
        expect(receiveGifts(state, [gift])).toEqual([]);
    });
});

describe('small surprises', () => {
    it('follow the island, one per day at most, the same on every reopening', () => {
        const state = started();
        for (let i = 0; i < 6; i++) state.landmarks.push({ id: `fl${i}`, kind: 'flower', cell: { x: i % 6, z: 4 }, growth: 6 });
        state.landmarks.push({ id: 'bowl', kind: 'water-bowl', cell: { x: 4, z: 2 }, growth: 0 },
            { id: 'lamp', kind: 'lantern', cell: { x: 5, z: 2 }, growth: 0 });
        const kinds = momentCandidates(state).map(c => c.moment);
        expect(kinds).toEqual(expect.arrayContaining(['butterflies', 'guest-water']));
        const days = Array.from({ length: 40 }, (_, day) => dayMoment(state, day));
        expect(days).toEqual(Array.from({ length: 40 }, (_, day) => dayMoment(state, day)));
        expect(days.some(d => d?.moment === 'butterflies')).toBe(true);
        expect(days.some(d => d === undefined)).toBe(true);
    });

    it('pair friends who love the same thing', () => {
        const state = started();
        const a = friend(state, { species: 'otter' }), b = friend(state, { species: 'duck' }), c = friend(state, { species: 'hedgehog' });
        expect(friendOf(state, a)?.id).toBe(b.id);
        expect(friendOf(state, c)).toBeUndefined();
    });
});

describe('island styles opened by level', () => {
    it('keeps clothes, hats and flag patterns for the levels that open them', () => {
        const state = started(), id = state.villagers[0].id;
        expect(() => act(state, { type: 'dress', id, color: 2 })).toThrow('まだ');
        expect(() => act(state, { type: 'flag', pattern: 1 })).toThrow('まだ');
        expect(act(state, { type: 'flag', color: 3 }).state.flagColor).toBe(3);
        state.genki.best = 150;
        const dressed = act(act(state, { type: 'dress', id, color: 2 }).state, { type: 'dress', id, hat: 3 }).state;
        expect(dressed.villagers[0].outfit).toEqual({ color: 2, hat: 3 });
        expect(act(dressed, { type: 'flag', pattern: 4 }).state.flagPattern).toBe(4);
        expect(() => act(dressed, { type: 'dress', id, color: 9 })).toThrow();
    });
});

describe('learning memory', () => {
    it('stays bounded over years without counting any completion twice', () => {
        let state = newIsland('kid-m', T0);
        const facts = Array.from({ length: RULES.learnedMemory + 500 }, (_, i) => ({ id: `c${i}`, at: T0 + 1 + i }));
        for (let i = 0; i < facts.length; i += 250) state = ingestCompletions(state, facts.slice(0, i + 250)).state;
        expect(state.learned.length).toBeLessThanOrEqual(RULES.learnedMemory + 1);
        expect(state.drops).toBe(facts.length * RULES.dropsPerCompletion);
        expect(ingestCompletions(state, facts).added).toBe(0);
        expect(ingestCompletions(state, [...facts, { id: 'late-new', at: facts.at(-1)!.at + 5 }]).added).toBe(1);
    });
});
