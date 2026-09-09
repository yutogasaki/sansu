import type { HomeJourneyState } from './homeJourney';
import type { IslandObservationV1 } from './learningObservation';
import type { SubjectKey } from '../types';
import type { LearningSlot, ParkLearningAction } from '../park/types';
import type { LearningEvidenceBarrier, LearningEvidenceContext } from '../learning/types';
import type { IslandCosmetics, IslandCustomizationAction, IslandCustomizationState } from './customization';
import type { IslandExperienceAction, IslandExperienceState } from './experience';
import type { IslandWorkshopAction, IslandWorkshopState } from './workshop';
import type { IslandSharedMemoriesAction, IslandSharedMemoriesState, SharedMemory } from './sharedMemories';
import type { IslandPhotoAction, IslandPhotoReceipt } from './photos';
import type { IslandFurnitureAction } from './furniture';
import type { IslandExpressionAction, IslandExpressionState } from './expression';
import type { IslandSavedSceneStyleV2 } from './sceneStyle';
import type { IslandRewardGoalAction, IslandRewardGoalState } from './rewardGoalTypes';
import type { IslandLearningKeepsakeAction, IslandLearningKeepsakesState } from './learningKeepsakes';

export const ISLAND_BASIC_ITEM_KINDS = ['bench', 'flower', 'lantern', 'swing', 'mushroom', 'fountain'] as const;
export type IslandBasicItemKind = typeof ISLAND_BASIC_ITEM_KINDS[number];
export const ISLAND_OPTIONAL_FURNITURE_KINDS = ['telescope', 'hammock', 'tea-table'] as const;
export type IslandOptionalFurnitureKind = typeof ISLAND_OPTIONAL_FURNITURE_KINDS[number];
export const ISLAND_ITEM_KINDS = [...ISLAND_BASIC_ITEM_KINDS, ...ISLAND_OPTIONAL_FURNITURE_KINDS] as const;
export type IslandItemKind = typeof ISLAND_ITEM_KINDS[number];
export const ISLAND_HABITAT_IDS = ['garden', 'waterside', 'grove', 'village'] as const;
export type IslandHabitatId = typeof ISLAND_HABITAT_IDS[number];
export interface IslandPosition { x: number; z: number }
export interface IslandItem {
    id: string;
    kind: IslandItemKind;
    position?: IslandPosition;
    rotation: number;
    habitatId?: IslandHabitatId;
    growthLevel?: number;
    /** Omitted follows growth. A selected older appearance never removes earned play. */
    appearanceLevel?: number;
    /** An automatically added item had no clear place; manual placement remains available. */
    autoPlacementBlocked?: boolean;
}
export interface IslandGrowthMemory {
    id: string;
    kind: 'initial' | 'upgrade' | 'expansion';
    capturedAt: number;
    completedSets: number;
    /** Omitted preserves this snapshot's original completed-set land rules. */
    expansionLevel?: 0 | 1 | 2;
    habitatId?: IslandHabitatId;
    level?: number;
    progress: Record<IslandHabitatId, number>;
    focus: IslandHabitatId;
    items: IslandItem[];
    /** Omitted snapshots retain their original moon garden appearance. */
    cosmetics?: IslandCosmetics;
    /** New captures keep confirmed expression choices. Old memories retain their legacy display. */
    sceneStyle?: IslandSavedSceneStyleV2;
}
export interface IslandDiscovery { id: string; itemId: string; discoveredAt: number }
export interface IslandGrowthState {
    version: 1;
    /** Completed whole problems toward each next mark; absence means zero. */
    pendingAnswers?: Record<IslandHabitatId, number>;
    /** Omitted preserves land already earned under the original v1 rules. */
    expansionLevel?: 0 | 1 | 2;
    progress: Record<IslandHabitatId, number>;
    focus: IslandHabitatId;
    memories: IslandGrowthMemory[];
    discoveries: IslandDiscovery[];
}
export interface IslandReward {
    id: string;
    planId: string;
    choices: IslandBasicItemKind[];
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
    homeJourney?: HomeJourneyState;
    profileId: string;
    schemaVersion: 1;
    revision: number;
    completedSets: number;
    pendingPlanId?: string;
    items: IslandItem[];
    pendingRewards: IslandReward[];
    /** Additive v1 migration: old reservations keep their original gift contract. */
    growth?: IslandGrowthState;
    /** Optional v1 extension: absent balances receive one legacy completed-set credit. */
    customization?: IslandCustomizationState;
    /** Optional v1 expression settings and layout memories; independent of learning and growth. */
    experience?: IslandExperienceState;
    /** Finite acquired expression and independent selection; ordinary writers preserve absence. */
    expression?: IslandExpressionState;
    /** One optional furniture/expression goal; legacy customization goals keep their original field. */
    rewardGoal?: IslandRewardGoalState;
    /** Free finite memorial displays; eligibility is derived from completed sections. */
    learningKeepsakes?: IslandLearningKeepsakesState;
    /** Optional confirmed workshop gestures and observations; ordinary learning writers preserve absence. */
    workshop?: IslandWorkshopState;
    /** Optional bounded displays, shared requests and memories. Image bytes live in separate photo stores. */
    sharedMemories?: IslandSharedMemoriesState;
    /** One outstanding independent check per skill; old v1 records omit these fields. */
    pendingMathChecks?: IslandMathCheck[];
    mathReviewTurn?: number;
    vocabDueCursor?: string;
    /** A one-section choice, consumed only when the following reservation is saved. */
    nextSubjectChoice?: { afterPlanId: string; subject: SubjectKey };
    updatedAt: number;
}
export interface IslandPlan {
    homeJourneyVersion?: 1;
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
    rewardChoices: IslandBasicItemKind[];
    /** Presence opts into automatic growth; frozen when this reservation is created. */
    growthTarget?: IslandHabitatId;
    /** Absent old reservations retain ten stars and one growth mark per section. */
    rewardPacing?: 'answers-v1';
    startedAt: number;
    completedAt?: number;
    /** Captured only for new reservations; old plans do not imply introduction evidence. */
    introducedItemIds?: string[];
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
    type: 'plan_started' | 'plan_completed' | 'answer' | 'support_opened' | 'model_opened' | 'supported_completed' | 'skipped' | 'reward_claimed' | 'item_edited' | 'growth_selected' | 'appearance_changed' | 'discovery_observed' | 'customization_changed' | 'experience_changed' | 'workshop_changed' | 'shared_memory_changed' | 'shared_memory_first' | 'photo_changed' | 'furniture_acquired' | 'expression_changed' | 'reward_goal_changed' | 'learning_keepsakes_changed';
    timestamp: number;
    action?: IslandLearningAction | IslandEdit | IslandCustomizationAction | IslandExperienceAction | IslandWorkshopAction | IslandSharedMemoriesAction | IslandPhotoAction | IslandFurnitureAction | IslandExpressionAction | IslandRewardGoalAction | IslandLearningKeepsakeAction;
    /** Immutable first shared result; no image data and never a learning evidence input. */
    sharedMemory?: SharedMemory;
    /** Small photo receipt only; PNG/thumbnail bytes never enter the event or learning writer. */
    photoReceipt?: IslandPhotoReceipt;
    slotIndex?: number;
    result?: 'correct' | 'incorrect' | 'assisted-correct' | 'assisted-incorrect' | 'skipped' | 'supported-completion';
    learningLogId?: number;
    learningEvidence?: LearningEvidenceContext;
    learningEvidenceBarrier?: LearningEvidenceBarrier;
    rewardId?: string;
    itemId?: string;
    kind?: IslandItemKind;
    habitatId?: IslandHabitatId;
    appearanceLevel?: number;
    discoveryId?: string;
}
