import { newIsland } from './island';
import { islandCharacter, syncSoil } from './environment';
import type { GrowingRecord } from './repository';

export const FIRST_ISLAND = 'main';
export const ISLAND_STARTS = {
    garden: { name: '花のしま', hint: '花を そだてる ところから', symbol: '✿' },
    grove: { name: '森のしま', hint: '木の苗を そだてる ところから', symbol: '♧' },
    water: { name: '水辺のしま', hint: '水を ひく ところから', symbol: '≈' },
} as const;
export type IslandStart = keyof typeof ISLAND_STARTS;
export const islandIdOf = (record?: GrowingRecord) => record?.islandId ?? FIRST_ISLAND;

export function makeVoyageIsland(current: GrowingRecord, id: string, name: string, start: IslandStart, now: number): GrowingRecord {
    if (!id || id === FIRST_ISLAND || !Object.prototype.hasOwnProperty.call(ISLAND_STARTS, start)) throw new Error('しまの はじまりを えらんでね。');
    const title = name.trim();
    if (!title || [...title].length > 12) throw new Error('なまえは 1〜12もじで つけてね。');
    const state = newIsland(current.profileId, now);
    state.islandName = title;
    if (start === 'grove') state.landmarks.push(
        { id: 'voyage-tree-1', kind: 'sapling', cell: { x: 0, z: 1 }, growth: 0 },
        { id: 'voyage-tree-2', kind: 'sapling', cell: { x: 5, z: 1 }, growth: 0 });
    else if (start === 'water') state.landmarks.push(
        { id: 'voyage-water', kind: 'water-bowl', cell: { x: 0, z: 2 }, growth: 0 },
        { id: 'voyage-channel', kind: 'water-channel', cell: { x: 0, z: 3 }, growth: 0 });
    else state.landmarks.push(
        { id: 'voyage-flower-1', kind: 'flower', cell: { x: 0, z: 2 }, growth: 0 },
        { id: 'voyage-flower-2', kind: 'flower', cell: { x: 0, z: 3 }, growth: 0 });
    syncSoil(state); state.character = islandCharacter(state);
    return { profileId: current.profileId, islandId: id, islandStart: start, version: 5,
        revision: current.revision + 1, createdAt: now, updatedAt: now, state };
}

/** Old archived balances are never a second wallet or a second learning claim. */
export function carrySharedResources(from: GrowingRecord, to: GrowingRecord): GrowingRecord {
    const state = structuredClone(to.state), source = from.state;
    state.drops = source.drops;
    state.learned = [...source.learned]; state.learnedFloor = source.learnedFloor;
    state.enrolledAt = source.enrolledAt;
    state.mastery = source.mastery && { ...source.mastery };
    state.gifts = source.gifts && [...source.gifts];
    return { ...to, state };
}
