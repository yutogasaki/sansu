/** Trial query is a page-start input. Candidate/scene links perform a full page
 * load; changing search via history within a running page is not supported.
 * Keep the parser pure for Node fixtures and preserve URLSearchParams semantics
 * (first duplicate value, percent decoding, empty values, absent => null). */
export function parseTrialQuery(search: string) {
    const params = new URLSearchParams(search);
    const values = new Map<string, string>();
    for (const [name, value] of params) if (!values.has(name)) values.set(name, value);
    return Object.freeze({
        get: (name: string): string | null => values.get(name) ?? null,
        has: (name: string): boolean => values.has(name),
    });
}

export const frozenTrialSearch = typeof window === 'undefined' ? '' : window.location.search;
export const frozenTrialQuery = parseTrialQuery(frozenTrialSearch);
export const frozenTrialEnabled = frozenTrialQuery.get('queryTrial') === 'frozen';

/** The baseline still reads location and constructs URLSearchParams every call.
 * Its only extra work is this function call and the immutable boolean branch. */
export function trialQuery() {
    return frozenTrialEnabled ? frozenTrialQuery
        : new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}
