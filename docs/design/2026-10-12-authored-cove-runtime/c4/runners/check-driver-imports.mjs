// Read-only closure audit: no browser, server, snapshot, or core command.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from '/Users/yutogasaki/Projects/sansu/node_modules/esbuild/lib/main.js';
const repo = process.env.SANSU_CLOSURE_REPO ?? '/Users/yutogasaki/Projects/sansu';
const out = process.env.SANSU_CLOSURE_OUT ?? '/private/tmp/sansu-authored-cove-c4-prep';
process.chdir(repo);
const inventory = JSON.parse(await fs.readFile(`${out}/inputs.json`, 'utf8'));
const sourceDirectory = 'docs/design/2026-10-12-authored-cove-entrance';
const driver = await fs.readFile('tools/e2e-authored-cove.mjs', 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const begin = driver.indexOf('const walk = async directory =>');
const end = driver.indexOf('await fs.mkdir(output, { recursive: false });', begin);
if (begin < 0 || end <= begin) throw Error('Driver source collector boundaries changed');
const collector = driver.slice(begin, end);
// The selected collector defines only recursive fs reads/import resolution.
if (/chromium|launch\(|writeFile|mkdir|unlink|rm\(/.test(collector)) throw Error('Driver collector gained side effects');
const collect = new Function('fs', 'path', 'sha', 'sourceDirectory', `${collector}\nreturn inputs();`);
const driverInputs = await collect(fs, path, sha, sourceDirectory);
const driverMissing = Object.keys(driverInputs).filter(file => !inventory[file]);
const driverChanged = Object.keys(driverInputs).filter(file => inventory[file] && inventory[file] !== driverInputs[file]);
// Mirror the driver's pure domain projection bundle, retaining only the input
// names. write:false avoids touching source or candidate files.
const compiled = await build({ stdin: { contents: `
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts';
export { canPlace } from './src/domain/growingIsland/commands.ts';
export { landCells, reachableFromHome, isReachable } from './src/domain/growingIsland/space.ts';
`, resolveDir: repo }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', metafile: true });
const domainInputs = Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>').sort();
const domainMissing = domainInputs.filter(file => !inventory[file]);
const report = { mode: 'read-only prospective closure audit; not runtime/core verification', driverSha256: sha(driver),
  driverInputCount: Object.keys(driverInputs).length, driverMissing, driverChanged,
  domainInputCount: domainInputs.length, domainMissing,
  pass: !driverMissing.length && !driverChanged.length && !domainMissing.length };
await fs.writeFile(`${out}/driver-inputs.json`, JSON.stringify(driverInputs, null, 2) + '\n');
await fs.writeFile(`${out}/driver-inputs.txt`, Object.keys(driverInputs).sort().join('\n') + '\n');
await fs.writeFile(`${out}/domain-inputs.txt`, domainInputs.join('\n') + '\n');
await fs.writeFile(`${out}/import-audit.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
