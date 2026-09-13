import type { RelationCutover } from './relationMigration';
import type { FacilityCutover } from './facilityMigration';
import type { FacilityTrip } from './facilityTrips';
import type { TourCutover } from './tourMigration';
import type { PlayTourCursor } from './playTours';
import { growthRateV3, type LifeEconomyV3 } from './economyRules';
import type { LifeEconomyCheckpoint } from './economyMigration';
import type { DiscoveryJournal } from './discoveryJournal';

export const LIFE_CANDIDATE = 'island-life-economy-checkpoint-v3';
export const LIFE_STEP_MS = 1200;
export const HOUR = 3_600_000;
export const LIFE_RULES = { dropsPerProblem: 2, dailyGoal: 6, activityMs: HOUR / 2, expansionPrice: 12,
    maxItems: 30, budHours: 2, bloomHours: 6, stylePrice: 4 } as const;
export type ItemKind = 'flower' | 'bench' | 'swing' | 'lantern' | 'sapling' | 'water-bowl' | 'picnic-table' | 'pinwheel' | 'flower-arch' | 'sandbox' | 'garden-hut' | 'library';
export type Style = 'original' | 'sunshine' | 'starlight';
export type ResidentId = 'pokomoko' | 'rabbit' | 'otter';
export type LandSide = 'east' | 'west' | 'south';
export type Cell = { x: number; z: number };
export const CATALOG: Record<ItemKind, { label: string; price: number }> = {
    flower: { label: 'おはな', price: 2 }, bench: { label: 'ベンチ', price: 4 },
    swing: { label: 'ブランコ', price: 6 }, lantern: { label: 'ほしの あかり', price: 8 },
    sapling: { label: '木の なえ', price: 4 }, 'water-bowl': { label: '水ばち', price: 4 }, 'picnic-table': { label: 'ピクニック テーブル', price: 8 },
    pinwheel: { label: 'かざぐるま', price: 12 }, 'flower-arch': { label: '花の アーチ', price: 12 }, sandbox: { label: 'すなば', price: 18 },
    'garden-hut': { label: 'えんげい 小屋', price: 36 }, library: { label: '森の としょしつ', price: 72 },
};
export interface LifeItem { id: string; kind: ItemKind; cell?: Cell; growth: number; style: Style; access?: 'front'; paidDrops?: number }
export interface Credit { id: string; at: number; day: string }
export type LifeCommand = { type: 'buy'; kind: ItemKind; cell: Cell }
    | { type: 'move'; itemId: string; cell: Cell } | { type: 'store' | 'remove' | 'visit' | 'observe'; itemId: string }
    | { type: 'observe-relation'; itemId: string; residentId: ResidentId; targetId?: string }
    | { type: 'expand'; side: LandSide } | { type: 'style'; style: Style; itemId?: string };
export interface LifePurchaseReceipt {
    priceVersion: 'life-48-v1' | 'life-v3-plants-water-v1' | 'life-v3-picnic-v1' | 'life-v3-wind-arch-v1' | 'life-v3-sandbox-v1' | 'life-v3-facilities-v1'; actualPaidDrops: number; quoteFingerprint: string;
    itemInstanceId: string; committedAt: number;
}
export interface LifeLandReceipt {
    rules: 'land-12-24-48-v1'; step: number; side: LandSide; actualPaidDrops: number; actionId: string; committedAt: number;
}
export interface LifeAction { id: string; at: number; command: LifeCommand; purchaseReceipt?: LifePurchaseReceipt; landReceipt?: LifeLandReceipt; undoOf?: string }
export interface LifeRecord {
    profileId: string; version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; revision: number; createdAt: number; realAt: number; now: number;
    credits: Credit[]; actions: LifeAction[]; offsets: { at: number; offset: number }[]; clockIntents: string[];
    activitiesV2At?: number;
    activitiesV2After?: number;
    clockIntentHours?: Record<string, 6 | 24>;
    discoveryJournal?: DiscoveryJournal;
    economyCheckpoint?: LifeEconomyCheckpoint;
    tourCutover?: TourCutover;
    facilityCutover?: FacilityCutover;
    relationCutover?: RelationCutover;
}
export interface Visit { observationSubjectId?: string; relationTargetId?: string; relationSelectionVersion?: 1; observationTest?: boolean; itemId: string; from: Cell; path: Cell[]; start: number; end: number }
/** Synthetic visits let the renderer show quiet ground walks without turning
 * them into a furniture use or a persisted command. */
