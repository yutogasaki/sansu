import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { seedLearningProfile, expectedLearningModel } from './island-learning-fixtures.mjs';
import { readNative } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_PLACE_URL??'http://127.0.0.1:5689';
const out=process.env.SANSU_DECIMAL_OUTPUT??'output/place-input/native';
await fs.mkdir(out,{recursive:true});
const report={scope:'Native profile fixtures, actual planner, digit-only physical input and actual answer receipts.',cases:[]};
const browser=await chromium.launch();
try{
 for(const width of [390,768])for(const skill of ['dec_add','dec_sub','dec_mul_dec','dec_div_dec']){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1024},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/#/onboarding`);await page.getByRole('button',{name:'まなぶ',exact:true}).waitFor();
  const profile=await seedLearningProfile(page,{skill,type:'hissan'});
  await page.goto(`${base}/#/island`);await page.getByRole('button',{name:'まなぶ',exact:true}).click();
  await page.locator('[data-written-input][data-active="true"]').waitFor();
  const before=await readNative(page,profile),slot=before.plan.slots[before.plan.cursor];
  const step=expectedLearningModel(slot).steps[slot.hissanStep??0];
  // Real generators normalize trailing zeros. All visible numeric slots are entered.
  const digits=step.inputCellIndices.map((col,i)=>({col,value:step.correctValues[i]})).sort((a,b)=>a.col-b.col).map(c=>c.value).join('').replace('.','');
  assert.equal(await page.getByRole('button',{name:'しょうすうてん',exact:true}).count(),0);
  await page.screenshot({path:`${out}/${width}-${skill}.png`});
  await page.keyboard.type(digits,{delay:35});
  await page.waitForFunction(()=>!document.querySelector('[data-written-input]')||document.querySelector('[data-written-input][data-active="true"]')?.textContent?.trim()==='·');
  let after;
  for(let attempt=0;attempt<40;attempt++){after=await readNative(page,profile);if(after.islandEvents.some(e=>e.action?.type==='answer'&&!before.islandEvents.some(old=>old.id===e.id)))break;await page.waitForTimeout(100);}
  const receipts=after.islandEvents.filter(e=>e.action?.type==='answer'&&!before.islandEvents.some(old=>old.id===e.id));
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].result,'correct');
  assert.deepEqual(receipts[0].action.answer,step.correctValues);
  assert.deepEqual(errors,[]);
  report.cases.push({width,requestedSkill:skill,actualSkill:slot.problem.categoryId,question:slot.problem.questionText,digits,receipt:receipts[0],pass:true});
  await page.close();console.log(`PASS ${width} ${skill} ${digits}`);
 }
 report.pass=true;
}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
