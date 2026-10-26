import { terrainOf } from './editableTerrainWorld';
import { dugWater, scoresNear } from './environment';
import { roll } from './random';
import { RULES } from './rules';
import { key } from './space';
import type { Cell, GrowingState, Landmark, Moment } from './types';

/**
 * しまの ふしぎ (§1.4): what the child's own arrangement of ground, water, trees and lights
 * brings about. Each one is noticed once and kept in the ふしぎずかん. Nothing here is a
 * quest, a daily reward or something that can be missed; it only records what happened.
 */
export type DiscoveryId = 'waterfall' | 'cove-boat' | 'high-light' | 'grove-hill' | 'rainbow-tree' | 'clover' | 'floating-isle' | 'lookout-home' | 'ship-cove' | 'golden-pumpkin' | `species:${string}` | `learn:${string}` | `build:${string}` | `life:${string}` | `voyage:${string}` | `moment:${Moment}`;
export type DiscoveryGroup = 'build' | 'life' | 'ground' | 'luck' | 'sky' | 'learn' | 'voyage';

export interface Discovery { id: DiscoveryId; group: DiscoveryGroup; name: string; line: string; hint: string }

const SUBJECT_NAME = { math: 'さんすう', vocab: 'えいたんご', kokugo: 'こくご' } as const;
const SPECIES_ENTRIES: Discovery[] = ([
    ['shell-flower', 'かいの はな', 'しおかぜの小島で さいたよ', 'しおかぜの小島に いくと あえるよ'],
    ['leaf-crab', 'はぶね ヤドカリ', 'かいの はなの そばの みずべに きたよ', 'しおかぜの小島で、かいの はなを みずの となりへ'],
    ['bell-tree', 'すずのみの 木', 'こだまの森で りんと なったよ', 'こだまの森に いくと あえるよ'],
    ['echo-bird', 'こだまどり', 'つながった 森に きたよ', 'こだまの森で、そだった 木を 3本 つなげよう'],
    ['glass-weed', 'すける みずくさ', 'ひかりの入り江で ゆれているよ', 'ひかりの入り江に いくと あえるよ'],
    ['glow-shell', 'ひかりがい', 'たきの したで ひかったよ', 'ひかりの入り江で、たきを つくろう'],
    ['balloon-flower', 'ふうせんばな', 'わたぐもの高原で ふくらんだよ', 'わたぐもの高原に いくと あえるよ'],
    ['fluff-sheep', 'わたげひつじ', 'おかの ひろばに きたよ', 'わたぐもの高原で、おかの うえに ひろばを'],
    ['key-weed', 'ねじまきそう', 'ぜんまい島で くるくる まいたよ', 'ぜんまい島に いくと あえるよ'],
    ['clock-bird', 'ぜんまいどり', 'たかい とうだいに ひかれて とんできたよ', 'ぜんまい島で、2だんの うえに あかりを'],
    ['star-tree', 'ほしのみの 木', '星の島で みが ひかったよ', '星の島に いくと あえるよ'],
    ['star-jelly', 'ほしくらげ', 'あかりの みずべに うかんだよ', '星の島で、みずの ちかくに あかりを 3つ'],
] as const).map(([id, name, line, hint]) => ({ id: `species:${id}` as DiscoveryId, group: 'voyage' as const, name, line, hint }));
const LEARN_ENTRIES: Discovery[] = (['math', 'vocab', 'kokugo'] as const).flatMap(subject => [2, 5, 9, 13, 17].map(level => ({
    id: `learn:${subject}:${level}` as DiscoveryId, group: 'learn' as const, name: `${SUBJECT_NAME[subject]} Lv${level}`,
    line: `${SUBJECT_NAME[subject]}の Lv${level}の ないようを たしかめたよ`, hint: `${SUBJECT_NAME[subject]}で Lv${level}の ないようを たしかめよう` })));

