import type { AttemptLog } from '../../db';
import type { MemoryState, SubjectKey, UserProfile } from '../types';
import { getNextPromotionLevel, mathPromotionEvidence } from '../levelProgression';
import { getSkillsForLevel, MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from '../math/curriculum';
import { getWordsByLevel } from '../english/words';
import { independentCorrectCount } from './independentProgress';

const mathTitles = [
    'かずと すうじ', 'かたち・いろ・もよう', 'かずと ばしょ', '10までの かず',
    'おおきさくらべ', 'かずを わける', 'かずと たしひき', '100までの かず',
    'はじめの たしざん', 'くり上がりの たしざん', 'ひきざん', '2けたの たしひき',
    '大きな かずの たしひき', '九九 1〜5のだん', '九九 6〜9のだん', 'かけざんの ひっさん',
    'わりざん', 'あまりのある わりざん', '大きな かずの かけ算・わり算',
    '小数の たしひき', '小数の かけ算・わり算', '分母が同じ 分数', '分母がちがう 分数',
    '分数の かけ算', '分数の わり算と 倍', '大きな数と 小数くらべ', '分数くらべと 百分率', '平均と 比', '速さ',
];
export const learningLevelTitle = (subject: SubjectKey, level: number): string => subject === 'math'
    ? mathTitles[level] ?? 'さんすう' : `ことばの セット ${level}`;

export interface ProgressCondition {
    label: string;
    detail: string;
    met: boolean;
    count?: number;
    target?: number;
}
export interface LearningProgressView {
    subject: SubjectKey;
    main: number;
    next: number | null;
    stage: 'unlock' | 'practice' | 'paused' | 'complete';
    message: string;
    conditions: ProgressCondition[];
}

/** Read-only presentation of the same evidence as the progression services. */
export function learningProgressView(profile: UserProfile, subject: SubjectKey, logs: readonly AttemptLog[] = [],
    memories: readonly MemoryState[] = [], missingUnits: number = 7): LearningProgressView {
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const max = subject === 'math' ? profile.mathMaxUnlocked : profile.vocabMaxUnlocked;
    const limit = subject === 'math' ? MAX_MATH_LEVEL : MAX_VOCAB_LEVEL;
    const levels = subject === 'math' ? profile.mathLevels : profile.vocabLevels;
    if (main >= limit) return { subject, main, next: null, stage: 'complete', conditions: [], message: 'ここまでの はんいが ひらいたよ。ふくしゅうも つづけられるよ。' };
    const next = main + 1;
    if (max > main && getNextPromotionLevel(profile, subject) === null) return { subject, main, next, stage: 'paused', conditions: [],
        message: 'つぎの はんいは おやすみ中。いまの はんいで つづけよう。' };
    const stage = max > main ? 'practice' : 'unlock';
    const conditions: ProgressCondition[] = [];
    if (stage === 'practice' && subject === 'vocab') {
        const words = getWordsByLevel(next);
        const ids = new Set(memories.filter(memory => independentCorrectCount(memory) > 0).map(memory => memory.id));
        const count = words.filter(word => ids.has(word.id)).length;
        const target = Math.ceil(words.length * 0.7);
        conditions.push({ label: 'ひとりで できた ことば', detail: `${count} / ${target}語（このセットの70%）`, count, target,
            met: words.length > 0 && count >= target });
    } else {
        const recent = levels?.find(level => level.level === main)?.recentIndependentAnswersNonReview ?? [];
        const ids = new Set(getSkillsForLevel(next));
        const evidence = stage === 'practice' ? mathPromotionEvidence(logs.filter(log => log.profileId === profile.id && log.subject === subject && ids.has(log.itemId)))
            : { answered: recent.length, recentCount: recent.length, correct: recent.filter(Boolean).length };
        const target = stage === 'practice' ? 30 : 20;
        conditions.push({ label: stage === 'practice' ? 'つぎの はんいに 取り組む' : 'いまの はんいを たしかめる',
            detail: `${Math.min(evidence.answered, target)} / ${target}問`, count: evidence.answered, target, met: evidence.answered >= target });
        const met = evidence.recentCount >= 20 && evidence.correct / evidence.recentCount >= 0.85;
        conditions.push({ label: 'ひとりで 解けるか たしかめる', met,
            detail: evidence.recentCount < 20 ? `確認のきろくを あつめているよ（${evidence.recentCount} / 20問）`
                : `直近${evidence.recentCount}問で ${evidence.correct}問。めやすは85%以上` });
    }
    if (subject === 'math' && (stage === 'unlock' ? main : next) === 11) {
        conditions.push({ label: 'いろいろな たしひきを たしかめる', detail: `${7 - missingUnits} / 7つの 単元`,
            count: 7 - missingUnits, target: 7, met: missingUnits === 0 });
    }
    return { subject, main, next, stage, conditions,
        message: stage === 'practice' ? 'つぎの はんいが ひらいたよ。少しずつ れんしゅう中。' : 'ひとりで 解けることを ふやして、つぎの はんいへ。' };
}

/** Changes to settings without new learning must not masquerade as earned progress. */
export function learningProgressNotice(before: UserProfile, after: UserProfile, subject: SubjectKey): string | null {
    const latest = after.recentAttempts?.slice(-1)[0];
    if (before.id !== after.id || !latest || latest.subject !== subject || latest.id === before.recentAttempts?.slice(-1)[0]?.id) return null;
    const mainKey = subject === 'math' ? 'mathMainLevel' : 'vocabMainLevel';
    const maxKey = subject === 'math' ? 'mathMaxUnlocked' : 'vocabMaxUnlocked';
    if (after[mainKey] > before[mainKey]) return `${learningLevelTitle(subject, after[mainKey])}へ すすんだよ`;
    if (after[maxKey] > before[maxKey]) return 'あたらしい はんいが ひらいたよ';
    return null;
}
