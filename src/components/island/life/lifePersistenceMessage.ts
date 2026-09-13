/** Do not expose browser/database exceptions or claim an uncertain write was lost. */
export function lifePersistenceMessage(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'この島のデータは新しい版で開いてください。' || message === 'この観察は新しい版で開いてください。') {
        return 'この しまは あたらしい アプリで ひらいてね。';
    }
    if (message === 'しまが かわったよ。もういちど えらんでね。' || message === '同じ操作の内容が変わっています。') {
        return 'しまが かわったよ。もういちど えらんでね。';
    }
    return 'しまの きろくを たしかめられなかったよ。もういちど ためしてね。';
}
