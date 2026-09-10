import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {seedLearningProfile} from './island-learning-fixtures.mjs';
import {readNative} from './island-e2e-helpers.mjs';
const url=process.env.SANSU_NATURAL_INPUT_URL || 'http://127.0.0.1:5697', out=process.env.SANSU_NATURAL_INPUT_OUTPUT || 'output/natural-input';
await mkdir(out,{recursive:true});const browser=await chromium.launch(),report=[];
function mixedAnswer(question){
 const terms=question.replace(/\s*=\s*$/,'').split(/\s*\+\s*/).map(t=>{const m=t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);assert(m,question);return [Number(m[1]||0),Number(m[2]),Number(m[3])];});
 const [a,b]=terms;let n=a[1]*b[2]+b[1]*a[2],d=a[2]*b[2];const whole=a[0]+b[0]+Math.floor(n/d);n%=d;
 const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(n,d);return [String(whole),String(n/g),String(d/g)];
}
try{for(const width of [390,768])for(const lane of ['island','study'])for(const scenario of ['decimal','mixed']){
 const result={width,lane,scenario,errors:[]};report.push(result);let context,page;
 try{
  let id,root,oldId,values;
  for(let attempt=0;attempt<15;attempt++){
   if(context)await context.close();context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.message));
   await page.goto(url+'/#/onboarding');await page.getByRole('button',{name:'まなぶ',exact:true}).waitFor();const skill=scenario==='decimal'?'dec_add':'frac_mixed';id=await seedLearningProfile(page,{skill,type:'number'});
   await page.goto(url+(lane==='island'?'/#/island':'/#/study?session=review&force_review=1&focus_subject=math&focus_ids='+skill));if(lane==='island')await page.getByRole('button',{name:'まなぶ',exact:true}).click();
   root=page.locator(lane==='island'?'.park-answer':'[data-study-question-id]');await root.locator('[data-answer-shape]').first().waitFor();oldId=await root.getAttribute(lane==='island'?'data-problem-id':'data-study-question-id');
   let question;
   if(lane==='island'){const state=await readNative(page,id),p=state.plan.slots[state.plan.cursor].problem;question=p.questionText;values=Array.isArray(p.correctAnswer)?p.correctAnswer:[p.correctAnswer];}
   else {question=await root.getAttribute('data-question-text');if(scenario==='mixed')values=mixedAnswer(question);else{const m=question.match(/([\d.]+)\s*\+\s*([\d.]+)/);assert(m);values=[String(Math.round((Number(m[1])+Number(m[2]))*10000)/10000)];}}
   result.question=question;result.answer=values;
   if(scenario==='mixed'||values[0].includes('.'))break;
  }
  const keypad=page.getByRole('group',{name:'すうじ キーパッド'}),field=root.getByRole('button',{name:scenario==='mixed'?'整数':'こたえ',exact:true});
  const write=async text=>{for(const ch of text){if(width===390)await keypad.getByRole('button',{name:ch==='.'?'しょうすうてん':ch,exact:true}).tap();else await page.keyboard.type(ch);}};
  const enter=async locator=>{await locator.focus();await page.keyboard.press('Enter');};
  const contents=async locator=>(await locator.locator('.answer-cell[data-filled=true]').allTextContents()).join('');
  const before=await readNative(page,id);
  if(scenario==='decimal')await write(values[0].slice(0,-1));else{await write(values[0]);await write(values[1]);}
  await field.tap();await keypad.getByRole('button',{name:'ひとつ もどす',exact:true}).tap();
  assert.equal(await contents(field),'','Backspace must delete the entire selection');
  if(scenario==='mixed')assert.equal(await contents(root.getByRole('button',{name:'分子',exact:true})),values[1]);
  await enter(keypad.getByRole('button',{name:'7',exact:true}));assert.equal(await contents(field),'7','Enter must press the focused number key');
  await enter(keypad.getByRole('button',{name:'こたえを けす',exact:true}));assert.equal(await root.locator('.answer-cell[data-filled=true]').count(),0,'Enter must press Clear');
  await write(values[0][0]);await enter(field);assert.equal(await field.getAttribute('data-replace-selected'),'true','Enter on the field selects it');
  await page.keyboard.press('Backspace');assert.equal(await contents(field),'');
  await page.keyboard.press('Escape');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const escaped=await readNative(page,id);assert.equal(escaped.logs.length,before.logs.length,'Escape must not log a skipped answer');assert.equal(await root.getAttribute(lane==='island'?'data-problem-id':'data-study-question-id'),oldId);
  result.confirmLabelLines = await keypad.locator('[data-keypad-submit] span').evaluate(span => { const range = document.createRange(); range.selectNodeContents(span); return range.getClientRects().length; });
  assert.equal(result.confirmLabelLines, 1, 'The confirmation label must stay on one line');
  await page.screenshot({path:`${out}/${lane}-${width}-${scenario}.png`});
  for(const value of values)await write(value);
  await page.waitForFunction(({lane,oldId})=>document.querySelector(lane==='island'?'.park-answer':'[data-study-question-id]')?.getAttribute(lane==='island'?'data-problem-id':'data-study-question-id')!==oldId,{lane,oldId});
  const after=await readNative(page,id);assert.equal(after.logs.length,before.logs.length+1);assert.equal(after.logs.at(-1).result,'correct');if(lane==='island')assert.equal(after.plan.cursor,before.plan.cursor+1);
  result.pass=true;console.log('PASS',lane,width,scenario);
 }catch(error){result.pass=false;result.error=error.stack;if(page)await page.screenshot({path:`${out}/FAIL-${lane}-${width}-${scenario}.png`}).catch(()=>{});console.log('FAIL',lane,width,scenario,error.message);}finally{if(context)await context.close();}
}}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
if(report.some(result=>!result.pass||result.errors.length))process.exitCode=1;
