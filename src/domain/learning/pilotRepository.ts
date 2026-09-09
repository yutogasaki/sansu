import type { SansuDatabase } from '../../db';
import { hasLegacyMathPromotionEvidence } from '../levelProgression';
import { getSkillsForLevel } from '../math/curriculum';
import { evaluateMathLevel11Pilot, reservedEventsToEvidenceRecords } from './evidence';
import { getMathLevel11Practice } from './unitPractice';

/** Read-only projection for diagnostics and bounded runtime use. No migration. */
export const readMathLevel11Pilot = async (
    database: SansuDatabase,
    profileId: string,
    asOf: string = new Date().toISOString(),
) => database.transaction('r', database.logs, database.parkEvents, database.islandEvents, database.challengeContacts, async () => {
    const [logs, parkEvents, islandEvents, contacts] = await Promise.all([
        database.logs.where('[profileId+subject]').equals([profileId, 'math']).toArray(),
        database.parkEvents.where('profileId').equals(profileId).toArray(),
        database.islandEvents.where('profileId').equals(profileId).toArray(),
        database.challengeContacts.where('profileId').equals(profileId).toArray(),
    ]);
    const records = [
        ...logs,
        ...contacts.map(contact => ({ id: `challenge-contact:${contact.itemId}`, profileId, subject: 'math' as const, itemId: contact.itemId, timestamp: contact.uncertain ? asOf : contact.latestAt, result: 'contact' as const, contactUncertain: contact.uncertain })),
        ...reservedEventsToEvidenceRecords(parkEvents.map((event) => ({ ...event, id: `park:${event.id}` }))),
        ...reservedEventsToEvidenceRecords(islandEvents.map((event) => ({ ...event, id: `island:${event.id}` }))),
    ];
    const skills = getSkillsForLevel(11);
    const evaluation = evaluateMathLevel11Pilot(records, profileId, asOf);
    return {
        // This is the evidence portion of the old condition, not a prediction
        // that the profile's enabled/main/max policy would actually promote it.
        legacyLevel11Evidence: hasLegacyMathPromotionEvidence(logs.filter((log) => skills.includes(log.itemId)
            && Date.parse(log.timestamp) <= Date.parse(asOf))),
        evaluation,
        practice: getMathLevel11Practice(evaluation),
    };
});
