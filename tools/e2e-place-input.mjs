import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
const base = process.env.SANSU_PLACE_URL ?? 'http://127.0.0.1:5689';
const out = process.env.SANSU_PLACE_OUTPUT ?? 'output/place-input';
await fs.mkdir(out, {recursive:true});
// A dev-only page, generated under ignored output; never included in the app build.
await fs.mkdir('output/place-input', {recursive:true});
await fs.writeFile('output/place-input/fixture.html', "<!doctype html><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><div id=\"root\"></div>\n<script type=\"module\">\nimport React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {LearningAnswerForm} from '/src/components/domain/LearningAnswerForm.tsx';\nimport '/src/index.css';\nimport '/src/components/island/IslandAnswerForm.css';\nconst root=createRoot(document.getElementById('root'));\nwindow.showFixture=(question,answer,version)=>{window.receipts=[];root.render(React.createElement(LearningAnswerForm,{key:question,slot:{problem:{id:question,subject:'math',categoryId:question.includes('\u00d7')?'dec_mul_dec':question.includes('\u00f7')?'dec_div_dec':'dec_add',questionText:question,correctAnswer:answer,inputType:'hissan',hissanVersion:version,isReview:false},source:'main',assisted:false,completed:false,countsTowardReviewCap:false},disabled:false,onAnswer:value=>window.receipts.push(value)}));};\nwindow.ready=true;\n</script>\n");
const browser = await chromium.launch();
const report = {scope:'Explicit component diagnostic fixtures; real LearningAnswerForm, no planner or persistence claims.',cases:[]};
try {
for (const width of [390,768]) {
 const page=await browser.newPage({viewport:{width,height:width===390?844:1024}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/output/place-input/fixture.html`);
 await page.waitForFunction(()=>window.ready);
 for (const [question,answer,entry] of [['12.3 + 4 =','16.3','163'],['3.5 - 0.78 =','2.72','272'],['0.9 + 0.1 =','1','1'],['0.1 × 0.2 =','0.02','002'],['1.2 ÷ 0.3 =','4','4'],['1000 - 999 =','1','1'],['0.5 + 0 =','0.50','05']]) {
  await page.evaluate(([q,a])=>window.showFixture(q,a),[question,answer]);
  const inputs=page.locator('[data-written-input]'); await inputs.first().waitFor();
  assert.equal(await inputs.count(),entry.length);
  assert.equal(await page.getByRole('button',{name:'.',exact:true}).count(),0);
  assert.equal(await inputs.first().getAttribute('data-active'),'true');
  if(entry.length>1){await page.keyboard.type('9');await page.keyboard.press('Backspace');}
  await page.screenshot({path:`${out}/${width}-${report.cases.length}-before.png`});
  await page.keyboard.type(entry,{delay:35});
  await page.waitForFunction(()=>window.receipts.length===1);
  assert.deepEqual(await page.evaluate(()=>window.receipts[0]),[...answer].reverse());
  const positions=await inputs.evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,right:b.right,width:b.width};}));
  assert(positions.every(p=>p.x>=0&&p.right<=width&&p.width>=40));
  await page.screenshot({path:`${out}/${width}-${report.cases.length}-after.png`});
  report.cases.push({width,question,entry,pass:true});
 }
 assert.deepEqual(errors,[]);await page.close();
}
report.pass=true;
} finally {await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
