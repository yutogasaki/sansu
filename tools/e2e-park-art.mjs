import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5187';
const out=process.env.SANSU_PARK_ART_OUTPUT || 'output/playwright/park-art';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,candidate:'park-resin-blender-v1',flag:'VITE_BUILD_PLAY_ENABLED=true',scenarios:[],errors:[]};
const manifest=JSON.parse(await fs.readFile('src/components/park/artManifest.json','utf8'));
const capture=async(page,name)=>{
    await page.evaluate(()=>document.querySelector('.park-page').scrollTo(0,0));
    await page.screenshot({path:`${out}/${name}.png`});
};

try {
    for (const viewport of [{width:390,height:844},{width:768,height:1024}]) {
        const context=await browser.newContext({viewport,recordVideo:{dir:`${out}/video`,size:viewport}});
        const page=await context.newPage();
        page.on('pageerror',e=>report.errors.push(e.message));
        page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
        await page.goto(`${base}/#/park`);
        await page.waitForURL('**/#/onboarding');
        const id=await page.evaluate(async()=>{
            const {createInitialProfile}=await import('/src/domain/user/profile.ts');
            const {saveProfile,setActiveProfileId}=await import('/src/domain/user/repository.ts');
            const {openPark}=await import('/src/domain/park/repository.ts');
            const profile=createInitialProfile('つむぎ',2,1,1,'math');profile.soundEnabled=false;
            await saveProfile(profile);await setActiveProfileId(profile.id);await openPark(profile.id);return profile.id;
        });
        await page.goto(`${base}/#/park`);
        await page.locator('[data-game-id]').waitFor();
        const revision=await page.locator('[data-game-id]').getAttribute('data-build-revision');
        assert.equal(await page.locator('[data-game-id]').getAttribute('data-visual-candidate-id'),report.candidate);
        await page.waitForFunction(()=>[...document.querySelectorAll('svg image')].every(el=>{const im=new Image();im.src=el.getAttribute('href');return im.complete&&im.naturalWidth>0;}));
        await capture(page,`${viewport.width}-a-ready`);
        const readySize=await page.locator('[data-sprite="actor-violet-stand"]').evaluate(el=>el.getBoundingClientRect().height/3.2);
        const arrange=async kinds=>{
            await page.evaluate(async({id,kinds})=>{
                const {db}=await import('/src/db/index.ts');const park=await db.parks.get(id);
                park.parts=kinds.filter(Boolean).map((kind,i)=>({id:`visual-${i}`,kind,createdAt:new Date().toISOString()}));
                let cursor=0;park.courses[0].slots=kinds.map(k=>k?park.parts[cursor++].id:null);
                park.activeCourseId=park.courses[0].id;park.revision++;await db.parks.put(park);
            },{id,kinds});
            await page.reload();await page.locator('[data-game-id]').waitFor();
        };
        const replay=()=>page.getByRole('button',{name:'▷ あそばせる',exact:true}).click();
        const done=()=>page.getByRole('button',{name:'▷ もういっかい',exact:true}).waitFor({timeout:20000});
        await arrange(['slide','trampoline','bubble']);await replay();
        await page.waitForFunction(()=>Number(document.querySelector('[data-toy-action="jump"]')?.getAttribute('data-world-z'))>2.9);
        assert.equal(await page.locator('[data-toy-action="jump"]').getAttribute('data-bubble-visible'),'false');
        await capture(page,`${viewport.width}-b-apex`);await done();
        await capture(page,`${viewport.width}-b-landed`);
        await arrange(['slide','bubble','trampoline']);await replay();
        await page.locator('[data-toy-action="bubble"][data-bubble-visible="true"]').waitFor({timeout:12000});
        await capture(page,`${viewport.width}-c-attached`);
        await page.waitForFunction(()=>Number(document.querySelector('[data-toy-action="jump"]')?.getAttribute('data-world-z'))>2.9);
        assert.equal(await page.locator('[data-toy-action="jump"]').getAttribute('data-bubble-visible'),'true');
        await capture(page,`${viewport.width}-c-apex`);
        await page.locator('[data-toy-action="jump"][data-bubble-popped="true"]').waitFor();
        await capture(page,`${viewport.width}-c-pop`);await done();
        await arrange(['slide','bubble','trampoline','bubble','paint','bell']);
        await capture(page,`${viewport.width}-six-left`);
        const sixSize=await page.locator('[data-sprite="actor-violet-stand"]').evaluate(el=>el.getBoundingClientRect().height/3.2);
        assert(Math.abs(sixSize-readySize)<1,'Actor scale changed with course length');
        await page.getByRole('button',{name:'みぎを みる',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.park-stage-viewport').scrollLeft>100);
        await capture(page,`${viewport.width}-six-right`);
        await replay();await done();
        const rect=await page.locator('[data-toy-action="finish"] image').evaluate(el=>{
            const matrix=el.getScreenCTM(), x=Number(el.getAttribute('x'))+192,y=Number(el.getAttribute('y'))+267;
            const point=new DOMPoint(x,y).matrixTransform(matrix);return {x:point.x,y:point.y};
        });
        assert(rect.x>0&&rect.x<viewport.width,'Final landing outside the visible stage');
        const spriteName=await page.locator('[data-toy-action="finish"] image').getAttribute('data-sprite');
        assert(spriteName.startsWith('actor-pink-'),'Paint state did not survive to finish');
        const actorBounds=await page.locator('[data-toy-action="finish"] image').evaluate((el,sprite)=>{
            const x=Number(el.getAttribute('x')),y=Number(el.getAttribute('y')),matrix=el.getScreenCTM();
            const a=new DOMPoint(x+sprite.bounds[0],y+sprite.bounds[1]).matrixTransform(matrix);
            const b=new DOMPoint(x+sprite.bounds[2],y+sprite.bounds[3]).matrixTransform(matrix);
            const clip=el.closest('.park-stage-viewport').getBoundingClientRect();
            return {left:a.x,right:b.x,top:a.y,bottom:b.y,clipTop:clip.top,clipBottom:clip.bottom};
        },manifest.sprites[spriteName]);
        assert(actorBounds.left>=0&&actorBounds.right<=viewport.width&&actorBounds.top>=actorBounds.clipTop&&actorBounds.bottom<=actorBounds.clipBottom,`Actor clipped: ${JSON.stringify(actorBounds)}`);
        await capture(page,`${viewport.width}-six-finish`);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        report.scenarios.push({viewport,revision,actorUnitCssPixels:readySize,sixUnitCssPixels:sixSize,pass:true});
        console.log(`PASS art ${viewport.width}`);
        await context.close();
    }
    assert.deepEqual(report.errors,[]);
    await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
} finally {await browser.close();}
