import { discover, waterfalls } from './discoveries';
import { terrainOf } from './editableTerrainWorld';
import { dugWater, TREE_MATURE_HOURS } from './environment';
import { HOME_CELL, distance, isVacant, key, landCells } from './space';
import type { Cell, GrowingState, TownEvent } from './types';

/**
 * 島の航路と まなびの節目 (island-journey.md): route slots open from the first friend and from
 * learning levels the child confirmed; each slot becomes a themed island the child chooses and
 * grows. Its own species come by arranging the island, never by searching or by luck.
 */
export const THEMES = ['shiokaze', 'kodama', 'hikari', 'watagumo', 'karakuri', 'hoshi'] as const;
export type ThemeId = typeof THEMES[number];
export const SPECIES = ['shell-flower', 'leaf-crab', 'bell-tree', 'echo-bird', 'glass-weed', 'glow-shell', 'balloon-flower', 'fluff-sheep', 'key-weed', 'clock-bird', 'star-tree', 'star-jelly'] as const;
export type SpeciesId = typeof SPECIES[number];

export interface ThemeInfo { name: string; mood: string; first: SpeciesId; second: SpeciesId; hint: string }
export const THEME_INFO: Record<ThemeId, ThemeInfo> = {
    shiokaze: { name: 'しおかぜの小島', mood: 'あさせと かいの きし', first: 'shell-flower', second: 'leaf-crab', hint: 'かいの はなを、ほった みずの となりに おいてみよう' },
    kodama: { name: 'こだまの森', mood: 'たいじゅと こもれび', first: 'bell-tree', second: 'echo-bird', hint: 'そだった 木を 3本 つなげてみよう' },
    hikari: { name: 'ひかりの入り江', mood: 'すきとおる みず', first: 'glass-weed', second: 'glow-shell', hint: 'おかの うえの みずを、いけへ おとしてみよう' },
    watagumo: { name: 'わたぐもの高原', mood: 'まるい おかと ひろい そら', first: 'balloon-flower', second: 'fluff-sheep', hint: 'おかの うえに、2×2の たいらな ひろばを つくろう' },
    karakuri: { name: 'ぜんまい島', mood: 'はぐるまと じょうき', first: 'key-weed', second: 'clock-bird', hint: '2だんの うえに あかりを おくと、とうだいが ともるよ' },
    hoshi: { name: '星の島', mood: 'いつも よるの そら', first: 'star-tree', second: 'star-jelly', hint: 'ほった みずの ちかくに、あかりを 3つ' },
};
export const SPECIES_NAME: Record<SpeciesId, string> = {
    'shell-flower': 'かいの はな', 'leaf-crab': 'はぶね ヤドカリ', 'bell-tree': 'すずのみの 木', 'echo-bird': 'こだまどり',
    'glass-weed': 'すける みずくさ', 'glow-shell': 'ひかりがい', 'balloon-flower': 'ふうせんばな', 'fluff-sheep': 'わたげひつじ',
    'key-weed': 'ねじまきそう', 'clock-bird': 'ぜんまいどり', 'star-tree': 'ほしのみの 木', 'star-jelly': 'ほしくらげ',
};
export const themeOfSpecies = (id: SpeciesId) => THEMES.find(theme => THEME_INFO[theme].first === id || THEME_INFO[theme].second === id)!;

/** Learning levels (shared Lv1–20) whose content the child confirmed, per subject. */
export interface ConfirmedLevels { math: number; vocab: number; kokugo: number }
export const ROUTE_LEVELS = [2, 5, 9, 13, 17] as const;
/** The last internal math level of each shared Lv1–20 (learning-levels.md). */
const MATH_LEVEL_ENDS = [1, 3, 5, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28];

/**
 * The highest internal level the child passed by the official level-up test (a saved finish
 * test that passed). A level chosen in settings or at the start is never evidence. Passing a
 * level also covers the levels below it, so a child who started high has them for the routes.
 */
export function passedLevel(history: readonly { kind?: string; subject?: string; passed?: boolean; level?: number }[] | undefined, subject: 'math' | 'vocab') {
    return Math.max(0, ...(history ?? []).filter(test => test.kind === 'finish' && test.passed === true && test.subject === subject && Number.isInteger(test.level)).map(test => test.level!));
}
/** Math: a shared Lv is confirmed once its last internal level was passed. */
export const confirmedMathLevel = (passed: number) => MATH_LEVEL_ENDS.filter(end => end <= passed).length;
/** Words: the shared Lv is the word level itself. */
export const confirmedVocabLevel = (passed: number) => Math.max(0, Math.min(20, passed | 0));

