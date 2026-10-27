import { discover } from './discoveries';
import { islandScores, TREE_MATURE_HOURS } from './environment';
import { mechanismProgress } from './mechanisms';
import { roll } from './random';
import { HOME_CELL, distance, isVacant, landCells } from './space';
import type { Cell, GrowingState, TownEvent } from './types';

/**
 * 島の航路と まなびの節目 (island-journey.md): once the newest island has grown well and the
 * child confirmed the next learning level, a shoal off its shore becomes the next special island
 * (§3.6). Which island it becomes follows how the island grew, and is not told before arrival.
 * Its own species come by arranging the island, never by searching or by luck.
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
    karakuri: { name: 'ぜんまい島', mood: 'はぐるまと じょうき', first: 'key-weed', second: 'clock-bird', hint: 'みずみちから ものを 5つ つなげると、はぐるまが まわるよ' },
    hoshi: { name: '星の島', mood: 'いつも よるの そら', first: 'star-tree', second: 'star-jelly', hint: 'あかりを ちかくに 3つ ならべて、せいざを つくろう' },
};
export const SPECIES_NAME: Record<SpeciesId, string> = {
    'shell-flower': 'かいの はな', 'leaf-crab': 'はぶね ヤドカリ', 'bell-tree': 'すずのみの 木', 'echo-bird': 'こだまどり',
    'glass-weed': 'すける みずくさ', 'glow-shell': 'ひかりがい', 'balloon-flower': 'ふうせんばな', 'fluff-sheep': 'わたげひつじ',
    'key-weed': 'ねじまきそう', 'clock-bird': 'ぜんまいどり', 'star-tree': 'ほしのみの 木', 'star-jelly': 'ほしくらげ',
};
/** What each species seems to say when touched: its own small personality. */
export const SPECIES_VOICE: Record<SpeciesId, string> = {
    'shell-flower': 'みみを すますと うみの おとが するよ', 'leaf-crab': 'はっぱの おうち、すてきでしょ', 'bell-tree': 'かぜが ふくと りんりん なるよ', 'echo-bird': 'よんだら こたえて くれるよ',
    'glass-weed': 'ひかりが すけて きらきら ゆれるよ', 'glow-shell': 'よるに なると ぽっと ひかるよ', 'balloon-flower': 'いまにも ふわっと うきそう', 'fluff-sheep': 'もこもこで あったかいよ',
    'key-weed': 'ねじを まくと くるくる まわるよ', 'clock-bird': 'ちくたく、いっしょに あるこう', 'star-tree': 'ほしの みが ひとつずつ ひかるよ', 'star-jelly': 'そらを ゆっくり およいでいるよ',
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

/** A place in the archipelago, in % of the chart's first frame; it may lie outside it as islands grow. */
export type Place = readonly [number, number];
/** The shoal growing off the newest island (§3.6). */
export interface Shoal {
    at?: Place;
    /** The newest island was widened enough / became lively enough while the child was on it; kept once met. */
    land?: true;
    life?: true;
    /** Which island its growth leans to, read on the newest island; and the island once the shoal is ready. */
    leaning?: ThemeId;
    theme?: ThemeId;
}
export interface Journey {
    /** The highest confirmed Lv seen per subject, for the chart's stars; never goes down. */
    levels?: ConfirmedLevels;
    /** Opened slots. Slot 0 (the old first-friend route) is only ever an old one; slots 1–5 open with the shoal. */
    routes: { slot: number; reason: string; at: number }[];
    chosen: { slot: number; theme: ThemeId; islandId: string; at?: Place }[];
    species: SpeciesId[];
    shoal?: Shoal;
    /** The island this state is, set when sailing; absent means the home island. */
    here?: string;
}
const journeyOf = (state: GrowingState): Journey => state.journey ??= { routes: [], chosen: [], species: [] };
const HOME_ISLAND = 'main';
/** §3.6 initial values, tuned by play: the newest island widened 3 times, 5 friends and 3 grown trees. */
export const SHOAL_NEEDS = { landSteps: 3, friends: 5, grownTrees: 3 } as const;

function openRoute(state: GrowingState, slot: number, reason: string, at: number, events: TownEvent[]) {
    const journey = journeyOf(state);
    if (journey.routes.some(route => route.slot === slot)) return;
    journey.routes.push({ slot, reason, at });
    journey.routes.sort((a, b) => a.slot - b.slot);
    events.push({ type: 'route', slot });
}

/** Special islands made since the shiokaze island stopped coming; each needs the next learning milestone. */
const specialsMade = (state: GrowingState) => (state.journey?.chosen ?? []).filter(choice => choice.theme !== 'shiokaze').length;
/** The island the shoal grows beside: the newest special island, or home. */
export function frontier(state: GrowingState): IslandKey {
    const chosen = state.journey?.chosen ?? [];
    return chosen[chosen.length - 1]?.theme ?? 'home';
}
function onFrontier(state: GrowingState) {
    const newest = frontier(state);
    return newest === 'home' ? !state.theme && (state.journey?.here ?? HOME_ISLAND) === HOME_ISLAND : state.theme === newest;
}
function learnedFor(state: GrowingState, known = state.journey?.levels) {
    const level = ROUTE_LEVELS[specialsMade(state)], subject = level && known && (['math', 'vocab', 'kokugo'] as const).find(name => (known[name] ?? 0) >= level);
    return subject ? `${subject}:${level}` : undefined;
}
const landSteps = (state: GrowingState) =>
    (state.land.expanded ? 1 : 0) + state.land.extra.length + state.land.capes.length + (state.land.districts?.length ?? 0);
const lively = (state: GrowingState) =>
    state.villagers.filter(v => !state.arrivals.includes(v.id)).length >= SHOAL_NEEDS.friends
    && state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS).length >= SHOAL_NEEDS.grownTrees;

