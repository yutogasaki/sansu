import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const target=process.env.SANSU_WORLD_FIRST_URL,out=process.env.SANSU_WORLD_FIRST_OUTPUT;await mkdir(out,{recursive:false});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await context.newPage();page.setDefaultTimeout(60000);
const report={target,version:await fetch(`${target}/version.json`).then(r=>r.json()),fixture:'Real onboarding, empty island, no injected records/credits/clocks. Responsive checks resize the same owner.',humanN:0,cases:[],errors:[],pass:false};page.on('pageerror',e=>report.errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
const ready=()=>page.locator('.life-world[data-rendered="true"]').waitFor();
try{
 await page.goto(target);for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await button(name).first().click();
 await page.locator('.island-learning[data-input-ready="true"]').waitFor();await button('とじる').click();await ready();
 for(const [name,width,height] of [['phone',390,844],['tablet',768,1024],['small',320,568],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:name==='tablet'?'reduce':'no-preference'});await ready();await page.evaluate(()=>document.fonts.ready);
  const sound=page.locator('.island-sound-button');const soundName=await sound.getAttribute('aria-label');if(soundName?.includes('音を とめる'))await sound.click();
  const tools=page.locator('.life-home-tools'),world=page.locator('.life-world');
  const bounds=await tools.boundingBox(),worldBounds=await world.boundingBox();assert(worldBounds.y+worldBounds.height<=bounds.y);
  assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
  for(const el of [button('つくる'),button('しまの ようす'),page.locator('.life-camera-tools>summary')])assert(await el.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  const style=await page.addStyleTag({content:await readFile(new URL('./before.css',import.meta.url),'utf8')});await page.screenshot({path:`${out}/${name}-before.png`});await style.evaluate(el=>el.remove());await page.screenshot({path:`${out}/${name}-after.png`});
  await button('つくる').focus();await page.screenshot({path:`${out}/${name}-focus.png`});await page.keyboard.press('Enter');await page.locator('.life-menu').waitFor();await page.screenshot({path:`${out}/${name}-build.png`});await button('メニューを とじる').click();assert(await button('つくる').evaluate(el=>el===document.activeElement));
  await button('しまの ようす').click();await button('しまの ようすを とじる').click();assert(await button('しまの ようす').evaluate(el=>el===document.activeElement));
  await page.locator('.life-camera-tools>summary').click();await page.screenshot({path:`${out}/${name}-camera.png`});await button('しま全体を みる').click();await button('くらしを みる').click();await page.locator('.life-camera-tools>summary').click();
  await page.getByRole('navigation',{name:'メインメニュー'}).getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('.island-learning[data-input-ready="true"]').waitFor();await page.screenshot({path:`${out}/${name}-learning.png`});await button('とじる').click();await ready();
  report.cases.push({name,width,height,bounds,worldBounds,pass:true});await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(`${name} PASS`);
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
