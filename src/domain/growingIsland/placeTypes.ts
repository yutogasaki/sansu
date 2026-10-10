import type { Cell } from './types';

export const PLACE_GOAL_IDS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'] as const;
export type PlaceGoalId = typeof PLACE_GOAL_IDS[number];
export type PlaceFamily = 'grove' | 'spring' | 'community' | 'flowers';
export type PlaceStage = 'seeded' | 'connected' | 'grown' | 'lived';
export interface PlacePoint extends Cell { y: number }
export interface PlaceUseTarget {
    id: string;
    kind: 'seat' | 'play' | 'gallery' | 'shore';
    cell: Cell;
    /** Physical floor route starts and ends on the same reachable ground entrance. */
    route?: PlacePoint[];
}
export interface DerivedPlace {
    id: string;
    ruleId: Exclude<PlaceGoalId, 'P06'>;
    family: PlaceFamily;
    anchorId: string;
    memberIds: string[];
    mainIds: string[];
    variant: string;
    stage: PlaceStage;
    footprint: Cell[];
    entrances: Cell[];
    walkSurface: PlacePoint[];
    waterRefs: string[];
    shadeRefs: string[];
    useTargets: PlaceUseTarget[];
    revision: string;
    /** Missing prerequisites, available even while its owners are still growing. */
    missing: string[];
}
export interface PlaceRelation {
    id: 'C01' | 'C02' | 'C03' | 'C04';
    placeIds: [string, string];
    path: Cell[];
}
export interface PlaceEvidence {
    at: number;
    ruleId: PlaceGoalId;
    anchorId: string;
    memberIds: string[];
    variant: string;
    revision: string;
}
export interface PlaceUseEvidence extends PlaceEvidence { actorId: string; targetId: string }
export interface PlaceProgress {
    version: 1;
    selected?: PlaceGoalId;
    milestones: Partial<Record<PlaceGoalId, PlaceEvidence>>;
    uses: Partial<Record<PlaceGoalId, { pokomoko?: PlaceUseEvidence; villager?: PlaceUseEvidence }>>;
    /** Original actual-use snapshots survive moving, storing and reconnecting their owners. */
    useHistory?: PlaceUseEvidence[];
    shown: Partial<Record<PlaceGoalId, string>>;
}
export interface PlaceStatus {
    id: PlaceGoalId;
    name: string;
    family: PlaceFamily | 'island';
    hint: string;
    stage: PlaceStage;
    achieved: boolean;
    place?: DerivedPlace;
    missing: string[];
}
