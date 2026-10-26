import allocation from './allocation.json';
import { WORD_CORRECTIONS, EDITORIAL_SHARED_ROOTS } from './editorial';
import { SCENE_READINGS } from './sceneReadings';
import { SCENES_1 } from './scenes1';
import { SCENES_2 } from './scenes2';
import { SCENES_3 } from './scenes3';
import { SCENES_4 } from './scenes4';
import { SCENES_5 } from './scenes5';
import { SCENES_6 } from './scenes6';
import { WORDS_1 } from './words1';
import { WORDS_2 } from './words2';
import { WORDS_3 } from './words3';
import { WORDS_4 } from './words4';
import { WORDS_5 } from './words5';
import { WORDS_6 } from './words6';
export interface KanjiWord { text: string; reading: string; exposure: string; revised?: boolean }
export interface KanjiScene { key: string; wordIndex: number; passage: string; acceptedReadings?: string[] }
export interface KanjiEntry { character: string; target: string; grade: number; readings: string[]; allReadings: string[]; words: KanjiWord[]; scenes: KanjiScene[] }
export const kana = (text: string) => text.normalize('NFKC').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60)).replace(/\s/g, '');
// Inflected names/extended words share the original lexical exposure, not a new independent context.
const SHARED_ROOTS: Record<string, string> = {
    ...EDITORIAL_SHARED_ROOTS, 愛媛県: '愛媛', 岐阜県: '岐阜', 滋賀県: '滋賀', 大阪府: '大阪', 埼玉県: '埼玉',
    昭和時代: '昭和', 健康体: '健康', 宇宙船: '宇宙', 皇后様: '皇后', 親孝行: '孝行',
    貿易港: '貿易', 天皇陛下: '陛下', 誕生日: '誕生', 桜色: '桜',
};
const sceneRows = [SCENES_1, SCENES_2, SCENES_3, SCENES_4, SCENES_5, SCENES_6].flatMap(rows => rows.trim().split('\n').map(row => row.split('|')));
if (sceneRows.some(row => row.length !== 3 || row.slice(1).some(text => text.split('~').length !== 2)) || new Set(sceneRows.map(row => row[0])).size !== sceneRows.length) throw new Error('Invalid kanji scenes');
const scenes = new Map(sceneRows.map(([character, ...passages]) => [character, passages]));
const reference: Record<string, { grade: number; readings: string[]; allReadings: string[] }> = allocation;
export const KANJI_ENTRIES: KanjiEntry[] = [WORDS_1, WORDS_2, WORDS_3, WORDS_4, WORDS_5, WORDS_6].flatMap(rows => rows.trim().split('\n').map(row => {
    const [character, ...words] = row.trim().split(/\s+/);
    const fact = reference[character];
    if (!fact || words.length !== 2 || !scenes.has(character)) throw new Error(`Invalid kanji record: ${character}`);
    return { character, target: `kanji:${character.codePointAt(0)!.toString(16)}`, grade: fact.grade,
        readings: fact.readings, allReadings: fact.allReadings, words: words.map((pair, index) => {
            const [oldText, oldReading] = pair.split('/');
            const correction = WORD_CORRECTIONS[`${character}:${index}`];
            const text = correction?.text ?? oldText, reading = correction?.reading ?? oldReading;
            return { text, reading, exposure: SHARED_ROOTS[text] ?? text, ...(correction ? { revised: true } : {}) };
        }), scenes: scenes.get(character)!.map((passage, index) => ({ key: `s${index + 1}`, wordIndex: index, passage,
            ...(SCENE_READINGS[`${character}:s${index + 1}`] ? { acceptedReadings: SCENE_READINGS[`${character}:s${index + 1}`] } : {}) })) };
}));
const byCharacter = new Map(KANJI_ENTRIES.map(entry => [entry.character, entry]));
const byTarget = new Map(KANJI_ENTRIES.map(entry => [entry.target, entry]));
export const kanjiEntry = (character: string) => byCharacter.get(character);
export const kanjiForTarget = (target: string) => byTarget.get(target);
const WORD_ALIASES: Record<string, string[]> = {
    市場: ['いちば', 'しじょう'], 何人: ['なんにん', 'なにじん'], 半月: ['はんつき', 'はんげつ'],
    昨日: ['きのう', 'さくじつ'], 今年: ['ことし', 'こんねん'], 今朝: ['けさ', 'こんちょう'],
    博士: ['はかせ', 'はくし'], 日本酒: ['にほんしゅ', 'にっぽんしゅ'],
    紅葉: ['こうよう', 'もみじ'], 紅色: ['べにいろ', 'こうしょく'], 留まる: ['とまる', 'とどまる'],
    早朝: ['そうちょう'], 初日: ['しょにち', 'はつひ'], 一日: ['いちにち', 'ついたち'],
};
export function wordReadings(word: KanjiWord) { return [...new Set([word.reading, ...(WORD_ALIASES[word.text] ?? [])])]; }

/** Compare historical and current lexical roots without rewriting frozen items or old facts. */
export function canonicalKanjiExposure(group: string) {
    const [prefix, hex, ...parts] = group.split(':');
    if (prefix !== 'kanji') return group;
    const entry = kanjiForTarget(`${prefix}:${hex}`);
    if (!entry) return group;
    const oldRoot = parts.join(':'), root = SHARED_ROOTS[oldRoot] ?? oldRoot;
    return `${entry.target}:${root === entry.character ? 'isolated' : root}`;
}