/**
 * How far the shoal has grown (§3.6): 0 nothing yet, then one step for each of learning, land
 * and life, in any order; 3 is an island the child can cross to. Undefined once every island came.
 */
export function shoalStage(state: GrowingState): 0 | 1 | 2 | 3 | undefined {
    if (!themesLeft(state).length) return undefined;
    if (freeSlots(state).length) return 3;
    const shoal = state.journey?.shoal;
    return ((learnedFor(state) ? 1 : 0) + (shoal?.land ? 1 : 0) + (shoal?.life ? 1 : 0)) as 0 | 1 | 2;
}

/** What each island's growth leans to; flowers and raised ground lift the cloud highland. */
function leaningOf(state: GrowingState): ThemeId {
    const scores = islandScores(state), raised = Object.values(state.terrain?.heights ?? {}).filter(h => typeof h === 'number' && h >= 1).length;
    const weight: Record<ThemeId, number> = { shiokaze: 0, kodama: scores.tree, hikari: scores.water, hoshi: scores.light, karakuri: scores.farm, watagumo: scores.flower + raised };
    return byLeaning(state, weight);
}
/** The strongest of the islands still to come; ties fall to an order of the child's own island, never to learning. */
function byLeaning(state: GrowingState, weight?: Record<ThemeId, number>) {
    const left = themesLeft(state), made = specialsMade(state);
    return [...left].sort((a, b) => (weight ? weight[b] - weight[a] : 0) || roll(state.seed, 'shoal', a, made) - roll(state.seed, 'shoal', b, made))[0];
}

/**
 * Notice the shoal growing (§3.6). Learning counts wherever the child is; land and life only
 * on the newest island, and once met they stay. A slot opens when all three are there.
 */
