import { keepsakeKind, type FlowerColor, type GrowingState, type LandmarkKind, type SeedKind } from '../../../domain/growingIsland';
import { FLOWER_NAME } from './flowerGeometry';
import { HOME_STAGE, KEEPSAKE_NAME, LANDMARK_LABEL, SEED_LABEL } from './growingCopy';

type Choice = { kind: SeedKind | LandmarkKind; seed: boolean; mode: 'new' | 'move' | 'unstore'; id?: string; keepsake?: string; color?: FlowerColor };

/** The same child-facing item names used by the tray and the selected-item sheet. */
export function placementName(state: GrowingState, choice: Choice): string {
    if (choice.keepsake) return KEEPSAKE_NAME[keepsakeKind(choice.keepsake)];
    if (choice.seed) {
        const seed = choice.kind as SeedKind;
        const plot = choice.id ? state.plots.find(item => item.id === choice.id) : undefined;
        if (plot?.kind === 'home' && plot.stage > 0) return HOME_STAGE[plot.stage];
        const name = SEED_LABEL[seed].name;
        return choice.mode === 'new' || plot?.stage === 0 ? seed === 'wonder' ? name : `${name}の たね` : name;
    }
    if (choice.kind === 'flower' && choice.mode === 'new' && choice.color) return `${FLOWER_NAME[choice.color]}の はな`;
    return LANDMARK_LABEL[choice.kind as LandmarkKind]?.name ?? 'めじるし';
}
