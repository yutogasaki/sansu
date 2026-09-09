import type { Problem, LevelState } from '../types';
import { ENGLISH_WORDS } from './words';

export interface ListeningSentence {
    id: string;
    version: 1;
    wordId: string;
    english: string;
    japanese: string;
    japaneseKanji: string;
    glyph: string;
    sceneLabel: string;
    support: string[];
}

// Authored text paired with existing, repository-owned learning illustrations.
// Speech uses the device's English voice; no recording is redistributed.
const sentences: [string, string, string, string, string, string, string[]][] = [
    ['apple', 'This is an apple.', 'これは りんごです。', 'これは りんごです。', '🍎', 'りんご', ['this', 'is', 'an']],
    ['orange', 'This is an orange.', 'これは オレンジです。', 'これは オレンジです。', '🍊', 'オレンジ', ['this', 'is', 'an']],
    ['banana', 'This is a banana.', 'これは バナナです。', 'これは バナナです。', '🍌', 'バナナ', ['this', 'is', 'a']],
    ['dog', 'This is a dog.', 'これは いぬです。', 'これは 犬です。', '🐶', 'いぬ', ['this', 'is', 'a']],
    ['cat', 'Look at the cat.', 'ねこを みて。', '猫を 見て。', '🐱', 'ねこ', ['look', 'at', 'the']],
    ['rabbit', 'This is a rabbit.', 'これは うさぎです。', 'これは うさぎです。', '🐰', 'うさぎ', ['this', 'is', 'a']],
    ['bird', 'This is a bird.', 'これは とりです。', 'これは 鳥です。', '🐦', 'とり', ['this', 'is', 'a']],
    ['flower', 'This is a flower.', 'これは はなです。', 'これは 花です。', '🌸', 'はな', ['this', 'is', 'a']],
    ['tree', 'The tree is green.', 'その きは みどりいろです。', 'その 木は 緑色です。', '🌳', 'みどりいろの き', ['the', 'is', 'green']],
    ['house', 'This is a house.', 'これは いえです。', 'これは 家です。', '🏠', 'いえ', ['this', 'is', 'a']],
];
export const LISTENING_SENTENCES: readonly ListeningSentence[] = sentences.map(([wordId, english, japanese, japaneseKanji, glyph, sceneLabel, support]) => ({
    id: `sentence.${wordId}.v1`, version: 1, wordId, english, japanese, japaneseKanji, glyph, sceneLabel, support,
}));

export interface ListeningSession {
    completedIds: string[];
    recentWordIds: string[];
    offered: boolean;
    sentence?: ListeningSentence;
    open: boolean;
}
export const emptyListeningSession = (): ListeningSession => ({ completedIds: [], recentWordIds: [], offered: false, open: false });

/** Called only after a whole answer has been saved. No persistence or mastery writes. */
export function completeListeningAnswer(state: ListeningSession, problem: Problem, boundary: boolean, levels: readonly LevelState[]): ListeningSession {
    if (state.offered || state.completedIds.includes(problem.id)) return state;
    const vocab = problem.subject === 'vocab';
    const completedIds = vocab ? [...state.completedIds, problem.id] : state.completedIds;
    const recentWordIds = vocab ? [...state.recentWordIds, problem.categoryId].slice(-12) : state.recentWordIds;
    const next = { ...state, completedIds, recentWordIds };
    if (completedIds.length < 6 || !boundary) return next;
    const enabled = new Set(levels.filter(level => level.enabled && level.unlocked).map(level => level.level));
    const sentence = [...recentWordIds].reverse().map(id => LISTENING_SENTENCES.find(item => item.wordId === id))
        .find(item => item && enabled.has(ENGLISH_WORDS.find(word => word.id === item.wordId)!.level));
    return { ...next, offered: true, sentence };
}
