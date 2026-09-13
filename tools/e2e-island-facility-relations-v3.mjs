import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_FACILITY_RELATIONS_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_FACILITY_RELATIONS_OUTPUT;
assert(out); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'facility-distance-v1', fixture: '100 QA credits; real UI purchases and visits; separate owner-API observation/version-12 probe; no earned acquisition claim', humanN: 0, cases: [], pass: false };
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
            const ruleId=kind==='library'?'R5':'R6';
            for(let angle=0;angle<4;angle++){
                await page.waitForTimeout(1800);
                if((await saved(page,id)).record.discoveryJournal?.entries.some(e=>e.event.ruleId===ruleId&&e.event.source==='live'))break;
                await page.locator('.life-camera-tools summary').click();await page.getByRole('button',{name:'しまを ひだりに まわす',exact:true}).click();await page.locator('.life-camera-tools summary').click();
            }
            await waitForAsync(page,async({id,ruleId})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');return(await lifeDb.worlds.get(id)).discoveryJournal?.entries.some(e=>e.event.ruleId===ruleId&&e.event.source==='live');},{id,ruleId});
            const journal=(await saved(page,id)).record.discoveryJournal;
            const event=journal.historyIds.map(id=>journal.entries.find(e=>e.event.eventId===id).event).find(e=>e.ruleId===ruleId&&e.source==='live');
            await page.screenshot({path:`${out}/${device}-${kind}-live.png`});
            await page.getByRole('button',{name:'しまの ようす',exact:true}).click();await page.getByRole('button',{name:'しまの おもいで',exact:true}).click();await page.getByRole('button',{name:'みえた ばめん',exact:true}).click();await page.locator(`[data-life-memory="${event.eventId}"]`).click();
            await page.waitForFunction(()=>JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView??'{}').delivered===true);await page.screenshot({path:`${out}/${device}-${kind}-replay.png`});
            await page.getByRole('button',{name:'のこす',exact:true}).click();
            await waitForAsync(page,async({id,eventId})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');return(await lifeDb.worlds.get(id)).discoveryJournal.savedIds.includes(eventId);},{id,eventId:event.eventId});
            await page.getByRole('button',{name:'いまの島でみる',exact:true}).click();
            await page.waitForFunction(()=>JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView??'{}').delivered===true);await page.screenshot({path:`${out}/${device}-${kind}-current.png`});
            await page.getByRole('button',{name:'みてみるを とじる',exact:true}).click();
            const comparison=[];
            for(const [stage,cell] of [['far',{x:5,z:3}],['restored',{x:3,z:2}]]){
                const journalBefore=(await saved(page,id)).record.discoveryJournal;
                await inventory(page,target.id);await page.getByRole('button',{name:'うごかす',exact:true}).click();await putCell(page,cell);
                await waitForAsync(page,async({id,target,cell})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');const s=replayLife(await lifeDb.worlds.get(id));return s.items.some(i=>i.id===target&&i.cell?.x===cell.x&&i.cell?.z===cell.z);},{id,target:target.id,cell});
                await page.waitForFunction(({stage,kind,facility,target})=>JSON.parse(document.querySelector('.life-world').dataset.lifePoses).some(p=>p.id==='pokomoko'&&p.facilityUse?.kind===kind&&p.facilityUse.action!=='carrying'&&p.itemId===(stage==='far'?facility:target)),{stage,kind,facility:facility.id,target:target.id});
                const pose=await page.locator('.life-world').evaluate(n=>JSON.parse(n.dataset.lifePoses).find(p=>p.id==='pokomoko'));
                const distance=await page.evaluate(async({id,facility,target})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');const{relationDistance}=await import('/src/domain/islandLife/discovery.ts');const s=replayLife(await lifeDb.worlds.get(id));return relationDistance(s,s.items.find(i=>i.id===facility),s.items.find(i=>i.id===target));},{id,facility:facility.id,target:target.id});
                assert(stage==='far'?distance>4:distance<=4);assert.equal(pose.id,collected[2].pose.id);
                await page.screenshot({path:`${out}/${device}-${kind}-${stage}.png`});
                await inventory(page,facility.id);await page.getByRole('button',{name:'みてみる',exact:true}).click();
                await page.locator('.life-relation-view[data-rendered="true"]').waitFor();
                if(stage==='restored')await page.waitForFunction(()=>JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView??'{}').delivered===true);
                else await page.waitForTimeout(2400);
                const view=await page.locator('.life-relation-view').evaluate(n=>JSON.parse(n.dataset.relationView));
                const observed=view.poses.find(p=>p.id==='pokomoko');assert.equal(observed.itemId,pose.itemId);assert.equal(observed.facilityUse?.kind,kind);
                if(stage==='far'){assert.equal(view.delivered,false);assert.equal(view.core,false);}
                await page.screenshot({path:`${out}/${device}-${kind}-${stage}-observation.png`});
                await page.getByRole('button',{name:'みてみるを とじる',exact:true}).click();
                const compared=await saved(page,id);assert.deepEqual(compared.record.discoveryJournal.entries.find(e=>e.event.eventId===event.eventId).event,event);assert(compared.record.discoveryJournal.savedIds.includes(event.eventId));assert.equal(compared.state.light,0);assert.equal(compared.state.drops,kind==='library'?124:162);assert.deepEqual(await readNative(page,id),native);
                if(stage==='far')assert.deepEqual(compared.record.discoveryJournal.historyIds,journalBefore.historyIds);
                comparison.push({stage,cell,distance,pose,view});
            }
            const before=(await saved(page,id));assert.equal(before.state.light,0);
            await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
            await page.waitForFunction(({kind,target})=>JSON.parse(document.querySelector('.life-world').dataset.lifePoses).some(p=>p.id==='pokomoko'&&p.itemId===target&&p.facilityUse?.kind===kind),{kind,target:target.id});
            const resumed=await saved(page,id);assert.equal(resumed.record.version,11);assert.deepEqual(resumed.record.facilityCutover,before.record.facilityCutover);assert.deepEqual(await readNative(page,id),native);
            await inventory(page,target.id);await page.getByRole('button',{name:'しまう',exact:true}).click();await closeMenu(page);
            await waitForAsync(page,async({id,target})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');return!replayLife(await lifeDb.worlds.get(id)).items.find(i=>i.id===target).cell;},{id,target:target.id});
            const final=await saved(page,id);assert(final.state.residents.every(r=>!r.facilityTrip));assert.deepEqual(final.record.discoveryJournal.entries.find(e=>e.event.eventId===event.eventId).event,event);assert(final.record.discoveryJournal.savedIds.includes(event.eventId));assert.equal(final.state.light,0);assert.equal(final.state.drops,kind==='library'?124:162);assert.deepEqual(await readNative(page,id),native);
            await page.screenshot({path:`${out}/${device}-${kind}-stored.png`});
            const observationWriteProbe=await page.evaluate(async({id,facility})=>{
                const{lifeDb,updateLife}=await import('/src/domain/islandLife/repository.ts');const intentId=`qa-version-12-${id}`;
                for(let attempt=0;attempt<3;attempt++){
                    const current=await lifeDb.worlds.get(id);
                    try{const next=await updateLife(id,[],{id:intentId,revision:current.revision,command:{type:'observe',itemId:facility}});return{version:next.version,action:next.actions.find(a=>a.id===intentId)};}
                    catch(error){if(!String(error).includes('しまが かわったよ')||attempt===2)throw error;}
                }
            },{id,facility:facility.id});
            assert.equal(observationWriteProbe.version,12);await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
            const afterProbe=await saved(page,id);assert.equal(afterProbe.record.version,12);assert.equal(afterProbe.state.drops,final.state.drops);assert.equal(afterProbe.state.light,0);assert.deepEqual(await readNative(page,id),native);
            assert.deepEqual(afterProbe.record.discoveryJournal.entries.find(e=>e.event.eventId===event.eventId).event,event);
            await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('.park-answer').waitFor();assert.deepEqual(errors,[]);
            report.cases.push({device,kind,ruleId,event,collected,samples,comparison,version:final.record.version,observationWriteProbe,pass:true,errors});
        }catch(error){const diagnostic=await page.evaluate(()=>({poses:document.querySelector('.life-world')?.dataset.lifePoses,samples:window.tripSamples}));await writeFile(`${out}/${device}-${kind}-failure-state.json`,JSON.stringify(diagnostic,null,2));await page.screenshot({path:`${out}/${device}-${kind}-failure.png`});report.cases.push({device,kind,pass:false,error:error.stack,errors});throw error;}
        finally{await context.close();}
    }
    report.endHash=await sourceHash();assert.equal(report.startHash,report.endHash);report.pass=true;
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
