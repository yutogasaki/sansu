import { LANDMARK_PRICE, SEED_PRICE } from '../../../domain/growingIsland';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland';

type Choice = { mode: 'new' | 'move' | 'unstore'; seed: boolean; kind: SeedKind | LandmarkKind };

/** Preview existing prices; the saved command remains the authority. */
export function placementPrice(state: GrowingState, choice: Choice) {
    if (choice.mode !== 'new') return 0;
    if (choice.seed) return state.tutorial === 'first-home' && choice.kind === 'home' ? 0 : SEED_PRICE[choice.kind as SeedKind];
    return LANDMARK_PRICE[choice.kind as LandmarkKind] ?? 0;
}
