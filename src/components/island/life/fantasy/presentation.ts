/** A visual rollout only. Economic and migration rules remain explicitly separate. */
export const FANTASY_CANDIDATE = 'living-fantasy-garden-v2';
export const fantasyEnabled = () => import.meta.env.VITE_ISLAND_FANTASY_ENABLED === 'true';
import type { GardenTime } from '../../../../domain/islandLife/model';
export type { GardenTime } from '../../../../domain/islandLife/model';
export const gardenTimes: { id: GardenTime; label: string }[] = [
    { id: 'day', label: 'ひる' }, { id: 'dusk', label: '夕ぐれ' }, { id: 'night', label: 'よる' },
];
export function readGardenTime(profileId?: string): GardenTime {
    if (!profileId) return 'day';
    try {
        const saved = localStorage.getItem(`sansu:garden-time:${profileId}`);
        return saved === 'dusk' || saved === 'night' ? saved : 'day';
    } catch { return 'day'; }
}
export function saveGardenTime(profileId: string | undefined, value: GardenTime) {
    if (!profileId) return;
    try { localStorage.setItem(`sansu:garden-time:${profileId}`, value); } catch { /* Viewing still works without storage. */ }
}
