export interface LearningMusicGesture {
    result: Promise<boolean>;
    cancel: () => void;
}

type Listener = (enabled: boolean) => LearningMusicGesture | undefined;
const listeners = new Set<Listener>();

/** The header and learning panel have separate audio owners. Forward the actual
 * gesture synchronously, before saving the profile can consume user activation. */
export function subscribeLearningMusicGesture(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function beginLearningMusicGesture(enabled: boolean) {
    const attempts = [...listeners].map(listener => listener(enabled)).filter((value): value is LearningMusicGesture => Boolean(value));
    return {
        // No mounted math panel is not an audio failure (e.g. island or words).
        result: Promise.all(attempts.map(attempt => attempt.result)).then(results => results.every(Boolean)),
        cancel: () => { attempts.forEach(attempt => attempt.cancel()); },
    };
}


type Playback = 'inactive' | 'locked' | 'ready';
const playbackOwners = new Map<symbol, Playback>();
const playbackListeners = new Set<() => void>();
export const getLearningMusicReady = () => [...playbackOwners.values()].every(state => state !== 'locked');
export const subscribeLearningMusicPlayback = (listener: () => void) => {
    playbackListeners.add(listener);
    return () => { playbackListeners.delete(listener); };
};

/** A separate music context may be suspended even when the UI-sound context is
 * ready. The header must reflect both; vocabulary has no required music owner. */
export function registerLearningMusicPlayback() {
    const id = Symbol('learning music');
    const update = (state?: Playback) => {
        const before = getLearningMusicReady();
        if (state === undefined) playbackOwners.delete(id); else playbackOwners.set(id, state);
        if (before !== getLearningMusicReady()) playbackListeners.forEach(listener => listener());
    };
    return { set: (state: Playback) => update(state), remove: () => update() };
}
