import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {seedLearningProfile} from './island-learning-fixtures.mjs';
import {readNative} from './island-e2e-helpers.mjs';
const url=process.env.SANSU_CORRECTION_URL || 'http://127.0.0.1:5697',out=process.env.SANSU_CORRECTION_OUTPUT || 'output/entry-correction';await mkdir(out,{recursive:true});const b=await chromium.launch(),report=[];
function answer(question){const terms=question.replace(/\s*=\s*$/,'').split(/\s*\+\s*/).map(t=>{const m=t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);assert(m,question);return [Number(m[1]||0),Number(m[2]),Number(m[3])];});const [a,c]=terms;let n=a[1]*c[2]+c[1]*a[2],d=a[2]*c[2];let whole=a[0]+c[0];if(a[0]||c[0]){whole+=Math.floor(n/d);n%=d;}const gcd=(a,b)=>b?gcd(b,a%b):a;let g=gcd(n,d);n/=g;d/=g;return whole?[String(whole),String(n),String(d)]:d===1?[String(n)]:[String(n),String(d)];}
try{for(const width of [390,768])for(const lane of ['island','study'])for(const scenario of ['mixed','integer']){
 const row={width,lane,scenario,errors:[]};report.push(row);let c,p,id,values,root,oldId,question;
 try{
  for(let attempt=0;attempt<20;attempt++){
   if(c)await c.close();c=await b.newContext({viewport:{width,height:width===390?844:1024},hasTouch:width===390,reducedMotion:'reduce'});p=await c.newPage();p.setDefaultTimeout(30000);p.on('pageerror',e=>row.errors.push(e.message));
   await p.goto(url+'/#/onboarding');await p.getByRole('button',{name:'まなぶ',exact:true}).waitFor();const skill=scenario==='mixed'?'frac_mixed':'frac_add_same';id=await seedLearningProfile(p,{skill,type:'number'});
   await p.goto(url+(lane==='island'?'/#/island':'/#/study?session=review&force_review=1&focus_subject=math&focus_ids='+skill));if(lane==='island')await p.getByRole('button',{name:'まなぶ',exact:true}).click();
   root=p.locator(lane==='island'?'.park-answer':'[data-study-question-id]');await root.locator('[data-answer-shape]').first().waitFor();oldId=await root.getAttribute(lane==='island'?'data-problem-id':'data-study-question-id');
   if(lane==='island'){const s=await readNative(p,id),q=s.plan.slots[s.plan.cursor].problem;question=q.questionText;values=Array.isArray(q.correctAnswer)?q.correctAnswer:[q.correctAnswer];if(values.length===2&&values[1]==='1')values=[values[0]];}else {question=await root.getAttribute('data-question-text');values=answer(question);}
   if(scenario==='mixed'||values.length===1){row.sampleAttempts=attempt+1;break;}
  }
  assert.equal(values.length,scenario==='mixed'?3:1);row.question=question;row.values=values;
  const tap=async l=>width===390?l.tap():l.click();const keys=p.getByRole('group',{name:'すうじ キーパッド'});const write=async text=>{for(const ch of text){if(width===390)await tap(keys.getByRole('button',{name:ch,exact:true}));else await p.keyboard.type(ch);}};
  const before=await readNative(p,id);
  if(scenario==='mixed'){
   await write(values[0]);await write('9'.repeat(values[1].length));
   const numerator=p.getByRole('button',{name:'分子',exact:true});const previous=await numerator.innerText();await tap(numerator);assert.equal(await numerator.innerText(),previous);assert.equal(await numerator.getAttribute('data-replace-selected'),'true');
   await p.keyboard.press('.');assert.equal(await numerator.innerText(),previous);
   await write(values[1]);assert.equal(await p.getByRole('button',{name:'整数',exact:true}).locator('.answer-cell').allTextContents().then(a=>a.join('')),values[0]);
   await tap(keys.getByRole('button',{name:'こたえを けす',exact:true}));assert.equal(await root.locator('.answer-cell[data-filled=true]').count(),0);assert.equal(await p.getByRole('button',{name:'整数',exact:true}).getAttribute('aria-pressed'),'true');
   await write(values[0]);await write(values[1]);
   const integer=p.getByRole('button',{name:'整数',exact:true});await tap(integer);await write('8');await tap(integer);await write(values[0]);
   assert.equal(await numerator.locator('.answer-cell').allTextContents().then(a=>a.join('')),values[1]);
   await p.screenshot({path:`${out}/${lane}-${width}-correction.png`});await write(values[2]);
  }else{
   assert.equal(await root.locator('[data-answer-shape]').count(),1);assert.equal(await root.locator('[data-number-layout]').count(),0);
   if(lane==='island'){const s=await readNative(p,id);assert.deepEqual(s.plan.slots[s.plan.cursor].problem.correctAnswer,[values[0],'1']);}
   await p.screenshot({path:`${out}/${lane}-${width}-integer.png`});await write(values[0]);
  }
  await p.waitForFunction(({lane,id})=>document.querySelector(lane==='island'?'.park-answer':'[data-study-question-id]')?.getAttribute(lane==='island'?'data-problem-id':'data-study-question-id')!==id,{lane,id:oldId});
  const after=await readNative(p,id);assert.equal(after.logs.length,before.logs.length+1);assert.equal(after.logs.at(-1).result,'correct');if(lane==='island')assert.equal(after.plan.cursor,before.plan.cursor+1);
  row.pass=true;console.log('PASS',lane,width,scenario);
 }catch(e){row.pass=false;row.error=e.stack;if(p)await p.screenshot({path:`${out}/FAIL-${lane}-${width}-${scenario}.png`});console.log('FAIL',lane,width,scenario,e.message);}finally{if(c)await c.close();}
}}finally{await b.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
if(report.some(r=>!r.pass||r.errors.length))process.exitCode=1;
