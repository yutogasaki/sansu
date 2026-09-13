import { expect, it } from 'vitest';
import { lifePersistenceMessage } from './lifePersistenceMessage';
import { applyRelationObservation } from '../../../domain/islandLife/relationObservation';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';

it('explains a real walking rejection without claiming the save failed or changing the visit', () => {
    const state = replayLife(newLife('walking-copy', 0));
    state.relationSelectionVersion = 1; state.now = 100;
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 4, z: 2 }, style: 'original', growth: 0 }];
    state.residents[0].visit = { itemId: 'bench', from: { x: 3, z: 2 }, path: [{ x: 3, z: 2 }, { x: 4, z: 2 }], start: 0, end: 10000 };
    const before = structuredClone(state);
    let rejected: unknown;
    try { applyRelationObservation(state, 'bench', state.residents[0].id); } catch (error) { rejected = error; }
    expect(rejected).toBeInstanceOf(Error);
    expect(lifePersistenceMessage(rejected)).toBe('みちを とおっているよ。ついてから もういちど えらんでね。');
    expect(state).toEqual(before);
});

it('keeps known unavailable choices separate from unknown storage failures', () => {
    expect(lifePersistenceMessage(new Error('いまは、ほかのことを しているよ。'))).toBe('ほかのことを しているよ。あとで もういちど えらんでね。');
    expect(lifePersistenceMessage(new Error('その ものは いま ここに ないよ。'))).toBe('その ものは いま ここに ないよ。もういちど えらんでね。');
});

it('keeps storage internals and unknown payloads out of child copy without declaring saved work lost', () => {
    for (const error of [new DOMException('database quota details', 'QuotaExceededError'), new Error('completion lost'), { message: 'private payload' }, null]) {
        expect(lifePersistenceMessage(error)).toBe('しまの きろくを たしかめられなかったよ。もういちど ためしてね。');
    }
});

it('retains distinct next actions for a newer reader and a conflicting placement', () => {
    expect(lifePersistenceMessage(new Error('この島のデータは新しい版で開いてください。'))).toBe('この しまは あたらしい アプリで ひらいてね。');
    expect(lifePersistenceMessage(new Error('しまが かわったよ。もういちど えらんでね。'))).toBe('しまが かわったよ。もういちど えらんでね。');
});
