export type RandomSource = () => number;

export const hashRandomSeed = (value: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

/**
 * Returns an isolated deterministic random stream. Callers should create a new
 * stream for each independent generation key instead of sharing one globally.
 */
export const createSeededRandom = (seed: string | number): RandomSource => {
    let value = typeof seed === "number" ? seed >>> 0 : hashRandomSeed(seed);

    return () => {
        value += 0x6d2b79f5;
        let mixed = value;
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
};
