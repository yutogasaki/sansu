import type { AnimationDefinition, useAnimationControls } from "framer-motion";
import type { FuwafuwaReactionStyle } from "./fuwafuwaSpeech";
import { IkimonoStage } from "./types";

type MotionControls = ReturnType<typeof useAnimationControls>;
type ReactionVariantMap = Record<FuwafuwaReactionStyle, AnimationDefinition[]>;

export interface SwayConfig {
    rotate: number;
    y: number;
    duration: number;
}

const STAGE_SWAY: Record<Exclude<IkimonoStage, "gone">, SwayConfig> = {
    egg: { rotate: 0, y: 3, duration: 5 },
    hatching: { rotate: 0.8, y: 4, duration: 4.5 },
    small: { rotate: 1.2, y: 5, duration: 4 },
    medium: { rotate: 1.5, y: 4, duration: 5 },
    adult: { rotate: 1, y: 3, duration: 6 },
    fading: { rotate: 0.5, y: 2, duration: 8 },
};

const IDLE_WEIGHTS = [36, 28, 20, 16] as const;

const REACTION_WEIGHTS: Record<FuwafuwaReactionStyle, readonly number[]> = {
    cozy: [35, 30, 20, 15],
    growing: [35, 30, 20, 15],
    sharing: [35, 30, 20, 15],
    celebrating: [30, 25, 25, 20],
    guiding: [35, 30, 20, 15],
};

export function getStageSway(stage: IkimonoStage): SwayConfig {
    if (stage === "gone") return STAGE_SWAY.egg;
    return STAGE_SWAY[stage];
}

export function pickWeightedIndex(weights: readonly number[], lastIndex: number | null): number {
    const adjusted = weights.map((weight, index) => {
        if (lastIndex === null || index !== lastIndex || weights.length === 1) {
            return weight;
        }

        return Math.max(1, Math.floor(weight / 2));
    });

    const total = adjusted.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;

    for (let index = 0; index < adjusted.length; index += 1) {
        roll -= adjusted[index];
        if (roll < 0) {
            return index;
        }
    }

    return adjusted.length - 1;
}

export function pickIdleMotionVariant(lastIndex: number | null): number {
    return pickWeightedIndex(IDLE_WEIGHTS, lastIndex);
}

export function getDefaultReactionStyleForStage(stage: IkimonoStage): FuwafuwaReactionStyle {
    switch (stage) {
        case "egg":
            return "sharing";
        case "hatching":
        case "small":
        case "medium":
            return "growing";
        case "adult":
        case "fading":
        case "gone":
        default:
            return "cozy";
    }
}

export function shouldShowTapHitokoto(stage: IkimonoStage): boolean {
    const chance = stage === "egg" ? 0.22 : stage === "hatching" ? 0.24 : 0.26;
    return Math.random() < chance;
}

export function shouldShowBonusTapHitokoto(stage: IkimonoStage): boolean {
    const chance = stage === "egg" ? 0.22 : stage === "hatching" ? 0.24 : 0.28;
    return Math.random() < chance;
}

export async function playIdleMotion(
    controls: MotionControls,
    sway: SwayConfig,
    mode = Math.floor(Math.random() * 4),
): Promise<void> {
    if (mode === 0) {
        await controls.start({
            y: [0, -sway.y, 0, -sway.y * 0.5, 0],
            rotate: [0, sway.rotate, 0, -sway.rotate, 0],
            transition: { duration: sway.duration, ease: "easeInOut" },
        });
        return;
    }
    if (mode === 1) {
        await controls.start({
            scale: [1, 1.03, 1],
            y: [0, -sway.y * 0.7, 0],
            transition: { duration: sway.duration * 0.9, ease: "easeInOut" },
        });
        return;
    }
    if (mode === 2) {
        await controls.start({
            rotate: [0, sway.rotate * 1.2, 0, -sway.rotate * 1.2, 0],
            y: [0, -sway.y * 0.8, 0],
            transition: { duration: sway.duration * 1.1, ease: "easeInOut" },
        });
        return;
    }
    await controls.start({
        x: [0, 2, -2, 0],
        y: [0, -sway.y * 0.55, 0],
        transition: { duration: sway.duration, ease: "easeInOut" },
    });
}

