import type { SansuDatabase } from '../../db';
import type { UserProfile } from '../types';
import { readMathLevel11Pilot } from './pilotRepository';

/** Read event history only when the current or eligible adjacent range uses Lv11. */
export async function readRuntimeMathUnitPractice(
    database: SansuDatabase,
    profile: UserProfile,
    asOf: string,
) {
    if (profile.mathMainLevel !== 11
        && !(profile.mathMainLevel === 10 && profile.mathMaxUnlocked >= 11)) return undefined;
    return (await readMathLevel11Pilot(database, profile.id, asOf)).practice;
}
