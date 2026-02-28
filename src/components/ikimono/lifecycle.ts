import { IkimonoStage, IkimonoState, SPECIES_COUNT } from './types';

// ライフサイクル全体の日数（将来的に変更可能）
export const LIFECYCLE_DAYS = 30;

// 各段階の終了日（この日を含まない）
export const STAGE_BOUNDARIES: { stage: IkimonoStage; endDay: number }[] = [
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
 * previousSpecies を渡すと、前の世代と異なる種類が選ばれる
 */
export function createNewIkimonoState(profileId: string, generation = 1, previousSpecies?: number): IkimonoState {
    let species = Math.floor(Math.random() * SPECIES_COUNT);
    if (previousSpecies != null && SPECIES_COUNT > 1) {
        while (species === previousSpecies) {
            species = Math.floor(Math.random() * SPECIES_COUNT);
        }
    }
    return {
        profileId,
        birthDate: new Date().toISOString(),
        generation,
        species,
    };
}

/**
 * 既存データに species がない場合（後方互換）、ランダムに補完する
 */
export function ensureSpecies(state: Omit<IkimonoState, 'species'> & { species?: number }): IkimonoState {
    if (state.species != null) return state as IkimonoState;
    return { ...state, species: Math.floor(Math.random() * SPECIES_COUNT) };
}
