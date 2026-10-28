import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
const files = ['growth-seam-guard-check.ts', 'growth-seam-guard-check.mjs', 'growth-seam-transform.mjs', 'growth-seam.ts', 'evidence/33-F2-used-state.json'];
const inputHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
for (const mode of ['A', 'F']) {
    const outfile = `/private/tmp/sansu-growth-seam-guard-${mode}.mjs`;
    await build({ entryPoints: [`${folder}/growth-seam-guard-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', GROWTH_DIAGNOSTIC_MODE: JSON.stringify(mode) }, logLevel: 'silent',
        plugins: [{ name: 'guard-fault-injection', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            b.onLoad({ filter: /commands\.ts$/ }, async a => {
                const source = growthSeamCommandTransform(await readFile(a.path, 'utf8'), { alwaysInherit: true });
                const needle = 'if (seamBefore) inheritGrowthBoundary(seamBefore, state);';
                if (source.split(needle).length !== 2) throw Error('Fault injection source mismatch');
                return { loader: 'ts', contents: source.replace(needle, 'void seamBefore; // Diagnostic: omit inheritance but retain final guard') };
            });
        } }],
    });
    const result = { ...JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 120_000 })),
        date: new Date().toISOString(), inputHashes, command: `fnm exec --using=22.23.3 node ${folder}/growth-seam-guard-check.mjs` };
    await writeFile(`/private/tmp/sansu-growth-seam-guard-${mode}.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
