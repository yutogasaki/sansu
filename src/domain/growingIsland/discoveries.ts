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
export type DiscoveryId = 'waterfall' | 'cove-boat' | 'high-light' | 'grove-hill' | 'rainbow-tree' | 'clover' | 'floating-isle' | `moment:${Moment}`;
export type DiscoveryGroup = 'ground' | 'luck' | 'sky';

export interface Discovery { id: DiscoveryId; group: DiscoveryGroup; name: string; line: string; hint: string }

export const DISCOVERIES: readonly Discovery[] = [
    { id: 'waterfall', group: 'ground', name: 'たき', line: 'おかの みずが したの うみへ おちているよ', hint: 'おかの うえの みずみちや みずばちの となりを、うみの ふでで ほってみよう' },
    { id: 'cove-boat', group: 'ground', name: 'いりえの こぶね', line: 'ほった いりえに こぶねが うかんだよ', hint: 'うみの ふでで、つながった 3マスを ほってみよう' },
    { id: 'high-light', group: 'ground', name: 'たかだいの あかり', line: 'たかい ところの あかりは とおくまで とどくよ', hint: 'おかの うえに あかりを おいてみよう' },
    { id: 'grove-hill', group: 'ground', name: 'もりの おか', line: 'おかの うえに もりが できたよ', hint: 'そだった 木を 3本 ならべて、おかに してみよう' },
    { id: 'floating-isle', group: 'ground', name: 'うかぶ こじま', line: 'たかい おかの ぬしの木の そらに、こじまが うかんだよ', hint: '2だんの おかで、木を ぬしの木まで そだててみよう' },
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
    }
    if (state.landmarks.some(l => l.rare === 'rainbow' && l.cell)) discover(state, 'rainbow-tree');
}
