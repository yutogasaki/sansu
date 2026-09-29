import { useSyncExternalStore } from 'react';

/** Seeds waiting to grow, shown on the learn tab as 🌱n (spec 52 §10.3). Never a problem count. */
let waiting = 0;
const listeners = new Set<() => void>();

export function publishWaitingSeeds(count: number) {
    if (count === waiting) return;
    waiting = count; listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useWaitingSeeds() {
    return useSyncExternalStore(subscribe, () => waiting, () => 0);
}
