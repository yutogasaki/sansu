import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {seedDev,readNative,waitForAsync} from './island-e2e-helpers.mjs';
import {saved,buy,callResident,inventory,closeMenu} from './island-life-ui-helpers.mjs';
const base=process.env.SANSU_WORLD_SHADOW_URL??'http://127.0.0.1:5233',out=process.env.SANSU_WORLD_SHADOW_OUTPUT;assert(out);await mkdir(out,{recursive:false});
async function hash(){const h=createHash('sha256');for(const f of [...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','src','public','package.json','package-lock.json','vite.config.ts'],{encoding:'utf8'}).trim().split('\n'))].sort())h.update(f).update('\0').update(await readFile(f)).update('\0');return h.digest('hex');}
const report={startHash:await hash(),target:base,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),flags:'DEV Island/Life preview; bark study OFF',candidate:'world-shadow-greeting-v1',humanN:0,fixture:'20 QA credits, actual purchases and explicit Pokomoko call; other residents keep natural assignments; no accelerated time or rerolls',cases:[],pass:false};
const fixture=process.env.SANSU_WORLD_SHADOW_FIXTURE?JSON.parse(await readFile(process.env.SANSU_WORLD_SHADOW_FIXTURE)):undefined;
if(fixture)report.fixture='Explicit fixed QA record of the first purchase diagnostic, with its original resident assignments and logical time; realAt anchored to test launch. No natural-occurrence or new-acquisition claim.';
const browser=await chromium.launch();
async function shadow(page,who){return page.evaluate(who=>{const close=document.querySelector('.life-relation-view');return JSON.parse(close?.dataset.shadowView??document.querySelector('.life-world')?.dataset[`worldShadow${who}View`]??'{}')},who);}
async function greeting(page,who){await page.waitForFunction(who=>document.querySelector('.life-relation-view')?.dataset.shadowMagic==='greeting'||document.querySelector('.life-world')?.dataset[`worldShadow${who}Magic`]==='greeting',who);}
async function closeView(page){const close=page.getByRole('button',{name:'みてみるを とじる',exact:true});if(await close.isVisible())await close.click();}
async function repeatTap(page,who){if(!await page.locator('.life-relation-view').count())return tap(page,who);const at=await page.locator('.life-relation-view').evaluate(n=>{const p=JSON.parse(n.dataset.shadowView).touchPoint,{projection,view}=JSON.parse(n.dataset.relationView).camera,r=n.getBoundingClientRect(),mul=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);const q=mul(projection,mul(view,[...p,1]));return{x:r.left+(q[0]/q[3]+1)*r.width/2,y:r.top+(1-q[1]/q[3])*r.height/2}});await page.touchscreen.tap(at.x,at.y);}
async function tap(page,who){await page.waitForFunction(who=>JSON.parse(document.querySelector('.life-world')?.dataset[`worldShadow${who}View`]??'{}').touchPoint,who);const point=await page.locator('.life-world').evaluate((n,who)=>{const p=JSON.parse(n.dataset[`worldShadow${who}View`]).touchPoint,{projection,view}=JSON.parse(n.dataset.lifeCamera),r=n.getBoundingClientRect(),mul=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);const q=mul(projection,mul(view,[...p,1]));return{x:r.left+(q[0]/q[3]+1)*r.width/2,y:r.top+(1-q[1]/q[3])*r.height/2}},who);await page.touchscreen.tap(point.x,point.y);}
try{for(const[device,viewport]of[['phone',{width:390,height:844}],['tablet',{width:768,height:1024}]]){
    if(process.env.SANSU_WORLD_SHADOW_DEVICE&&process.env.SANSU_WORLD_SHADOW_DEVICE!==device)continue;
    const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:device==='tablet'?'reduce':'no-preference'}),page=await context.newPage(),errors=[],events=[],clockChecks=[];let id;page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
    try{
        console.log(`${device}: setup`);await page.goto(base);
        if(fixture){
            id=fixture.profileId;
            await page.evaluate(async record=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{createInitialProfile}=await import('/src/domain/user/profile.ts');const{saveProfile,setActiveProfileId}=await import('/src/domain/user/repository.ts');if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('DEV only');const p=createInitialProfile('検証',2,0,1,'math');p.id=record.profileId;p.soundEnabled=false;await saveProfile(p);await setActiveProfileId(p.id);await lifeDb.worlds.put({...record,realAt:Date.now()});},fixture);
        }else{id=await seedDev(page,{familiar:false});
        await page.evaluate(async id=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{newLife,learningDay}=await import('/src/domain/islandLife/model.ts');if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('DEV only');const at=Date.now(),r=newLife(id,at);r.credits=Array.from({length:20},(_,i)=>({id:`qa-${i}`,at,day:learningDay(at)}));await lifeDb.worlds.put(r);},id);
        }
        await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();assert.equal(await page.locator('.life-world').getAttribute('data-life-visual-candidate'),'canopy-dots-c3-v1');
        const native=await readNative(page,id);
        if(!fixture){await buy(page,'bench',{x:3,z:2},id);await callResident(page,(await saved(page,id)).state.items[0].id,id);await buy(page,'bench',{x:0,z:2},id);await buy(page,'bench',{x:1,z:2},id);}
        const layout=(await saved(page,id,true)).state,bench=layout.items.find(i=>i.id===layout.target);
        assert(bench?.kind==='bench');
        const before=await saved(page,id);assert(!before.record.discoveryJournal?.entries.some(e=>e.event.ruleId==='M3'));
        const zoom=process.env.SANSU_WORLD_SHADOW_ZOOM==='1';
        const actors=layout.residents.filter(r=>(!zoom||r.id==='pokomoko')&&layout.items.some(i=>i.kind==='bench'&&i.id===r.visit?.itemId)).map(r=>r.id);
        if(fixture&&!zoom)assert.equal(actors.length,3);
        if(zoom){await page.locator('.life-camera-tools summary').click();for(let i=0;i<4;i++)await page.getByRole('button',{name:'しまを おおきく',exact:true}).click();await page.locator('.life-camera-tools summary').click();}
        await page.screenshot({path:`${out}/${device}-world-ready.png`});
        for(const who of actors){
            console.log(`${device}: ${who}`);
            await page.waitForFunction(who=>{const n=document.querySelector('.life-world'),p=JSON.parse(n?.dataset.lifePoses??'[]').find(p=>p.id===who);return p?.phase==='bench'&&p.seatGap<1e-8&&JSON.parse(n?.dataset[`worldShadow${who}View`]??'{}').touchPoint;},who);
            const ordinary=await page.locator('.life-world').evaluate((n,who)=>JSON.parse(n.dataset.lifePoses).find(p=>p.id===who),who);
            await page.evaluate(who=>{
                globalThis.shadowCloseFrames=[];
                globalThis.shadowCloseWatcher=new MutationObserver(()=>{const n=document.querySelector('.life-relation-view');if(!n?.dataset.relationView)return;const view=JSON.parse(n.dataset.relationView),pose=view.poses.find(p=>p.id===who);if(pose)globalThis.shadowCloseFrames.push({at:view.at,phase:pose.phase,position:pose.position,seatGap:pose.seatGap});});
                globalThis.shadowCloseWatcher.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-relation-view']});
            },who);
            await tap(page,who);
            await greeting(page,who);
            await page.waitForTimeout(600);const peak=await shadow(page,who);await page.screenshot({path:`${out}/${device}-${who}-greeting.png`});
            const pose=await page.evaluate(who=>{const close=document.querySelector('.life-relation-view');return(close?JSON.parse(close.dataset.relationView).poses:JSON.parse(document.querySelector('.life-world').dataset.lifePoses)).find(p=>p.id===who)},who);
            assert.deepEqual(pose.position,ordinary.position);assert(pose.seatGap<1e-8);
            await repeatTap(page,who);await page.waitForTimeout(250);assert.equal((await shadow(page,who)).eventId,peak.eventId);
            const source=await page.locator('.life-observation').count()?'current-context-test':'live';
            if(zoom)assert.equal(source,'live','The enlarged main-world shadow should stay in the world');
            if(source==='current-context-test')assert.equal(await page.locator('.life-observation').getAttribute('data-life-observation-resident'),who);
            const event=await waitForAsync(page,async({id,who,source})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');return(await lifeDb.worlds.get(id)).discoveryJournal?.entries.find(e=>e.event.ruleId==='M3'&&e.event.source===source&&e.event.snapshot.scene.shadowTouch?.residentId===who)?.event;},{id,who,source});events.push(event);
            await page.waitForFunction(who=>!document.querySelector('.life-relation-view')?.dataset.shadowMagic&&!document.querySelector('.life-world')?.dataset[`worldShadow${who}Magic`],who);
            const frames=await page.evaluate(()=>{globalThis.shadowCloseWatcher.disconnect();return globalThis.shadowCloseFrames});
            if(source==='current-context-test'){
                assert(frames.length>0);assert(frames.every((f,i)=>f.phase==='bench'&&f.seatGap<1e-8&&(!i||f.at>=frames[i-1].at)),'The close view must not rewind a settled visit');
                frames.forEach(f=>assert.deepEqual(f.position,ordinary.position));clockChecks.push({who,frames});
            }
            await closeView(page);
        }
        if(actors.length>1){
            console.log(`${device}: switch target`);await page.waitForTimeout(600);await tap(page,actors[0]);
            await greeting(page,actors[0]);await closeView(page);
            await tap(page,actors[1]);await greeting(page,actors[1]);
            assert(!await page.locator('.life-world').evaluate((n,who)=>n.dataset[`worldShadow${who}Magic`],actors[0]));
            await page.screenshot({path:`${out}/${device}-switch-target.png`});
            await page.waitForFunction(who=>!document.querySelector('.life-relation-view')?.dataset.shadowMagic&&!document.querySelector('.life-world')?.dataset[`worldShadow${who}Magic`],actors[1]);await closeView(page);
        }
        assert.deepEqual((await saved(page,id)).record.actions,before.record.actions);
        console.log(`${device}: save memory`);
        const journal=(await saved(page,id)).record.discoveryJournal;
        const original=journal.historyIds.map(id=>journal.entries.find(e=>e.event.eventId===id)?.event).find(e=>e?.ruleId==='M3'&&e.snapshot.scene.shadowTouch?.residentId==='pokomoko');assert(original);
        await page.getByRole('button',{name:'しまの ようす',exact:true}).click();await page.getByRole('button',{name:'しまの おもいで',exact:true}).click();await page.getByRole('button',{name:'みえた ばめん',exact:true}).click();
        await page.locator(`[data-life-memory="${original.eventId}"]`).click();await page.getByRole('button',{name:'のこす',exact:true}).click();
        await waitForAsync(page,async({id,eventId})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');return(await lifeDb.worlds.get(id)).discoveryJournal.savedIds.includes(eventId);},{id,eventId:original.eventId});
        await page.screenshot({path:`${out}/${device}-saved-memory.png`});
        await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();
        console.log(`${device}: edit cancels`);
        await tap(page,'pokomoko');await greeting(page,'pokomoko');await closeView(page);
        await inventory(page,bench.id);await page.waitForFunction(()=>!document.querySelector('.life-world')?.dataset.worldShadowpokomokoMagic);
        await page.getByRole('button',{name:'しまう',exact:true}).click();await closeMenu(page);
        await waitForAsync(page,async({id,bench})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');return!replayLife(await lifeDb.worlds.get(id)).items.find(i=>i.id===bench).cell;},{id,bench:bench.id});
        await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();const final=await saved(page,id);
        assert.deepEqual(final.record.discoveryJournal.entries.find(e=>e.event.eventId===original.eventId).event,original);assert.deepEqual(await readNative(page,id),native);assert.equal(final.state.drops,before.state.drops);assert.equal(final.state.light,before.state.light);
        await page.screenshot({path:`${out}/${device}-stored-bench.png`});
        const delivery=await page.evaluate(()=>({builds:[...document.querySelectorAll('[data-build-revision]')].map(n=>({...n.dataset})),world:{...document.querySelector('.life-world').dataset}}));
        await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('.island-learning[data-input-ready="true"]').waitFor();await page.screenshot({path:`${out}/${device}-learning.png`});assert.deepEqual(errors,[]);report.cases.push({device,viewport,actors,zoom,events,clockChecks,delivery,pass:true});
    }catch(error){await page.screenshot({path:`${out}/${device}-failure.png`});await writeFile(`${out}/${device}-failure.json`,JSON.stringify({error:error.stack,errors,state:id?await saved(page,id):null,dom:await page.locator('body').innerText(),world:await page.locator('.life-world').evaluate(n=>({...n.dataset})).catch(()=>null)},null,2));throw error;}finally{await context.close();}
}report.endHash=await hash();assert.equal(report.startHash,report.endHash);report.pass=true;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
