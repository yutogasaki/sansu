// CPU diagnostic for the unchanged growth formula; not page-opening latency.
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] } });
try {
    const { effectiveGrowthHours, GROWTH_WINDOW_MS } = await server.ssrLoadModule('/src/domain/islandLife/economyRules.ts');
    function previous(times, from, to) {
        if (![from, to, ...times].every(Number.isFinite) || to < from) throw Error('Invalid growth interval');
        const b = [...new Set([from, to, ...times.flatMap(t => [t, t + GROWTH_WINDOW_MS]).filter(t => t > from && t < to)])].sort((a, b) => a - b);
        return b.slice(1).reduce((total, end, i) => total + (end - b[i]) / 3600000 * (.5 + .5 * Math.min(times.filter(t => t <= b[i] && t > b[i] - GROWTH_WINDOW_MS).length / 6, 1)), 0);
    }
    const results = [];
    for (const count of [0, 6, 100]) {
        const times = Array.from({ length: count }, (_, i) => i * 3600000 / 100), n = 100000;
        const run = fn => { let sum = 0; const start = performance.now(); for (let i = 0; i < n; i++) sum += fn(times, i * 7000, (i + 1) * 7000); return { ms: performance.now() - start, sum }; };
        run(previous); run(effectiveGrowthHours);
        const before = run(previous), after = run(effectiveGrowthHours);
        assert.equal(after.sum, before.sum);
        results.push({ credits: count, intervals: n, before, after });
    }
    const report = { scope: 'Synthetic CPU growth integration only; exact accumulated result equality; single local run, no timing assertion', results };
    console.log(JSON.stringify(report));
    if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
} finally { await server.close(); }
