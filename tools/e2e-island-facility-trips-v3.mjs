import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_TRIPS_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_TRIPS_OUTPUT;
assert(out); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'facility-trips-v1', fixture: '100 QA credits; real UI purchases and visits; no earned acquisition claim', humanN: 0, cases: [], pass: false };
async function saved(page, id) { return page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record) }; }, id); }
async function closeMenu(page) { const b = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await b.isVisible()) await b.click(); }
async function inventory(page, id) { await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click(); await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click(); await page.locator(`[data-life-item="${id}"]`).click(); }
async function putCell(page, cell) {
    const at = await page.locator('.life-world').evaluate((n, c) => {
        const { projection, view } = JSON.parse(n.dataset.lifeCamera), r = n.getBoundingClientRect(); const mul = (m, v) => [0,1,2,3].map(r => m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
        const p = mul(projection, mul(view, [c.x-2.5,.045,c.z-2,1])); return { x:r.left+(p[0]/p[3]+1)*r.width/2,y:r.top+(1-p[1]/p[3])*r.height/2 };
    }, cell);
    await page.touchscreen.tap(at.x, at.y); await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click(); await closeMenu(page);
}
async function buy(page,kind,cell,id) {
    await closeMenu(page);await page.getByRole('button',{name:'つくる',exact:true}).click();await page.getByRole('group',{name:'しまの ていれ'}).getByRole('button',{name:'つくる',exact:true}).click();
    if(kind==='library'||kind==='garden-hut')await page.getByRole('button',{name:'6ページめ',exact:true}).click();
    await page.locator(`[data-life-buy="${kind}"]`).click();await putCell(page,cell);
    await waitForAsync(page,async({id,kind})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');return replayLife(await lifeDb.worlds.get(id)).items.some(i=>i.kind===kind&&i.cell);},{id,kind});
}
const browser=await chromium.launch();
try{
    for(const [device,viewport] of [['phone',{width:390,height:844}],['tablet',{width:768,height:1024}]])for(const kind of ['library','garden-hut']){
        const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:device==='tablet'?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];
        page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
        try{
            await page.goto(base);const id=await seedDev(page,{familiar:false});
            await page.evaluate(async id=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{newLife,learningDay}=await import('/src/domain/islandLife/model.ts');if(lifeDb.name!=='SansuIslandLifePreviewV1')throw new Error('DEV only');const now=Date.now(),r=newLife(id,now);r.credits=Array.from({length:100},(_,i)=>({id:`qa-${i}`,at:now,day:learningDay(now)}));await lifeDb.worlds.put(r);},id);
            await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();const native=await readNative(page,id);
            await buy(page,kind,{x:0,z:0},id);const facility=(await saved(page,id)).state.items.find(i=>i.kind===kind);
            await inventory(page,facility.id);await page.getByRole('button',{name:'ぽこもこを よぶ',exact:true}).click();await closeMenu(page);
            const partner=kind==='library'?'bench':'flower';await buy(page,partner,{x:3,z:2},id);const target=(await saved(page,id)).state.items.find(i=>i.kind===partner);
            await inventory(page,target.id);await page.getByRole('button',{name:'うごかす',exact:true}).click();
            await page.evaluate(()=>{window.tripSamples=[];window.tripTimer=setInterval(()=>{const n=document.querySelector('.life-world');if(n?.dataset.lifePoses)window.tripSamples.push({at:performance.now(),poses:JSON.parse(n.dataset.lifePoses)});},30);});
            await putCell(page,{x:3,z:2});
            const collected=[];
            for(const stage of ['collect','carry','use']){
                await page.waitForFunction(({stage,kind,facility,target})=>JSON.parse(document.querySelector('.life-world').dataset.lifePoses).some(p=>p.id==='pokomoko'&&p.facilityUse?.kind===kind&&(stage==='collect'?p.itemId===facility:stage==='carry'?p.itemId===target&&p.facilityUse.action==='carrying':p.itemId===target&&p.facilityUse.action!=='carrying')),{stage,kind,facility:facility.id,target:target.id});
                const pose=await page.locator('.life-world').evaluate(n=>JSON.parse(n.dataset.lifePoses).find(p=>p.id==='pokomoko'));collected.push({stage,pose});
                await page.screenshot({path:`${out}/${device}-${kind}-${stage}.png`});
            }
            const samples=await page.evaluate(()=>{clearInterval(window.tripTimer);return window.tripSamples;});
            assert(collected.every(c=>c.pose.id==='pokomoko'));assert(new Set(samples.flatMap(s=>s.poses.filter(p=>p.id==='pokomoko'&&p.facilityUse?.action==='carrying').map(p=>p.position.map(n=>n.toFixed(2)).join(',')))).size>=2);
            if(kind==='library')assert(collected[2].pose.seatGap<1e-8);
            const before=(await saved(page,id));assert.equal(before.state.light,0);
            await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
            await page.waitForFunction(({kind,target})=>JSON.parse(document.querySelector('.life-world').dataset.lifePoses).some(p=>p.id==='pokomoko'&&p.itemId===target&&p.facilityUse?.kind===kind),{kind,target:target.id});
            const resumed=await saved(page,id);assert.equal(resumed.record.version,11);assert.deepEqual(resumed.record.facilityCutover,before.record.facilityCutover);assert.deepEqual(await readNative(page,id),native);
            await inventory(page,target.id);await page.getByRole('button',{name:'しまう',exact:true}).click();await closeMenu(page);
            await waitForAsync(page,async({id,target})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');return!replayLife(await lifeDb.worlds.get(id)).items.find(i=>i.id===target).cell;},{id,target:target.id});
            const final=await saved(page,id);assert(final.state.residents.every(r=>!r.facilityTrip));assert.equal(final.state.light,0);assert.equal(final.state.drops,kind==='library'?124:162);assert.deepEqual(await readNative(page,id),native);
            await page.screenshot({path:`${out}/${device}-${kind}-stored.png`});
            await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('.park-answer').waitFor();assert.deepEqual(errors,[]);
            report.cases.push({device,kind,collected,samples,version:final.record.version,pass:true,errors});
        }catch(error){await page.screenshot({path:`${out}/${device}-${kind}-failure.png`});report.cases.push({device,kind,pass:false,error:error.stack,errors});throw error;}
        finally{await context.close();}
    }
    report.endHash=await sourceHash();assert.equal(report.startHash,report.endHash);report.pass=true;
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
