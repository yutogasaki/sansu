import { newIsland } from './island';
import { islandCharacter, syncSoil } from './environment';
import { THEME_INFO, THEMES, welcomeFirstSpecies, type ThemeId } from './journey';
import { seaLevelAt } from './terrainEditing';
import type { GrowingRecord } from './repository';

export const FIRST_ISLAND = 'main';
export const ISLAND_STARTS = {
    garden: { name: '花のしま', hint: '花を そだてる ところから', symbol: '✿' },
    grove: { name: '森のしま', hint: '木の苗を そだてる ところから', symbol: '♧' },
    water: { name: '水辺のしま', hint: '水を ひく ところから', symbol: '≈' },
} as const;
export type IslandStart = keyof typeof ISLAND_STARTS | ThemeId;
export const isTheme = (start: string): start is ThemeId => (THEMES as readonly string[]).includes(start);
export const islandIdOf = (record?: GrowingRecord) => record?.islandId ?? FIRST_ISLAND;

export function makeVoyageIsland(current: GrowingRecord, id: string, name: string, start: IslandStart, now: number): GrowingRecord {
    if (!id || id === FIRST_ISLAND || !(Object.prototype.hasOwnProperty.call(ISLAND_STARTS, start) || isTheme(start))) throw new Error('しまの はじまりを えらんでね。');
    const title = name.trim();
    if (!title || [...title].length > 12) throw new Error('なまえは 1〜12もじで つけてね。');
    const state = newIsland(current.profileId, now);
    state.islandName = title;
    if (isTheme(start)) themeIsland(state, start);
    else if (start === 'grove') state.landmarks.push(
        { id: 'voyage-tree-1', kind: 'sapling', cell: { x: 0, z: 1 }, growth: 0 },
        { id: 'voyage-tree-2', kind: 'sapling', cell: { x: 5, z: 1 }, growth: 0 });
    else if (start === 'water') state.landmarks.push(
        { id: 'voyage-water', kind: 'water-bowl', cell: { x: 0, z: 2 }, growth: 0 },
        { id: 'voyage-channel', kind: 'water-channel', cell: { x: 0, z: 3 }, growth: 0 });
    else state.landmarks.push(
        { id: 'voyage-flower-1', kind: 'flower', cell: { x: 0, z: 2 }, growth: 0 },
        { id: 'voyage-flower-2', kind: 'flower', cell: { x: 0, z: 3 }, growth: 0 });
    // The first steps and the firsts are the child's, not one island's (island-journey.md §5).
    if (current.state.guidance) { state.guidance = structuredClone(current.state.guidance); delete state.guidance.firstFlower; }
    syncSoil(state); state.character = islandCharacter(state);
    // A special island starts with its own ground, which is a version 6 island (spec 13).
    return { profileId: current.profileId, islandId: id, islandStart: start, version: state.terrain ? 6 : 5,
        revision: current.revision + 1, createdAt: now, updatedAt: now, state };
}

/**
 * A special island's start (island-journey.md §4): its own ground, and the species that is
 * there when the child arrives. Everything after follows the ordinary island rules.
 */
function themeIsland(state: ReturnType<typeof newIsland>, theme: ThemeId) {
    state.theme = theme;
    const heights: Record<string, number> = {};
    const raise = (cells: [number, number][], h: number | 'sea') => cells.forEach(([x, z]) => { heights[`${x},${z}`] = h === 'sea' ? seaLevelAt(state, { x, z }) : h; });
    let welcome: [number, number] = [4, 2];
    if (theme === 'shiokaze') { raise([[0, 4], [1, 4]], 'sea'); welcome = [4, 2]; }
    else if (theme === 'kodama') {
        raise([[0, 1], [1, 1], [0, 2]], 1);
        state.landmarks.push({ id: 'theme-tree-1', kind: 'sapling', cell: { x: 0, z: 1 }, growth: 0 }, { id: 'theme-tree-2', kind: 'sapling', cell: { x: 1, z: 1 }, growth: 0 });
        welcome = [4, 2];
    } else if (theme === 'hikari') { raise([[1, 3], [2, 3]], 'sea'); welcome = [4, 2]; }
    else if (theme === 'watagumo') { raise([[0, 1], [1, 1]], 1); raise([[0, 2]], 2); welcome = [4, 2]; }
    else if (theme === 'karakuri') { raise([[4, 1], [5, 1], [5, 2]], 2); welcome = [1, 3]; }
    else if (theme === 'hoshi') { raise([[0, 4]], 'sea'); welcome = [4, 2]; }
    state.terrain = { version: 1, heights, undo: [], redo: [] };
    state.islandName ??= THEME_INFO[theme].name;
    welcomeFirstSpecies(state, { x: welcome[0], z: welcome[1] });
}

/** Old archived balances are never a second wallet or a second learning claim. */
export function carrySharedResources(from: GrowingRecord, to: GrowingRecord): GrowingRecord {
    const state = structuredClone(to.state), source = from.state;
    state.drops = source.drops;
    state.learned = [...source.learned]; state.learnedFloor = source.learnedFloor;
    state.enrolledAt = source.enrolledAt;
    state.mastery = source.mastery && { ...source.mastery };
    state.gifts = source.gifts && [...source.gifts];
    // The record book is the child's: what happened on any island stays in it (island-journey.md §5).
    if (source.discoveries || state.discoveries) state.discoveries = [...new Set([...(source.discoveries ?? []), ...(state.discoveries ?? [])])];
    // Route slots, chosen themes and found species belong to the child, not to one island.
    if (source.journey) {
        const species = [...new Set([...source.journey.species, ...(state.journey?.species ?? [])])];
        state.journey = { ...structuredClone(source.journey), species };
    }
    return { ...to, state };
}
