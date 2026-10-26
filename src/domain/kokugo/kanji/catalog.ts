import type { KokugoItem } from '../types';
import { KANJI_ENTRIES, kana, wordReadings, type KanjiEntry } from './data';
import { kanjiUnitInfo } from './curriculum';
const readingPool = [...new Set(KANJI_ENTRIES.flatMap(e => [...e.readings.map(kana), ...e.words.map(w => w.reading)]))];
const choiceOrder = (answer: string, pool: string[], excluded: Set<string>, seed: number) => {
    const rest: string[] = [];
    for (let i = 0; i < pool.length && rest.length < 2; i++) {
        const candidate = pool[(seed + i) % pool.length];
        if (candidate !== answer && !excluded.has(candidate) && !rest.includes(candidate)) rest.push(candidate);
    }
    if (rest.length !== 2) throw new Error('Insufficient unambiguous kanji alternatives');
    const choices = [answer, ...rest], offset = seed % 3;
    return [...choices.slice(offset), ...choices.slice(0, offset)];
};
interface Material { text: string; reading: string; accepted: string[]; singleCharacter: boolean; exposure: string; family: string; suffix?: string; passage?: string }
function materials(entry: KanjiEntry): Material[] {
    const isolated: Material[] = entry.readings.length ? [{ text: entry.character, reading: kana(entry.readings[0]),
        accepted: entry.allReadings.map(kana), singleCharacter: true, exposure: 'isolated', family: '字と音' }] : [];
    return [...isolated, ...entry.words.map(word => ({ text: word.text, reading: word.reading,
        accepted: word.text === entry.character ? [...new Set([...entry.allReadings.map(kana), ...wordReadings(word)])] : wordReadings(word),
        singleCharacter: word.text === entry.character,
        exposure: word.exposure === entry.character ? 'isolated' : word.exposure, family: word.text === entry.character ? '字と音' : 'ことばの読み',
        ...(word.revised ? { suffix: 'r2' } : {}) })), ...entry.scenes.map(scene => {
            const word = entry.words[scene.wordIndex];
            const lexicalReadings = wordReadings(word), accepted = scene.acceptedReadings ?? lexicalReadings;
            if ((lexicalReadings.length > 1 && !scene.acceptedReadings) || !accepted.includes(word.reading)
                || accepted.some(reading => !lexicalReadings.includes(reading))) throw new Error(`Unreviewed scene readings: ${entry.character}:${scene.key}`);
            return { text: word.text, reading: word.reading, accepted, singleCharacter: false,
                exposure: `scene:${scene.key}`, family: '文の中の語', suffix: `scene-${scene.key}`, passage: scene.passage.replace('~', word.text) };
        })];
}
export function kanjiItemsForEntry(entry: KanjiEntry, unitId: string): KokugoItem[] {
    const info = kanjiUnitInfo(unitId);
    if (!info || info.grade !== entry.grade) return [];
    const seed = entry.character.codePointAt(0)!;
    const base = { unitId, version: 'kokugo-kanji-3' as const, target: entry.target, kanji: entry.character, condition: '基本例' };
    if (info.kind === 'P') return [{ ...base, id: `${unitId}-${seed.toString(16)}-paper`,
        family: '紙に書いて見比べる', exposureGroup: `${entry.target}:paper`, mode: 'expression-open', form: 'activity',
        choices: [], answer: '', prompt: `「${entry.character}」を 紙に 書いてみよう。`,
        hint: '手本を 閉じて 書いたら、開いて 見くらべよう。',
        model: `${entry.character}\n${entry.words.map(word => `${word.text}（${word.reading}）`).join(' ／ ')}\n線の向き・長さ・まとまりを 見くらべよう。` }];
    return materials(entry).map((material, index) => {
        const spelling = info.kind === 'S', short = info.kind === 'T';
        const answer = spelling ? entry.character : material.reading;
        const possibleReadings = new Set(material.accepted.map(kana));
        const mask = material.text.split(entry.character).join('□');
        // Remove every known homophone for the masked word and conservatively every matching character reading.
        const excludedLetters = new Set((spelling ? KANJI_ENTRIES : []).filter(other => other.allReadings.some(reading => {
            const r = kana(reading); return possibleReadings.has(r) || material.reading.includes(r);
        }) || other.words.some(word => word.text.split(other.character).join('□') === mask
            && wordReadings(word).some(reading => possibleReadings.has(reading)))).map(other => other.character));
        const choices = short ? [] : choiceOrder(answer, spelling ? KANJI_ENTRIES.map(e => e.character) : readingPool,
            spelling ? excludedLetters : possibleReadings, seed + index * 23);
        return { ...base, id: `${unitId}-${seed.toString(16)}-${material.suffix?.startsWith('scene-') ? material.suffix : `${index}${material.suffix ? `-${material.suffix}` : ''}`}`, family: material.family,
            exposureGroup: `${entry.target}:${material.exposure}`, mode: spelling ? 'expression-structured' as const : 'decoding' as const,
            form: short ? 'short' as const : 'choice' as const, choices, answer,
            ...(short ? { acceptedAnswers: material.accepted } : {}),
            ...(material.passage ? { passage: spelling ? material.passage.split(entry.character).join('□') : material.passage } : {}),
            prompt: spelling ? material.singleCharacter ? `音読み・訓読みが「${material.reading}」の漢字は？` : `「${material.reading}」と読む「${mask}」。□に 入る漢字は？`
                : index === 0 && entry.readings.length ? `「${material.text}」の 読み方を 一つ${short ? 'ひらがなで 書こう' : 'えらぼう'}。`
                    : `「${material.text}」を ${short ? 'ひらがなで 書こう' : 'どう読む'}？`,
            hint: material.singleCharacter ? '送りがなのある読みは、送りがなも 入れるよ。音読み・訓読みを たしかめよう。' : spelling ? 'ことば全体を たしかめて、合う字を さがそう。' : 'ことばを 一つのまとまりで 読んでみよう。',
            model: spelling ? `「${material.text}」と書くよ。読みは「${material.reading}」。`
                : `「${material.text}」の読みの例は「${material.reading}」。`,
        };
    });
}
const cache = new Map<string, KokugoItem[]>();
export function kanjiItems(unitId: string, focusTarget?: string) {
    const info = kanjiUnitInfo(unitId);
    if (!info) return [];
    const key = `${unitId}:${focusTarget ?? '*'}`;
    if (!cache.has(key)) cache.set(key, KANJI_ENTRIES.filter(entry => entry.grade === info.grade && (!focusTarget || entry.target === focusTarget))
        .flatMap(entry => kanjiItemsForEntry(entry, unitId)));
    return cache.get(key)!;
}
