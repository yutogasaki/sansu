import { KOKUGO_LEVEL_UNITS } from './levels';

export const KOKUGO_LEVEL_TITLES = [
    'おとと ことば', 'ひらがなの ことば', 'おとの ちがいと ばしょ', 'だれが どうする', 'ちいさい じと カタカナ',
    'ぶんの くぎりと かんじ', 'てにをはと ひとつの ぶん', 'かいてある ことと じゅんばん', 'かんじの よみと にた ことば', 'くわしくする ことば',
    'じゅんじょと ぶんの つながり', 'じゅくごと ぶんの いみ', 'きもちと ことばの てがかり', 'りゆうと ちゅうしん', 'ひょうきと かんようく',
    'いいかえと だんらく', 'ようてんと ぶんの くみたて', 'ばめんに あう かんじと けいご', 'じじつ・いけんと ひょう', 'ふたつの しりょうと こんきょ',
] as const;

/** A display lookup, never evidence of mastery. Separate kanji courses and free activities have no mapped Lv. */
export function kokugoUnitLevel(unitId: string) {
    const index = KOKUGO_LEVEL_UNITS.findIndex(units => units.includes(unitId));
    return index < 0 ? undefined : index + 1;
}
