// Design data diagnostic. No browser, IndexedDB, player save or app source writes.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../..');
const source = `
import { newIsland } from './src/domain/growingIsland/island.ts';
import { landCells, onLand, isHouseCell, reachableFromHome, isReachable, key } from './src/domain/growingIsland/space.ts';
import { foodSupport, housing } from './src/domain/growingIsland/community.ts';
import { waterLayout, waterAt } from './src/domain/growingIsland/environment.ts';
import { connectedWaterChannels } from './src/domain/islandLife/waterChannels.ts';
import { derivePlaces } from './src/domain/growingIsland/places.ts';
import { SEED_PRICE, LANDMARK_PRICE } from './src/domain/growingIsland/rules.ts';
export function probe(data) {
 const reports = [];
 for (const layout of data.layouts) {
  const state = newIsland('design-only', 0);
  state.land = structuredClone(data.land); state.town = { clock: data.clock.town, bank: 0 };
  state.nature.hours = data.clock.nature; state.landmarks = []; state.plots = [];
  const occupied = new Set(); const owners = [];
  for (const group of data.groups) {
   if (layout.cells[group.prefix]?.length !== group.count) throw new Error(layout.id + ': count ' + group.prefix);
   layout.cells[group.prefix].forEach(([x,z], i) => {
    const id = group.prefix + (i+1), cell = {x,z};
    if (!onLand(state,cell) || isHouseCell(cell) || occupied.has(key(cell))) throw new Error(layout.id + ': cell ' + id);
    occupied.add(key(cell)); owners.push({id,kind:group.kind,cell});
    if (group.kind === 'home' || group.kind === 'farm') state.plots.push({id,kind:group.kind,cell,stage:group.stage,plantedAt:0,builtAt:6,stagedAt:30,style:'plain',growth:0,paid:40});
    else state.landmarks.push({id,kind:group.kind,cell,growth:group.growth ?? 0,
      ...(group.kind === 'sapling' ? {maturedAt:i < 4 ? 500 : 980} : {}),
      ...(group.kind === 'flower' ? {color:['red','yellow','white','blue'][i%4]} : {})});
   });
  }
  state.villagers = data.residents.map((v,i)=>({...v,variant:{color:i,accessory:0,sparkle:false},arrivedAt:0}));
  const reached = reachableFromHome(state), water = connectedWaterChannels(waterLayout(state));
  const inaccessible = owners.filter(o=>!isReachable(o.cell,reached)).map(o=>o.id);
  if(inaccessible.length) throw new Error(layout.id+': inaccessible '+inaccessible.join(','));
  const dryChannels = state.landmarks.filter(l=>l.kind==='water-channel'&&!water.has(key(l.cell))).map(l=>l.id);
  if(dryChannels.length) throw new Error(layout.id+': dry '+dryChannels.join(','));
  const food = foodSupport(state), homes = housing(state), places = derivePlaces(state);
  if(food < state.villagers.length || homes.capacity < state.villagers.length) throw new Error(layout.id+': support');
  const families = [...new Set(places.filter(p=>p.stage==='grown'||p.stage==='lived').map(p=>p.family))].sort();
  const blockedFamilies = ['grove','spring','flowers','community'].filter(required=>!families.includes(required));
  reports.push({id:layout.id,name:layout.name,ownerCount:owners.length,landCells:landCells(state).length,
   housing:homes,foodSupport:food,wateredFarms:state.plots.filter(p=>p.kind==='farm'&&waterAt(state,p.cell)>0).map(p=>p.id),
   reachedWaterChannels:water.size,inaccessible,families,blockedFamilies,
   places:places.map(p=>({id:p.id,family:p.family,variant:p.variant,stage:p.stage,missing:p.missing,entrances:p.entrances,useTargets:p.useTargets.map(t=>({id:t.id,kind:t.kind,cell:t.cell}))})),
   ids:owners.map(o=>o.id).sort(),listedCost:data.groups.reduce((sum,g)=>sum+g.count*(SEED_PRICE[g.kind]??LANDMARK_PRICE[g.kind]??0),0)});
 }
 if(reports.some(r=>JSON.stringify(r.ids)!==JSON.stringify(reports[0].ids))) throw new Error('different ownership');
 return reports;
}`;

const input = await readFile(resolve(directory, 'layouts.json'));
const compiled = await build({ stdin: { contents: source, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
let reports;
try {
  const module = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  reports = module.probe(JSON.parse(input));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const result = { status: reports.some(r=>r.blockedFamilies.length) ? 'PARTIAL_KNOWN_PLACE_CONFLICT' : 'PASS_LOGICAL_DIAGNOSTIC_ONLY', at: new Date().toISOString(),
  inputSha256: createHash('sha256').update(input).digest('hex'), compiledSourceSha256: createHash('sha256').update(compiled.outputFiles[0].text).digest('hex'),
  command: 'fnm exec --using=22 node docs/product/island-system/experience-design/check-layouts.mjs',
  expected: 'Same 38 owners, land, maturity and 4 residents; unique owned cells; all owners reachable; all 6 channels supplied; food/housing sufficient; all 4 place families grown',
  limits: ['No native 3D/world geometry or actor pose validation', 'No player acquisition, natural elapsed-time simulation, saved migration or browser interaction', 'No evidence of art quality, child understanding, replay appeal or production delivery'], reports };
await writeFile(resolve(directory, 'layout-verification.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({status:result.status,inputSha256:result.inputSha256,reports:reports.map(({id,ownerCount,landCells,foodSupport,families,blockedFamilies,listedCost})=>({id,ownerCount,landCells,foodSupport,families,blockedFamilies,listedCost}))},null,2));