export function grantRoutes(state: GrowingState, levels: ConfirmedLevels | undefined, at: number): TownEvent[] {
    const events: TownEvent[] = [];
    if (!themesLeft(state).length) return events;
    const here = onFrontier(state), learned = learnedFor(state, levels ?? state.journey?.levels);
    const before = state.journey?.shoal;
    const land = Boolean(before?.land) || (here && landSteps(state) >= SHOAL_NEEDS.landSteps);
    const life = Boolean(before?.life) || (here && lively(state));
    if (!freeSlots(state).length && !learned && !land && !life) return events;
    const shoal = journeyOf(state).shoal ??= {};
    if (land) shoal.land = true;
    if (life) shoal.life = true;
    // Read the island's lean only near the end, where it decides something.
    if (here && !shoal.theme && (freeSlots(state).length || [learned, land, life].filter(Boolean).length >= 2)) shoal.leaning = leaningOf(state);
    shoal.at ??= placeNext(state);
    if (!freeSlots(state).length && learned && land && life) openRoute(state, specialsMade(state) + 1, learned, at, events);
    if (freeSlots(state).length) shoal.theme ??= shoal.leaning ?? byLeaning(state);
    return events;
}

/** Keep the highest confirmed Lv per subject (stars on the chart, まなび in the record book). */
export function noteLevels(state: GrowingState, levels: ConfirmedLevels) {
    const journey = journeyOf(state), was = journey.levels ?? { math: 0, vocab: 0, kokugo: 0 };
    journey.levels = { math: Math.max(was.math, levels.math | 0), vocab: Math.max(was.vocab, levels.vocab | 0), kokugo: Math.max(was.kokugo, levels.kokugo | 0) };
    for (const subject of ['math', 'vocab', 'kokugo'] as const)
        for (const level of ROUTE_LEVELS) if (journey.levels[subject] >= level) discover(state, `learn:${subject}:${level}`);
    if (finaleLit(state)) discover(state, 'learn:finale');
}
export const starsLit = (state: GrowingState) => Math.max(0, ...Object.values(state.journey?.levels ?? { math: 0 }));
/** Which subjects confirmed a star (island-journey.md §3.3): only colour, never another route. */
export const starSubjects = (state: GrowingState, level: number) =>
    (['math', 'vocab', 'kokugo'] as const).filter(subject => (state.journey?.levels?.[subject] ?? 0) >= level);
/**
 * Places in the archipelago (§3.2, §3.6), in % of the chart: home in the middle. Islands made
 * before 2026-10-28 keep their old fixed place; later ones are born where their shoal grew.
 */
export const HOME_PLACE: Place = [50, 52];
export const LEGACY_PLACE: Record<ThemeId, Place> = {
    shiokaze: [50, 87], kodama: [18, 60], hikari: [82, 60], watagumo: [22, 28], karakuri: [78, 29], hoshi: [50, 10],
};
export type IslandKey = ThemeId | 'home';
export function placeOf(state: GrowingState, key: IslandKey): Place {
    if (key === 'home') return HOME_PLACE;
    const choice = state.journey?.chosen.find(c => c.theme === key);
    return choice?.at ?? LEGACY_PLACE[key];
}
/**
 * Off the newest island, toward the most open sea, so any number of islands never overlap; and
 * in a direction from home no other island takes, so from home it never hides behind another.
 */
