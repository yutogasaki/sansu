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

export type SoundPlaybackStatus = 'off' | 'ready' | 'blocked';
const soundListeners = new Set<() => void>();
let observedContext: AudioContext | null = null;
let playbackFailed = false;
const notifySound = () => soundListeners.forEach(listener => listener());
const observeAudioContext = () => {
    if (observedContext === Howler.ctx) return;
    observedContext?.removeEventListener('statechange', notifySound);
    observedContext = Howler.ctx;
    observedContext?.addEventListener('statechange', notifySound);
};

export const getSoundPlaybackStatus = (): SoundPlaybackStatus => !isSoundEnabled ? 'off'
    : playbackFailed || Howler.noAudio || (Howler.usingWebAudio && Howler.ctx?.state !== 'running') ? 'blocked' : 'ready';

export const subscribeSoundPlayback = (listener: () => void) => {
    observeAudioContext();
    soundListeners.add(listener);
    return () => { soundListeners.delete(listener); };
};
const soundPlayed = () => { playbackFailed = false; notifySound(); };
const soundFailed = () => { playbackFailed = true; notifySound(); };

export const setSoundEnabled = (enabled: boolean) => {
    isSoundEnabled = enabled;
    Howler.mute(!enabled);
    observeAudioContext();
    notifySound();
};

export const loadSounds = () => {
    // Preload SE
    Object.entries(SE_ASSETS).forEach(([key, src]) => {
        if (!seInstances[key as SoundType]) {
            seInstances[key as SoundType] = new Howl({
                src: [src],
                volume: seVolume(key as SoundType),
                preload: true,
                onplay: soundPlayed,
                onplayerror: soundFailed,
                onloaderror: soundFailed,
            });
        }
    });
    observeAudioContext();
};

export const playSound = (type: SoundType) => {
    if (!isSoundEnabled) return;

    // Load on demand if not preloaded
    if (!seInstances[type]) {
        seInstances[type] = new Howl({
            src: [SE_ASSETS[type]],
            volume: seVolume(type),
            onplay: soundPlayed,
            onplayerror: soundFailed,
            onloaderror: soundFailed,
        });
    }

    // Play
    // For SE, we might want overlapping (default) or single instance?
    // Howler default is overlapping, which is good for rapid taps.
    seInstances[type]?.play();
};

/** Call directly from a click, before awaiting persistence. A separate, cancellable
 * cue cannot remain queued and play later after leaving the screen. */
export const enableSoundFromGesture = (): { result: Promise<boolean>; cancel: () => void } => {
    playbackFailed = true;
    setSoundEnabled(true);
    let cue: Howl | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let started = false;
    let context: AudioContext | null = null;
    let resolveResult: (playing: boolean) => void = () => {};
    const result = new Promise<boolean>(resolve => { resolveResult = resolve; });
    const finish = (playing: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        context?.removeEventListener('statechange', confirmPlaying);
        if (playing) soundPlayed();
        else { cue?.unload(); soundFailed(); }
        resolveResult(playing);
    };
    const confirmPlaying = () => {
        if (!isSoundEnabled) finish(false);
        else if (started && (!Howler.usingWebAudio || context?.state === 'running')) finish(true);
    };
    const cancel = () => {
        clearTimeout(timer);
        context?.removeEventListener('statechange', confirmPlaying);
        cue?.unload();
        if (!settled) { settled = true; resolveResult(false); }
    };
    try {
        cue = new Howl({ src: [SE_ASSETS.correct], volume: seVolume('correct'),
            onplay: () => { started = true; confirmPlaying(); },
            onplayerror: () => finish(false), onloaderror: () => finish(false),
            onend: () => { cue?.unload(); },
        });
        observeAudioContext();
        context = Howler.ctx;
        context?.addEventListener('statechange', confirmPlaying);
        timer = setTimeout(() => finish(false), 1500);
        // Explicit resume also covers an interrupted context after backgrounding.
        // Keep HTML5 fallback play() on the gesture's stack as well.
        if (Howler.usingWebAudio && Howler.ctx?.state !== 'running') {
            void Howler.ctx.resume().catch(() => finish(false));
        }
        cue.play();
    } catch { finish(false); }
    return { result, cancel };
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
