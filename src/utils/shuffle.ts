import type { RandomSource } from "./random";

/**
 * Fisher-Yates (Knuth) shuffle algorithm.
 * Returns a new shuffled array without mutating the original.
 *
 * Math.random() を sort のコンパレータに使う手法は
 * 偏りが生じるため、Fisher-Yates を使用する。
 */
export const shuffleArray = <T>(
    array: readonly T[],
    random: RandomSource = Math.random,
): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};
