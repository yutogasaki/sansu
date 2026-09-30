import { roll } from './random';
import { BLOOM_HOURS } from './environment';
import { distance, isVacant, key, landCells, neighbors } from './space';
import type { Cell, GrowingState, Landmark, NatureEvent } from './types';

/**
 * Flowers that mix (spec 52 §5.1). Two bloomed flowers of different colours standing close
 * together may seed a flower of a new colour between them, on the nature clock. Children
 * place and arrange; the island does the rest. Nothing wilts and no colour is ever lost.
 */
export const FLOWER_COLORS = ['red', 'yellow', 'white', 'blue', 'orange', 'pink', 'purple', 'sky', 'cream', 'mint', 'wonder'] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
/** Colours a child can plant. Blue opens with island level 2; the rest come only from mixing. */
export const PLANTED_COLORS: readonly { color: FlowerColor; level: number }[] = [
    { color: 'red', level: 1 }, { color: 'yellow', level: 1 }, { color: 'white', level: 1 }, { color: 'blue', level: 2 },
];

const RECIPES: Record<string, FlowerColor> = {
    'red+yellow': 'orange', 'red+white': 'pink', 'blue+red': 'purple', 'blue+white': 'sky', 'white+yellow': 'cream', 'blue+yellow': 'mint',
    // The polka-dot wonder flower: two mixed colours meeting (Pokomoko's lineage).
    'orange+purple': 'wonder', 'pink+sky': 'wonder', 'cream+mint': 'wonder',
};
export function mixOf(a: FlowerColor, b: FlowerColor): FlowerColor | undefined {
    return a === b ? undefined : RECIPES[[a, b].sort().join('+')];
}
/** The pair that makes a colour, for the flower book's hints. */
export function recipeFor(color: FlowerColor): [FlowerColor, FlowerColor][] {
    return Object.entries(RECIPES).filter(([, result]) => result === color).map(([pair]) => pair.split('+') as [FlowerColor, FlowerColor]);
}

/** Flowers placed before colours existed keep their pink look and count as pink. */
export const flowerColor = (flower: Pick<Landmark, 'color'>): FlowerColor => flower.color ?? 'pink';

export const MIX_EVERY = 24, MIX_CHANCE = .4, FLOWER_SHARE = .25;

const bloomed = (state: GrowingState) => state.landmarks.filter(l => l.kind === 'flower' && l.cell && l.growth >= BLOOM_HOURS);

/** An open cell next to both parents if there is one, otherwise next to either. */
function seedCell(state: GrowingState, a: Cell, b: Cell, pick: number): Cell | undefined {
    const around = (cell: Cell) => neighbors(cell).filter(n => isVacant(state, n));
    const both = around(a).filter(n => distance(n, b) === 1);
    const options = both.length ? both : [...around(a), ...around(b)];
    return options.length ? options[Math.floor(pick * options.length)] : undefined;
}

/** One mixing round: each close pair of different colours may seed one new flower. */
export function mixFlowers(state: GrowingState, round: number, events: NatureEvent[]) {
    const limit = Math.floor(landCells(state).length * FLOWER_SHARE);
    const parents = bloomed(state).sort((x, y) => x.id.localeCompare(y.id));
    const used = new Set<string>();
    for (let i = 0; i < parents.length; i++) for (let j = i + 1; j < parents.length; j++) {
        if (state.landmarks.filter(l => l.kind === 'flower').length >= limit) return;
        const a = parents[i], b = parents[j];
        if (used.has(a.id) || used.has(b.id) || distance(a.cell!, b.cell!) > 2) continue;
        const color = mixOf(flowerColor(a), flowerColor(b));
        if (!color) continue;
        const pair = `${a.id}+${b.id}`;
        if (roll(state.seed, 'flower-mix', pair, round) >= MIX_CHANCE) continue;
        const cell = seedCell(state, a.cell!, b.cell!, roll(state.seed, 'flower-mix-cell', pair, round));
        if (!cell) continue;
        used.add(a.id); used.add(b.id);
        const id = `l${state.nextId++}`;
        state.landmarks.push({ id, kind: 'flower', cell, growth: 0, color });
        events.push({ type: 'mixed', id, color });
        noteColor(state, color, events);
    }
}

/** The flower book remembers each colour the island has grown (§5.1). */
export function noteColor(state: GrowingState, color: FlowerColor, events?: NatureEvent[]) {
    const book = state.flowerBook ?? [];
    if (book.includes(color)) return;
    state.flowerBook = [...book, color];
    events?.push({ type: 'new-color', color });
}

export const flowerCells = (state: GrowingState) => new Set(bloomed(state).map(l => key(l.cell!)));
