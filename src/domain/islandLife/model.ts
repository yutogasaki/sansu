export const LIFE_CANDIDATE = 'island-life-garden-v6';
export const LIFE_STEP_MS = 1200;
export const HOUR = 3_600_000;
export const LIFE_RULES = { dropsPerProblem: 2, dailyGoal: 6, activityMs: HOUR / 2, expansionPrice: 12,
    maxItems: 30, budHours: 2, bloomHours: 6, stylePrice: 4 } as const;
export type ItemKind = 'flower' | 'bench' | 'swing' | 'lantern';
export type Style = 'original' | 'sunshine' | 'starlight';
export type ResidentId = 'pokomoko' | 'rabbit' | 'otter';
export type Cell = { x: number; z: number };
export const CATALOG: Record<ItemKind, { label: string; price: number }> = {
    flower: { label: 'おはな', price: 2 }, bench: { label: 'ベンチ', price: 4 },
    swing: { label: 'ブランコ', price: 6 }, lantern: { label: 'ほしの あかり', price: 8 },
};
export interface LifeItem { id: string; kind: ItemKind; cell?: Cell; growth: number; style: Style; access?: 'front' }
export interface Credit { id: string; at: number; day: string }
export type LifeCommand = { type: 'buy'; kind: ItemKind; cell: Cell }
    | { type: 'move'; itemId: string; cell: Cell } | { type: 'store' | 'remove' | 'visit'; itemId: string }
    | { type: 'expand'; side: 'east' | 'west' } | { type: 'style'; style: Style; itemId?: string };
export interface LifeAction { id: string; at: number; command: LifeCommand }
export interface LifeRecord {
    profileId: string; version: 1; revision: number; createdAt: number; realAt: number; now: number;
    credits: Credit[]; actions: LifeAction[]; offsets: { at: number; offset: number }[]; clockIntents: string[];
    activitiesV2At?: number;
    activitiesV2After?: number;
}
export interface Visit { itemId: string; from: Cell; path: Cell[]; start: number; end: number }
export interface LifeResident {
    id: ResidentId; cell: Cell; visit?: Visit; enjoyed: number; enjoyedBy: Partial<Record<ItemKind, number>>;
    discovery?: { itemId: string; at: number; mood: 'notice' | 'curious' };
}
export interface LifeState {
    now: number; activityVersion: 1 | 2; drops: number; light: number; expanded?: 'east' | 'west'; items: LifeItem[];
    styles: Style[]; heroStyle: Style; target?: string; days: Record<string, number>;
    lastAchievement?: number; residents: LifeResident[];
}
export interface District { id: string; ids: string[]; kind: 'flowers' | 'play'; label: string; cells: Cell[] }
export function lifeEnabled() { return import.meta.env.VITE_ISLAND_LIFE_ENABLED === 'true' || import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true'; }
export function learningDay(at: number) {
    const date = new Date(at); date.setHours(date.getHours() - 4);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function vigor(s: LifeState, at = s.now) {
    if (s.lastAchievement === undefined) return .25;
    const elapsed = at - s.lastAchievement;
    return elapsed < 24 * HOUR ? 1 : elapsed < 72 * HOUR ? .5 : .1;
}
export function growthStage(item: Pick<LifeItem, 'kind' | 'growth'>) { return item.kind !== 'flower' ? 2 : item.growth >= LIFE_RULES.bloomHours ? 2 : item.growth >= LIFE_RULES.budHours ? 1 : 0; }
export function newLife(profileId: string, now: number): LifeRecord {
    return { profileId, version: 1, revision: 0, createdAt: now, realAt: now, now, credits: [], actions: [], offsets: [{ at: now, offset: 0 }], clockIntents: [], activitiesV2At: now, activitiesV2After: 0 };
}
