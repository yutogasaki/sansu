import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=path.resolve(process.env.SANSU_PORTAL_BROWSER_OUTPUT||'/tmp/codex/PI-001-SANSU/browser');
const before=path.resolve(process.env.SANSU_PORTAL_BEFORE||'/tmp/codex/PI-001-SANSU/recovery');
const candidateRoot=path.resolve(process.env.SANSU_PORTAL_CANDIDATE||path.join(root,'portal'));
fs.mkdirSync(out,{recursive:true});
const integration=JSON.parse(fs.readFileSync(path.join(candidateRoot,'data/integration.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={at:new Date().toISOString(),command:'node tools/check-portal-migration-browser.mjs'+(process.argv.includes('--full')?' --full':''),candidate:integration.currentCandidate,beforeManifest:sha(fs.readFileSync(path.join(before,'manifest.json'))),pages:[],operations:[],failures:[]};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/');
 const local=!old&&url.pathname.startsWith('/portal/');
 const directory=old?before:local?candidateRoot:root,relative=decodeURIComponent(url.pathname.slice(old?8:local?8:1));
 const filename=path.resolve(directory,relative);
 if(!filename.startsWith(directory+path.sep)||/(?:^|\/)(?:\.git|\.env|node_modules)(?:\/|$)/.test(relative)){res.writeHead(403);res.end();return;}
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');fs.createReadStream(filename).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const pairs=[['.agents/index.html','overview.html'],['.agents/map.html','map.html'],['.agents/plan.html','plan.html'],['.agents/roles.html','roles.html'],['.agents/operations.html','operations.html'],['.agents/tasks/index.html','tasks.html'],['docs/index.html','documents.html']];
const shot=async(name)=>{const file=name+'.jpg';await page.screenshot({path:path.join(out,file),type:'jpeg',quality:75});return file;};
async function capture(route,name,width,variant){
 await page.setViewportSize({width,height:1000});await page.goto(origin+route);await page.waitForLoadState('networkidle');
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
  brokenImages:[...document.images].filter(n=>n.getBoundingClientRect().width&&n.complete&&!n.naturalWidth).map(n=>n.src),
  controls:[...document.querySelectorAll('input,select,button,summary')].length,
  smallText:[...document.querySelectorAll('main p,main li,main small,main button,main summary')].filter(n=>n.checkVisibility()&&parseFloat(getComputedStyle(n).fontSize)<16).map(n=>({tag:n.tagName,class:n.className,text:n.textContent.slice(0,120)})).slice(0,20),
  minFont:Math.min(...[...document.querySelectorAll('main p,main li,main small,main button,main summary')].filter(n=>n.checkVisibility()).map(n=>parseFloat(getComputedStyle(n).fontSize)))}));
 const screenshots=[await shot(name+'-'+width+'-first')];
 if(process.argv.includes('--full'))for(let y=1000;y<metrics.height;y+=1000){await page.evaluate(value=>scrollTo(0,value),y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));screenshots.push(await shot(name+'-'+width+'-'+String(y).padStart(6,'0')));}
 report.pages.push({route,width,variant,...metrics,screenshots});
 if(variant==='integrated'){assert(!metrics.overflow,name+': horizontal overflow');assert(!metrics.brokenImages.length,name+': broken visible image');assert(metrics.minFont>=16,name+': body text smaller than 16px');}
 console.log('captured '+name+' '+width+' '+screenshots.length+' parts');
}
try{
 for(const width of [1440,390]){
  for(const [source,target] of pairs){await capture('/before/'+source,'before-'+target.replace('.html',''),width,'original');await capture('/portal/'+target,'after-'+target.replace('.html',''),width,'integrated');}
  await capture('/portal/index.html','after-home',width,'integrated');
 }
 for(const width of [320,768,195])await capture('/portal/index.html','after-home',width,'integrated');
 for(const viewport of [{width:320,height:568},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto(origin+'/portal/index.html');await page.waitForLoadState('networkidle');
  const original=await page.locator('.original').boundingBox();
  assert(original&&original.y>=0&&original.y+original.height<=viewport.height,'元ポータル入口が初期画面内: '+JSON.stringify({viewport,original}));
  const screenshot=await shot('entry-'+viewport.width+'x'+viewport.height);
  report.operations.push({name:'元入口を初期画面に保持',viewport,original,screenshot});
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/portal/documents.html');await page.waitForLoadState('networkidle');
 await page.locator('#search').fill('no-such-item-PI001');
 assert.equal(await page.locator('[data-search]:visible').count(),0);assert.match(await page.locator('#result').innerText(),/一致する項目はありません/);
 await page.reload();await page.waitForLoadState('networkidle');assert.equal(await page.locator('#search').inputValue(),'no-such-item-PI001');
 await page.locator('#page-search-reset').click();assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#search').evaluate(n=>n===document.activeElement),true);
 report.operations.push('ページ全文検索・0件・URL復元・解除・フォーカス');
 await page.locator('#global-search').fill('学習');await page.locator('#global-category').selectOption('仕様');await page.locator('#global-format').selectOption('文章');
 const rows=JSON.parse(fs.readFileSync(path.join(candidateRoot,'data/search.json'))),expected=rows.filter(r=>r.category==='仕様'&&r.format==='文章'&&(r.body.toLowerCase().includes('学習')||r.title.toLowerCase().includes('学習')));
 await page.waitForFunction(count=>document.querySelectorAll('#global-results li').length===count,expected.length);
 assert(expected.length>0);await page.reload();await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('#global-category').inputValue(),'仕様');assert.equal(await page.locator('#global-format').inputValue(),'文章');
 assert.equal(await page.locator('#global-results li').count(),expected.length);
 await shot('search-facets-390');
 const first=page.locator('#global-results a').first();await first.click();assert(await page.locator('#reader').evaluate(n=>n.open));
 await page.locator('[data-reader-view="original"]').click();assert.equal(await page.locator('#reader-content pre').innerText(),expected[0].body);
 await page.locator('[data-reader-view="data"]').click();assert.deepEqual(JSON.parse(await page.locator('#reader-content pre').innerText()),expected[0]);
 const deepURL=page.url();await page.reload();await page.waitForLoadState('networkidle');assert(await page.locator('#reader').evaluate(n=>n.open));assert.equal(await page.locator('[data-reader-view="data"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-reader-view="reading"]').click();assert(await page.locator('#reader-content h2,#reader-content h3').count());
 await shot('document-reading-390');await page.keyboard.press('Escape');assert(!(await page.locator('#reader').evaluate(n=>n.open)));
 await first.click();await page.keyboard.press('Escape');assert(await first.evaluate(n=>n===document.activeElement));
 report.operations.push('全文＋分類＋形式・根拠付き件数・再読込・人/原文/JSON同項目一致・深いURL復元・Escape・開いた位置へ復帰');
 report.documentURL=deepURL.replace(origin,'[local-origin]');
 await page.locator('#global-search').fill('no-such-document-PI001');await page.waitForFunction(()=>document.querySelector('#global-status').textContent.includes('一致する資料はありません'));
 await page.locator('#global-reset').click();assert.equal(await page.locator('#global-search').inputValue(),'');assert.equal(await page.locator('#global-category').inputValue(),'');
 for(const [,target] of pairs){
  await page.goto(origin+'/portal/'+target);await page.waitForLoadState('networkidle');
  const summary=page.locator('.preserved-original > summary');await summary.focus();await page.keyboard.press('Enter');assert(await summary.evaluate(n=>n.parentElement.open));await page.keyboard.press('Enter');assert(!(await summary.evaluate(n=>n.parentElement.open)));
  const local=page.locator('.ai-detail > summary').first();if(await local.count()){await local.focus();await page.keyboard.press('Enter');assert(await local.evaluate(n=>n.parentElement.open));await page.keyboard.press('Enter');}
  report.operations.push(target+': 元表示/詳細のキーボード開閉・一覧保持');
 }
 assert(!errors.length,'browser errors: '+errors.join('; '));report.status='PASS';
}catch(error){report.status='FAIL';report.failures.push(error.stack);await shot('failure');process.exitCode=1;}
finally{
 report.pageErrors=errors;fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
 const sections=report.pages.map(row=>`<section><h2>${row.variant} ${row.route} · ${row.width}px</h2>${row.screenshots.map(file=>`<a href="${file}"><img src="${file}" alt="${row.route} ${row.width}px" loading="lazy"></a>`).join('')}</section>`).join('');
 fs.writeFileSync(path.join(out,'comparison.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sansu 同内容・同幅の比較</title><style>body{font:16px/1.6 system-ui;margin:24px}section{border-top:1px solid #ccc;padding:24px 0}img{width:280px;max-width:100%;vertical-align:top;margin:6px}h2{font-size:20px}</style><h1>Sansu ポータル比較</h1><p>候補 '+report.candidate+'。'+report.status+'。スクリーンショットを開いて原寸で確認できます。</p>'+sections+'</html>');
 await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({status:report.status,pages:report.pages.length,operations:report.operations.length,failures:report.failures}));
}
