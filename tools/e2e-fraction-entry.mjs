import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {seedLearningProfile} from './island-learning-fixtures.mjs';
import {readNative} from './island-e2e-helpers.mjs';
const out=process.env.SANSU_FRACTION_OUTPUT || 'output/fraction-entry',url=process.env.SANSU_FRACTION_URL || 'http://127.0.0.1:5697';
await mkdir(out,{recursive:true});
const b=await chromium.launch();const results=[];
try {for(const width of [390,768])for(const route of ['island','study'])for(const skill of ['frac_add_same','frac_mixed']) {
 const c=await b.newContext({viewport:{width,height:width===390?844:1024},hasTouch:width===390,reducedMotion:'reduce'}),p=await c.newPage();p.setDefaultTimeout(30000);
 const row={width,route,skill,errors:[]};results.push(row);p.on('pageerror',e=>row.errors.push(e.message));
 const tap=async l=>width===390?l.tap():l.click();
 try{
 await p.goto(url+'/#/onboarding');await p.getByRole('button',{name:'まなぶ',exact:true}).waitFor();const id=await seedLearningProfile(p,{skill,type:'multi-number'});
 await p.goto(url+(route==='island'?'/#/island':'/#/study?session=review&force_review=1&focus_subject=math&focus_ids='+skill));
 if(route==='island')await tap(p.getByRole('button',{name:'まなぶ',exact:true}));
 const layout=p.locator('[data-number-layout]');await layout.waitFor();assert.equal(await layout.getAttribute('data-number-layout'),skill==='frac_mixed'?'mixed':'fraction');
 const boxes=layout.locator(':scope > *');const count=await boxes.count();
 const n=await boxes.nth(count-2).boundingBox(),d=await boxes.last().boundingBox();assert(n.y+n.height<d.y);assert(Math.abs(n.x+n.width/2-d.x-d.width/2)<2);
 if(count===3){const a=await boxes.first().boundingBox();assert(a.x+a.width<n.x);assert(a.y<d.y&&a.y+a.height>n.y);}
 const next=p.getByRole('button',{name:'つぎの欄へ',exact:true});assert(await next.isEnabled());
 const focus=async i=>tap(route==='island'?boxes.nth(i):boxes.nth(i).locator('div').first());
 const shapes=await layout.locator('[data-answer-shape]').evaluateAll(es=>es.map(e=>e.getAttribute('data-answer-shape')));
 await focus(count-2);await p.keyboard.type('9'.repeat(shapes[count-2].length));assert(await next.isDisabled());await p.keyboard.press('Backspace');assert(await next.isEnabled());
 await p.getByRole('button',{name:'こたえを けす',exact:true}).click();
 await focus(count-2);await tap(next);assert(await next.isDisabled());await p.keyboard.press('/');assert(await next.isDisabled());
 await tap(p.getByRole('button',{name:'カーソルを ひだりへ',exact:true}));assert(await next.isEnabled());
 let values;
 if(route==='island'){const s=await readNative(p,id);row.question=s.plan.slots[s.plan.cursor].problem.questionText;values=s.plan.slots[s.plan.cursor].problem.correctAnswer;}
 else {row.question=await p.locator('[data-study-index="0"]').getAttribute('data-question-text');const parts=row.question.replace(/\s*=\s*$/,'').split(/\s*\+\s*/);const parse=x=>{const m=x.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);assert(m,x);return [Number(m[1]||0)*Number(m[3])+Number(m[2]),Number(m[3])];};const [a,bb]=parts.map(parse);let nn=a[0]*bb[1]+bb[0]*a[1],dd=a[1]*bb[1];const integer=Math.floor(nn/dd);if(count===3)nn%=dd;const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(nn,dd);values=(count===3?[String(integer)]:[]).concat(String(nn/g),String(dd/g));}
 for(let i=0;i<count;i++){await focus(i);await tap(p.getByRole('button',{name:'こたえを けす',exact:true})); if(route==='island')break;}
 const oldId=route==='island'?await p.locator('.park-answer').getAttribute('data-problem-id'):'';
 for(let i=0;i<count;i++){await focus(i);const digits=i===count-1?values[i].slice(0,-1):values[i];for(const digit of digits)await tap(p.getByRole('button',{name:digit,exact:true}));}
 assert(await next.isDisabled());
 await p.keyboard.press('Enter');
 assert(await layout.isVisible());
 const keyRects=await p.getByRole('group',{name:'すうじ キーパッド'}).getByRole('button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height};}));
 assert(keyRects.every(r=>r.x>=0&&r.x+r.width<=width&&r.height>=44));row.keypadBottom=Math.max(...keyRects.map(r=>r.y+r.height));assert(row.keypadBottom<=(width===390?844:1024),'keypad below viewport');
 await p.screenshot({path:`${out}/${route}-${skill}-${width}.png`});
 await tap(p.getByRole('button',{name:values.at(-1).at(-1),exact:true}));
 if(route==='island'){await p.waitForFunction(id=>document.querySelector('.park-answer')?.getAttribute('data-problem-id')!==id,oldId);const s=await readNative(p,id);assert.equal(s.plan.cursor,1);}else await p.locator('[data-study-index="1"]').waitFor();
 row.pass=true;console.log('PASS',route,skill,width);
 }catch(e){row.pass=false;row.error=e.stack;await p.screenshot({path:`${out}/FAIL-${route}-${skill}-${width}.png`});console.log('FAIL',route,skill,width,e.message);}
 await c.close();
}}finally{await b.close();await writeFile(out+'/report.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass||r.errors.length))process.exitCode=1;
