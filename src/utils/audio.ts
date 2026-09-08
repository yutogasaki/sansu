import { Howl, Howler } from 'howler';
import { resolveAppAssetPath } from './assets';

// Sound Types
export type SoundType =
    | "correct"
    | "incorrect"
    | "tap"
    | "step"
    | "level_up"
    | "start"
    | "clear";

// BGM Types
export type BgmType =
    | "menu"
    | "study";

// Asset Map
const SE_ASSETS: Record<SoundType, string> = {
    correct: resolveAppAssetPath("/sounds/correct.mp3"),
    incorrect: resolveAppAssetPath("/sounds/incorrect.mp3"),
    tap: resolveAppAssetPath("/sounds/tap.mp3"),
    step: resolveAppAssetPath("/sounds/step.mp3"),
    level_up: resolveAppAssetPath("/sounds/level_up.mp3"),
    start: resolveAppAssetPath("/sounds/start.mp3"),
    clear: resolveAppAssetPath("/sounds/clear.mp3")
};

const BGM_ASSETS: Record<BgmType, string> = {
    menu: resolveAppAssetPath("/sounds/bgm_menu.mp3"),
    study: resolveAppAssetPath("/sounds/bgm_study.mp3")
};

// Cache for Howl instances
const seInstances: Partial<Record<SoundType, Howl>> = {};
const seVolume = (type: SoundType) => type === 'tap' ? 0.24 : type === 'incorrect' ? 0.38 : 0.55;
let currentBgm: Howl | null = null;
let currentBgmType: BgmType | null = null;

// Global settings
// Stay muted until the canonical active profile has been resolved by the route guard.
let isSoundEnabled = false;
Howler.mute(true);

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
                volume: seVolume(key as SoundType),
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
            volume: seVolume(type)
        });
    }

    // Play
    // For SE, we might want overlapping (default) or single instance?
    // Howler default is overlapping, which is good for rapid taps.
    seInstances[type]?.play();
};

/** Short toy bell; uses the shared mute gate and can be stopped on leaving play. */
export const playParkBell = (): (() => void) => {
    if (!isSoundEnabled || !Howler.ctx || !Howler.masterGain) return () => {};
    const context = Howler.ctx;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1046, context.currentTime);
    gain.gain.setValueAtTime(.09, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .4);
    oscillator.connect(gain);
    gain.connect(Howler.masterGain);
    oscillator.start();
    oscillator.stop(context.currentTime + .42);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    return () => { gain.disconnect(); };
};

export const playBgm = (type: BgmType) => {
    if (!isSoundEnabled) return;
    if (currentBgmType === type && currentBgm?.playing()) return;

    // Stop current
    const previousBgm = currentBgm;
    if (previousBgm) {
        previousBgm.fade(0.5, 0, 500);
        window.setTimeout(() => {
            previousBgm.stop();
            previousBgm.unload();
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
        currentBgm.unload();
        currentBgm = null;
        currentBgmType = null;
    }
};
