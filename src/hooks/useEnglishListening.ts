import { useCallback, useState } from 'react';
import type { LevelState, Problem } from '../domain/types';
import { completeListeningAnswer, emptyListeningSession } from '../domain/english/listening';
import { ENGLISH_WORDS } from '../domain/english/words';

export function useEnglishListening(sessionKey: string, enabled: boolean, levels: readonly LevelState[], currentProblem?: Problem) {
    const [session, setSession] = useState(() => ({ key: sessionKey, enabled, value: emptyListeningSession() }));
    if (session.key !== sessionKey || session.enabled !== enabled) {
        setSession({ key: sessionKey, enabled, value: emptyListeningSession() });
    }
    const record = useCallback((problem: Problem, boundary: boolean) => {
        if (!enabled) return;
        setSession(current => current.key !== sessionKey || !current.enabled ? current
            : { ...current, value: completeListeningAnswer(current.value, problem, boundary, levels) });
    }, [enabled, levels, sessionKey]);
    const open = useCallback(() => setSession(current => ({ ...current, value: { ...current.value, open: true } })), []);
    const close = useCallback(() => setSession(current => ({ ...current, value: { ...current.value, open: false, sentence: undefined } })), []);
    const candidate = session.value.sentence;
    const level = candidate && ENGLISH_WORDS.find(word => word.id === candidate.wordId)?.level;
    const sentence = enabled && candidate && levels.some(item => item.level === level && item.enabled && item.unlocked)
        && !(currentProblem?.subject === 'vocab' && currentProblem.categoryId === candidate.wordId) ? candidate : undefined;
    return { sentence, isOpen: Boolean(sentence && session.value.open), record, open, close };
}
