import type { SubjectKey, UserProfile } from '../types';
import type { FinishReadiness } from '../finishCoverage';
import { finishEligibility } from '../finishTest';
import { needsProgressionResume } from '../user/resumeProgression';
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
    summary?: string;
    met: boolean;
    count?: number;
    target?: number;
}
export interface LearningProgressView {
    subject: SubjectKey;
    main: number;
    next: number | null;
    stage: 'unlock' | 'practice' | 'ready' | 'paused' | 'complete';
    message: string;
    conditions: ProgressCondition[];
    pauseReason?: 'disabled' | 'inconsistent';
}

/** Read-only presentation of the same evidence as the progression services. */
export function learningProgressView(profile: UserProfile, subject: SubjectKey, missingUnits: number = 7, readiness?: FinishReadiness): LearningProgressView {
    const eligibility = finishEligibility(profile, subject, missingUnits === 0 ? [] : Array(missingUnits).fill('missing'), readiness);
    const { mainLevel: main, nextLevel: next, count, correct, status } = eligibility;
    if (status === 'complete') return { subject, main, next: null, stage: 'complete', conditions: [], message: 'ここまでの はんいを まなんだよ。ふくしゅうも つづけよう。' };
    const conditions: ProgressCondition[] = [
        { label: 'いまの はんいの れんしゅう', summary: `${count} / 20`, detail: `${count} / 20問（さいきん7日間）`, count, target: 20, met: count >= 20 },
        { label: 'ひとりで 解けるか たしかめる', met: count >= 20 && correct >= 17,
            summary: `${correct} / ${count}`,
            detail: `${count}問のうち ${correct}問 ひとりでできた（20問中17問以上が めやす）` },
    ];
    if (readiness) conditions.push({ label: subject === 'math' ? 'いろいろな 型を たしかめる' : 'いろいろな ことばを たしかめる',
        summary: `${readiness.coveredCount} / ${readiness.requiredCount}`,
        detail: `${readiness.coveredCount} / ${readiness.requiredCount}${subject === 'math' ? 'つの 型' : '語'}`,
        count: readiness.coveredCount, target: readiness.requiredCount, met: eligibility.coverageReady === true });
    if (subject === 'math' && main === 11 && (!readiness || missingUnits > 0)) conditions.push({ label: 'いろいろな たしひきを たしかめる',
        summary: `${7 - missingUnits} / 7`,
        detail: `${7 - missingUnits} / 7つの 単元`, count: 7 - missingUnits, target: 7, met: missingUnits === 0 });
    if (readiness && !eligibility.fresh && count >= 20) conditions.push({ label: 'さいきんの できたを あつめる',
        detail: 'さいきん7日間の れんしゅうで たしかめよう', met: false });
    if (eligibility.recovering) conditions.push({ label: 'しあげで むずかしかった 型を れんしゅうする',
        detail: 'べつの 問題で ひとりで できたら、もういちど ちょうせんできるよ', met: false });
    if (status === 'paused') {
        const disabled = needsProgressionResume(profile, subject);
        return { subject, main, next, stage: 'paused', conditions, pauseReason: disabled ? 'disabled' : 'inconsistent',
            message: disabled
                ? `Lv${next}は 現在オフです。メインレベルの選び直しでも、上のレベルがオフになります。学習設定で進級を再開できます。`
                : 'レベルの設定を たしかめてね。いまの はんいの れんしゅうは つづけられるよ。' };
    }
    return { subject, main, next, stage: status === 'ready' ? 'ready' : 'unlock', conditions,
        message: status === 'ready' ? 'しあげに ちょうせんできるよ！クリアすると つぎの はんいへ。' : 'いまの はんいを れんしゅうして、しあげに そなえよう。' };
}

/** Changes to settings without new learning must not masquerade as earned progress. */
export function learningProgressNotice(before: UserProfile, after: UserProfile, subject: SubjectKey, readiness?: { beforeReady: boolean; afterReady: boolean }): string | null {
    const latest = after.recentAttempts?.slice(-1)[0];
    if (before.id !== after.id || !latest || latest.subject !== subject || latest.id === before.recentAttempts?.slice(-1)[0]?.id) return null;
    const mainKey = subject === 'math' ? 'mathMainLevel' : 'vocabMainLevel';
    const maxKey = subject === 'math' ? 'mathMaxUnlocked' : 'vocabMaxUnlocked';
    if (after[mainKey] > before[mainKey]) return `${learningLevelTitle(subject, after[mainKey])}へ すすんだよ`;
    if (after[maxKey] > before[maxKey]) return 'あたらしい はんいが ひらいたよ';
    if (readiness?.beforeReady === false && readiness.afterReady === true) return 'しあげに ちょうせんできるよ！';
    return null;
}
