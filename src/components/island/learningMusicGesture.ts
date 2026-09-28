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
