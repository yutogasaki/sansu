import { canonicalIslandCustomizationAction, IslandCustomizationConflict, type IslandCustomizationAction } from '../../domain/island/customization';
import type { IslandRecord } from '../../domain/island/types';
import { IslandConflict } from '../../domain/island/repository';

export interface IslandCustomizationRequest { revision: number; action: IslandCustomizationAction }
export class IslandCustomizationPending extends Error {}

/** A known conflict has no uncertain receipt. Other failures retain the exact
 * request so a lost response cannot charge again after a newer live snapshot. */
export async function executeIslandCustomizationRequest(pending: { current: IslandCustomizationRequest | undefined },
    revision: number, action: IslandCustomizationAction,
    write: (request: IslandCustomizationRequest) => Promise<IslandRecord>) {
    const intent = canonicalIslandCustomizationAction(action);
    if (pending.current && JSON.stringify(pending.current.action) !== JSON.stringify(intent)) {
        throw new IslandCustomizationPending('さきの そうさの けっかを たしかめよう。');
    }
    const request = pending.current ?? { revision, action: Object.freeze(intent) };
    pending.current = request;
    try {
        const updated = await write(request);
        if (pending.current === request) pending.current = undefined;
        return updated;
    } catch (error) {
        if (pending.current === request && (error instanceof IslandConflict || error instanceof IslandCustomizationConflict)) pending.current = undefined;
        throw error;
    }
}
