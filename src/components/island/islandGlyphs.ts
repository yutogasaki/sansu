// Symbol identities come from the reserved Problem, never its answer or category.
export const ISLAND_GLYPH_LABELS: Readonly<Record<string, string>> = {
    '🍎': 'りんご', '🍊': 'みかん', '🍓': 'いちご', '🍐': 'なし', '🫐': 'ブルーベリー', '🍌': 'バナナ', '🍇': 'ぶどう',
    '🌸': 'はな', '🌻': 'ひまわり', '⭐': 'ほし', '🌙': 'つき', '🐟': 'さかな', '🥕': 'にんじん', '🍯': 'はちみつ',
    '🐶': 'いぬ', '🐱': 'ねこ', '🐰': 'うさぎ', '🐻': 'くま', '🐼': 'パンダ', '🦊': 'きつね',
    '🐦': 'ことり', '🪱': 'えさ', '🙂': 'ともだち', '🦒': 'きりん', '🧸': 'くまのぬいぐるみ',
    '🌲': 'き', '🌳': 'き', '🏠': 'おうち', '🗼': 'タワー', '🎈': 'ふうせん',
    '🧺': 'かご', '📦': 'はこ', '🎁': 'プレゼント', '📚': 'ほん', '🪨': 'いし', '⚽': 'ボール',
    '●': 'てん', '🔴': 'あかいまる', '🔵': 'あおいまる', '🟡': 'きいろいまる',
    '🟢': 'みどりのまる', '🟠': 'オレンジのまる', '🔺': 'あかいさんかく',
    '🟥': 'あかいしかく', '🟦': 'あおいしかく', '🟨': 'きいろいしかく',
    '🟩': 'みどりのしかく', '🟧': 'オレンジのしかく', '🟪': 'むらさきのしかく', '⬜': 'しろいしかく',
};

export type IslandLabelPart = { kind: 'text' | 'glyph'; value: string };
// Preserve joined/modified emoji without requiring Intl.Segmenter on older PWAs.
const labelSegments = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|[\s\S]/gu;

/** Keeps words, spaces and repeated symbols in their original order. */
export function splitIslandLabel(label: string): IslandLabelPart[] {
    const parts: IslandLabelPart[] = [];
    for (const segment of label.match(labelSegments) ?? []) {
        const kind = ISLAND_GLYPH_LABELS[segment] || /\p{Extended_Pictographic}/u.test(segment) ? 'glyph' : 'text';
        const previous = parts[parts.length - 1];
        if (kind === 'text' && previous?.kind === 'text') previous.value += segment;
        else parts.push({ kind, value: segment });
    }
    return parts;
}
