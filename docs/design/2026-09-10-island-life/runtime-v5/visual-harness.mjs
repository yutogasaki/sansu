import { createRequire } from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire('/Users/yutogasaki/Projects/sansu/package.json')('playwright');
const base=process.env.SANSU_GARDEN_URL||'http://127.0.0.1:5252/',out=process.env.SANSU_GARDEN_OUTPUT||'/tmp/sansu-garden-draft';await mkdir(out,{recursive:true});
const {readNative}=await import('/tmp/sansu-island-life-v5/tools/island-e2e-helpers.mjs');
const browser=await chromium.launch();
try {const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});let errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(base);for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await page.getByRole('button',{name,exact:true}).first().click();await page.locator('.island-learning[data-input-ready="true"]').waitFor();await page.getByRole('button',{name:'とじる',exact:true}).click();await page.locator('.life-world[data-rendered="true"]').waitFor();
await page.locator('.life-wallet').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/phone-initial.png'});
const nativeBefore=await readNative(page);
await page.evaluate(async()=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {newLife,learningDay}=await import('/src/domain/islandLife/model.ts');const row=await lifeDb.worlds.toCollection().first();const start=Date.now()-8*3600000;const record=newLife(row.profileId,start);record.credits=Array.from({length:50},(_,i)=>({id:'visual-fixture-'+i,at:start,day:learningDay(start)}));record.actions=[{id:'expand',at:start+1,command:{type:'expand',side:'east'}},...[['flower',0,2],['flower',1,2],['flower',2,2],['flower',0,3],['flower',1,3],['flower',2,3],['swing',4,3],['swing',5,3],['swing',6,3],['bench',4,1],['lantern',6,1]].map(([kind,x,z],i)=>({id:'visual-item-'+i,at:start+2+i,command:{type:'buy',kind,cell:{x,z}}}))];await lifeDb.worlds.put(record)});
await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();await page.locator('.life-wallet').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/phone-grown.png'});let renderBefore,renderAfter;
if(process.env.SANSU_GARDEN_MEMORY==='1'){
await page.waitForTimeout(700);renderBefore=JSON.parse(await page.locator('.life-world').getAttribute('data-life-render'));
for(let i=0;i<3;i++){await page.getByRole('group',{name:'しまの ていれ'}).getByRole('button',{name:'つくる',exact:true}).click();await page.locator('[data-life-buy="flower"]').click();await page.locator('.life-placement summary').click();await page.locator('[data-life-cell]:enabled').first().click();await page.getByRole('button',{name:'やめる',exact:true}).click()}
await page.waitForTimeout(700);renderAfter=JSON.parse(await page.locator('.life-world').getAttribute('data-life-render'));
if(renderAfter.geometries>renderBefore.geometries||renderAfter.textures>renderBefore.textures)throw Error('Unreleased geometry or texture after three placement cancels');
}
if(JSON.stringify(nativeBefore)!==JSON.stringify(await readNative(page)))throw Error('Visual fixture changed native learning stores');
await writeFile(out+'/report.json',JSON.stringify({renderBefore,renderAfter,target:base,candidate:await page.locator('[data-life-candidate]').getAttribute('data-life-candidate'),fixture:'Explicit preview credits/actions and 8 hours, not earned learning evidence',errors},null,2));
}finally{await browser.close()}
