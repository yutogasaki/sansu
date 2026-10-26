import { waterfalls } from './discoveries';
import { terrainOf } from './editableTerrainWorld';
import { dugWater, TREE_MATURE_HOURS } from './environment';
import { roll } from './random';
import { distance, key, landCells } from './space';
import type { Cell, GrowingState } from './types';
import type { ThemeId } from './journey';

/**
 * その島だけの仕掛け (island-journey.md §4). Each special island answers the child's
 * arrangement in its own way; anything placed does something, and a worked-out arrangement
 * completes the island. They are scenery and play only: never growth, items or learning.
 */
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const cellOf = (id: string): Cell => { const [x, z] = id.split(',').map(Number); return { x, z }; };

function groups(cells: readonly Cell[], linked: (a: Cell, b: Cell) => boolean): Cell[][] {
    const left = [...cells], out: Cell[][] = [];
    while (left.length) {
        const group = [left.shift()!];
        for (let i = 0; i < group.length; i++) for (let j = left.length - 1; j >= 0; j--) if (linked(group[i], left[j])) group.push(...left.splice(j, 1));
        out.push(group);
    }
    return out;
}
const touching = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1;

/** しお: a tide of 12 h 25 min, so the same clock time sees a different tide each day. 1 is high. */
export function tideLevel(at: number) {
    const period = (12 * 60 + 25) * 60_000;
    return (Math.cos(((at % period) / period) * Math.PI * 2) + 1) / 2;
}

/** かぜ: one of eight directions for the real day, the same for everyone on the island (radians). */
export function windAngle(state: GrowingState, at: number) {
    const day = Math.floor(at / 86_400_000);
    return Math.floor(roll(state.seed, 'wind', 'day', day) * 8) / 8 * Math.PI * 2;
}

/** こだま: grown trees joined by their sides; groups of three or more ring together. */
export function echoGroves(state: GrowingState) {
    const trees = state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS).map(l => l.cell!);
    return groups(trees, touching).filter(group => group.length >= 3);
}

/** ひかりの水: water things and dug water joined by their sides; longer flows shine brighter. */
export function lightFlows(state: GrowingState) {
    const water = [...state.landmarks.filter(l => l.cell && (l.kind === 'water-channel' || l.kind === 'water-bowl' || l.kind === 'fountain')).map(l => l.cell!), ...dugWater(state)];
    const unique = [...new Map(water.map(c => [key(c), c])).values()];
    return groups(unique, touching).sort((a, b) => b.length - a.length);
}

/** からくり: power runs from each water channel (a waterwheel) through things joined by their sides. */
export function gearChain(state: GrowingState): Cell[] {
    const things = new Map<string, Cell>();
    for (const owner of [...state.landmarks, ...state.plots, ...state.keepsakes]) if (owner.cell) things.set(key(owner.cell), owner.cell);
    const sources = state.landmarks.filter(l => l.kind === 'water-channel' && l.cell).map(l => l.cell!);
    const powered = new Set<string>(), queue = sources.map(key);
    queue.forEach(id => powered.add(id));
    while (queue.length) {
        const at = cellOf(queue.pop()!);
        for (const [dx, dz] of NEIGHBORS) {
            const id = key({ x: at.x + dx, z: at.z + dz });
            if (things.has(id) && !powered.has(id)) { powered.add(id); queue.push(id); }
        }
    }
    return [...powered].map(cellOf);
}

/** せいざ: lights within two cells of each other are joined into a constellation. */
export function constellations(state: GrowingState) {
    const lights = state.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).map(l => l.cell!);
    return groups(lights, (a, b) => distance(a, b) <= 2).filter(group => group.length >= 2);
}

const heightAt = (state: GrowingState, cell: Cell) => terrainOf(state)?.heights[key(cell)] ?? 0;

export interface MechanismProgress { theme: ThemeId; done: boolean; have: number; need: number; next: string }

/** How far this island's own play has come; `done` is what calls the island's second species. */
export function mechanismProgress(state: GrowingState): MechanismProgress | undefined {
    const theme = state.theme;
    if (!theme) return undefined;
    switch (theme) {
        case 'shiokaze': {
            const dug = new Set(dugWater(state).map(key));
            const flowers = state.keepsakes.filter(k => k.unitId === 'species:shell-flower' && k.cell).map(k => k.cell!);
            const done = flowers.some(c => NEIGHBORS.some(([dx, dz]) => dug.has(key({ x: c.x + dx, z: c.z + dz }))));
            return { theme, done, have: done ? 1 : 0, need: 1, next: 'かいの はなを、ほった みずの となりに おこう' };
        }
        case 'kodama': {
            const trees = state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS).map(l => l.cell!);
            const biggest = Math.max(0, ...groups(trees, touching).map(g => g.length));
            return { theme, done: biggest >= 3, have: Math.min(3, biggest), need: 3, next: 'そだった 木を となりどうしに ならべよう' };
        }
        case 'hikari': {
            const done = waterfalls(state).length > 0;
            return { theme, done, have: done ? 1 : 0, need: 1, next: 'おかの うえの みずの となりを ほって、たきを つくろう' };
        }
        case 'watagumo': {
            const heights = terrainOf(state)?.heights ?? {};
            const occupied = new Set([...state.landmarks, ...state.plots, ...state.keepsakes].filter(o => o.cell).map(o => key(o.cell!)));
            const done = Object.entries(heights).some(([id, h]) => {
                if (h < 1) return false;
                const { x, z } = cellOf(id);
                return [{ x, z }, { x: x + 1, z }, { x, z: z + 1 }, { x: x + 1, z: z + 1 }].every(c => heightAt(state, c) === h && !occupied.has(key(c)));
            });
            return { theme, done, have: done ? 1 : 0, need: 1, next: 'おかの うえに、2×2の たいらな ひろばを つくろう' };
        }
        case 'karakuri': {
            const chain = gearChain(state).length;
            return { theme, done: chain >= 5, have: Math.min(5, chain), need: 5, next: 'みずみちから、となりどうしに ものを つなげよう' };
        }
        case 'hoshi': {
            const biggest = Math.max(0, ...constellations(state).map(g => g.length));
            return { theme, done: biggest >= 3, have: Math.min(3, biggest), need: 3, next: 'あかりを 2マス いないに ならべて、せいざを つくろう' };
        }
    }
}

/** For scenery: every open land cell, so tide shells and wind fluff can find a place. */
export const openLand = (state: GrowingState) => {
    const taken = new Set([...state.plots, ...state.landmarks, ...state.keepsakes].filter(o => o.cell).map(o => key(o.cell!)));
    return landCells(state).filter(c => !taken.has(key(c)));
};
