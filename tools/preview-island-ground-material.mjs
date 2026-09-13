import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = process.env.SANSU_GROUND_URL, out = process.env.SANSU_GROUND_OUTPUT, variant = process.env.SANSU_GROUND_VARIANT;
assert(base && out && ['moss','turf','earth'].includes(variant)); await mkdir(out, {recursive:false});
const record = JSON.parse(await readFile('docs/design/2026-09-14-island-world-shadow/fixed-record.json'));
async function hash() { const h=createHash('sha256'); for(const path of [...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','src','public','package.json','package-lock.json','vite.config.ts'],{encoding:'utf8'}).trim().split('\n'))].sort()) h.update(path).update('\0').update(await readFile(path)).update('\0'); return h.digest('hex'); }
const shore=process.env.SANSU_SHORE_VARIANT;
assert(!shore || ['lagoon','tidal','shelf'].includes(shore));
const sculpt=process.env.SANSU_SCULPT_VARIANT;
assert(!sculpt || ['traced','buttress','recess'].includes(sculpt));
const atmosphere=process.env.SANSU_ATMOSPHERE_VARIANT;
assert(!atmosphere || ['garden','shelter','sunroom'].includes(atmosphere));
const clearance=process.env.SANSU_CLEARANCE_VARIANT;
assert(!clearance || ['porch','vault','grove'].includes(clearance));
const candidate=clearance?`canopy-clearance-${clearance}-study-v1`:atmosphere?`canopy-atmosphere-${atmosphere}-study-v1`:sculpt?`canopy-sculpt-${sculpt}-study-v2`:shore?`canopy-shore-${shore}-study-v3`:`canopy-ground-${variant}-study-v1`;
const failMesh=process.env.SANSU_SCULPT_FAIL_MESH==='1';
assert(!failMesh || sculpt);
const failImage=process.env.SANSU_GROUND_FAIL_IMAGE==='1';
const report={fault:failMesh?'explicit mesh network failure':failImage?'explicit texture network failure':'none',target:base,variant,shore,sculpt,atmosphere,clearance,candidate,flags:'DEV Island/Life preview; bark study=true; ground study='+variant+'; shore study='+(shore??'off')+'; sculpt study='+(sculpt??'off')+'; atmosphere study='+(atmosphere??'off')+'; clearance study='+(clearance??'off'),fixture:'Explicit same saved QA record, original resident assignments and logical time; realAt anchored at launch. No acquisition or human evidence.',startHash:await hash(),cases:[],pass:false};
report.atlasSha256=createHash('sha256').update(await readFile('docs/design/2026-09-14-canopy-ground/material-atlas.png')).digest('hex');
if(sculpt) report.sculptMeshSha256=createHash('sha256').update(await readFile(`docs/design/2026-09-14-canopy-sculpt/meshes/${sculpt}.json`)).digest('hex');
const browser=await chromium.launch();
try {for(const [device,viewport] of [['phone',{width:390,height:844}],['tablet',{width:768,height:1024}]]){
    const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    try {
        if(failMesh) await page.route(`**/docs/design/2026-09-14-canopy-sculpt/meshes/${sculpt}.json`,route=>route.abort('failed'));
        if(failImage) await page.route('**/docs/design/2026-09-14-canopy-ground/material-atlas.png',route=>route.abort('failed'));
        await page.goto(base); await page.evaluate(async record=>{
            const {lifeDb}=await import('/src/domain/islandLife/repository.ts'); const{createInitialProfile}=await import('/src/domain/user/profile.ts');const{saveProfile,setActiveProfileId}=await import('/src/domain/user/repository.ts');
            if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('DEV fixture only');const p=createInitialProfile('検証',2,0,1,'math');p.id=record.profileId;p.soundEnabled=false;await saveProfile(p);await setActiveProfileId(p.id);await lifeDb.worlds.put({...record,realAt:Date.now()});
        },record);
        await page.reload();await page.locator(`.life-world[data-rendered="true"][data-life-ground-material-status="${failImage?'fallback':'ready'}"]`).waitFor();
        if(sculpt) await page.locator(`.life-world[data-life-sculpt-status="${failMesh?'fallback':'ready'}"]`).waitFor();
        assert.equal(await page.locator('.life-world').getAttribute('data-life-visual-candidate'),candidate);
        await page.waitForTimeout(800);await page.screenshot({path:`${out}/${device}-current.png`});
        const metadata=await page.evaluate(()=>({builds:[...document.querySelectorAll('[data-build-revision]')].map(n=>({...n.dataset})),world:{...document.querySelector('.life-world').dataset}}));
        assert.deepEqual(errors,[]);report.cases.push({device,viewport,metadata,errors});
    }catch(error){await page.screenshot({path:`${out}/${device}-failure.png`});throw error;}finally{await context.close();}
}report.endHash=await hash();assert.equal(report.startHash,report.endHash);report.pass=true;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
