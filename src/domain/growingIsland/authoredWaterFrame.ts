import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';
import { composeAuthoredWaterWorld } from './authoredWaterWorld';

// The UI, renderer and future preview share the same immutable frame. Keep only
// the committed shape and two nearby edits; a receipt never regenerates terrain.
const frames = new WeakMap<IslandWorld, Map<string, ReturnType<typeof composeAuthoredWaterWorld>>>();
export function authoredWaterFrame(state: GrowingState, base: IslandWorld) {
    const key = JSON.stringify([state.plots, state.landmarks, state.keepsakes]);
    let cache = frames.get(base);
    if (!cache) { cache = new Map(); frames.set(base, cache); }
    const existing = cache.get(key);
    if (existing) return existing;
    const frame = composeAuthoredWaterWorld(state, base);
    cache.set(key, frame);
    if (cache.size > 3) cache.delete(cache.keys().next().value!);
    return frame;
}
