import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5188';
const metal = process.env.SANSU_PARK_BROWSER_GPU === 'metal';
const browser = await chromium.launch(metal ? { args: ['--use-angle=metal'] } : {});
const results = [];
try {
    for (const viewport of [{width:390,height:844},{width:768,height:1024}]) {
        const context = await browser.newContext({viewport,deviceScaleFactor:2}); const page=await context.newPage();
        await page.goto(`${base}/#/onboarding`);
        await page.evaluate(async()=>{
            const {createInitialProfile}=await import('/src/domain/user/profile.ts');const {saveProfile,setActiveProfileId}=await import('/src/domain/user/repository.ts');
            const {openPark}=await import('/src/domain/park/repository.ts');const {db}=await import('/src/db/index.ts');
            const p=createInitialProfile('測定用',2,1,1,'math');p.soundEnabled=false;await saveProfile(p);await setActiveProfileId(p.id);
            const park=await openPark(p.id);park.parts.push({id:'test-gate',kind:'bubble'});park.courses[0].slots=['starter-slide','test-gate','starter-trampoline'];park.revision++;await db.parks.put(park);
        });
        await page.goto(`${base}/#/park`);await page.locator('canvas[data-frames]').waitFor();
        const runs=[];
        for(let repeat=-1;repeat<3;repeat++) {
            await page.getByRole('button',{name:/^▷ (あそばせる|もういっかい)$/}).click();
            await page.getByRole('button',{name:'とめて つくりなおす',exact:true}).waitFor();
            await page.evaluate(()=>{
                window.frameIntervals=[];window.measuringPark=true;let time,frame;
                const sample=now=>{
                    const c=document.querySelector('canvas');const current=c?.dataset.frames;
                    if(current!==frame) {
                        if(time && c.dataset.progress!=='1') window.frameIntervals.push(now-time);
                        frame=current;time=now;
                    }
                    if(window.measuringPark)requestAnimationFrame(sample);
                };requestAnimationFrame(sample);
            });
            await page.getByRole('button',{name:'▷ もういっかい',exact:true}).waitFor({timeout:30000});
            const run=await page.evaluate(()=>{
                window.measuringPark=false;const values=window.frameIntervals.sort((a,b)=>a-b);return {count:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:values[Math.floor(values.length*.95)],maxMs:values.at(-1),over33ms:values.filter(ms=>ms>33.34).length};
            });
            assert(run.count>30,'No valid render cadence samples');if(repeat>=0)runs.push(run);
        }
        const info=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),...JSON.parse(c.dataset.renderInfo)};});
        const idle=await page.locator('canvas').getAttribute('data-frames');await page.waitForTimeout(500);assert.equal(await page.locator('canvas').getAttribute('data-frames'),idle);
        results.push({viewport,deviceScaleFactor:2,info,runs,meanFps:runs.map(r=>1000/r.meanMs),idleDrawsOver500ms:0});await context.close();
    }
    await fs.writeFile('output/playwright/park-three/performance.json',JSON.stringify({target:base,revision:'4102126-park-three-review',candidate:'park-three-resin-v1',browser:browser.version(),headless:true,gpuMode:metal?'metal':'default',physicalMobile:false,measurement:'RAF cadence of changes to actual renderer frame count; no GPU timer query',warmupReplays:1,measuredReplaysPerViewport:3,screenshots:false,video:false,cpuThrottle:1,results},null,2));
    console.log('PASS render cadence',results.map(r=>({viewport:r.viewport,meanFps:r.meanFps,runs:r.runs})));
}finally{await browser.close();}