function placeNext(state: GrowingState): Place {
    const from = placeOf(state, frontier(state)), taken = [HOME_PLACE, ...(state.journey?.chosen ?? []).map(c => placeOf(state, c.theme))];
    const middle = taken.reduce(([x, y], p) => [x + p[0] / taken.length, y + p[1] / taken.length], [0, 0]);
    const start = roll(state.seed, 'shoal', 'angle', specialsMade(state)) * Math.PI * 2;
    let best: Place = from, score = -Infinity;
    for (let i = 0; i < 16; i++) {
        const angle = start + i / 16 * Math.PI * 2, at: Place = [from[0] + Math.cos(angle) * 26, from[1] + Math.sin(angle) * 22];
        const room = Math.min(...taken.map(p => Math.hypot(p[0] - at[0], p[1] - at[1]))), away = Math.hypot(at[0] - middle[0], at[1] - middle[1]);
        const bearing = Math.atan2(at[1] - HOME_PLACE[1], at[0] - HOME_PLACE[0]);
        const gap = Math.min(Math.PI, ...taken.slice(1).map(p => Math.abs(((Math.atan2(p[1] - HOME_PLACE[1], p[0] - HOME_PLACE[0]) - bearing + Math.PI * 3) % (Math.PI * 2)) - Math.PI)));
        const value = Math.min(room, 30) + away * .15 + Math.min(gap, Math.PI / 3) / (Math.PI / 3) * 14;
        if (value > score + 1e-9) { score = value; best = at; }
    }
    return [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10];
}
export type NeighborMode = 'made' | 'shoal';
export interface Neighbor { key: IslandKey | 'shoal'; mode: NeighborMode; at: Place; islandId?: string; stage?: 1 | 2 | 3 }
/** What is seen from here (§3.4, §3.6): the islands made, and a shoal once it began to grow. Nothing else. */
export function neighbors(state: GrowingState, here: IslandKey): Neighbor[] {
    const made: Neighbor[] = (state.journey?.chosen ?? []).map(c => ({ key: c.theme, mode: 'made' as const, at: placeOf(state, c.theme), islandId: c.islandId }));
    const home: Neighbor = { key: 'home', mode: 'made', at: HOME_PLACE }, all = [home, ...made].filter(n => n.key !== here);
    const stage = shoalStage(state), at = state.journey?.shoal?.at;
    if (stage && at) all.push({ key: 'shoal', mode: 'shoal', at, stage });
    return all;
}
/** とくさん (§3.5): each special island whose play was completed sends its gift to every other island. */
export const GIFT_NAME: Record<ThemeId, string> = {
    shiokaze: 'はまの かいがら', kodama: 'きんの すずのみ', hikari: 'きらめく みず', watagumo: 'かぜの わたげ', karakuri: 'ちいさな すいしゃ', hoshi: 'あかりの ほし',
};
export const islandGifts = (state: GrowingState) =>
    THEMES.filter(theme => theme !== state.theme && state.discoveries?.includes(`island:${theme}`));

/** Lv20 in any subject: every special island's sign shines; scenery only (§3.3). */
export const FINALE_LEVEL = 20;
export const finaleLit = (state: GrowingState) => starsLit(state) >= FINALE_LEVEL;

/** Slots opened but not yet made into an island; an old open slot 0 counts like any other. */
export function freeSlots(state: GrowingState) {
    const journey = state.journey; if (!journey) return [];
    return journey.routes.map(route => route.slot).filter(slot => !journey.chosen.some(choice => choice.slot === slot));
}
/** The special islands still to come; the shiokaze island no longer comes (§3.1), at most five. */
export function themesLeft(state: GrowingState): ThemeId[] {
    const taken = new Set(state.journey?.chosen.map(choice => choice.theme) ?? []);
    return specialsMade(state) >= ROUTE_LEVELS.length ? [] : THEMES.filter(theme => theme !== 'shiokaze' && !taken.has(theme));
}
/** The island the ready shoal will turn out to be, decided when it became ready; not shown before arrival. */
export function nextIsland(state: GrowingState): ThemeId | undefined {
    if (!freeSlots(state).length || !themesLeft(state).length) return undefined;
    return state.journey?.shoal?.theme ?? byLeaning(state);
}
/** Record the island made from the ready shoal. Throws unless the shoal is ready and it is that island. */
export function chooseTheme(state: GrowingState, theme: ThemeId, islandId: string) {
    const slot = freeSlots(state)[0];
    if (slot === undefined || nextIsland(state) !== theme) throw new Error('まだ その しまへは わたれないよ。');
    const journey = journeyOf(state), at = journey.shoal?.at ?? placeNext(state);
    journey.chosen.push({ slot, theme, islandId, at });
    delete journey.shoal;
    return slot;
}

const SPECIES_KEEPSAKE = (id: SpeciesId) => `species:${id}`;
const placed = (state: GrowingState, id: SpeciesId) => state.keepsakes.filter(k => k.unitId === SPECIES_KEEPSAKE(id) && k.cell).map(k => k.cell!);


/** Whether the arranged island now calls its theme's second species: its own play is complete. */
export const secondSpeciesReady = (state: GrowingState) => Boolean(mechanismProgress(state)?.done);

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
            discover(state, `island:${state.theme}`);
        }
    }
    return events;
}
