import { HOUR, type LifeRecord } from '../islandLife/model';
import { restoreLifeSnapshot } from '../islandLife/replaySnapshot';
import { replayLife } from '../islandLife/simulation';

/** Read-only cutover: use the same clock and verified cache as a normal Life opening. */
export async function replayLifeForMigration(record: LifeRecord, realNow: number) {
    await restoreLifeSnapshot(record);
    const elapsed = Math.max(0, Math.min(7 * 24 * HOUR, realNow - record.realAt));
    return replayLife(record, record.now + elapsed);
}
