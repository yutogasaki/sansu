/** Explicit composition experiment. Never reinterpret the previous saved worlds. */
export function assemblyEnabled(): boolean {
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (!query.has('assemblyTrial')) return false;
    if (query.get('assemblyTrial') !== 'bay' || query.get('placeSetTrial') !== 'two'
        || query.get('terrainTrial') !== 'H' || query.get('trialScene') !== 'shore'
        || (query.has('coastSetTrial') && query.get('coastSetTrial') !== 'two')
        || (query.has('trialSave') && query.get('trialSave') !== 'assembly-local') || (query.has('shoreTrial') && query.get('shoreTrial') !== 'off')
        || (query.has('shoulderTrial') && query.get('shoulderTrial') !== 'off'))
        throw Error('湾と高台の構成比較は、専用の比較URLで開いてください。');
    return true;
}
export const ASSEMBLY_RECIPE = 'platforms-then-protected-bay-memory-v1';

export function coastSetEnabled(): boolean {
    const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (!q.has('coastSetTrial')) return false;
    if (q.get('coastSetTrial') !== 'two' || !assemblyEnabled()) throw Error('二つの湾の比較専用URLで開いてください。');
    return true;
}
export const MULTI_BAY_RECIPE = 'platforms-then-independent-two-bays-v1';

/** REJECTED experiment: monotonic reachability over-constrains lawful undo.
 * Kept behind an explicit flag only to reproduce the counterexample. Not adopted. */
export function connectivityGuardEnabled(): boolean {
    const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (!q.has('connectivityTrial')) return false;
    if (q.get('connectivityTrial') !== 'guarded' || !coastSetEnabled())
        throw Error('道を守る比較は、二つの湾の専用URLで開いてください。');
    return true;
}
