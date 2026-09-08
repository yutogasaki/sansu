import { canonicalIslandExperienceAction, IslandExperienceConflict, type IslandExperienceAction } from '../../domain/island/experience';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';

export interface IslandExperienceRequest { revision: number; action: IslandExperienceAction }
export class IslandExperiencePendingConflict extends Error {
    constructor() { super('さきの そうさを たしかめてから、つぎを ためそう。'); this.name = 'IslandExperiencePendingConflict'; }
}

/** An uncertain response must retry the original receipt, even after a newer
 * island arrives. A confirmed conflict may rebase the next deliberate attempt. */
export async function executeIslandExperienceRequest(pending: { current: IslandExperienceRequest | undefined },
    revision: number, action: IslandExperienceAction,
    write: (request: IslandExperienceRequest) => Promise<IslandRecord>) {
    const intent = canonicalIslandExperienceAction(action);
    if (pending.current && JSON.stringify(pending.current.action) !== JSON.stringify(intent)) throw new IslandExperiencePendingConflict();
    const request = pending.current ?? Object.freeze({ revision, action: Object.freeze({ ...intent }) });
    pending.current = request;
    try {
        const updated = await write(request);
        if (pending.current === request) pending.current = undefined;
        return updated;
    } catch (error) {
        if ((error instanceof IslandConflict || error instanceof IslandExperienceConflict) && pending.current === request) pending.current = undefined;
        throw error;
    }
}