export const ROAM_VISIT_PREFIX = 'roam:';
export function isRoamVisit(visit?: Pick<Visit, 'itemId'>) {
    return Boolean(visit?.itemId.startsWith(ROAM_VISIT_PREFIX));
}
export interface LifeResident {
    facilityTrip?: FacilityTrip;
    archCooldownUntil?: number;
    playTour?: PlayTourCursor & { remainingMs: number };
    id: ResidentId; cell: Cell; visit?: Visit; enjoyed: number; enjoyedBy: Partial<Record<ItemKind, number>>;
    discovery?: { itemId: string; at: number; mood: 'notice' | 'curious' };
}
export type LifeWorldStyle = 'moon-garden-v1' | 'canopy-dots-c3-v1';
export interface LifeState {
    worldStyle?: LifeWorldStyle;
    landscapeVersion?: 'groves-water-v1';
    relationVersion?: 'water-bench-v1';
    shadowMagicVersion?: 1;
    shadowTouch?: { itemId: string; residentId: ResidentId };
    waterMagicVersion?: 1;
    waterTouch?: { itemId: string; point: [number, number] };
    poseReducedMotion?: boolean;
    waterFocus?: { residentId: ResidentId; itemId: string; targetId: string; ready: boolean; focus: number[] }[];
    extraLand?: LandSide[];
    facilityPresentation?: 'carry-care-v1';
    facilityTripVersion?: 1;
    relationSelectionVersion?: 1;
    tourVersion?: 1;
    scenePose?: 'captured-v1';
    roamRound?: number;
    now: number; activityVersion: 1 | 2; drops: number; light: number; expanded?: 'east' | 'west'; items: LifeItem[];
    styles: Style[]; heroStyle: Style; target?: string; days: Record<string, number>;
    economy?: LifeEconomyV3;
    relationTarget?: { benchId: string; targetId: string };
    lastAchievement?: number; residents: LifeResident[];
}
export interface District { id: string; ids: string[]; kind: 'flowers' | 'play'; label: string; cells: Cell[] }
export function lifeEnabled() { return import.meta.env.VITE_ISLAND_LIFE_ENABLED === 'true' || import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true'; }
export function learningDay(at: number) {
    const date = new Date(at); date.setHours(date.getHours() - 4);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function vigor(s: LifeState, at = s.now) {
    if (s.economy) return growthRateV3(s.economy.completionTimes, at);
    if (s.lastAchievement === undefined) return .25;
    const elapsed = at - s.lastAchievement;
    return elapsed < 24 * HOUR ? 1 : elapsed < 72 * HOUR ? .5 : .1;
}
export function plantThresholds(kind: ItemKind): readonly [number, number] | undefined {
    return kind === 'flower' ? [LIFE_RULES.budHours, LIFE_RULES.bloomHours] : kind === 'sapling' ? [6, 18] : undefined;
}
export function growthStage(item: Pick<LifeItem, 'kind' | 'growth'>) {
    const thresholds = plantThresholds(item.kind);
    return !thresholds ? 2 : item.growth >= thresholds[1] ? 2 : item.growth >= thresholds[0] ? 1 : 0;
}
export function newLife(profileId: string, now: number): LifeRecord {
    return { profileId, version: 1, revision: 0, createdAt: now, realAt: now, now, credits: [], actions: [], offsets: [{ at: now, offset: 0 }], clockIntents: [], activitiesV2At: now, activitiesV2After: 0 };
}

export function readableLifeVersion(version: number) { return version === 1 || version === 2 || version === 3 || version === 4 || version === 5 || version === 6 || version === 7 || version === 8 || version === 9 || version === 10 || version === 11 || version === 12 || version === 13 || version === 14; }
