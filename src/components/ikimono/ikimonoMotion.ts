import type { useAnimationControls } from 'framer-motion';
import { IkimonoStage } from './types';

type MotionControls = ReturnType<typeof useAnimationControls>;

export interface SwayConfig {
    rotate: number;
    y: number;
    duration: number;
}

const STAGE_SWAY: Record<Exclude<IkimonoStage, 'gone'>, SwayConfig> = {
    egg: { rotate: 0, y: 3, duration: 5 },
    hatching: { rotate: 0.8, y: 4, duration: 4.5 },
    small: { rotate: 1.2, y: 5, duration: 4 },
    medium: { rotate: 1.5, y: 4, duration: 5 },
    adult: { rotate: 1, y: 3, duration: 6 },
    fading: { rotate: 0.5, y: 2, duration: 8 },
};

export type TapReaction =
    | 'hitokoto'
    | 'bounce'
    | 'spin'
    | 'wiggle'
    | 'nod'
    | 'tilt'
    | 'hop'
    | 'shimmy'
    | 'squash'
    | 'floaty'
    | 'pulse';

export function getStageSway(stage: IkimonoStage): SwayConfig {
    if (stage === 'gone') return STAGE_SWAY.egg;
    return STAGE_SWAY[stage];
}

export function pickTapReaction(stage: IkimonoStage): TapReaction {
    const r = Math.random();
    if (stage === 'egg') {
        if (r < 0.2) return 'hitokoto';
        if (r < 0.35) return 'wiggle';
        if (r < 0.5) return 'shimmy';
        if (r < 0.68) return 'bounce';
        if (r < 0.84) return 'squash';
        return 'hop';
    }
    if (r < 0.24) return 'hitokoto';
    if (r < 0.34) return 'bounce';
    if (r < 0.44) return 'wiggle';
    if (r < 0.53) return 'nod';
    if (r < 0.62) return 'spin';
    if (r < 0.71) return 'tilt';
    if (r < 0.79) return 'hop';
    if (r < 0.86) return 'shimmy';
    if (r < 0.92) return 'squash';
    if (r < 0.97) return 'floaty';
    return 'pulse';
}

export async function playIdleMotion(controls: MotionControls, sway: SwayConfig): Promise<void> {
    const mode = Math.floor(Math.random() * 4);
    if (mode === 0) {
        await controls.start({
            y: [0, -sway.y, 0, -sway.y * 0.5, 0],
            rotate: [0, sway.rotate, 0, -sway.rotate, 0],
            transition: { duration: sway.duration, ease: 'easeInOut' },
        });
        return;
    }
    if (mode === 1) {
        await controls.start({
            scale: [1, 1.03, 1],
            y: [0, -sway.y * 0.7, 0],
            transition: { duration: sway.duration * 0.9, ease: 'easeInOut' },
        });
        return;
    }
    if (mode === 2) {
        await controls.start({
            rotate: [0, sway.rotate * 1.2, 0, -sway.rotate * 1.2, 0],
            y: [0, -sway.y * 0.8, 0],
            transition: { duration: sway.duration * 1.1, ease: 'easeInOut' },
        });
        return;
    }
    await controls.start({
        x: [0, 2, -2, 0],
        y: [0, -sway.y * 0.55, 0],
        transition: { duration: sway.duration, ease: 'easeInOut' },
    });
}

export async function playTapReaction(controls: MotionControls, reaction: TapReaction): Promise<void> {
    switch (reaction) {
        case 'hitokoto':
            await controls.start({
                scale: [1, 1.05, 1],
                transition: { duration: 0.3 },
            });
            break;
        case 'bounce':
            await controls.start({
                y: [0, -15, 0],
                transition: { duration: 0.4, ease: 'easeOut' },
            });
            break;
        case 'spin':
            await controls.start({
                rotate: [0, 10, -10, 5, 0],
                transition: { duration: 0.5 },
            });
            break;
        case 'wiggle':
            await controls.start({
                x: [0, -5, 5, -3, 3, 0],
                transition: { duration: 0.4 },
            });
            break;
        case 'nod':
            await controls.start({
                y: [0, 5, -2, 0],
                transition: { duration: 0.35, ease: 'easeOut' },
            });
            break;
        case 'tilt':
            await controls.start({
                rotate: [0, 8, -6, 4, 0],
                y: [0, -5, 0],
                transition: { duration: 0.5, ease: 'easeInOut' },
            });
            break;
        case 'hop':
            await controls.start({
                y: [0, -22, 0, -10, 0],
                scale: [1, 1.04, 0.98, 1.02, 1],
                transition: { duration: 0.55, ease: 'easeOut' },
            });
            break;
        case 'shimmy':
            await controls.start({
                x: [0, -8, 8, -6, 6, -4, 4, 0],
                rotate: [0, -4, 4, -3, 3, 0],
                transition: { duration: 0.6, ease: 'easeInOut' },
            });
            break;
        case 'squash':
            await controls.start({
                scaleX: [1, 1.08, 0.93, 1.02, 1],
                scaleY: [1, 0.92, 1.06, 0.98, 1],
                transition: { duration: 0.45, ease: 'easeOut' },
            });
            break;
        case 'floaty':
            await controls.start({
                y: [0, -10, -14, -10, 0],
                rotate: [0, 2, -2, 0],
                transition: { duration: 0.8, ease: 'easeInOut' },
            });
            break;
        case 'pulse':
            await controls.start({
                scale: [1, 1.06, 1, 1.04, 1],
                transition: { duration: 0.6, ease: 'easeOut' },
            });
            break;
    }
}
