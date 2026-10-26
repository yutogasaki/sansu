import { createServer } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const output = process.env.SANSU_KOKUGO_AUDIT_OUTPUT;
if (!output) throw new Error('Set SANSU_KOKUGO_AUDIT_OUTPUT to a new audit directory');
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
    const { KANJI_ENTRIES, kana } = await server.ssrLoadModule('/src/domain/kokugo/kanji/data.ts');
    const { WORD_CORRECTIONS } = await server.ssrLoadModule('/src/domain/kokugo/kanji/editorial.ts');
    const { kanjiItems } = await server.ssrLoadModule('/src/domain/kokugo/kanji/catalog.ts');
    const { KOKUGO_ITEMS, READING_BOOKS } = await server.ssrLoadModule('/src/domain/kokugo/catalog.ts');
    const issues = [], scenes = [], corrections = [], readingChecks = [];
    for (const entry of KANJI_ENTRIES) {
        for (const [index, word] of entry.words.entries()) {
            const correction = WORD_CORRECTIONS[`${entry.character}:${index}`];
            if (correction) corrections.push({ character: entry.character, index, ...correction });
            const reading = kana(word.reading);
            const matches = entry.readings.map(kana).filter(r => reading.includes(r) || reading.includes(r.replace(/く$|き$|ち$|つ$/, 'っ')));
            if (!matches.length && entry.readings.length) readingChecks.push({ character: entry.character, grade: entry.grade, word: word.text, reading: word.reading, elementaryReadings: entry.readings,
                disposition: word.revised ? '校閲による差替え。語全体の読みを出題' : '熟字訓・連濁・活用・語全体の読みとして維持。字単独の当該学年音訓とは別',
                laterReading: entry.allReadings.map(kana).some(r => reading.includes(r)) });
        }
        for (const scene of entry.scenes) scenes.push({ character: entry.character, grade: entry.grade, key: scene.key, word: entry.words[scene.wordIndex].text, reading: entry.words[scene.wordIndex].reading, passage: scene.passage.replace('~', entry.words[scene.wordIndex].text) });
        for (const kind of ['R', 'T', 'S']) {
            const items = kanjiItems(`H${kind}${entry.grade}`, entry.target);
            if (new Set(items.map(i => i.exposureGroup)).size < 3 || new Set(items.map(i => i.family)).size < 2) issues.push(`${entry.character}/${kind}: insufficient independent material`);
            if (kind === 'S') for (const item of items.filter(item => item.prompt.startsWith('音読み・訓読みが'))) {
                const reading = item.prompt.match(/「([^」]+)」/)[1];
                if (!entry.allReadings.map(kana).includes(reading)) issues.push(`${item.id}: word phrase mislabeled as character reading`);
            }
            if (kind === 'S' && items.some(i => i.passage?.includes(entry.character))) issues.push(`${entry.character}: answer visible in spelling passage`);
        }
    }
    if (scenes.length !== 2052 || new Set(scenes.map(s => s.passage)).size !== scenes.length) issues.push('scene count or duplicate passage');
    const audio = [];
    for (const item of KOKUGO_ITEMS.filter(i => i.audio)) {
        const bytes = await readFile(path.join('public', item.audio));
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (sha256 !== item.audioSha256 || bytes.length < 1000) issues.push(`${item.id}: invalid audio`);
        audio.push({ id: item.id, asset: item.audio, bytes: bytes.length, sha256 });
    }
    const report = { at: new Date().toISOString(), editorialAuthority: 'AI校閲。人の国語校閲者による採用審査・音声実聴・児童観察は未実施',
        counts: { kanji: KANJI_ENTRIES.length, words: KANJI_ENTRIES.length * 2, scenes: scenes.length, correctedWords: corrections.length,
            starterGraded: KOKUGO_ITEMS.filter(i => i.form !== 'activity').length, starterActivities: KOKUGO_ITEMS.filter(i => i.form === 'activity').length, books: READING_BOOKS.length },
        issues, audio, corrections, readingChecks, sceneReadingDecisions: KANJI_ENTRIES.flatMap(entry => entry.scenes.filter(scene => scene.acceptedReadings).map(scene => ({ character: entry.character, key: scene.key, acceptedReadings: scene.acceptedReadings }))) };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
    await writeFile(path.join(output, 'scenes.tsv'), ['grade\tcharacter\tkey\tword\treading\tpassage', ...scenes.map(s => [s.grade, s.character, s.key, s.word, s.reading, s.passage].join('\t'))].join('\n') + '\n');
    console.log(JSON.stringify({ counts: report.counts, issues, output }));
    if (issues.length) process.exitCode = 1;
} finally { await server.close(); }
