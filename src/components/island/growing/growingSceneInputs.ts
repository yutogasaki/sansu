import type { Cell, GrowingState } from '../../../domain/growingIsland/types';
import type { Ghost } from './objectLayer';

/** Keep undefined fields and value types distinct, including in future state fields.
 * Object and array order remain intact; a different order may conservatively rebuild.
 * These inputs contain plain saved data, never runtime Three objects or functions.
 */
function literalValue(value: unknown): unknown {
    if (value === null) return ['null'];
    if (Array.isArray(value)) return ['array', value.map(literalValue)];
    if (typeof value === 'object') return ['object', Object.entries(value).map(([name, child]) => [name, literalValue(child)])];
    if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
    if (typeof value === 'undefined') return ['undefined'];
    return [typeof value, value];
}

/** Receipt bookkeeping cannot change owners, places, routes or actor presentation.
 * Include every other state field by default, rather than maintaining a visual whitelist.
 * The literal string is compared directly, with no lossy hash or numeric digest.
 */
export function growingSceneStateKey(state: GrowingState): string {
    const fields = Object.entries(state).filter(([name]) => name !== 'applied' && name !== 'placeProgress' && name !== 'experience');
    return JSON.stringify(literalValue(fields));
}

/** A fresh but equivalent preview object should not recreate its GPU resources. */
export function growingScenePreviewKey(ghost?: Ghost, selectedId?: string, hints?: readonly Cell[]): string {
    return JSON.stringify(literalValue([ghost, selectedId, hints]));
}