export const DISCOVERIES: readonly Discovery[] = [
    { id: 'build:expand', group: 'build', name: 'ひろい しま', line: 'しまの 土地を ひろげたよ', hint: 'しずくで 土地を ひろげてみよう' },
    { id: 'build:shape', group: 'build', name: 'じめんづくり', line: 'じめんを じぶんの かたちに したよ', hint: 'メニューの「じめんを かえる」で なぞってみよう' },
    { id: 'build:tend', group: 'build', name: 'そだてる て', line: 'ばしょを そだてたよ', hint: '木や 花の「そだてる」を つかってみよう' },
    { id: 'life:friends', group: 'life', name: 'にぎやかな しま', line: 'なかまが 3にんに なったよ', hint: 'いえを たてて、なかまを むかえよう' },
    { id: 'life:two-storey', group: 'life', name: 'ふたかいだて', line: 'いえが ふたかいだてに そだったよ', hint: 'なかまの すむ いえは、だんだん おおきく なるよ' },
    { id: 'life:bridge', group: 'life', name: 'みはらしの はし', line: 'はしを かけて、なかまが わたったよ', hint: 'メニューの「はしを つくる」' },
    { id: 'life:flag', group: 'life', name: 'じぶんの はた', line: 'はたに じを かいたよ', hint: 'メニューの「はたを つくる」で なぞってみよう' },
    { id: 'voyage:route', group: 'voyage', name: 'はじめての こうろ', line: 'あたらしい しまへの こうろが ひらいたよ', hint: 'なかまを むかえると ひらくよ' },
    { id: 'voyage:island', group: 'voyage', name: 'とくべつな しま', line: 'とくべつな しまを つくったよ', hint: '海図で、ひらいた こうろの しまを えらぼう' },
    { id: 'voyage:all', group: 'voyage', name: 'ぜんぶの うみ', line: '6つの とくべつな しまを ぜんぶ つくったよ', hint: 'まなびで こうろを ひらいていこう' },
    ...SPECIES_ENTRIES,
    ...LEARN_ENTRIES,
    { id: 'waterfall', group: 'ground', name: 'たき', line: 'おかの みずが したの うみへ おちているよ', hint: 'おかの うえの みずみちや みずばちの となりを、うみの ふでで ほってみよう' },
    { id: 'cove-boat', group: 'ground', name: 'いりえの こぶね', line: 'ほった いりえに こぶねが うかんだよ', hint: 'うみの ふでで、つながった 3マスを ほってみよう' },
    { id: 'high-light', group: 'ground', name: 'たかだいの あかり', line: 'たかい ところの あかりは とおくまで とどくよ', hint: 'おかの うえに あかりを おいてみよう' },
    { id: 'grove-hill', group: 'ground', name: 'もりの おか', line: 'おかの うえに もりが できたよ', hint: 'そだった 木を 3本 ならべて、おかに してみよう' },
    { id: 'floating-isle', group: 'ground', name: 'うかぶ こじま', line: 'たかい おかの ぬしの木の そらに、こじまが うかんだよ', hint: '2だんの おかで、木を ぬしの木まで そだててみよう' },
    { id: 'lookout-home', group: 'ground', name: 'みはらしの いえ', line: 'おかの うえの いえに、ぼうえんきょうの ある みはらしだいが ついたよ', hint: 'おかの うえに いえを たててみよう' },
    { id: 'ship-cove', group: 'ground', name: 'いりえの みなと', line: 'つぎの ふねが、ほった いりえで まっているよ', hint: 'うみの ふでで、4マスの いりえを ほってみよう' },
    { id: 'golden-pumpkin', group: 'luck', name: 'きんの かぼちゃ', line: 'きんいろの かぼちゃが みのったよ', hint: 'みずの ちかくに はたけを つくると、たまに…' },
    { id: 'rainbow-tree', group: 'luck', name: 'にじの 木', line: 'にじいろの はっぱの 木が そだったよ', hint: 'みずと 花の ちかくで 木を そだてると、たまに…' },
    { id: 'clover', group: 'luck', name: 'よつば', line: 'のはらで よつばを みつけたよ', hint: 'のはらの 花を つんでいると、たまに…' },
    { id: 'moment:rainbow', group: 'sky', name: 'にじ', line: 'あめあがりに にじが でたよ', hint: 'みずの ちかくを しめらせてみよう' },
    { id: 'moment:butterflies', group: 'sky', name: 'ちょうちょの むれ', line: 'ちょうちょが あつまったよ', hint: 'さいた 花を 6つ そろえよう' },
    { id: 'moment:friends', group: 'sky', name: 'なかよし', line: 'すきな ものが おなじ ふたりが いっしょに いたよ', hint: 'すきな ものが おなじ なかまの いえを ちかくに' },
    { id: 'moment:guest-water', group: 'sky', name: 'みなもの たびどり', line: 'みずべに たびどりが きたよ', hint: 'あかりの そばの みずばちに、花を そえてみよう' },
    { id: 'moment:guest-grove', group: 'sky', name: 'こもれびの おきゃく', line: 'こかげに おきゃくさんが きたよ', hint: 'そだった 木の そばに ベンチと 花を' },
    { id: 'moment:whale', group: 'sky', name: 'くじら', line: 'くじらが しおを ふいたよ', hint: 'みずを ふやすか、おおきな いりえを ほってみよう' },
    { id: 'moment:rainbow-bird', group: 'sky', name: 'にじいろの とり', line: 'にじいろの とりが とんだよ', hint: 'はなずかんを 5いろ あつめよう' },
    { id: 'moment:moon-rabbit', group: 'sky', name: 'つきの うさぎ', line: 'つきの うさぎが あかりを みにきたよ', hint: 'あかりを 3つ。まんげつなら 1つでも' },
    { id: 'moment:full-moon', group: 'sky', name: 'まんげつの みち', line: 'まんまるの つきが うみに ひかりの みちを つくったよ', hint: 'まんげつの ころに しまを ひらいてみよう' },
    { id: 'moment:dot-rain', group: 'sky', name: 'みずたまの あめ', line: 'いろとりどりの みずたまが ふってきたよ', hint: 'ふしぎの たねを そだててみよう' },
];

