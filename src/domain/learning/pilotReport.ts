import { LEARNING_ITEM_MAPPINGS, LEARNING_UNITS, validateLearningCatalog } from './catalog';
import { createLearningProblemContext } from './context';
import { evaluateMathLevel11Pilot } from './evidence';
import type { LearningEvidenceRecord } from './evidence';
import { LEARNING_CATALOG_VERSION } from './types';
import type { Problem } from '../types';
import { hasMathPromotionEvidence } from '../levelProgression';

const PROFILE = 'synthetic-pilot';
const AS_OF = '2026-09-11T12:00:00.000Z';

/** Authored equations make the comparison reproducible without changing production RNG. */
const attempt = (skill: string, a: number, b: number, index: number, day = 8): LearningEvidenceRecord => {
    const addition = skill.startsWith('add');
    const problem: Problem = {
        id: `sample-${index}`, subject: 'math', categoryId: skill,
        questionText: `${a} ${addition ? '+' : '-'} ${b} =`,
        correctAnswer: String(addition ? a + b : a - b), inputType: 'number', isReview: false,
    };
    return {
        id: `${day}:${index}`, profileId: PROFILE, subject: 'math', itemId: skill,
        result: 'correct', timestamp: `2026-09-${String(day).padStart(2, '0')}T10:00:${String(index % 60).padStart(2, '0')}.000Z`,
        learningEvidence: {
            problem: createLearningProblemContext('math', problem)!,
            assistance: 'independent', completion: 'whole-problem',
        },
    };
};

export const createMathPilotScenarios = () => {
    const onlyAddition = Array.from({ length: 30 }, (_, i) => attempt('add_2d1d_nc', 20 + (i % 8) + 10 * Math.floor(i / 8), 1, i));
    const repeated = Array.from({ length: 30 }, (_, i) => attempt('add_2d1d_nc', 23, 4, i));
    const groups: [string, number, number][] = [
        ['add_2d1d_nc', 21, 3], ['add_2d1d_c', 28, 4],
        ['sub_2d1d_nc', 28, 3], ['sub_2d1d_c', 31, 4],
        ['add_2d2d_nc', 21, 13], ['add_2d2d_c', 28, 14],
        ['sub_2d2d', 38, 12], ['sub_2d2d', 41, 14],
    ];
    const balanced = groups.flatMap(([skill, a, b], group) => Array.from({ length: 3 }, (_, i) =>
        attempt(skill, a + i * 10, b, group * 3 + i)));
    const delayed = [...balanced, ...groups.map(([skill, a, b], i) => attempt(skill, a, b, i, 10))];
    const support = balanced.map((record): LearningEvidenceRecord => ({
        ...record, learningEvidence: { ...record.learningEvidence!, assistance: 'assisted' },
    }));
    const oldLogs = onlyAddition.map((record) => {
        const old = { ...record };
        delete old.learningEvidence;
        return old;
    });
    const laterBarrier: LearningEvidenceRecord = {
        id: 'support-after-retention', profileId: PROFILE, subject: 'math', itemId: 'sub_2d2d',
        timestamp: '2026-09-11T10:00:00.000Z', result: 'barrier',
        learningEvidenceBarrier: { problem: delayed[delayed.length - 1].learningEvidence!.problem, reason: 'support-opened' },
    };
    return [
        { name: '足し算だけ30問', description: '従来のレベル全体の条件を満たしても、引き算や他の単元を達成としない。', records: onlyAddition },
        { name: '同じ問題を30回', description: '同じ内容の反復を異なる問題の理解として数えない。', records: repeated },
        { name: '支援付きで全単元', description: '支援で完了した記録は独力の証拠へ変換しない。', records: support },
        { name: '全単元を同日に独力確認', description: '7単元・必要な8種類を各3問確認。定着はまだ未確認。', records: balanced },
        { name: '全単元を後日再確認', description: '24時間以上を空けて独力で再確認した合成データ。実参加者の成果ではない。', records: delayed },
        { name: '定着確認後に支援', description: 'その後つまずいた単元は独力確認を再収集する。', records: [...delayed, laterBarrier] },
        { name: '文脈のない旧記録', description: '旧正解数・卒業済み状態から新しい単元達成を作らない。', records: oldLogs },
    ];
};

export const buildLearningPilotReport = () => ({
    catalogVersion: LEARNING_CATALOG_VERSION,
    inventory: {
        mathItems: LEARNING_ITEM_MAPPINGS.filter((item) => item.subject === 'math').length,
        mathUnits: LEARNING_UNITS.filter((unit) => unit.subject === 'math').length,
        englishItems: LEARNING_ITEM_MAPPINGS.filter((item) => item.subject === 'vocab').length,
        englishUnits: LEARNING_UNITS.filter((unit) => unit.subject === 'vocab').length,
    },
    catalogErrors: validateLearningCatalog(),
    units: LEARNING_UNITS,
    mappings: LEARNING_ITEM_MAPPINGS,
    scenarios: createMathPilotScenarios().map(({ name, description, records }) => ({
        name, description,
        evaluation: {
            legacyLevel11Evidence: hasMathPromotionEvidence(records.filter((record) => record.result !== 'barrier')
                .map((record, index) => ({ ...record, id: index, result: record.result as 'correct' | 'incorrect' | 'skipped' }))),
            ...evaluateMathLevel11Pilot(records, PROFILE, AS_OF),
        },
    })),
    limitations: [
        '試作の比較判定です。通常の出題・SRS・レベル・保護者設定は変更しません。',
        'シナリオは合成データであり、子どもの学力向上・自発的再遊びの実測ではありません。',
        '3種類の独力正解と24時間以上の間隔は初期の比較条件です。最適値とは断定していません。',
        '単元の実績と前提の確認は別です。未実装の前提を満たしたことにはしません。',
        '英語は綴りが表示された訳語選択の対応です。聞く・話す・書く能力を認定しません。',
        'mathUnitsには教材未実装のplanned単元を含みます。表現欄は出題の形式であり、頭の中の解法を推定しません。',
    ],
});
