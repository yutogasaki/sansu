import { chromium, webkit } from 'playwright';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { seedNative, readNative, waitReady, runtimeMetadata } from '../../../../tools/island-e2e-helpers.mjs';
const base = process.env.HOUSE_UI_URL || 'http://127.0.0.1:5381';
const out = process.env.HOUSE_UI_OUTPUT || 'output/playwright/house-room';
await fs.mkdir(out, { recursive: true });
const engine = process.env.HOUSE_UI_BROWSER || 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const report = { target: base, engine, fixture: 'Native profile only; real room gestures and menu/learning navigation.', scenarios: [], captures: [], pass: false };
try {
 for (const viewport of [{width:390,height:844},{width:768,height:1024}]) {
  const page = await browser.newPage({viewport, hasTouch:true, reducedMotion:viewport.width===390?'no-preference':'reduce'});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const capture=async name=>{const file=`${viewport.width}-${name}.png`;await page.screenshot({path:`${out}/${file}`});report.captures.push({file,...await runtimeMetadata(page),houseCandidate:await page.locator('.island-page').getAttribute('data-house-candidate'),cameraCandidate:await page.locator('[data-home-camera-candidate]').first().getAttribute('data-home-camera-candidate').catch(()=>null)});};
  await page.goto(base); await page.waitForURL('**/#/onboarding'); const id=await seedNative(page,randomUUID());
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.reload({waitUntil:'networkidle'});
  report.bootstrapErrors ??= [];report.bootstrapErrors.push({viewport,errors:[...errors]});errors.length=0;
  await page.locator('.life-world[data-rendered=true]').waitFor(); await capture('launch');
  await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).tap(); await waitReady(page); await capture('house');
  const walker=page.locator('[data-home-resident]');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident).visible);
  const before=await readNative(page,id);
  const values=(await walker.getAttribute('data-camera-frame')).split(',').map(Number);
  const camera=new THREE.PerspectiveCamera();camera.matrixWorld.fromArray(values.slice(0,16));camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.projectionMatrix.fromArray(values.slice(16));
  const point=new THREE.Vector3(1.8,.035,1.1).multiplyScalar(.26).add(new THREE.Vector3(-2.6,.18,-2.25)).project(camera);
  assert(Math.abs(point.x)<1 && Math.abs(point.y)<1, 'Walk target stays in the visible room');
  const bounds=await walker.boundingBox();await page.touchscreen.tap(bounds.x+(point.x+1)*bounds.width/2,bounds.y+(1-point.y)*bounds.height/2);
  await page.waitForFunction(()=>{const w=JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident);return w.position[0]>1.7&&!w.moving;});
  await capture('room-walk');
  await walker.focus();await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>{const w=JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident);return w.position[0]<1.5&&!w.moving;});
  for(let step=0;step<4;step++){
   await page.keyboard.press('ArrowRight');
   await page.waitForFunction(()=>!JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident).moving);
  }
  const edge=await walker.evaluate(el=>({resident:JSON.parse(el.dataset.homeResident),frame:el.dataset.cameraFrame.split(',').map(Number)}));
  const edgeCamera=new THREE.PerspectiveCamera();edgeCamera.matrixWorld.fromArray(edge.frame.slice(0,16));edgeCamera.matrixWorldInverse.copy(edgeCamera.matrixWorld).invert();edgeCamera.projectionMatrix.fromArray(edge.frame.slice(16));
  const edgePoint=new THREE.Vector3(edge.resident.position[0],.5,edge.resident.position[2]).multiplyScalar(.26).add(new THREE.Vector3(-2.6,.18,-2.25)).project(edgeCamera);
  assert(Math.abs(edgePoint.x)<.95 && Math.abs(edgePoint.y)<.95,'Keyboard walking keeps the resident on screen');
  await capture('room-edge');
  for(let step=0;step<3;step++){
   await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(()=>!JSON.parse(document.querySelector('[data-home-resident]').dataset.homeResident).moving);
  }
  const target=await walker.evaluate(el=>JSON.parse(el.dataset.homeTargets).find(t=>t.type==='album'));
  await page.touchscreen.tap(bounds.x+target.x,bounds.y+target.y);await page.locator('.island-page[data-mode=album]').waitFor();await capture('album');
  assert.deepEqual(await readNative(page,id),before);
  await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).tap();await waitReady(page);
  const trigger=page.getByRole('button',{name:'いえの メニュー',exact:true});
  await trigger.tap();await page.getByRole('dialog',{name:'いえの メニュー',exact:true}).waitFor();await capture('menu');await page.getByRole('button',{name:'いえの メニューを とじる',exact:true}).tap();
  await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-house-menu-trigger'));
  await trigger.tap();await page.locator('[data-keepsake-action=learn]').click();
  await page.locator('.island-page[data-mode=learning]').waitFor();await waitReady(page);await capture('learning-from-house-menu');
  const reserved=await readNative(page,id);assert(reserved.plan);
  await page.getByRole('button',{name:'とじる',exact:true}).click();await waitReady(page);
  assert.equal(await page.locator('.island-house-menu[open]').count(),0);
  assert.deepEqual(await readNative(page,id),reserved);await capture('learning-return');
  assert.deepEqual(errors,[]);report.scenarios.push({viewport,pass:true,checks:['floor touch','arrow key walking','resident stays visible at edge','real tabletop album touch','read-only 7 stores','menu close focus','learning from menu','same reservation on return']});await page.close();
 }
 report.pass=true;
} finally {await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
