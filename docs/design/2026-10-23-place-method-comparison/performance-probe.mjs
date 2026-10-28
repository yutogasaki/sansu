import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform } from './curved-grid-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';

const dir = new URL('.', import.meta.url).pathname;
const outfile = '/private/tmp/sansu-performance-probe.mjs';
function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`Performance hook changed: ${before.slice(0, 90)}`);
    return source.replace(before, after);
}
function profileWorld(source) {
    source = `const terrainPerf: unknown[] = [];
export const terrainPerfRead = () => terrainPerf.splice(0);
` + source;
    source = replaceOnce(source, '    if (previous) return previous;', `    if (previous) { terrainPerf.push({kind:'cache-hit', revision}); return previous; }
    const profileStart = performance.now(), phases: {name:string;ms:number}[] = [];
    let profileLast = profileStart;
    const mark = (name:string) => { const at=performance.now(); phases.push({name,ms:at-profileLast}); profileLast=at; };`);
    source = replaceOnce(source, '    const source = original.definition.districts[0], bounds = landBounds(state);',
        "    mark('legacy-world');\n    const source = original.definition.districts[0], bounds = landBounds(state);");
    source = replaceOnce(source, '    const geometry = compileWorldDefinition(definition);',
        "    mark('height-mesh-sites');\n    const geometry = compileWorldDefinition(definition);\n    mark('compile-geometry');");
    source = replaceOnce(source, '    const world = compileWorldDefinition({ ...definition, edges });',
        "    mark('derive-walk-edges');\n    const world = compileWorldDefinition({ ...definition, edges });\n    mark('compile-final-world');");
    source = replaceOnce(source, '    cache.set(revision, world); return world;', `    cache.set(revision, world);
    terrainPerf.push({kind:'cold-build', revision, totalMs:performance.now()-profileStart, phases,
        detail, nx, nz, samples:samples.length, groundTriangles:floor.indices.length/3,
        waterTriangles:water.indices.length/3, sites:sites.length, edges:edges.length});
    return world;`);
    return source;
}
const contents = `
import assert from 'node:assert/strict';
import observed from './evidence/61-H-linear-stable-before-edit.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, terrainPerfRead } from '../../../src/domain/growingIsland/editableTerrainWorld';
const fields=['land','terrain','plots','landmarks','villagers','keepsakes','placeProgress','town','drops','character'];
const state={...newIsland('performance-read-only-fixture',1000),...structuredClone(Object.fromEntries(fields.map(k=>[k,observed[k]])))};
const original=JSON.stringify(state), samples=[];
const measure=(label,fn)=>{terrainPerfRead();const t=performance.now();let status='accepted',error;try{fn();}catch(e){status='rejected';error=String(e);}const elapsedMs=performance.now()-t;const events=terrainPerfRead();samples.push({label,status,error,elapsedMs,builds:events.filter(e=>e.kind==='cold-build'),cacheHits:events.filter(e=>e.kind==='cache-hit').length});};
measure('initial current world cold',()=>editableIslandWorld(state));
measure('initial current world cache hit',()=>editableIslandWorld(structuredClone(state)));
const command={type:'terrain-edit',cell:{x:4,z:4},delta:-1,actors:[{x:4,z:4}]};
for(let i=0;i<3;i++)measure('same actor-guard rejected command '+i,()=>applyIntent(state,{id:'rejected-'+i,command},1000+i));
measure('same candidate accepted without actor snapshot',()=>applyIntent(state,{id:'accepted-warm',command:{...command,actors:[]}},1010));
measure('different candidate actor-guard cold',()=>applyIntent(state,{id:'different-cold',command:{...command,delta:1}},1011));
assert.equal(JSON.stringify(state),original);
console.log(JSON.stringify({samples,unchangedInput:true,scope:'Node CPU diagnostic with actual H + stable + linear transforms; explicit actor at edited4,4 is a test fixture, not browser actor telemetry. No renderer/GPU/DB. Results are not browser frame timing.'}));
`;
await build({ stdin: { contents, resolveDir: dir, sourcefile: 'performance-probe-entry.ts', loader: 'ts' }, outfile,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-H-linear-stable-performance', setup(b) {
        b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: profileWorld(rampPlaneTerrainTransform(stableBaseWorldTransform(
            terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: 'H' }), { alwaysStable: true }), { alwaysLinear: true })) }));
        b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        b.onLoad({ filter: /placeTerrain\.ts$/ }, async a => ({ loader: 'ts', contents: stableBaseTerrainTransform(await readFile(a.path, 'utf8'), { alwaysStable: true }) }));
        b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
    } }],
});
const result = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 }));
const files = ['performance-probe.mjs', 'terrain-transform.mjs', 'stable-base-transform.mjs', 'ramp-plane-transform.mjs',
    'curved-grid-transform.mjs', 'evidence/61-H-linear-stable-before-edit.json'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(dir + file)).digest('hex')])));
const output = { date: new Date().toISOString(), command: 'node docs/design/2026-10-23-place-method-comparison/performance-probe.mjs', hashes, ...result };
await writeFile(dir + 'evidence/performance-probe.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
