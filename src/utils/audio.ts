import { Howl, Howler } from 'howler';

// Sound Types
export type SoundType =
    | "correct"
    | "incorrect"
    | "tap"
    | "level_up"
    | "start"
    | "clear";

// BGM Types
export type BgmType =
    | "menu"
    | "study";

// Asset Map
const SE_ASSETS: Record<SoundType, string> = {
    correct: "/sounds/correct.mp3",
    incorrect: "/sounds/incorrect.mp3",
    tap: "/sounds/tap.mp3",
    level_up: "/sounds/level_up.mp3",
    start: "/sounds/start.mp3",
    clear: "/sounds/clear.mp3"
};

const BGM_ASSETS: Record<BgmType, string> = {
    menu: "/sounds/bgm_menu.mp3",
    study: "/sounds/bgm_study.mp3"
};

// Cache for Howl instances
const seInstances: Partial<Record<SoundType, Howl>> = {};
let currentBgm: Howl | null = null;
let currentBgmType: BgmType | null = null;

// Global settings
let isSoundEnabled = true;

export const setSoundEnabled = (enabled: boolean) => {
    isSoundEnabled = enabled;
    Howler.mute(!enabled);
};

export const loadSounds = () => {
    // Preload SE
    Object.entries(SE_ASSETS).forEach(([key, src]) => {
        if (!seInstances[key as SoundType]) {
            seInstances[key as SoundType] = new Howl({
                src: [src],
                volume: 0.6,
                preload: true
            });
        }
    });
};

export const playSound = (type: SoundType) => {
    if (!isSoundEnabled) return;

    // Load on demand if not preloaded
    if (!seInstances[type]) {
        seInstances[type] = new Howl({
            src: [SE_ASSETS[type]],
            volume: type === 'tap' ? 0.3 : 0.6
        });
    }

    // Play
    // For SE, we might want overlapping (default) or single instance?
    // Howler default is overlapping, which is good for rapid taps.
    seInstances[type]?.play();
};

export const playBgm = (type: BgmType) => {
    if (!isSoundEnabled) return;
    if (currentBgmType === type && currentBgm?.playing()) return;

    // Stop current
    if (currentBgm) {
        currentBgm.fade(0.5, 0, 500);
        setTimeout(() => {
            currentBgm?.stop();
        }, 500);
    }

    // Start new
    currentBgm = new Howl({
        src: [BGM_ASSETS[type]],
        html5: true, // Good for long audio
        loop: true,
        volume: 0.3
    });

    currentBgm.play();
    currentBgm.fade(0, 0.3, 1000);
    currentBgmType = type;
};

export const stopBgm = () => {
    if (currentBgm) {
        currentBgm.stop();
        currentBgm = null;
        currentBgmType = null;
    }
};
