/** A visual rollout only. Economic and migration rules remain explicitly separate. */
export const FANTASY_CANDIDATE = 'living-fantasy-garden-v2';
export const fantasyEnabled = () => import.meta.env.VITE_ISLAND_FANTASY_ENABLED === 'true';
import type { GardenTime } from '../../../../domain/islandLife/model';
export type { GardenTime } from '../../../../domain/islandLife/model';
/** Device-local scenery only; never used as a growth or reward clock. */
export function gardenTimeAt(now = new Date()): GardenTime {
    const hour = now.getHours();
    if (hour < 5 || hour >= 19) return 'night';
    if (hour < 10) return 'morning';
    if (hour < 16) return 'day';
    return 'dusk';
}
