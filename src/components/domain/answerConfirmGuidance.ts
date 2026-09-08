import { useSyncExternalStore } from 'react';

// Device-local gesture guidance, never learning/profile evidence. Storage can be
// unavailable; in that case remembering it for this launch still works.
const storageKey = 'sansu_answer_confirmation_demonstrated_v1';
function readDemonstrated() {
    try { return localStorage.getItem(storageKey) === '1'; }
    catch { return false; }
}
let demonstrated = readDemonstrated();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export function acknowledgeAnswerConfirmation() {
    if (demonstrated) return;
    demonstrated = true;
    try { localStorage.setItem(storageKey, '1'); }
    catch { /* Optional guidance must never interrupt answering. */ }
    listeners.forEach(listener => listener());
}

export const useAnswerConfirmationDemonstrated = () => useSyncExternalStore(subscribe, () => demonstrated, () => false);