const heightAt = (state: GrowingState, cell: Cell) => terrainOf(state)?.heights[key(cell)] ?? 0;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const WATER_SOURCES = new Set<Landmark['kind']>(['water-channel', 'water-bowl', 'fountain']);

/** Water on raised ground falls into dug water beside it: one fall per edge. */
export function waterfalls(state: GrowingState): { from: Cell; to: Cell }[] {
    const dug = new Set(dugWater(state).map(key));
    if (!dug.size) return [];
    const out: { from: Cell; to: Cell }[] = [];
    for (const l of state.landmarks) {
        if (!l.cell || !WATER_SOURCES.has(l.kind) || heightAt(state, l.cell) < 1) continue;
        for (const [dx, dz] of NEIGHBORS) {
            const to = { x: l.cell.x + dx, z: l.cell.z + dz };
            if (dug.has(key(to))) out.push({ from: l.cell, to });
        }
    }
    return out;
}

/** Dug water in connected pieces of three cells or more: the child's own coves and ponds. */
export function coves(state: GrowingState): Cell[][] {
    const cells = dugWater(state), left = new Map(cells.map(cell => [key(cell), cell])), out: Cell[][] = [];
    for (const start of cells) {
        if (!left.has(key(start))) continue;
        const piece: Cell[] = [], queue = [start]; left.delete(key(start));
        while (queue.length) {
            const cell = queue.pop()!; piece.push(cell);
            for (const [dx, dz] of NEIGHBORS) {
                const next = left.get(key({ x: cell.x + dx, z: cell.z + dz }));
                if (next) { left.delete(key(next)); queue.push(next); }
            }
        }
        if (piece.length >= 3) out.push(piece.sort((a, b) => a.x - b.x || a.z - b.z));
    }
    return out.sort((a, b) => b.length - a.length || key(a[0]).localeCompare(key(b[0])));
}

/** Where the little boat floats: the most open cell of the biggest cove. */
export function boatCell(state: GrowingState): Cell | undefined {
    const cove = coves(state)[0];
    if (!cove) return undefined;
    const inside = new Set(cove.map(key));
    const open = (cell: Cell) => NEIGHBORS.filter(([dx, dz]) => inside.has(key({ x: cell.x + dx, z: cell.z + dz }))).length;
    return [...cove].sort((a, b) => open(b) - open(a) || key(a).localeCompare(key(b)))[0];
}

/** Lights standing on raised ground reach one cell further (§1.4). */
export const highLight = (state: GrowingState, cell: Cell) => heightAt(state, cell) >= 1;

const isLord = (state: GrowingState, l: Landmark) => l.kind === 'sapling' && l.maturedAt !== undefined && state.nature.hours - l.maturedAt >= RULES.lordTreeHours;

/** A lord tree on a two-step hill raises a small island into the sky beside it. */
export function floatingIsle(state: GrowingState): Cell | undefined {
    return state.landmarks.filter(l => l.cell && isLord(state, l) && heightAt(state, l.cell) >= 2)
        .sort((a, b) => a.id.localeCompare(b.id))[0]?.cell;
}

