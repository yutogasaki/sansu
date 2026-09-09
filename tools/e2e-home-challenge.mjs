import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { seedNative, runtimeMetadata } from './island-e2e-helpers.mjs';
const target = process.env.SANSU_CHALLENGE_URL || 'http://127.0.0.1:5316';
const output = process.env.SANSU_CHALLENGE_OUTPUT || 'output/challenge-v1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { target, candidate: 'home-challenge-v1', fixture: 'Explicit eligible level8 profile + one historical independent addition log; challenge results are earned with real 60s UI runs. Human N=0.', captures: [], scenarios: [], pass: false };
async function read(page, store) {
 return page.evaluate(async store => { const r=indexedDB.open('SansuDatabase');const d=await new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)}); const tx=d.transaction(store);const q=tx.objectStore(store).getAll();const rows=await new Promise((yes,no)=>{q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error)});d.close();return rows; },store);
}
try {
 for (const viewport of [{width:390,height:844},{width:768,height:1024}]) {
  const context=await browser.newContext({viewport,reducedMotion:viewport.width===390?'no-preference':'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const capture=async name=>{const file=`${viewport.width}-${name}.png`;await page.screenshot({path:`${output}/${file}`});report.captures.push({file,...await runtimeMetadata(page)});};
  try {
   console.log(viewport.width,'launch'); await page.goto(target);await page.waitForURL('**/#/onboarding');
   console.log(viewport.width,'seed'); const id=await seedNative(page,randomUUID());
   await page.evaluate(async id=>{
    const r=indexedDB.open('SansuDatabase');const d=await new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)});
    const tx=d.transaction(['profiles','appData','logs'],'readwrite');const app=await new Promise(yes=>{const q=tx.objectStore('appData').get('app');q.onsuccess=()=>yes(q.result)});const p=app.profiles[id];
    Object.assign(p,{mathStartLevel:8,mathMainLevel:8,mathMaxUnlocked:8,mathLevels:Array.from({length:8},(_,i)=>({level:i+1,enabled:true,unlocked:true,recentAnswersNonReview:[]}))});
    tx.objectStore('profiles').put(p);tx.objectStore('appData').put(app);
    tx.objectStore('logs').add({profileId:id,subject:'math',itemId:'add_1d_1',result:'correct',timestamp:'2026-09-01T00:00:00Z',learningEvidence:{assistance:'independent',completion:'whole-problem',problem:{catalogVersion:'curriculum-v1',subject:'math',itemId:'add_1d_1',unitId:'math.add-small-increments',representation:'symbol',variant:'default',inputType:'number',problemKey:JSON.stringify({answer:'3',inputType:'number',item:'add_1d_1',question:'1 + 2 ='})}}});
    await new Promise((yes,no)=>{tx.oncomplete=yes;tx.onerror=()=>no(tx.error)});d.close();
   },id);
   console.log(viewport.width,'house'); await page.goto(`${target}/?challenge-fixture=${id}#/island?view=keepsakes`); const card=page.getByRole('article',{name:'がくしゅう チャレンジ'});
   await card.getByRole('button',{name:'ちょうせん',exact:true}).waitFor(); console.log(viewport.width,'eligible');await capture('home');
   if (viewport.width === 768) { await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller)); await context.setOffline(true); }
   const beforeLogs=await read(page,'logs'), beforeMemory=await read(page,'memoryMath'), beforeIsland=await read(page,'islands');
   await card.getByRole('button',{name:'ちょうせん',exact:true}).click();
   const panel=page.getByTestId('challenge-panel');await panel.locator('.challenge-keypad').waitFor(); console.log(viewport.width,'running');
   assert.equal(await page.locator('.island-shell-nav').count(),0);
   await capture('ready');
   const keyboard=panel.getByRole('group',{name:'すうじ キーパッド'});
   const bounds=await keyboard.boundingBox();assert(bounds && bounds.y+bounds.height<=viewport.height, 'full keypad visible');
   // Read the displayed equation only, then answer by physical input. No stored answer injection.
   for(let i=0;i<12;i++) {
    await panel.getByRole('button',{name:'7',exact:true}).waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('[aria-label="7"]').disabled);
    const equation=await panel.locator('.challenge-equation').innerText();const nums=equation.match(/(\d+)\s*\+\s*(\d+)/);assert(nums);
    await page.keyboard.type(String(Number(nums[1])+Number(nums[2])));await page.keyboard.press('Enter');await page.waitForTimeout(380);
   }
   console.log(viewport.width,'waiting result'); await panel.locator('.challenge-result').waitFor({timeout:65000});await capture('result');
   assert.equal((await read(page,'challengeSummaries'))[0].best,12);
   assert.deepEqual(await read(page,'logs'),beforeLogs);assert.deepEqual(await read(page,'memoryMath'),beforeMemory);
   assert.equal((await read(page,'islands'))[0].completedSets,beforeIsland[0].completedSets);
   await panel.getByRole('button',{name:'いえに かざる',exact:true}).click();await card.waitFor();
   assert.deepEqual(new Set((await read(page,'challengeSummaries'))[0].displayed),new Set(['certificate','trophy']));
   await capture('awards');await page.reload();await card.getByText('じぶんの ベスト：12もん',{exact:true}).first().waitFor();
   await card.getByRole('button',{name:'ちょうせん',exact:true}).click();await panel.locator('.challenge-keypad').waitFor(); console.log(viewport.width,'running');
   await page.reload();await panel.locator('.challenge-result').waitFor();assert.equal((await read(page,'challengeSummaries'))[0].completedCount,1);
   assert.equal(await panel.locator('.challenge-keypad').count(),0,'reload never starts a timer');
   await panel.getByRole('button',{name:'いえへ',exact:true}).click();await card.waitFor();
   await page.setViewportSize({width:1024,height:768});await card.getByRole('button',{name:'ちょうせん',exact:true}).click();await panel.locator('.challenge-keypad').waitFor(); console.log(viewport.width,'running');
   const landscape=await panel.getByRole('group',{name:'すうじ キーパッド'}).boundingBox();assert(landscape.y+landscape.height<=768);
   await panel.getByRole('button',{name:'とじる',exact:true}).click();await card.waitFor();
   assert.deepEqual(errors,[]);report.scenarios.push({viewport,pass:true});
  } catch (error) { await page.screenshot({path:`${output}/${viewport.width}-failure.png`}); await writeFile(`${output}/${viewport.width}-failure.txt`, await page.locator('body').innerText()); throw error; } finally {await context.close();}
 }
 report.pass=true;
} catch(error) {report.error=String(error);throw error;}
finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
