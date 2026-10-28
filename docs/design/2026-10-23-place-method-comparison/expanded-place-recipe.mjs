import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const files = ['expanded-place-recipe.ts','expanded-place-recipe.mjs','ramp-plane-field.ts','stable-base-field.ts','terrain-transform.mjs','evidence/60-H-linear-stable-placed-state.json'];
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(dir+f)).digest('hex')])));
const results=[];
const flatFlower=process.argv.includes('--flat-flower');
const wideShore=process.argv.includes('--wide-shore');
const suffix=(flatFlower?'-flower-flat':'')+(wideShore?'-wide':'');
for(const mode of ['H','F']) {
 const linear=true,stable=true,outfile=`/private/tmp/sansu-expanded-place-recipe-${mode}.mjs`;
    await build({ entryPoints: [`${dir}expanded-place-recipe.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', RECIPE_MODE: JSON.stringify(mode), FLAT_FLOWER:String(flatFlower), WIDE_SHORE:String(wideShore) }, logLevel: 'silent', plugins: [{ name: 'independent-ramp-basis', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode });
                if (stable) source = stableBaseWorldTransform(source, { alwaysStable: true });
                if (linear) source = rampPlaneTerrainTransform(source, { alwaysLinear: true });
                return { loader: 'ts', contents: source };
            });
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            if (stable) b.onLoad({ filter: /domain\/growingIsland\/placeTerrain\.ts$/ }, async a => ({ loader: 'ts', contents: stableBaseTerrainTransform(await readFile(a.path, 'utf8'), { alwaysStable: true }) }));
            if (mode === 'H') {
                b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
                b.onLoad({ filter: /growing\/worldScene\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridWorldSceneTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
            }
        } }],
    });

 const result=JSON.parse(execFileSync(process.execPath,[outfile],{encoding:'utf8',timeout:300_000,maxBuffer:8*1024*1024}));
 results.push(result);
 console.log(JSON.stringify({mode,status:result.status,commands:result.commands,stages:result.stages,owners:result.owners}));
}
await writeFile(dir+`evidence/expanded-place-recipe${suffix}.json`,JSON.stringify({date:new Date().toISOString(),hashes,command:'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/expanded-place-recipe.mjs'+(flatFlower?' --flat-flower':'')+(wideShore?' --wide-shore':''),results},null,2));
await writeFile(dir+`evidence/expanded-place-recipe${suffix}-fixture.json`,JSON.stringify({state:results[0].state,source:'60-H-linear-stable-placed-state.json',commands:results[0].commands,status:'DIAGNOSTIC_NO_BROWSER_SAVE_PROOF',hashes},null,2));
