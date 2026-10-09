import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadDomain, hash, stableJSON } from './growing-fixture-data.mjs';

// Local, synthetic presentation saves only. Never connect this tool to a user's game.
const source = path.resolve(process.argv[2]);
const target = new URL(process.argv[3]);
const output = path.resolve(process.argv[4]);
assert(['localhost', '127.0.0.1'].includes(target.hostname), 'Loopback capture only');
const { domain, sourceHash } = await loadDomain(source);
const sourceRevision = await fs.readFile(path.join(source, '.promotion-source-revision'), 'utf8').then(s=>s.trim()).catch(()=>'unrecorded');
const compiled = await build({ stdin: { contents: "export { styleAt, islandCharacter } from './src/domain/growingIsland/environment.ts'", resolveDir: source }, bundle: true, platform: 'node', format: 'esm', write: false });
const { styleAt, islandCharacter } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const epoch = Date.parse('2026-10-10T03:00:00Z');

function fixture(id) {
  const profile = { ...domain.createInitialProfile('わたしの島', 1, 0, 1, 'math'), id: `promotion-${id}`, soundEnabled: false };
  let state = domain.newIsland(profile.id, epoch), serial = 0;
  const command = command => { try { state = domain.applyIntent(state, { id: `promo-${id}-${serial++}`, command }).state; } catch (error) { throw Error(`${JSON.stringify(command)}: ${error.message}`); } };
  command({ type: 'starter-guide', automatic: false });
  if (id !== 'start') {
    state.drops = 50000; state.genki.best = 150; state.genki.current = 150; domain.refreshUnlocks(state);
    command({ type: 'expand', side: 'west' });
    if (id === 'town') for (const side of ['east', 'south', 'west', 'east']) command({ type: 'expand', side });
    command({ type: 'plant', kind: 'home', cell: { x: id === 'town' ? -4 : -1, z: 1 } }); domain.refreshUnlocks(state);
    command({ type: 'store', id: 'starter-flower' }); command({ type: 'store', id: 'starter-bench' });
    const put = (kind, x, z, color) => {
      command({ type: 'place', kind, cell: { x, z }, ...(color ? { color } : {}) });
      const item = state.landmarks.at(-1); item.growth = kind === 'sapling' ? 18 : kind === 'flower' ? 6 : 0;
      if (kind === 'sapling') item.maturedAt = 0;
      return item;
    };
    const plant = (kind, x, z, stage = 1, roofColor) => {
      const style = styleAt(state, { x, z });
      const existing = state.plots.find(p => p.kind === kind && p.cell.x === x && p.cell.z === z);
      if (!existing) command({ type: 'plant', kind, cell: { x, z } });
      const plot = existing ?? state.plots.at(-1);
      Object.assign(plot, { stage, style, growth: 12, builtAt: 0, stagedAt: 0 });
      if (roofColor !== undefined) command({ type: 'paint', target: plot.id, color: roofColor });
      return plot;
    };
    let homes;
    if (id === 'village') {
      put('sapling', -2, 0); put('flower', 0, 2, 'red'); put('flower', -1, 3, 'yellow'); put('flower', 4, 2, 'blue');
      put('water-bowl', 5, 2); put('bench', 1, 4); put('swing', -2, 3); put('flower', 4, 4, 'yellow'); put('lantern', 0, 0);
      homes = [plant('home', -1, 1, 2, 3), plant('home', 5, 0, 2, 1)];
      plant('farm', 5, 4); put('flower', 3, 3, 'white');
    } else {
      state.villagers.push(...Array.from({length:2},(_,n)=>({...structuredClone(state.villagers[0]),id:`temp-${n}`}))); domain.refreshUnlocks(state);
      // Places are clustered by use, with open routes between them.
      for (const [x,z] of [[-5,0],[-3,0],[-5,3],[-3,4]]) put('sapling', x,z);
      for (const [x,z,c] of [[6,0,'red'],[8,0,'white'],[10,0,'yellow'],[6,3,'blue'],[8,3,'red'],[10,3,'white'],[9,5,'yellow'],[11,5,'blue'],[-4,6,'red'],[-3,6,'white'],[0,5,'yellow'],[2,6,'blue']]) put('flower',x,z,c);
      for (const [x,z] of [[0,0],[4,0],[0,3],[4,3],[1,6],[6,6]]) put('lantern',x,z);
      put('lighthouse',11,0); put('fountain',2,4); put('water-bowl',10,6);
      put('bakery',-3,2); put('postbox',-1,4); put('picnic-table',-3,5);
      put('bandstand',4,5); put('bench',1,3); put('bench',3,5);
      put('swing',7,5); put('slide',7,7); put('trampoline',9,7);
      homes = [[-4,1,3],[-4,4,5],[-1,0,2],[0,2,8],[5,1,9],[7,1,1],[9,2,3],[11,4,2]].map(([x,z,color]) => plant('home',x,z,4,color));
      plant('market',-1,2); plant('farm',-5,5); plant('farm',-5,7);
      plant('festival',5,4);
      state.wonderSeeds = 3;
      plant('wonder',-1,6); plant('wonder',5,7); plant('wonder',10,4);
      put('planter',-2,3); put('planter',-4,7); put('water-channel',2,5); put('water-channel',2,7);
    }
    const prototype = state.villagers[0];
    const species = ['rabbit','otter','girl','boy','fox','duck','squirrel','hedgehog','bird','penguin','owl','frog','rabbit','otter','fox','bird'];
    state.villagers = Array.from({ length: id === 'town' ? 16 : 2 }, (_, n) => ({ ...structuredClone(prototype), id: `friend-${n}`, home: homes[id === 'town' ? Math.floor(n / 2) : n].id, species: species[n], name: species[n] === 'girl' ? 'えま' : species[n] === 'boy' ? 'えいた' : `なかま${n+1}`, arrivedAt: n, variant: { color: n % 4, accessory: n % 3, sparkle: false }, outfit: { color: n % 8, hat: n % 4 } }));
    state.town = { clock: 720, bank: 0 }; state.nature = { hours: 720, realAt: epoch, lastSpread: 720, lastMix: 720 };
    state.character = islandCharacter(state); state.unopened = []; state.arrivals = [];
    state.pier.dockAt = state.town.clock + 240;
    domain.refreshUnlocks(state); command({ type: 'paint', target: 'flag', color: 3 }); command({ type: 'flag', pattern: 2 });
    if (id === 'town') command({ type: 'bridge-build', x: domain.bridgeSite(state) });
    state.islandName = 'ぽこもこの島';
    state.guidance.selected = undefined;
  }
  const reached = domain.reachableFromHome(state), cells = new Set(domain.landCells(state).map(domain.key));
  for (const item of [...state.plots,...state.landmarks]) if (item.cell) {
    assert(cells.has(domain.key(item.cell))); assert.equal(domain.occupant(state,item.cell,item.id),undefined);
    if (item.kind === 'home') assert(domain.isReachable(item.cell,reached), `Unreachable home ${item.id}`);
  }
  for (const home of state.plots.filter(p=>p.kind === 'home')) assert(state.villagers.filter(v=>v.home === home.id).length <= domain.RULES.homeCapacity[home.stage]);
  assert.deepEqual(state.learned,[]); assert.deepEqual(profile.recentAttempts,[]);
  return { id, synthetic: true, profile, island: { profileId: profile.id, version: 3, revision: 0, createdAt: epoch, updatedAt: epoch, state } };
}

