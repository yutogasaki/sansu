/**
 * Pokomoko's room redecorated with what the child learned (spec 52 §13.1). Each English word
 * the child has answered on their own becomes one dot of the wallpaper; math levels open new
 * wallpaper shapes. Nothing here is bought, drawn by lottery or counted by volume alone.
 */
export const WORD_GROUPS = [
    { id: 'food', name: 'たべもの', color: '#e2574c', categories: ['食べ物', '食事', '飲み物', '料理', '果物', '野菜'] },
    { id: 'nature', name: 'どうぶつ・しぜん', color: '#5fae5a', categories: ['動物', '自然', '環境', '環境問題', '天気', '植物', '季節', '生き物'] },
    { id: 'people', name: 'ひと', color: '#ef8fb1', categories: ['人', '家族', '職業', '身体', '感情', '健康'] },
    { id: 'town', name: 'まち', color: '#4f9bd9', categories: ['建物', '場所', '交通', '学校', '地理', '社会', '社会問題', '経済', '行事', '生活', '場面'] },
    { id: 'things', name: 'もの・かず', color: '#f2c14b', categories: ['道具', '物', '色', '数字', '月', '時間', '時間・変化', '曜日', '形'] },
    { id: 'move', name: 'うごき', color: '#f08a3c', categories: ['動詞'] },
    { id: 'look', name: 'ようす', color: '#9a74d6', categories: ['形容詞', '副詞'] },
    { id: 'other', name: 'そのほか', color: '#3fb3a7', categories: [] },
] as const;
export type WordGroupId = (typeof WORD_GROUPS)[number]['id'];

export function wordGroupOf(category: string): WordGroupId {
    return WORD_GROUPS.find(group => (group.categories as readonly string[]).includes(category))?.id ?? 'other';
}

/** A word counts once the child has answered it correctly on their own (spec 34), or earlier records show it held. */
export function isLearnedWord(memory: { strength: number; independentCorrectAnswers?: number } | undefined) {
    return Boolean(memory && ((memory.independentCorrectAnswers ?? 0) > 0 || memory.strength >= 3));
}

export interface LearnedWord { id: string; group: WordGroupId }

export function learnedWords(vocab: Record<string, { strength: number; independentCorrectAnswers?: number }>,
    words: readonly { id: string; category: string }[]): LearnedWord[] {
    return words.filter(word => isLearnedWord(vocab[word.id])).map(word => ({ id: word.id, group: wordGroupOf(word.category) }));
}

/** Wallpaper shapes. Counting opens round dots; later math units open their own shapes. */
export const WALL_PATTERNS = [
    { id: 'dots', name: 'みずたま', mathLevel: 0 },
    { id: 'blocks', name: 'いろの ブロック', mathLevel: 8 },
    { id: 'rings', name: 'とけいの わ', mathLevel: 13 },
    { id: 'stars', name: 'ほし', mathLevel: 19 },
    { id: 'pie', name: 'ケーキ', mathLevel: 21 },
    // English levels open shapes made of the words themselves.
    { id: 'letters', name: 'アルファベット', vocabLevel: 3 },
    { id: 'hearts', name: 'ハート', vocabLevel: 6 },
] as const;
export type WallPatternId = (typeof WALL_PATTERNS)[number]['id'];

export const RUG_COLORS = ['#4d9b9b', '#e2574c', '#f2c14b', '#4f9bd9', '#9a74d6', '#ef8fb1'] as const;

export interface RoomDecor { pattern: WallPatternId; rug: number; hidden?: WordGroupId[] }
export const DEFAULT_DECOR: RoomDecor = { pattern: 'dots', rug: 0 };

export function patternOpen(pattern: WallPatternId, mathLevel: number, vocabLevel = 0) {
    const entry = WALL_PATTERNS.find(p => p.id === pattern) as { mathLevel?: number; vocabLevel?: number } | undefined;
    if (!entry) return false;
    return entry.vocabLevel !== undefined ? entry.vocabLevel <= vocabLevel : (entry.mathLevel ?? Infinity) <= mathLevel;
}
