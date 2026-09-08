import type { SansuDatabase } from '../../db';
import { hasMathPromotionEvidence } from '../levelProgression';
import { getSkillsForLevel } from '../math/curriculum';
import { evaluateMathLevel11Pilot, reservedEventsToEvidenceRecords } from './evidence';

/** Explicit diagnostic read. No background work, profile writes or migration. */
export const readMathLevel11Pilot = async (
    database: SansuDatabase,
    profileId: string,
    asOf: string = new Date().toISOString(),
) => database.transaction('r', database.logs, database.parkEvents, database.islandEvents, async () => {
    const [logs, parkEvents, islandEvents] = await Promise.all([
        database.logs.where('[profileId+subject]').equals([profileId, 'math']).toArray(),
        database.parkEvents.where('profileId').equals(profileId).toArray(),
        database.islandEvents.where('profileId').equals(profileId).toArray(),
    ]);
    const records = [
        ...logs,
        ...reservedEventsToEvidenceRecords(parkEvents.map((event) => ({ ...event, id: `park:${event.id}` }))),
        ...reservedEventsToEvidenceRecords(islandEvents.map((event) => ({ ...event, id: `island:${event.id}` }))),
    ];
    const skills = getSkillsForLevel(11);
    return {
        // This is the evidence portion of the old condition, not a prediction
        // that the profile's enabled/main/max policy would actually promote it.
        legacyLevel11Evidence: hasMathPromotionEvidence(logs.filter((log) => skills.includes(log.itemId)
            && Date.parse(log.timestamp) <= Date.parse(asOf))),
        evaluation: evaluateMathLevel11Pilot(records, profileId, asOf),
    };
});