async function put(page, name, stores, callbackData) {
  await page.evaluate(async ({name,stores,data}) => {
    const request = indexedDB.open(name);
    const db = await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx = db.transaction(stores,'readwrite');
    const done = new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    for (const [store,value] of data) tx.objectStore(store).put(value);
    await done; db.close();
  },{name,stores,data:callbackData});
}
const show = async page => { await page.getByRole('button',{name:'しまのメニュー',exact:true}).click(); await page.getByRole('button',{name:'みせる',exact:true}).click(); await page.getByRole('button',{name:/みせる モード/}).click(); await page.waitForTimeout(900); };
const shot = async (page,file) => { const box=await page.locator('[data-growing-world] canvas').boundingBox(); await page.screenshot({path:path.join(output,file),clip:{x:box.x,y:box.y+70,width:box.width,height:box.height-140}}); };
const ready = async page => { try { await page.locator('[data-growing-island="ready"]').waitFor(); } catch (error) { await page.screenshot({path:path.join(output,'failure.png')}); console.log(await page.locator('body').innerText()); throw error; } await page.locator('.growing-loading--overlay').waitFor({state:'hidden'}); await page.waitForTimeout(1200); };
await fs.mkdir(output,{recursive:true});
const fixtures = process.argv[5] === 'learning-only' ? [] : ['start','village','town'].map(fixture);
await fs.writeFile(path.join(output,'fixtures.json'),JSON.stringify({synthetic:true,sourceHash,epoch,fixtures},null,2));
const browser = await chromium.launch();
const report = { source, sourceRevision, target: target.origin, sourceHash, epoch, synthetic:true, note:'Resources, maturity and population explicitly set. No learning acquisition claim.', captures:[] };
try {
  for (const item of fixtures) {
    const context = await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
    const page = await context.newPage(), errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(epoch); await page.goto(`${target.origin}/#/island`); await page.waitForURL('**/#/onboarding');
    await put(page,'SansuDatabase',['profiles','appData'],[['profiles',item.profile],['appData',{id:'app',schemaVersion:1,activeProfileId:item.profile.id,profiles:{[item.profile.id]:item.profile}}]]);
    await page.evaluate(id=>localStorage.setItem('sansu_active_profile',id),item.profile.id);
    await page.goto(`${target.origin}/#/island`); await ready(page);
    await put(page,'SansuGrowingIslandV1',['guidedIslands'],[['guidedIslands',item.island]]);
    await page.reload(); await ready(page);
    const canvas=page.locator('[data-growing-world] canvas');
    await show(page);
    const file=`island-${item.id}.png`;
    const box=await canvas.boundingBox(); await page.screenshot({path:path.join(output,file),clip:{x:box.x,y:box.y+70,width:box.width,height:box.height-140}});
    report.captures.push({id:item.id,file,sha256:hash(await fs.readFile(path.join(output,file))),metadata:await page.locator('[data-growing-world]').evaluate(n=>({...n.dataset})),version:await page.evaluate(()=>fetch('/version.json').then(r=>r.json())),people:item.island.state.villagers.length,homes:item.island.state.plots.filter(p=>p.kind==='home').length,fixtureHash:hash(stableJSON(item)),errors});
    assert.deepEqual(errors,[]);
    if(item.id==='town') {
      for (const [name,dx,dy] of [['homes',-260,70],['play',-260,-160],['square',120,-20]]) {
        await page.reload(); await ready(page); await show(page);
        const b=await canvas.boundingBox(), x=b.x+b.width/2, y=b.y+b.height/2;
        await page.mouse.move(x,y); await page.mouse.wheel(0,-300); await page.waitForTimeout(300);
        await page.mouse.down(); await page.mouse.move(x+dx,y+dy,{steps:15}); await page.mouse.up(); await page.waitForTimeout(900);
        await shot(page,`town-${name}.png`);
      }
      await page.getByRole('button',{name:'おわる',exact:true}).click(); await page.getByRole('button',{name:'しまのメニュー',exact:true}).click(); await page.getByRole('button',{name:'いえ',exact:true}).click();
      await page.locator('[data-house-layout]').waitFor();
      await page.waitForTimeout(1500); await page.screenshot({path:path.join(output,'home.png')});
      await page.setViewportSize({width:390,height:844}); await page.goto(`${target.origin}/#/island`); await ready(page); await page.getByRole('button',{name:'まなぶ',exact:true}).click(); await page.locator('[data-learning-candidate]').waitFor(); await page.waitForTimeout(1200); await page.screenshot({path:path.join(output,'math.png')});
    }
    await context.close();
  }
  for (const subject of ['math','vocab']) {
  const english = {...domain.createInitialProfile('ぽこもこ',2,7,1,subject),id:`promotion-learning-${subject}`,soundEnabled:false};
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',reducedMotion:'reduce'}); const page=await context.newPage();
  await page.clock.setFixedTime(epoch); await page.goto(`${target.origin}/#/island`); await page.waitForURL('**/#/onboarding');
  await put(page,'SansuDatabase',['profiles','appData'],[['profiles',english],['appData',{id:'app',schemaVersion:1,activeProfileId:english.id,profiles:{[english.id]:english}}]]); await page.evaluate(id=>localStorage.setItem('sansu_active_profile',id),english.id);
  await page.goto(`${target.origin}/#/island`); await ready(page); await page.getByRole('button',{name:'まなぶ',exact:true}).click(); await page.locator('[data-learning-candidate]').waitFor(); await page.waitForTimeout(1200); await page.screenshot({path:path.join(output,subject==='math'?'math.png':'english.png')}); report.captures.push({id:subject,file:subject==='math'?'math.png':'english.png',syntheticProfile:true,mathStartLevel:english.mathStartLevel,subjectMode:english.subjectMode,candidate:await page.locator('[data-learning-candidate]').first().getAttribute('data-learning-candidate'),version:await page.evaluate(()=>fetch('/version.json').then(r=>r.json()))});await context.close(); }
} finally { await browser.close(); await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)); }
console.log(`Captured ${report.captures.length} current-game views in ${output}`);