export interface Journey {
    /** The highest confirmed Lv seen per subject, for the chart's stars; never goes down. */
    levels?: ConfirmedLevels;
    /** Slot 0 opens with the first friend; slots 1–5 with a confirmed Lv2/5/9/13/17 in any subject. */
    routes: { slot: number; reason: string; at: number }[];
    chosen: { slot: number; theme: ThemeId; islandId: string }[];
    species: SpeciesId[];
}
const journeyOf = (state: GrowingState): Journey => state.journey ??= { routes: [], chosen: [], species: [] };
const welcomed = (state: GrowingState) => state.villagers.some(v => !state.arrivals.includes(v.id));

function openRoute(state: GrowingState, slot: number, reason: string, at: number, events: TownEvent[]) {
    const journey = journeyOf(state);
    if (journey.routes.some(route => route.slot === slot)) return;
    journey.routes.push({ slot, reason, at });
    journey.routes.sort((a, b) => a.slot - b.slot);
    events.push({ type: 'route', slot });
}

/** Route slots from what really happened; a slot never closes and never opens twice. */
export function grantRoutes(state: GrowingState, levels: ConfirmedLevels | undefined, at: number): TownEvent[] {
    const events: TownEvent[] = [];
    if (welcomed(state)) openRoute(state, 0, 'first-friend', at, events);
    if (levels) ROUTE_LEVELS.forEach((level, index) => {
        const subject = (['math', 'vocab', 'kokugo'] as const).find(name => (levels[name] ?? 0) >= level);
        if (subject) openRoute(state, index + 1, `${subject}:${level}`, at, events);
    });
    return events;
}

/** Keep the highest confirmed Lv per subject (stars on the chart, まなび in the record book). */
export function noteLevels(state: GrowingState, levels: ConfirmedLevels) {
    const journey = journeyOf(state), was = journey.levels ?? { math: 0, vocab: 0, kokugo: 0 };
    journey.levels = { math: Math.max(was.math, levels.math | 0), vocab: Math.max(was.vocab, levels.vocab | 0), kokugo: Math.max(was.kokugo, levels.kokugo | 0) };
    for (const subject of ['math', 'vocab', 'kokugo'] as const)
        for (const level of ROUTE_LEVELS) if (journey.levels[subject] >= level) discover(state, `learn:${subject}:${level}`);
}
export const starsLit = (state: GrowingState) => Math.max(0, ...Object.values(state.journey?.levels ?? { math: 0 }));

/** Slots opened but not yet given a theme; slot 0 always means the shiokaze island. */
export function freeSlots(state: GrowingState) {
    const journey = state.journey; if (!journey) return [];
    return journey.routes.map(route => route.slot).filter(slot => !journey.chosen.some(choice => choice.slot === slot));
}
export function themesLeft(state: GrowingState): ThemeId[] {
    const taken = new Set(state.journey?.chosen.map(choice => choice.theme) ?? []);
    return THEMES.filter(theme => theme !== 'shiokaze' && !taken.has(theme));
}
/** Which slot a theme would take now, or undefined if it cannot be chosen. */
export function slotForTheme(state: GrowingState, theme: ThemeId) {
    const free = freeSlots(state);
    if (state.journey?.chosen.some(choice => choice.theme === theme)) return undefined;
    if (theme === 'shiokaze') return free.includes(0) ? 0 : undefined;
    return themesLeft(state).includes(theme) ? free.find(slot => slot > 0) : undefined;
}
/** Record the choice when the themed island is made. Throws if no slot is open for it. */
export function chooseTheme(state: GrowingState, theme: ThemeId, islandId: string) {
    const slot = slotForTheme(state, theme);
    if (slot === undefined) throw new Error('まだ その しまへの こうろは ひらいていないよ。');
    journeyOf(state).chosen.push({ slot, theme, islandId });
    return slot;
}

