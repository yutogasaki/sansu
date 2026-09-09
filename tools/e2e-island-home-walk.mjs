import * as THREE from 'three';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { seedNative, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
const out = process.env.HOUSE_UX_OUTPUT || new URL('../output/house-walk/', import.meta.url).pathname;
await fs.mkdir(out,{recursive:true});
const base = process.env.HOUSE_UX_URL || 'http://127.0.0.1:5198';
const browser = await chromium.launch();
const report = {base, fixture:'Profile and completedSets=5 are explicit diagnostic fixtures; not evidence of earning awards through learning.', scenarios:[], captures:[], errors:[], pass:false};
try {
 for (const width of (process.env.HOUSE_UX_WIDTH ? [Number(process.env.HOUSE_UX_WIDTH)] : [390,768])) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:width===390?'no-preference':'reduce',hasTouch:true});
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
  const nav=page.locator('.island-shell-nav');
  const roomReady=async()=>{await page.waitForFunction(()=>{const e=document.querySelector('[data-renderer="three"]');return e&&JSON.parse(e.getAttribute('data-keepsake-room')||'null')?.visible&&Number(e.getAttribute('data-draw-calls'))>10;});await page.waitForTimeout(700);};
  const capture=async name=>{const file=`${width}-${name}.png`;await page.screenshot({path:out+file,animations:'disabled'});console.log('capture',file);report.captures.push({file,...await runtimeMetadata(page),room:await page.locator('[data-renderer="three"]').first().getAttribute('data-keepsake-room')});};
  await page.goto(base);await page.locator('[data-onboarding-world="island"]').waitFor({state:'attached'});const id=await seedNative(page,crypto.randomUUID());await page.goto(base);await nav.waitFor();await page.locator('[data-renderer="three"] canvas').waitFor();await page.waitForTimeout(1200);await capture('island');
  await nav.getByRole('button',{name:'いえ',exact:true}).tap();await roomReady();await capture('house-empty');
  const walker=page.locator('[data-home-resident]');
  const beforeWalk=JSON.parse(await walker.getAttribute('data-home-resident'));
  assert(beforeWalk.visible);
  const cameraValues=(await walker.getAttribute('data-camera-frame')).split(',').map(Number);
  const camera=new THREE.PerspectiveCamera();camera.matrixWorld.fromArray(cameraValues.slice(0,16));camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.projectionMatrix.fromArray(cameraValues.slice(16));
  const destination=new THREE.Vector3(1.8,.035,1.1).multiplyScalar(.26).add(new THREE.Vector3(-2.6,.18,-2.25)).project(camera);
  const bounds=await walker.boundingBox();await page.touchscreen.tap(bounds.x+(destination.x+1)*bounds.width/2,bounds.y+(1-destination.y)*bounds.height/2);
  await page.waitForFunction(()=>{const w=JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident);return w.position[0]>1.7&&!w.moving;});
  const afterWalk=JSON.parse(await walker.getAttribute('data-home-resident'));assert(afterWalk.position[0]>1.7);
  await capture('walk-arrived');
  await walker.focus();await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>{const w=JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident);return w.position[0]<1.5&&!w.moving;});

  const navTop=(await nav.boundingBox()).y;
  for(const action of ['album','open-keepsakes','notices']) {
   const control=page.locator(`[data-keepsake-action="${action}"]`);const box=await control.boundingBox();assert(box.height>=44);assert(box.y+box.height<=navTop,`${width} ${action} visible before scroll`);
   assert(await control.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  }
  await page.locator('[data-keepsake-action="notices"]').tap();await page.getByText('いまは あたらしい おしらせは ないよ').waitFor();await capture('notices');await page.locator('[data-keepsake-action="home"]').tap();
  // Tap the actual tabletop album using the renderer's projected target.
  const host=page.locator('[data-renderer="three"]');const target=await host.evaluate(e=>JSON.parse(e.dataset.homeTargets).find(t=>t.type==='album'));const rect=await host.boundingBox();console.log('album target',target,rect,await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.slice(0,250),{x:rect.x+target.x,y:rect.y+target.y}));await capture('before-album-tap');await host.evaluate(e=>{window.housePointerEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])e.addEventListener(type,event=>window.housePointerEvents.push({type:event.type,button:event.button,x:event.clientX,y:event.clientY}));});await page.touchscreen.tap(rect.x+target.x,rect.y+target.y);await page.locator('.island-page[data-mode="album"]').waitFor({state:'attached'});await capture('album');
  await nav.getByRole('button',{name:'いえ',exact:true}).tap();await roomReady();
  // Only the diagnostic award qualification is seeded; display/store use real UI transactions.
  await page.evaluate(async id=>{const r=indexedDB.open('SansuDatabase');const db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));const tx=db.transaction('islands','readwrite');const store=tx.objectStore('islands');const read=store.get(id);read.onsuccess=()=>store.put({...read.result,completedSets:5});await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=no;});db.close();},id);
  await page.reload();await roomReady();await page.locator('[data-keepsake-action="open-keepsakes"]').tap();
  await page.locator('[data-keepsake-action="display"]').tap();await page.locator('[data-keepsake-action="store"]').waitFor();await capture('certificate-displayed');
  assert((await readNative(page,id)).island.learningKeepsakes.displayed.includes('first-completion'));
  await page.locator('[data-keepsake-action="store"]').tap();await page.locator('[data-keepsake-action="display"]').waitFor();assert.equal((await readNative(page,id)).island.learningKeepsakes.displayed.length,0);
  await page.locator('[data-keepsake-action="display-earned"]').tap();await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-renderer="three"]').dataset.keepsakeRoom).awards.filter(a=>a.visible).length===2);
  await page.locator('[data-keepsake-action="home"]').tap();await page.reload();await roomReady();assert.equal((await readNative(page,id)).island.learningKeepsakes.displayed.length,2);await capture('house-earned');
  await page.locator('[data-keepsake-action="close"]').tap();await page.locator('.island-page[data-mode="home"]').waitFor({state:'attached'});
  assert.equal(report.errors.length,0);report.scenarios.push({width,pass:true,checks:['floor tap walks the indoor otter', 'arrow key moves the same indoor rig', 'first-screen destinations and 44px hit targets','direct challenge preserved','empty notices and back','actual 3D album tap','display/store/display-all/reload','exit to island']});await context.close();
 }
 report.pass=true;
} catch(e){report.failure=e.stack;throw e;} finally {await fs.writeFile(out+'report.json',JSON.stringify(report,null,2));await browser.close();}
