import type { IslandScreen } from './navigation';
export const TUTORIAL_IDS = ['view', 'growth', 'play', 'customization', 'discovery', 'photo', 'placement'] as const;
export type TutorialId = typeof TUTORIAL_IDS[number];
export type TutorialEvent = 'shown' | 'practiced' | 'dismissed';
const PREFIX = 'pokomoko:tutorial:v1:';
// Separate monotonic keys avoid cross-tab read/modify/write races.
const memory = new Set<string>();
export const tutorialKey = (profile: string, id: TutorialId, event: TutorialEvent) => `${PREFIX}${encodeURIComponent(profile)}:${id}:${event}`;
export function hasTutorialEvent(profile: string, id: TutorialId, event: TutorialEvent) {
    const key = tutorialKey(profile, id, event);
    if (memory.has(key)) return true;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
export function recordTutorialEvent(profile: string, id: TutorialId, event: TutorialEvent) {
    const key = tutorialKey(profile, id, event);
    memory.add(key);
    try { localStorage.setItem(key, '1'); } catch { /* Help never blocks learning on storage failure. */ }
}
export function tutorialWasSeen(profile: string, id: TutorialId) {
    return (['shown', 'practiced', 'dismissed'] as const).some(event => hasTutorialEvent(profile, id, event));
}
export function clearTutorialMemory() { memory.clear(); }
export function nextTutorial(screen: IslandScreen, eligible: boolean, grown: boolean, canView: boolean, seen: (id: TutorialId) => boolean): TutorialId | undefined {
    if (!eligible) return;
    const candidates: TutorialId[] = screen === 'home' ? [...(grown ? ['growth' as const] : []), ...(canView ? ['view' as const] : [])]
        : screen === 'play' ? ['play'] : screen === 'customization' ? ['customization'] : [];
    return candidates.find(id => !seen(id));
}

export function clearProfileTutorial(profile: string) {
    for (const id of TUTORIAL_IDS) for (const event of ['shown', 'practiced', 'dismissed'] as const) {
        const key = tutorialKey(profile, id, event); memory.delete(key);
        try { localStorage.removeItem(key); } catch { /* Best effort alongside existing local storage cleanup. */ }
    }
}