function getReactionVariants(baseScale: number): ReactionVariantMap {
    return {
        cozy: [
            {
                y: [0, -12, 0],
                scale: [baseScale, baseScale * 1.05, baseScale],
                transition: { duration: 0.48, ease: "easeInOut" },
            },
            {
                rotate: [0, -10, 10, -6, 0],
                y: [0, -8, 0],
                transition: { duration: 0.52, ease: "easeInOut" },
            },
            {
                x: [0, -8, 8, -6, 0],
                y: [0, -10, 0],
                scale: [baseScale, baseScale * 1.03, baseScale],
                transition: { duration: 0.56, ease: "easeInOut" },
            },
            {
                y: [0, -16, 0],
                rotate: [0, 360],
                scale: [baseScale, baseScale * 1.04, baseScale],
                transition: { duration: 0.72, ease: "easeInOut" },
            },
        ],
        growing: [
            {
                y: [0, -18, 0, -8, 0],
                scale: [baseScale, baseScale * 1.08, baseScale, baseScale * 1.03, baseScale],
                transition: { duration: 0.56, ease: "easeInOut" },
            },
            {
                rotate: [0, -12, 12, -6, 0],
                y: [0, -12, 0],
                scale: [baseScale, baseScale * 1.05, baseScale],
                transition: { duration: 0.56, ease: "easeInOut" },
            },
            {
                x: [0, -10, 10, -6, 0],
                y: [0, -14, 0],
                transition: { duration: 0.58, ease: "easeInOut" },
            },
            {
                y: [0, -20, 0],
                rotate: [0, 360],
                scale: [baseScale, baseScale * 1.07, baseScale],
                transition: { duration: 0.74, ease: "easeInOut" },
            },
        ],
        sharing: [
            {
                x: [0, -10, 10, -10, 10, 0],
                y: [0, -6, 0],
                transition: { duration: 0.42, ease: "easeInOut" },
            },
            {
                rotate: [0, -18, 18, -10, 10, 0],
                y: [0, -12, 0],
                scale: [baseScale, baseScale * 1.05, baseScale],
                transition: { duration: 0.58, ease: "easeInOut" },
            },
            {
                y: [0, -14, 0],
                x: [0, 8, -8, 0],
                scale: [baseScale, baseScale * 1.04, baseScale],
                transition: { duration: 0.6, ease: "easeInOut" },
            },
            {
                y: [0, -14, 0],
                rotate: [0, 360],
                scale: [baseScale, baseScale * 1.05, baseScale],
                transition: { duration: 0.72, ease: "easeInOut" },
            },
        ],
        celebrating: [
            {
                y: [0, -30, 0, -15, 0],
                scale: [baseScale, baseScale * 1.1, baseScale, baseScale * 1.05, baseScale],
                rotate: [0, -8, 8, 0],
                transition: { duration: 0.6, type: "spring", bounce: 0.5 },
            },
            {
                y: [0, -18, 0],
                rotate: [0, 360],
                scale: [baseScale, baseScale * 1.06, baseScale],
                transition: { duration: 0.72, ease: "easeInOut" },
            },
            {
                rotate: [0, -12, 12, -10, 10, 0],
                scale: [baseScale, baseScale * 1.1, baseScale * 0.96, baseScale],
                transition: { duration: 0.68, ease: "easeInOut" },
            },
            {
                y: [0, -22, 0, -10, 0],
                rotate: [0, 220, 360],
                scale: [baseScale, baseScale * 1.12, baseScale, baseScale * 1.05, baseScale],
                transition: { duration: 0.74, ease: "easeInOut" },
            },
        ],
        guiding: [
            {
                rotate: [0, -5, 5, -2, 0],
                scale: [baseScale, baseScale * 1.03, baseScale],
                transition: { duration: 0.5, ease: "easeInOut" },
            },
            {
                x: [0, -8, 8, -6, 0],
                y: [0, -10, 0],
                rotate: [0, 12, -12, 0],
                transition: { duration: 0.54, ease: "easeInOut" },
            },
            {
                y: [0, -12, 0],
                x: [0, 10, -10, 0],
                scale: [baseScale, baseScale * 1.04, baseScale],
                transition: { duration: 0.58, ease: "easeInOut" },
            },
            {
                y: [0, -12, 0],
                rotate: [0, 360],
                scale: [baseScale, baseScale * 1.04, baseScale],
                transition: { duration: 0.68, ease: "easeInOut" },
            },
        ],
    };
}

export async function playTapReaction(
    controls: MotionControls,
    reactionStyle: FuwafuwaReactionStyle,
    lastVariantIndex: number | null = null,
    baseScale = 1,
): Promise<number> {
    const nextVariantIndex = pickWeightedIndex(
        REACTION_WEIGHTS[reactionStyle],
        lastVariantIndex,
    );

    await controls.start(getReactionVariants(baseScale)[reactionStyle][nextVariantIndex]);
    return nextVariantIndex;
}
