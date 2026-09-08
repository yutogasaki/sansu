import { IslandConflict } from '../../domain/island/repository';
import { canonicalIslandWorkshopAction, IslandWorkshopConflict, type IslandWorkshopAction } from '../../domain/island/workshop';
import { WorkshopLayoutConflict } from '../../domain/island/workshopLayout';
import type { IslandRecord } from '../../domain/island/types';

export interface IslandWorkshopRequest { revision: number; action: IslandWorkshopAction }

/** Replaying an uncertain undo/save must use its original receipt, even if the
 * live query has already received the result whose response was lost. */
export async function executeIslandWorkshopRequest(pending: { current: IslandWorkshopRequest | undefined },
    revision: number, action: IslandWorkshopAction,
    write: (request: IslandWorkshopRequest) => Promise<IslandRecord>) {
    const intent = canonicalIslandWorkshopAction(action);
    const request = pending.current && JSON.stringify(pending.current.action) === JSON.stringify(intent)
        ? pending.current : { revision, action: structuredClone(intent) };
    pending.current = request;
    try {
        const updated = await write(request);
        pending.current = undefined;
        return updated;
    } catch (error) {
        if (error instanceof IslandConflict || error instanceof IslandWorkshopConflict || error instanceof WorkshopLayoutConflict) pending.current = undefined;
        throw error;
    }
}
