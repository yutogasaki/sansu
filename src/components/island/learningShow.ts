import type { IslandLearningFeedback } from './learningFeedback';

export type LearningShow = { completed: number; receipt?: string };

/** Session presentation only: help and misses cannot take the stage away. */
export function advanceLearningShow(previous: LearningShow, receipt?: IslandLearningFeedback): LearningShow {
    if (!receipt || previous.receipt === receipt.id) return previous;
    return { receipt: receipt.id, completed: Math.min(9, previous.completed + (receipt.kind === 'correct' || receipt.kind === 'supported' ? 1 : 0)) };
}

export const learningShowLevel = (completed: number) => Math.min(3, Math.floor(Math.max(0, completed) / 3));
