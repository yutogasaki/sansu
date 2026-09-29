import { sha256 } from '../natureTown/random';

/** A deterministic draw in [0, 1): reopening the island never rerolls a result. */
export function roll(seed: string, system: string, id: string, ordinal: number) {
    return parseInt(sha256(JSON.stringify(['growing-island-v1', seed, system, id, ordinal])).slice(0, 8), 16) / 4294967296;
}

export function pick<T>(items: readonly T[], weights: readonly number[], r: number): T {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let at = r * total;
    for (let i = 0; i < items.length; i++) { at -= weights[i]; if (at < 0) return items[i]; }
    return items[items.length - 1];
}
