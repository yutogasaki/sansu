// CPU-only synthetic replay diagnostic. Does not read or write user databases.
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] } });
try {
    const { newLife, HOUR } = await server.ssrLoadModule('/src/domain/islandLife/model.ts');
    const { replayLife, advanceLifeState } = await server.ssrLoadModule('/src/domain/islandLife/simulation.ts');
    const { enableCadence } = await server.ssrLoadModule('/src/domain/islandLife/cadence.ts');
    const results = [];
    for (const hours of [1, 24, 168]) {
        const state = replayLife(newLife('performance-fixture', 100));
        state.placementVersion = 1; state.tourVersion = 1;
        state.residents.forEach(r => { r.visit = undefined; });
        state.items = [['flower', 0, 3], ['bench', 1, 3], ['lantern', 4, 2], ['flower', 0, 1], ['swing', 4, 4], ['flower', 2, 4]]
            .map(([kind, x, z], i) => ({ id: `fixture-${i}`, kind, cell: { x, z }, growth: 6, style: 'original' }));
        enableCadence(state);
        const start = performance.now(); advanceLifeState(state, state.now + hours * HOUR);
        const result = { hours, ms: performance.now() - start, stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex') };
        results.push(result); console.log(JSON.stringify(result));
    }
    if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify({ scope: 'synthetic CPU replay; not actual phone or user save', results }, null, 2) + '\n');
} finally { await server.close(); }
