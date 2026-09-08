/** Only an unscoped normal practice request belongs to the island planner. */
export function islandStudyDestination(search: string, enabled: boolean): string | undefined {
    if (!enabled) return undefined;
    const params = new URLSearchParams(search);
    const sessions = params.getAll('session');
    if (sessions.some(session => session !== 'normal')) return undefined;
    // Preserve explicit scope, review, return, and diagnostic contracts, including
    // future query parameters, rather than silently dropping their intent.
    if ([...params.keys()].some(key => key !== 'session')) return undefined;
    return '/island?start=learn';
}
