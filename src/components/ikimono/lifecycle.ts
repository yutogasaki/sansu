import { IkimonoStage, IkimonoState } from './types';

// ライフサイクル全体の日数（将来的に変更可能）
const LIFECYCLE_DAYS = 30;

// 各段階の終了日（この日を含まない）
const STAGE_BOUNDARIES: { stage: IkimonoStage; endDay: number }[] = [
    { stage: 'egg', endDay: 3 },
    { stage: 'hatching', endDay: 7 },
    { stage: 'small', endDay: 14 },
    { stage: 'medium', endDay: 22 },
    { stage: 'adult', endDay: 28 },
    { stage: 'fading', endDay: LIFECYCLE_DAYS },
];

export interface StageInfo {
    stage: IkimonoStage;
    fadeOpacity: number; // 1.0 = 完全表示, 0.0 = 完全に消えた
}

/**
 * birthDate からの経過日数に基づいて現在のステージを計算する
 */
export function calculateStage(birthDate: string): StageInfo {
    const elapsed = Date.now() - new Date(birthDate).getTime();
    const elapsedDays = elapsed / (1000 * 60 * 60 * 24);

    for (const { stage, endDay } of STAGE_BOUNDARIES) {
        if (elapsedDays < endDay) {
            if (stage === 'fading') {
                // fading 期間中のフェードアウト計算（28日→30日で 1.0→0.0）
                const fadingStart = 28;
                const fadeDuration = LIFECYCLE_DAYS - fadingStart;
                const fadeProgress = (elapsedDays - fadingStart) / fadeDuration;
                return { stage, fadeOpacity: Math.max(0, 1 - fadeProgress) };
            }
            return { stage, fadeOpacity: 1 };
        }
    }

    return { stage: 'gone', fadeOpacity: 0 };
}

/**
 * 新しいライフサイクルの IkimonoState を生成する
 */
export function createNewIkimonoState(profileId: string, generation = 1): IkimonoState {
    return {
        profileId,
        birthDate: new Date().toISOString(),
        generation,
    };
}
