import { expect, it } from 'vitest';
import { lifePersistenceMessage } from './lifePersistenceMessage';

it('keeps storage internals and unknown payloads out of child copy without declaring saved work lost', () => {
    for (const error of [new DOMException('database quota details', 'QuotaExceededError'), new Error('completion lost'), { message: 'private payload' }, null]) {
        expect(lifePersistenceMessage(error)).toBe('しまの きろくを たしかめられなかったよ。もういちど ためしてね。');
    }
});

it('retains distinct next actions for a newer reader and a conflicting placement', () => {
    expect(lifePersistenceMessage(new Error('この島のデータは新しい版で開いてください。'))).toBe('この しまは あたらしい アプリで ひらいてね。');
    expect(lifePersistenceMessage(new Error('しまが かわったよ。もういちど えらんでね。'))).toBe('しまが かわったよ。もういちど えらんでね。');
});
