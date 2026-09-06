import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.SANSU_PARK_PRODUCTION_URL || 'http://127.0.0.1:5287';
const manifest=JSON.parse(await fs.readFile('src/components/park/artManifest.json','utf8'));
const files=Object.values(manifest.sprites).map(s=>`/assets/park/resin-v1/${s.file}`);
files.push(...['slide','trampoline','bubble'].map(kind=>`/assets/park/three-v1/${kind}-icon.png`));
const browser=await chromium.launch(process.env.SANSU_PARK_BROWSER_GPU === 'metal' ? {headless:true,args:['--use-angle=metal']} : {});
try {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    await page.goto(`${base}/#/park`);await page.waitForURL('**/#/onboarding');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await page.evaluate(async()=>{
        const request=indexedDB.open('SansuDatabase');
        const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        const profile={id:'park-offline-test',name:'つむぎ',grade:2,mathStartLevel:1,mathMainLevel:2,mathMaxUnlocked:2,
            vocabStartLevel:1,vocabMainLevel:1,vocabMaxUnlocked:1,subjectMode:'math',soundEnabled:false,
            mathSkills:{},vocabWords:{},mathLevels:[{level:2,unlocked:true,enabled:true,recentAnswersNonReview:[]}],streak:0,todayCount:0,recentAttempts:[]};
        const tx=db.transaction(['profiles','appData'],'readwrite');tx.objectStore('profiles').put(profile);
        tx.objectStore('appData').put({id:'app',schemaVersion:1,activeProfileId:profile.id,profiles:{[profile.id]:profile}});
        await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
        localStorage.setItem('sansu_active_profile',profile.id);db.close();
    });
    await page.goto(`${base}/#/park`);await page.locator('[data-game-id]').waitFor();
    await context.setOffline(true);await page.reload();await page.locator('canvas[data-frames]').waitFor();
    assert.equal(await page.locator('[data-art-candidate]').getAttribute('data-art-candidate'),'park-three-resin-v1');
    const loaded=await page.evaluate(files=>Promise.all(files.map(src=>new Promise(resolve=>{
        const image=new Image();image.onload=()=>resolve({src,ok:image.naturalWidth>0});image.onerror=()=>resolve({src,ok:false});image.src=src;
    }))),files);
    assert(loaded.every(x=>x.ok),`Offline art missing: ${JSON.stringify(loaded.filter(x=>!x.ok))}`);
    await page.getByRole('button',{name:'▷ あそばせる',exact:true}).click();
    await page.getByRole('button',{name:'▷ もういっかい',exact:true}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'つくる',exact:true}).click();
    await page.getByRole('button',{name:'シャボンゲートを つくる',exact:true}).click();
    await page.locator('.park-answer').waitFor();
    assert.equal(await page.locator('canvas').count(),0);
    const report={target:base,revision:await page.locator('[data-game-id]').getAttribute('data-build-revision'),
        candidate:await page.locator('[data-game-id]').getAttribute('data-visual-candidate-id'),serviceWorkerControlled:true,offlineAssets:loaded.length,replay:true,learning:true,pass:true};
    await fs.mkdir('output/playwright/park-three',{recursive:true});
    await fs.writeFile('output/playwright/park-three/offline-report.json',JSON.stringify(report,null,2));
    console.log(`PASS offline: ${loaded.length} UI/fallback assets and Three.js chunk, replay and learning, real service worker`);
    await context.close();
} finally {await browser.close();}
