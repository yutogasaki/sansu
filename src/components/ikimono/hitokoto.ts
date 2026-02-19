import { IkimonoStage } from './types';
import {
    AFTERNOON_OPEN,
    ANYTIME_OPEN,
    EGG_OPEN_HITOKOTO,
    EGG_TAP_HITOKOTO,
    EVENING_OPEN,
    MORNING_OPEN,
    OPEN_PREFIX,
    OPEN_SUFFIX,
    ScriptMode,
    STAGE_HITOKOTO,
    TAP_PREFIX,
    TAP_REACTION,
    TAP_SUFFIX,
    TextPair,
} from './hitokotoData';

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    return 'evening';
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function render(text: TextPair, mode: ScriptMode): string {
    return mode === 'kanji' ? text.kanji : text.kana;
}

function compose(prefix: TextPair[], suffix: TextPair[], mode: ScriptMode): string {
    const p = pickRandom(prefix);
    const s = pickRandom(suffix);
    return `${render(p, mode)} ${render(s, mode)}`;
}

function pickFrom(list: TextPair[], mode: ScriptMode): string {
    return render(pickRandom(list), mode);
}

export function getOpenHitokoto(mode: ScriptMode = 'kana'): string {
    if (Math.random() < 0.28) {
        return compose(OPEN_PREFIX, OPEN_SUFFIX, mode);
    }

    if (Math.random() < 0.55) {
        const time = getTimeOfDay();
        switch (time) {
            case 'morning': return pickFrom(MORNING_OPEN, mode);
            case 'afternoon': return pickFrom(AFTERNOON_OPEN, mode);
            case 'evening': return pickFrom(EVENING_OPEN, mode);
        }
    }
    return pickFrom(ANYTIME_OPEN, mode);
}

export function shouldShowHitokotoOnOpen(): boolean {
    return Math.random() < 0.33;
}

export function getTapHitokoto(mode: ScriptMode = 'kana'): string {
    if (Math.random() < 0.3) {
        return compose(TAP_PREFIX, TAP_SUFFIX, mode);
    }
    return pickFrom(TAP_REACTION, mode);
}

export function getEggOpenHitokoto(mode: ScriptMode = 'kana'): string {
    return pickFrom(EGG_OPEN_HITOKOTO, mode);
}

export function getEggTapHitokoto(mode: ScriptMode = 'kana'): string {
    return pickFrom(EGG_TAP_HITOKOTO, mode);
}

export function getStageHitokoto(stage: IkimonoStage, mode: ScriptMode = 'kana'): string | null {
    const list = STAGE_HITOKOTO[stage];
    if (!list) return null;
    return pickFrom(list, mode);
}
