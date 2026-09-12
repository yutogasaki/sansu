import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { waitForPageState } from './async-state-checks.mjs';

const base = process.env.SANSU_WRITTEN_BASE_URL || 'http://127.0.0.1:5201';
const parkBase = process.env.SANSU_WRITTEN_PARK_BASE_URL || 'http://127.0.0.1:5202';
const out = process.env.SANSU_WRITTEN_ROUTES_OUTPUT || 'output/playwright/written-routes';
const filter = process.env.SANSU_WRITTEN_ROUTES_SCENARIO;
const built = await build({ stdin: { contents: `export { generateWrittenArithmeticGrid } from './src/domain/math/writtenArithmetic.ts'; export { generateHissanGrid } from './src/domain/math/hissanEngine.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const engine = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const sourcePaths = ['src/hooks/useHissanSession.ts', 'src/pages/Study.tsx', 'src/pages/StudyLayout.tsx', 'src/components/domain/LearningAnswerForm.tsx', 'src/components/domain/WrittenArithmeticGrid.tsx', 'src/components/domain/WrittenArithmeticGrid.css', 'src/domain/math/writtenArithmetic.ts', 'src/domain/park/learning.ts', 'tools/e2e-written-routes.mjs', 'tools/async-state-checks.mjs'];
const snapshot = async () => Promise.all(sourcePaths.map(async path => ({ path, sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') })));
await fs.mkdir(out, { recursive: true });
const report = { target: base, parkTarget: parkBase, startedAt: new Date().toISOString(), evidenceScope: 'Study uses supported focus_subject / focus_ids with actual generators and learning writer. Park uses actual normal planner after native profile/memory setup. Expected arithmetic executes in Node from visible expression. Legacy fixture is separately labeled synthetic saved-plan compatibility.', sourceStart: await snapshot(), scenarios: [], captures: [], pass: false };
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const written = page => page.locator('.written-arithmetic');
const cell = (page, row, col) => page.locator(`[data-written-input="${row}-${col}"]`);
async function read(page, profileId) {
    return page.evaluate(async profileId => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const entries = await Promise.all(['parks', 'parkPlans', 'logs', 'parkEvents'].map(async name => {
            const query = db.transaction(name).objectStore(name).getAll();
            const rows = await new Promise((resolve, reject) => { query.onsuccess = () => resolve(query.result); query.onerror = () => reject(query.error); });
            return [name, rows.filter(row => row.profileId === profileId)];
        }));
        db.close();
        const state = Object.fromEntries(entries);
        return { ...state, plan: state.parkPlans.find(plan => plan.id === state.parks[0]?.pendingPlanId) };
    }, profileId);
}
async function capture(page, name) {
    const file = `${name}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', timeout: 5000 });
    report.captures.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), url: page.url(), viewport: page.viewportSize(), step: await written(page).getAttribute('data-written-step').catch(() => null), phase: await written(page).getAttribute('data-written-phase').catch(() => null) });
}
async function controls(page) {
    const rows = await page.locator('[aria-label="すうじ キーパッド"] button, [data-written-input]').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return { label: element.getAttribute('aria-label'), cell: element.getAttribute('data-written-input'), x:r.x,y:r.y,width:r.width,height:r.height, inViewport:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1, hit:element===hit||element.contains(hit), disabled:element.disabled };
    }));
    for (const digit of '0123456789') assert(rows.some(row => row.label===digit), `Full keypad includes ${digit}`);
    assert(rows.some(row=>row.label==='こたえを けす') && rows.some(row=>row.label==='ひとつ もどす'));
    for (const row of rows) {
        assert(row.inViewport && (row.disabled || row.hit), `Visible/hittable ${JSON.stringify(row)}`);
        assert(row.width >= 43.5 && row.height >= 43.5, `Touch target ${JSON.stringify(row)}`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    return rows;
}
async function renderedGrid(page, skill) {
    const text = (await page.locator('.written-heading > span').first().innerText()).trim();
    const match=text.match(/^(\d+)\s*([×÷])\s*(\d+)$/); assert(match, `Visible expression ${text}`);
    const a=BigInt(match[1]),b=BigInt(match[3]);
    const answer=match[2]==='×' ? String(a*b) : skill.startsWith('div_rem') ? [String(a/b),String(a%b)] : String(a/b);
    const grid=engine.generateWrittenArithmeticGrid(`${text} =`,answer,
        skill.startsWith('div') ? { divisionInput: 'compact' } : undefined); assert(grid);
    return { grid,text,answer };
}
async function ensureStep(page, index) {
    await page.waitForFunction(index=>document.querySelector('.written-arithmetic')?.getAttribute('data-written-step')===String(index),index);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-written-input]')].some(e=>!e.disabled));
}
async function keyBatch(page, keys) {
    await page.evaluate(keys=> { for(const key of keys) document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})); }, keys);
}
async function checkEditing(page, grid, profileId) {
    const step=grid.steps[0], before=await read(page,profileId);
    await cell(page,step.rowIndex,step.inputCellIndices[0]).click();
    await page.keyboard.press('Enter');
    assert.equal(await written(page).getAttribute('data-written-step'),'0');
    assert.equal(await page.getByText('このだんを もういちど',{exact:true}).count(),0);
    assert.equal((await read(page,profileId)).logs.length,before.logs.length);
    if(step.inputCellIndices.length>1) {
        const cols=[...step.inputCellIndices].sort((a,b)=>a-b);
        await cell(page,step.rowIndex,cols[0]).click();
        await page.keyboard.press('ArrowRight');
        assert.equal(await cell(page,step.rowIndex,cols[1]).getAttribute('aria-pressed'),'true');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await cell(page,step.rowIndex,cols[0]).getAttribute('aria-pressed'),'true');
    }
    await button(page,'こたえを けす').click();
    await keyBatch(page,step.correctValues);
    for(const [i,col] of step.inputCellIndices.entries()) assert.equal(await cell(page,step.rowIndex,col).innerText(),step.correctValues[i]);
    await page.keyboard.press('Backspace');
    const last=step.inputCellIndices.at(-1);
    assert.equal(await cell(page,step.rowIndex,last).getAttribute('aria-pressed'),'true');
    assert(!/^\d$/.test(await cell(page,step.rowIndex,last).innerText()));
    await button(page,'こたえを けす').click();
    assert.equal(await cell(page,step.rowIndex,step.inputCellIndices[0]).getAttribute('aria-pressed'),'true');
}
const scenarios=[];
for(const route of ['study','park']) for(const viewport of [{name:'phone',width:390,height:844},{name:'tablet',width:768,height:1024}]) for(const skill of ['mul_3d2d','div_3d2d_exact','div_rem_q2']) scenarios.push({route,...viewport,skill,name:`${route}-${viewport.name}-${skill}`});
try {
    for(const scenario of scenarios.filter(s=>!filter||s.name===filter)) {
        const row={...scenario,pass:false,controls:[]}; report.scenarios.push(row);
        const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},reducedMotion:'reduce',serviceWorkers:'block'});
        const page=await context.newPage();page.setDefaultTimeout(15000);
        const errors=[];page.on('pageerror',error=>errors.push(error.stack));
        try {
            await page.goto(`${scenario.route==='park'?parkBase:base}/#/study`);await page.waitForURL('**/#/onboarding');
            const profileId=await seedLearningProfile(page,{skill:scenario.skill,type:'hissan'});row.profileId=profileId;
            const url=scenario.route==='study'?`${base}/#/study?focus_subject=math&focus_ids=${scenario.skill}`:`${parkBase}/#/park`;
            await page.goto(url);
            if(scenario.route==='park') {await button(page,'つくる').click();await button(page,'シャボンゲートを つくる').click();}
            await ensureStep(page,0);
            const {grid,text,answer}=await renderedGrid(page,scenario.skill);row.expression=text;row.answer=answer;row.steps=grid.steps.length;
            if(scenario.route==='park') {const state=await read(page,profileId);assert.equal(state.plan.slots[0].problem.categoryId,scenario.skill);assert.equal(state.plan.slots[0].problem.hissanVersion,scenario.skill.startsWith('div')?3:2);row.planId=state.plan.id;}
            row.controls.push({phase:'ready',rows:await controls(page)});await capture(page,`${scenario.name}-ready`);
            await checkEditing(page,grid,profileId);row.editing=true;
            for(const [index,step] of grid.steps.entries()) {
                await ensureStep(page,index);
                const original=(await read(page,profileId)).logs.length;
                await button(page,'こたえを けす').click();
                await keyBatch(page,step.correctValues);
                for(const [i,col] of step.inputCellIndices.entries()) assert.equal(await cell(page,step.rowIndex,col).innerText(),step.correctValues[i]);
                if(index===grid.steps.length-1) {row.controls.push({phase:'late',rows:await controls(page)});await capture(page,`${scenario.name}-late`);}
                // Native Enter from a focused cell must submit instead of activating it again.
                await cell(page,step.rowIndex,step.inputCellIndices[0]).click();
                if(index<grid.steps.length-1) {
                    await keyBatch(page,['Enter','Enter']);await ensureStep(page,index+1);
                    assert.equal((await read(page,profileId)).logs.length,original,'Intermediate steps do not write independent answers');
                    row.controls.push({phase:`step-${index+1}`,rows:await controls(page)});
                } else {
                    await keyBatch(page,['Enter','Enter']);
                    await waitForPageState(page,async profileId=>{
                        const request=indexedDB.open('SansuDatabase');const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
                        const q=db.transaction('logs').objectStore('logs').getAll();
                        const logs=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);}).finally(()=>db.close());
                        return logs.filter(log=>log.profileId===profileId).length===1;
                    },profileId,{timeout:15000,description:'one final written-answer log'});
                    const after=await read(page,profileId);assert.equal(after.logs.length,1);assert.equal(after.logs[0].result,'correct');
                    if(scenario.route==='park') {assert.equal(after.plan.cursor,1);await page.waitForFunction(id=>document.querySelector('.park-answer')?.getAttribute('data-problem-id')===id,after.plan.slots[1].problem.id);}
                    else {await ensureStep(page,0);assert.equal(await page.locator('[data-study-index]').getAttribute('data-study-index'),'1');assert.equal(await page.getByText('このだんを もういちど',{exact:true}).count(),0);}
                    row.nextProblem=true;
                }
            }
            assert.deepEqual(errors,[]);row.pass=true;console.log(`PASS ${scenario.name}: ${text}, ${grid.steps.length} steps`);
        } catch(error) {row.error=error.stack;await capture(page,`${scenario.name}-failure`).catch(()=>{});console.log(`FAIL ${scenario.name}: ${error.message}`);}
        finally {await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
    }

    if(!filter || filter==='park-tablet-legacy-resume') {
        const row={name:'park-tablet-legacy-resume',route:'park',width:768,height:1024,evidenceScope:'Synthetic saved-plan fixture: actual newly reserved multiplication retains its problem identity but has hissanVersion removed, hissanStep 0, and empty confirmed legacy values. This simulates an old four-row layout; it is separate from normal planner evidence.',pass:false};report.scenarios.push(row);
        const context=await browser.newContext({viewport:{width:768,height:1024},reducedMotion:'reduce',serviceWorkers:'block'});
        const page=await context.newPage();page.setDefaultTimeout(15000);
        try {
            await page.goto(`${parkBase}/#/park`);await page.waitForURL('**/#/onboarding');
            const profileId=await seedLearningProfile(page,{skill:'mul_3d2d',type:'hissan'});row.profileId=profileId;
            await page.goto(`${parkBase}/#/park`);await button(page,'つくる').click();await button(page,'シャボンゲートを つくる').click();await ensureStep(page,0);
            const state=await read(page,profileId);const plan=state.plan;const problem=plan.slots[0].problem;
            const grid=engine.generateHissanGrid(problem.categoryId,problem.questionText,problem.correctAnswer);
            assert.equal(grid.rows.length,4);assert.equal(grid.steps.length,1);assert.equal(grid.steps[0].rowIndex,3);
            delete problem.hissanVersion;plan.slots[0].hissanStep=0;plan.slots[0].hissanValues={};
            await page.evaluate(async plan=>{
                const request=indexedDB.open('SansuDatabase');const db=await new Promise(r=>request.onsuccess=()=>r(request.result));
                const tx=db.transaction('parkPlans','readwrite');tx.objectStore('parkPlans').put(plan);
                await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
            },plan);
            await page.reload();await button(page,'つづきから').click();await page.locator('.park-answer[data-input-type="hissan"]').waitFor();
            assert.equal(await written(page).count(),0);assert.deepEqual((await read(page,profileId)).plan,plan);
            const classicRows=page.locator('.park-question > div > div');assert.equal(await classicRows.count(),4);
            row.legacyCoordinates=grid.steps[0].inputCellIndices.map(col=>`3-${col}`);row.expression=problem.questionText;
            await page.screenshot({path:`${out}/park-tablet-legacy-resumed.png`,animations:'disabled'});
            await button(page,'こたえを けす').click();await keyBatch(page,grid.steps[0].correctValues);
            const lastRow=classicRows.nth(3);for(const [i,col] of grid.steps[0].inputCellIndices.entries()) assert.equal(await lastRow.locator(':scope > div').nth(col).innerText(),grid.steps[0].correctValues[i]);
            await button(page,'こたえる').click();
            await waitForPageState(page,async id=>{
                const request=indexedDB.open('SansuDatabase');const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
                const q=db.transaction('parkPlans').objectStore('parkPlans').get(id);
                const plan=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);}).finally(()=>db.close());return plan?.cursor===1;
            },plan.id,{timeout:15000,description:'legacy written plan cursor 1'});
            const after=await read(page,profileId);assert.equal(after.logs.length,1);assert.equal(after.logs[0].result,'correct');assert.equal(after.plan.slots[0].problem.hissanVersion,undefined);
            assert.equal(after.plan.id,plan.id);assert.equal(after.plan.cursor,1);
            for(const [i,col] of grid.steps[0].inputCellIndices.entries())assert.equal(after.plan.slots[0].hissanValues[`3-${col}`],grid.steps[0].correctValues[i]);
            await page.waitForFunction(id=>document.querySelector('.park-answer')?.getAttribute('data-problem-id')===id,after.plan.slots[1].problem.id);
            row.pass=true;console.log('PASS park-tablet-legacy-resume: unchanged four-row coordinates and one final log');
        } catch(error){row.error=error.stack;await page.screenshot({path:`${out}/park-tablet-legacy-failure.png`,animations:'disabled',timeout:5000}).catch(()=>{});console.log(`FAIL legacy resume: ${error.message}`);}
        finally{await context.close();}
    }
    report.sourceEnd=await snapshot();report.sourceStable=JSON.stringify(report.sourceStart)===JSON.stringify(report.sourceEnd);
    report.pass=report.scenarios.length>0&&report.scenarios.every(s=>s.pass);await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    assert(report.pass,'Written route checks failed; inspect report.json');
} finally {await browser.close();}
