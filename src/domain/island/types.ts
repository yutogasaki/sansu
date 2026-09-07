import type { IslandObservationV1 } from './learningObservation';
import type { SubjectKey } from '../types';
import type { LearningSlot, ParkLearningAction } from '../park/types';

export const ISLAND_ITEM_KINDS = ['bench', 'flower', 'lantern', 'swing', 'mushroom', 'fountain'] as const;
export type IslandItemKind = typeof ISLAND_ITEM_KINDS[number];
export interface IslandPosition { x: number; z: number }
export interface IslandItem {
    id: string;
    kind: IslandItemKind;
    position?: IslandPosition;
    rotation: number;
}
export interface IslandReward {
    id: string;
    planId: string;
    choices: IslandItemKind[];
    earnedAt: number;
}
export interface IslandMathCheck {
    skillId: string;
    failedProblemId: string;
    failedQuestionKey: string;
    stage: 'bridge' | 'independent';
    createdAt: number;
}
export interface IslandRecord {
    profileId: string;
    schemaVersion: 1;
    revision: number;
    completedSets: number;
    pendingPlanId?: string;
    items: IslandItem[];
    pendingRewards: IslandReward[];
    /** One outstanding independent check per skill; old v1 records omit these fields. */
    pendingMathChecks?: IslandMathCheck[];
    mathReviewTurn?: number;
    vocabDueCursor?: string;
    updatedAt: number;
}
export interface IslandPlan {
    id: string;
    profileId: string;
    schemaVersion: 1;
    plannerVersion: 'island-learning-v1';
    subject: SubjectKey;
    status: 'active' | 'completed';
    revision: number;
    cursor: number;
    slots: IslandLearningSlot[];
    rewardId: string;
    rewardChoices: IslandItemKind[];
    startedAt: number;
    completedAt?: number;
}
/** Optional v1 extension: old assisted slots have already exposed an answer. */
export interface IslandLearningSlot extends LearningSlot {
    supportStage?: 'hint' | 'model';
}
export type IslandLearningAction = ParkLearningAction
    | { type: 'model_opened' }
    | { type: 'supported_completed' };
export type IslandEdit =
    | { type: 'place'; itemId: string; position: IslandPosition; rotation: number }
    | { type: 'store'; itemId: string };
export interface IslandEvent {
    /** Optional prospective facts; never a grading, SRS or mastery input. */
    observation?: IslandObservationV1;
    id: string;
    profileId: string;
    planId?: string;
    type: 'plan_started' | 'plan_completed' | 'answer' | 'support_opened' | 'model_opened' | 'supported_completed' | 'skipped' | 'reward_claimed' | 'item_edited';
    timestamp: number;
    action?: IslandLearningAction | IslandEdit;
    slotIndex?: number;
    result?: 'correct' | 'incorrect' | 'assisted-correct' | 'assisted-incorrect' | 'skipped' | 'supported-completion';
    learningLogId?: number;
    rewardId?: string;
    itemId?: string;
    kind?: IslandItemKind;
}
