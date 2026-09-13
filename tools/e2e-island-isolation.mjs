import { chromium } from 'playwright';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
import { inventory, closeMenu, saved } from './island-life-ui-helpers.mjs';
const base = process.env.SANSU_ISOLATION_URL ?? 'http://127.0.0.1:5232';
const out = process.env.SANSU_ISOLATION_OUTPUT ?? 'docs/design/audits/2026-09-14-island-isolation';
await mkdir(out, { recursive: true });
async function sourceHash(){const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','src','public','package.json','package-lock.json','vite.config.ts'],{encoding:'utf8'}).trim().split('\n'))].sort();const hash=createHash('sha256');for(const f of files)hash.update(f).update('\0').update(await readFile(f)).update('\0');return hash.digest('hex');}
let activeDevice;
const report = { startHash:await sourceHash(), target: base, revision: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    fixture: 'Disposable DEV browser, seeded profile and 100 QA credits; library, hut and bench purchased through domain commands. Acquisition is injected, not earned learning. All subsequent placement, confirmation, reload and free restoration use real UI.',
    cache: 'Fresh browser contexts; DEV target; production service-worker update untested', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch({channel:'chrome'});
async function capture(page, device, name) { console.log(device, name); await page.screenshot({path:`${out}/${device}-${name}.png`}); }
async function selectCell(page, cell) {
    await page.getByRole('button',{name:'マスから えらぶ',exact:true}).click();
    const target=page.locator(`[data-life-cell="${cell.x},${cell.z}"]`);
    while(!await target.isVisible()) await page.getByRole('button',{name:'つぎの マス',exact:true}).click();
    await target.click();
    await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor();
}
async function startMove(page,id,cell) {
    await inventory(page,id); await page.getByRole('button',{name:/^(うごかす|むりょうで うごかす)$/}).click(); await selectCell(page,cell);
}
async function confirm(page,id,cell,profileId) {
    await page.getByRole('button',{name:'ここに おく',exact:true}).click();
    if(await page.getByText('ばしょを あけているよ…',{exact:true}).isVisible())await capture(page,activeDevice,`clearance-${id}-${cell.x}-${cell.z}`);
    await waitForAsync(page,async ({id,cell,profileId})=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {replayLife}=await import('/src/domain/islandLife/simulation.ts');const r=await lifeDb.worlds.get(profileId);return JSON.stringify(replayLife(r).items.find(i=>i.id===id)?.cell)===JSON.stringify(cell);},{id,cell,profileId});
    await page.locator('.life-placement').waitFor({state:'hidden'});console.log('confirmed',id);
    await closeMenu(page);
}
async function isolated(page,profileId) {return page.evaluate(async id=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {replayLife}=await import('/src/domain/islandLife/simulation.ts');const {isolatedItems}=await import('/src/domain/islandLife/space.ts');return isolatedItems(replayLife(await lifeDb.worlds.get(id))).map(i=>i.id);},profileId);}
try {
    for(const [device,viewport] of [['phone',{width:390,height:844}],['tablet',{width:768,height:1024}]]) {
        activeDevice=device;
        const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:device==='tablet'?'reduce':'no-preference'});
        const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
        try {
            await page.goto(base);const profileId=await seedDev(page,{familiar:false});
            await page.evaluate(async id=>{
                const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {newLife,learningDay}=await import('/src/domain/islandLife/model.ts');const {commandLife}=await import('/src/domain/islandLife/simulation.ts');
                if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('Disposable DEV only');
                const at=Date.now();let r=newLife(id,at);r.credits=Array.from({length:100},(_,i)=>({id:`qa-${i}`,at,day:learningDay(at)}));
                const {prepareEconomyMigration}=await import('/src/domain/islandLife/economyMigration.ts');const {prepareTourMigration}=await import('/src/domain/islandLife/tourMigration.ts');r=await prepareTourMigration(await prepareEconomyMigration(r,[]));
                for(const [itemId,kind,cell] of [['qa-library','library',{x:0,z:0}],['qa-hut','garden-hut',{x:3,z:2}],['qa-bench','bench',{x:4,z:0}]])r=commandLife(r,{type:'buy',kind,cell},itemId,at);
                await lifeDb.worlds.put(r);
            },profileId);
            await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
            const native=await readNative(page,profileId);const initial=await saved(page,profileId);
            assert.equal(initial.state.placementVersion,1);assert.deepEqual(await isolated(page,profileId),[]);
            await capture(page,device,'before');
            await startMove(page,'qa-hut',{x:0,z:2});
            assert((await page.locator('[data-life-isolated-preview]').getAttribute('data-life-isolated-preview')).includes('qa-library'));
            await capture(page,device,'preview-existing');await confirm(page,'qa-hut',{x:0,z:2},profileId);
            await startMove(page,'qa-bench',{x:0,z:4});
            assert.deepEqual((await page.locator('[data-life-isolated-preview]').getAttribute('data-life-isolated-preview')).split(',').sort(),['qa-bench','qa-hut','qa-library']);
            await capture(page,device,'preview-multiple');await confirm(page,'qa-bench',{x:0,z:4},profileId);
            await capture(page,device,'confirmed');await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
            assert.deepEqual((await isolated(page,profileId)).sort(),['qa-bench','qa-hut','qa-library']);
            await capture(page,device,'reloaded');
            const marker=await page.locator('.life-world').evaluate(n=>{const {projection,view}=JSON.parse(n.dataset.lifeCamera),r=n.getBoundingClientRect();const mul=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);const p=mul(projection,mul(view,[-2.5,1.94,-.3,1]));return {x:r.left+(p[0]/p[3]+1)*r.width/2,y:r.top+(1-p[1]/p[3])*r.height/2};});
            await page.touchscreen.tap(marker.x,marker.y);await page.locator('[data-life-isolated-item="qa-library"]').waitFor();
            assert(await page.locator('[data-life-isolated-item="qa-library"]').isVisible());assert(await page.getByRole('button',{name:'むりょうで うごかす',exact:true}).isEnabled());await capture(page,device,'explanation');await closeMenu(page);
            await startMove(page,'qa-bench',{x:4,z:0});await confirm(page,'qa-bench',{x:4,z:0},profileId);
            await startMove(page,'qa-hut',{x:3,z:2});await confirm(page,'qa-hut',{x:3,z:2},profileId);
            assert.deepEqual(await isolated(page,profileId),[]);await capture(page,device,'restored');
            const final=await saved(page,profileId);assert.equal(final.state.drops,initial.state.drops);assert.deepEqual(final.state.items.map(i=>i.id),initial.state.items.map(i=>i.id));assert.deepEqual(await readNative(page,profileId),native);
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
            report.cases.push({device,viewport,reducedMotion:device==='tablet',delivery:await page.locator('.life-world').evaluate(n=>({...n.dataset})),errors,initialDrops:initial.state.drops,finalDrops:final.state.drops,pass:true});
        } catch(error) {await writeFile(`${out}/${device}-failure-dom.txt`,await page.locator('body').innerText());await writeFile(`${out}/${device}-failure-worlds.json`,JSON.stringify(await page.evaluate(async()=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');return lifeDb.worlds.toArray();}),null,2));await capture(page,device,'failure');throw error;} finally {await context.close();}
    }
    report.endHash=await sourceHash();assert.equal(report.endHash,report.startHash,'App source changed during capture');report.pass=true;
} catch(error) {report.error=error.stack;throw error;} finally {await writeFile(`${out}/manifest.json`,JSON.stringify(report,null,2));await browser.close();}
