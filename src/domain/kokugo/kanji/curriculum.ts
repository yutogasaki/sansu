import type { KokugoUnit } from '../types';
export type KanjiPractice = 'R' | 'T' | 'S' | 'P';
export const KANJI_GRADE_COUNTS = [80, 160, 200, 202, 193, 191] as const;
export const KANJI_PRACTICES = { R: '読みを えらぶ', T: '読みを 入力', S: '漢字を えらぶ', P: '紙に 書く' } as const;
export const KANJI_UNITS: KokugoUnit[] = KANJI_GRADE_COUNTS.flatMap((count, index) =>
    (Object.keys(KANJI_PRACTICES) as KanjiPractice[]).map(kind => ({
        id: `H${kind}${index + 1}`, track: 'H', band: index + 2,
        title: `小学${index + 1}年の漢字 · ${KANJI_PRACTICES[kind]}`,
        introduction: `${count}字から えらんで れんしゅうするよ。読みは ことばによって 変わるよ。ヒントや おてほんも 使えるよ。`,
    })));
export function kanjiUnitInfo(id: string) {
    const match = /^H([RTSP])([1-6])$/.exec(id);
    return match ? { kind: match[1] as KanjiPractice, grade: Number(match[2]) } : undefined;
}
