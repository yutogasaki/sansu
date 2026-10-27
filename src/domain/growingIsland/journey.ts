import { discover } from './discoveries';
import { mechanismProgress } from './mechanisms';
import { HOME_CELL, distance, isVacant, landCells } from './space';
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

/**
 * Route slots from what really happened; a slot never closes and never opens twice. A
 * learning slot opens only once the previous slot became an island, so one opens at a time
 * even for a child who started high (island-journey.md §3); the right to it is kept.
 */
export function grantRoutes(state: GrowingState, levels: ConfirmedLevels | undefined, at: number): TownEvent[] {
    const events: TownEvent[] = [];
    if (welcomed(state)) openRoute(state, 0, 'first-friend', at, events);
    const known = levels ?? state.journey?.levels;
    if (known) for (const [index, level] of ROUTE_LEVELS.entries()) {
        const slot = index + 1, journey = state.journey;
        if (journey?.routes.some(route => route.slot === slot)) continue;
        if (!journey?.chosen.some(choice => choice.slot === slot - 1)) break;
        const subject = (['math', 'vocab', 'kokugo'] as const).find(name => (known[name] ?? 0) >= level);
        if (!subject) break;
        openRoute(state, slot, `${subject}:${level}`, at, events);
        break;
    }
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
/** Lv20 in any subject: every special island's sign shines; scenery only (§3.3). */
export const FINALE_LEVEL = 20;
export const finaleLit = (state: GrowingState) => starsLit(state) >= FINALE_LEVEL;

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
