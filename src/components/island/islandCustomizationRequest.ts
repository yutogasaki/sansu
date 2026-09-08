import type { IslandCustomizationAction } from '../../domain/island/customization';
import type { IslandRecord } from '../../domain/island/types';
import { IslandConflict } from '../../domain/island/repository';

export interface IslandCustomizationRequest { revision: number; action: IslandCustomizationAction }

/** A known conflict has no uncertain receipt. Other failures retain the exact
 * request so a lost response cannot charge again after a newer live snapshot. */
export async function executeIslandCustomizationRequest(pending: { current: IslandCustomizationRequest | undefined },
    revision: number, action: IslandCustomizationAction,
    write: (request: IslandCustomizationRequest) => Promise<IslandRecord>) {
    const request = pending.current && JSON.stringify(pending.current.action) === JSON.stringify(action)
        ? pending.current : { revision, action };
    pending.current = request;
    try {
        const updated = await write(request);
        pending.current = undefined;
        return updated;
    } catch (error) {
        if (error instanceof IslandConflict) pending.current = undefined;
        throw error;
    }
}
