import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2], output = path.resolve(process.argv[3]);
assert(url && output);
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch();
const report = {url,candidate:'promotion-learning-complete-v3',cases:[],pass:false};
const errors=[];
try {
  for (const width of [320,390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:width<600?844:1000},reducedMotion:width===768?'reduce':'no-preference'});
    const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.evaluate(()=>document.fonts.ready);
    const selector=page.locator('.growth-selector');
    for (const stage of ['start','village','town']) {
      const button=selector.locator(`[data-stage="${stage}"]`);
      await button.click();
      await page.waitForFunction(()=>document.querySelector('.growth-photo')?.getAttribute('aria-busy')==='false');
      assert.equal(await button.getAttribute('aria-pressed'),'true');
      assert((await page.locator('#growth-image').getAttribute('src')).includes(stage==='town'?'island-complete.png':`island-${stage}.png`));
      assert.equal(await selector.locator('[aria-pressed="true"]').count(),1);
      const source=await page.locator('#stage-source').textContent();
      assert(source.includes(stage==='town'?'現在のゲームにはまだ登場しません':'現在のゲーム画面'));
      assert(source.includes(stage==='town'?'開発中':'紹介用'));
    }
    // A keyboard-only change and a rapid change should settle on the latest selection.
    await selector.locator('[data-stage="start"]').focus(); await page.keyboard.press('Enter');
    await selector.locator('[data-stage="village"]').click(); await selector.locator('[data-stage="town"]').click();
    await page.waitForFunction(()=>document.querySelector('#growth-image')?.getAttribute('src')?.includes('complete') && document.querySelector('.growth-photo')?.getAttribute('aria-busy')==='false');
    const summaries=page.locator('.faq summary');
    for(let n=0;n<await summaries.count();n++) {await summaries.nth(n).click(); assert(await page.locator('.faq details').nth(n).getAttribute('open')!==null);await summaries.nth(n).click();}
    const integrity=await page.evaluate(async()=>{
      await Promise.all([...document.images].map(i=>i.decode()));
      return {overflow:document.documentElement.scrollWidth>innerWidth,overflowNodes:[...document.querySelectorAll('body *')].map(n=>({tag:n.tagName,class:n.className,right:n.getBoundingClientRect().right})).filter(n=>n.right>innerWidth+1),images:[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth})),links:[...document.querySelectorAll('a[href^="https"]')].map(a=>a.href),targets:[...document.querySelectorAll('button,.button,.faq summary')].map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height})),sw:(await navigator.serviceWorker.getRegistrations()).length,db:(await indexedDB.databases()).length,candidate:document.body.dataset.visualCandidate,anchors:[...document.querySelectorAll('a[href^="#"]')].map(a=>({href:a.hash,exists:!!document.getElementById(a.hash.slice(1))}))};
    });
    report.cases.push({width,integrity});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});await page.screenshot({path:path.join(output,`${width}-hero.png`)});
    assert.equal(integrity.overflow,false);assert(integrity.images.every(i=>i.width>0));assert(integrity.targets.every(t=>t.height>=44));assert(integrity.links.every(u=>u==='https://sansu-seven.vercel.app/#/island'));assert(integrity.anchors.every(a=>a.exists));assert.equal(integrity.sw,0);assert.equal(integrity.db,0);assert.equal(integrity.candidate,report.candidate);
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);}); await page.screenshot({path:path.join(output,`${width}-hero.png`)}); await page.screenshot({path:path.join(output,`${width}-page.png`),fullPage:true});
    await page.locator('#learning').screenshot({path:path.join(output,`${width}-learning.png`)});
    await page.locator('#growth').screenshot({path:path.join(output,`${width}-growth.png`)});
    await page.locator('#island').screenshot({path:path.join(output,`${width}-island.png`)});
    report.cases.at(-1).pass=true;await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});const page=await context.newPage();await page.goto(url);
  assert.equal(await page.locator('noscript img').count(),2);assert.equal(await page.locator('h1').count(),1);assert((await page.locator('#stage-source').textContent()).includes('開発中'));await page.locator('.faq summary').first().click();assert(await page.locator('.faq details').first().getAttribute('open')!==null);report.noJS='PASS';await context.close();
  assert.deepEqual(errors,[]);report.pass=true;
} catch(error) {report.failure=String(error.stack||error);throw error;}
finally {report.errors=errors;await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log('PASS website: responsive layouts, images, stages, rapid selection, keyboard, FAQ, links, no-JS, reduced motion, no game storage/SW.');
