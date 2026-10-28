import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { kokugoActivity } from '../../domain/stats/kokugoActivity';
import type { KokugoCourse, KokugoProgress, KokugoEvent, KokugoWork } from '../../domain/kokugo/types';

export function useKokugoOverview(profileId?: string) {
    const result = useLiveQuery(async () => {
        if (!profileId) return undefined;
        try {
            const [course, progress, events, works] = await Promise.all([
                db.kokugoCourses.get(profileId), db.kokugoProgress.where('profileId').equals(profileId).toArray(),
                db.kokugoEvents.where('profileId').equals(profileId).toArray(), db.kokugoWorks.where('profileId').equals(profileId).toArray(),
            ]);
            return { profileId, course, progress, events, works, activities: kokugoActivity(events, works), error: false };
        } catch {
            return { profileId, course: undefined as KokugoCourse | undefined, progress: [] as KokugoProgress[], events: [] as KokugoEvent[],
                works: [] as KokugoWork[], activities: [], error: true };
        }
    }, [profileId]);
    return result?.profileId === profileId ? result : undefined;
}
