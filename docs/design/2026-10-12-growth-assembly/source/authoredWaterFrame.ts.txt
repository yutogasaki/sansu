import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';
import { composeAuthoredWaterWorld } from './authoredWaterWorld';

// The UI, renderer and future preview share the latest immutable frame. Live
// consumers retain their displayed shapes; a receipt never regenerates terrain.
const frames = new WeakMap<IslandWorld, Map<string, ReturnType<typeof composeAuthoredWaterWorld>>>();
export function authoredWaterFrame(state: GrowingState, base: IslandWorld) {
    const key = JSON.stringify([state.plots, state.landmarks, state.keepsakes]);
    let cache = frames.get(base);
    if (!cache) { cache = new Map(); frames.set(base, cache); }
    const existing = cache.get(key);
    if (existing) return existing;
    // Drop the old large lookup graph before allocating its replacement.
    cache.clear();
    const frame = composeAuthoredWaterWorld(state, base);
    cache.set(key, frame);
    return frame;
}
