/** Local diagnostics only: one latest duration per phase, never saved or sent. */
export function startLifeTiming(phase: string) {
    const start = performance.now();
    return () => {
        const name = `sansu-life:${phase}`;
        performance.clearMeasures(name);
        performance.measure(name, { start, end: performance.now() });
    };
}

export function timeLifeWork<T>(phase: string, work: () => T): T {
    const finish = startLifeTiming(phase);
    try { return work(); } finally { finish(); }
}