const heightAt = (state: GrowingState, cell: Cell) => terrainOf(state)?.heights[key(cell)] ?? 0;
const SPECIES_KEEPSAKE = (id: SpeciesId) => `species:${id}`;
const placed = (state: GrowingState, id: SpeciesId) => state.keepsakes.filter(k => k.unitId === SPECIES_KEEPSAKE(id) && k.cell).map(k => k.cell!);
const mature = (state: GrowingState) => state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS);

function connectedGrove(cells: Cell[]) {
    const left = new Set(cells.map(key));
    for (const start of cells) {
        if (!left.delete(key(start))) continue;
        let size = 1; const queue = [start];
        while (queue.length) {
            const cell = queue.pop()!;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const next = { x: cell.x + dx, z: cell.z + dz };
                if (left.delete(key(next))) { size++; queue.push(next); }
            }
        }
        if (size >= 3) return true;
    }
    return false;
}

/** Whether the arranged island now calls its theme's second species (island-journey.md §4). */
export function secondSpeciesReady(state: GrowingState): boolean {
    const dug = new Set(dugWater(state).map(key)), lights = state.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).map(l => l.cell!);
    switch (state.theme) {
        case 'shiokaze': return placed(state, 'shell-flower').some(cell => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => dug.has(key({ x: cell.x + dx, z: cell.z + dz }))));
        case 'kodama': return connectedGrove(mature(state).map(l => l.cell!));
        case 'hikari': return waterfalls(state).length > 0;
        case 'watagumo': {
            const heights = terrainOf(state)?.heights ?? {};
            return Object.entries(heights).some(([id, h]) => {
                if (h < 1) return false;
                const [x, z] = id.split(',').map(Number);
                const square = [{ x, z }, { x: x + 1, z }, { x, z: z + 1 }, { x: x + 1, z: z + 1 }];
                return square.every(c => heightAt(state, c) === h && !state.landmarks.some(l => l.cell && l.cell.x === c.x && l.cell.z === c.z)
                    && !state.plots.some(p => p.cell && p.cell.x === c.x && p.cell.z === c.z));
            });
        }
        case 'karakuri': return lights.some(cell => heightAt(state, cell) >= 2);
        case 'hoshi': return dug.size > 0 && lights.filter(cell => [...dug].some(id => { const [x, z] = id.split(',').map(Number); return distance(cell, { x, z }) <= 2; })).length >= 3;
        default: return false;
    }
}

function findSpecies(state: GrowingState, id: SpeciesId) {
    const journey = journeyOf(state);
    if (!journey.species.includes(id)) journey.species.push(id);
    discover(state, `species:${id}`);
}

/** Bring a species found anywhere to this island as a stored keepsake, once per island. */
export function adoptSpecies(state: GrowingState, id: SpeciesId) {
    if (!state.journey?.species.includes(id)) throw new Error('まだ みつけていない いきものだよ。');
    if (state.keepsakes.some(k => k.unitId === SPECIES_KEEPSAKE(id))) throw new Error('この しまには もう いるよ。');
    state.keepsakes.push({ id: `k${state.nextId++}`, unitId: SPECIES_KEEPSAKE(id) });
}

/** The arriving species of a new themed island, set at the island's first cell beside home. */
export function welcomeFirstSpecies(state: GrowingState, cell: Cell) {
    if (!state.theme) return;
    const id = THEME_INFO[state.theme].first;
    state.keepsakes.push({ id: `k${state.nextId++}`, unitId: SPECIES_KEEPSAKE(id), cell });
    findSpecies(state, id);
}

/** Notice the first friend and the theme's second species. Learning slots arrive with the sync. */
export function noteJourney(state: GrowingState, at: number): TownEvent[] {
    const events = grantRoutes(state, undefined, at);
    if (state.theme) {
        const second = THEME_INFO[state.theme].second;
        if (!state.journey?.species.includes(second) && secondSpeciesReady(state)) {
            // It comes onto the island beside its companion; with no room it waits among the child's things.
            findSpecies(state, second);
            const anchor = placed(state, THEME_INFO[state.theme].first)[0] ?? HOME_CELL;
            const cell = landCells(state).filter(c => isVacant(state, c)).sort((a, b) => distance(a, anchor) - distance(b, anchor) || a.x - b.x || a.z - b.z)[0];
            state.keepsakes.push({ id: `k${state.nextId++}`, unitId: SPECIES_KEEPSAKE(second), ...(cell ? { cell } : {}) });
            events.push({ type: 'species', species: second });
        }
    }
    return events;
}