function groveOnHill(state: GrowingState) {
    const trees = state.landmarks.filter(l => l.cell && l.kind === 'sapling' && l.maturedAt !== undefined && heightAt(state, l.cell) >= 1).map(l => l.cell!);
    const left = new Set(trees.map(key));
    for (const start of trees) {
        if (!left.has(key(start))) continue;
        let size = 0; const queue = [start]; left.delete(key(start));
        while (queue.length) {
            const cell = queue.pop()!; size++;
            for (const [dx, dz] of NEIGHBORS) {
                const id = key({ x: cell.x + dx, z: cell.z + dz });
                if (left.delete(id)) { const [x, z] = id.split(',').map(Number); queue.push({ x, z }); }
            }
        }
        if (size >= 3) return true;
    }
    return false;
}

/**
 * A maturing tree is sometimes a rainbow tree. Water and flowers within two cells make it
 * likelier; the draw belongs to the tree, so it cannot be redrawn.
 */
export function rainbowChance(state: GrowingState, tree: Landmark) {
    if (!tree.cell) return 0;
    const near = scoresNear(state, tree.cell, 2);
    return .06 + (near.water > 0 ? .12 : 0) + (near.flower > 0 ? .08 : 0);
}
export const rainbowTree = (state: GrowingState, tree: Landmark) => roll(state.seed, 'rainbow-tree', tree.id, 0) < rainbowChance(state, tree);

/** A field built near water is sometimes golden; the draw belongs to the field. */
export function goldenChance(state: GrowingState, cell: Cell) { return .06 + (scoresNear(state, cell, 2).water > 0 ? .12 : 0); }
export const goldenField = (state: GrowingState, plotId: string, cell: Cell) => roll(state.seed, 'golden-field', plotId, 0) < goldenChance(state, cell);

/** A home on raised ground gets a lookout. */
export const lookoutHome = (state: GrowingState, cell: Cell) => heightAt(state, cell) >= 1;

/** A cove of four or more dug cells is where the next ship waits. */
export const shipCove = (state: GrowingState) => coves(state).find(piece => piece.length >= 4);

/** A plucked wild flower sometimes leaves a four-leaf clover. */
export const cloverFound = (state: GrowingState, plotId: string) => roll(state.seed, 'clover', plotId, 0) < .15;

export function discover(state: GrowingState, id: DiscoveryId) {
    if (state.discoveries?.includes(id)) return false;
    state.discoveries = [...(state.discoveries ?? []), id];
    return true;
}

/** Notice what the island's shape now holds; earlier finds are never taken away. */
export function noteDiscoveries(state: GrowingState) {
    if (terrainOf(state)) {
        if (waterfalls(state).length) discover(state, 'waterfall');
        if (coves(state).length) discover(state, 'cove-boat');
        if (state.landmarks.some(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse') && highLight(state, l.cell))) discover(state, 'high-light');
        if (groveOnHill(state)) discover(state, 'grove-hill');
        if (floatingIsle(state)) discover(state, 'floating-isle');
        if (state.plots.some(p => p.kind === 'home' && p.stage > 0 && p.cell && lookoutHome(state, p.cell))) discover(state, 'lookout-home');
        if (shipCove(state)) discover(state, 'ship-cove');
    }
    if (state.landmarks.some(l => l.rare === 'rainbow' && l.cell)) discover(state, 'rainbow-tree');
    // しまづくり・くらし・こうかい (island-journey.md §5): facts of the island, kept once.
    if (state.land.extra.length || state.land.expanded || state.land.capes.length || state.land.districts?.length) discover(state, 'build:expand');
    if (Object.values(terrainOf(state)?.heights ?? {}).some(height => height !== 0) && state.terrain) discover(state, 'build:shape');
    if (state.landmarks.some(l => (l.tended ?? 0) > 0)) discover(state, 'build:tend');
    if (state.villagers.filter(v => !state.arrivals.includes(v.id)).length >= 3) discover(state, 'life:friends');
    if (state.plots.some(p => p.kind === 'home' && p.stage === 4)) discover(state, 'life:two-storey');
    if (state.bridge) discover(state, 'life:bridge');
    if (state.emblem) discover(state, 'life:flag');
    if (state.journey?.routes.length) discover(state, 'voyage:route');
    if (state.journey?.chosen.length) discover(state, 'voyage:island');
    if ((state.journey?.chosen.length ?? 0) >= 6) discover(state, 'voyage:all');
    if (state.plots.some(p => p.rare === 'golden' && p.cell)) discover(state, 'golden-pumpkin');
}
