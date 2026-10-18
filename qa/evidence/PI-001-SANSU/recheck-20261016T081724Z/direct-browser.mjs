// Isolated anonymous browser: native editing is exercised without personal data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root="/Users/yutogasaki/Projects/sansu";
const out=path.resolve(process.env.SANSU_LIBRARY_BROWSER_OUTPUT||'qa/evidence/PI-001-SANSU/library-browser');fs.mkdirSync(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const data=JSON.parse(fs.readFileSync(path.join(root,'portal/data/unification.json')));
const manifest=fs.readFileSync(path.join(root,'portal/data/unification-manifest.json'));
const report={at:new Date().toISOString(),command:'node tools/check-portal-library-browser.mjs '+process.argv.slice(2).join(' '),candidate:JSON.parse(fs.readFileSync(path.join(root,'portal/data/integration.json'))).currentCandidate,manifestSha256:sha(manifest),inputSha256:sha(fs.readFileSync(path.join(root,'portal/data/unification.json'))),groups:[],pages:[],failures:[]};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)),file=path.resolve(root,relative);
 if(req.method!=='GET'||!file.startsWith(root+path.sep)||/(?:^|\/)(?:\.env|\.git|node_modules)(?:\/|$)/.test(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const size=fs.statSync(file).size,match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
 const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
 if(match){res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}res.setHeader('Content-Length',Math.max(0,end-start+1));fs.createReadStream(file,{start,end}).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:47860/repos/sansu';
const browser=await chromium.launch({headless:true});
async function context(){const result=await browser.newContext({acceptDownloads:true});await result.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());return result;}
let active=await context();let page=await active.newPage();page.setDefaultTimeout(15000);
page.on('dialog',dialog=>dialog.accept());
const go=async route=>{await page.goto(origin+'/'+route);await page.waitForLoadState('networkidle');};
const shot=async name=>{const file=name+'.jpg';await page.screenshot({path:path.join(out,file),type:'jpeg',quality:75});return file;};
async function group(name,work){try{await work();report.groups.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){report.groups.push({name,status:'FAIL',error:String(error),screenshot:await shot('failure-'+report.groups.length)});report.failures.push({name,error:error.stack});console.log('FAIL '+name+': '+error);}}
try{
 await page.setViewportSize({width:390,height:844});
 await group('全項目検索・多軸・件数・0件・解除・URL復元・同項目JSON・Escape・フォーカス',async()=>{
  await go('portal/search.html');await page.waitForFunction(()=>document.querySelectorAll('#pu-results .pu-result').length===40);
  await page.locator('#pu-query').fill('島');await page.locator('#pu-category').selectOption('関連資料');await page.locator('#pu-type').selectOption('image');
  const expected=data.items.filter(row=>row.category==='関連資料'&&row.kind==='image'&&[row.text,row.pageTitle,row.title,...Object.values(row.attributes||{})].join(' ').includes('島'));
  assert(expected.length>0);await page.waitForFunction(n=>document.querySelector('#pu-count').textContent.startsWith(n.toLocaleString()+'件'),expected.length);await page.reload();await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#pu-query').inputValue(),'島');assert.equal(await page.locator('#pu-type').inputValue(),'image');
  const button=page.locator('#pu-results button').first();await button.click();assert.deepEqual(JSON.parse(await page.locator('#pu-detail-data').innerText()),expected[0]);assert.equal(new URL(page.url()).searchParams.get('record'),expected[0].key);
  await page.keyboard.press('Escape');assert(await button.evaluate(n=>n===document.activeElement));
  await button.click();await page.reload();await page.waitForFunction(()=>document.querySelector('#pu-detail').open);await page.keyboard.press('Escape');assert(await page.locator('#pu-query').evaluate(n=>n===document.activeElement));
  await page.locator('#pu-query').fill('PI001_NO_MATCH_70039');await page.waitForFunction(()=>document.querySelector('#pu-count').textContent.startsWith('0件'));assert.match(await page.locator('#pu-results').innerText(),/条件に合う項目はありません/);await page.locator('#pu-reset').click();assert.equal(await page.locator('#pu-query').inputValue(),'');await shot('library-search-390');
 });
 const atlas='docs/design/2026-10-10-island-design-strategy/index.html';
 await group('画像図鑑：全32画像・絞込・比較・メモ追加/編集/保存/書出/削除・再読込',async()=>{
  await go('portal/integrated/'+atlas);assert.equal(await page.locator('#gallery .reference-card').count(),32);
  await page.locator('#gallery img').evaluateAll(nodes=>nodes.forEach(n=>n.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('#gallery img')].every(n=>n.complete&&n.naturalWidth));
  await page.locator('#search').fill('PI001_NO_IMAGE');assert(await page.locator('#empty').isVisible());await page.locator('#search').fill('');
  const compare=page.locator('#gallery [data-compare]');await compare.nth(0).click();await compare.nth(1).click();await page.locator('#open-compare').click();assert.equal(await page.locator('#compare-images img').count(),2);await page.keyboard.press('Escape');await page.locator('#clear-compare').click();
  await page.locator('#gallery [data-detail]').first().click();await page.locator('#note-status').selectOption('候補');await page.locator('#note-text').fill('QA匿名メモ：画像の比較');await page.locator('#note-form button[type=submit]').click();assert.match(await page.locator('#note-feedback').innerText(),/保存しました/);
  await page.locator('#note-text').fill('QA匿名メモ：編集後');await page.locator('#note-form button[type=submit]').click();await page.keyboard.press('Escape');await page.reload();await page.waitForLoadState('networkidle');await page.locator('#gallery [data-detail]').first().click();assert.equal(await page.locator('#note-text').inputValue(),'QA匿名メモ：編集後');await page.keyboard.press('Escape');
  const download=page.waitForEvent('download');await page.locator('#export-notes').click();const saved=await download;const exported=JSON.parse(fs.readFileSync(await saved.path()));assert.equal(exported.notes[0].text,'QA匿名メモ：編集後');await saved.saveAs(path.join(out,'anonymous-atlas-export.json'));
  await page.locator('#gallery [data-detail]').first().click();await page.locator('#delete-note').click();assert(await page.locator('#delete-note').isDisabled());assert.equal(await page.locator('#note-text').inputValue(),'');await shot('atlas-edit-390');await page.keyboard.press('Escape');
 });
 await group('画像図鑑：保存失敗の表示・入力保持・書き出し可能',async()=>{
  const failed=await context();await failed.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('anonymous quota fixture','QuotaExceededError');};});const p=await failed.newPage();await p.goto(origin+'/portal/integrated/'+atlas);await p.locator('#gallery [data-detail]').first().click();await p.locator('#note-text').fill('QA匿名：保存失敗');await p.locator('#note-form button[type=submit]').click();assert.match(await p.locator('#note-feedback').innerText(),/保存ができません/);assert.equal(await p.locator('#note-text').inputValue(),'QA匿名：保存失敗');await p.keyboard.press('Escape');const wait=p.waitForEvent('download');await p.locator('#export-notes').click();const download=await wait;assert.match(fs.readFileSync(await download.path(),'utf8'),/QA匿名：保存失敗/);await failed.close();
 });
 const observer='portal/integrated/docs/design/audits/2026-09-07-single-child-study/observer.html';
 await group('観察票：匿名入力・保存/再読込・export/import・不正import・削除',async()=>{
  await go(observer);await page.locator('#participant').fill('QA-ANON');await page.locator('#age').fill('検証用の匿名入力');await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存済み'));await page.reload();assert.equal(await page.locator('#participant').inputValue(),'QA-ANON');
  const wait=page.waitForEvent('download');await page.locator('#export').click();const download=await wait;const file=path.join(out,'anonymous-observer-export.json');await download.saveAs(file);const bytes=fs.readFileSync(file);assert(bytes.includes(Buffer.from('QA-ANON')));
  await page.locator('#clear').click();assert.notEqual(await page.locator('#participant').inputValue(),'QA-ANON');await page.locator('#import-file').setInputFiles({name:'anonymous.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>document.querySelector('#participant').value==='QA-ANON');
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"invalid":true}')});await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('読み込めません'));assert.equal(await page.locator('#participant').inputValue(),'QA-ANON');await shot('observer-390');
 });
 await group('観察票：保存失敗の表示・入力保持・削除失敗時の保全',async()=>{
  const failed=await context();await failed.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('anonymous quota fixture','QuotaExceededError');};});const p=await failed.newPage();p.on('dialog',d=>d.accept());await p.goto(origin+'/'+observer);await p.locator('#participant').fill('QA-FAIL');assert.match(await p.locator('#save-status').innerText(),/保存できません/);assert.equal(await p.locator('#participant').inputValue(),'QA-FAIL');await p.locator('#clear').click();assert.match(await p.locator('#save-status').innerText(),/消去に失敗/);assert.equal(await p.locator('#participant').inputValue(),'QA-FAIL');await failed.close();
 });
 await group('フォルダ参照：全件一覧・資料名/容量/詳細・統合HTMLへの入口',async()=>{
  assert(data.folders.length>0);
  const folder=data.folders.find(row=>row.entries.some(entry=>entry.key));await go('portal/'+folder.target);
  assert.equal(await page.locator('.library-files [data-portal-item]').count(),folder.entries.filter(row=>row.key).length);assert.match(await page.locator('main').innerText(),/過去の資料を現在の採用・確認済みと扱いません/);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await shot('folder-390');
 });
 if(process.argv.includes('--all-pages'))for(const width of [1440,390])for(const row of data.pages){
  for(const variant of ['before','after']){
   const route=variant==='before'?row.source:'portal/'+row.target;const screenshots=[];
   try{
    await page.setViewportSize({width,height:1000});await go(route);await page.evaluate(()=>document.fonts.ready);
    const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,visibleBrokenImages:[...document.images].filter(n=>n.getBoundingClientRect().width&&n.complete&&!n.naturalWidth).length}));
    const key=sha(row.source).slice(0,12)+'-'+width+'-'+variant;screenshots.push(await shot(key));
    if(process.argv.includes('--full'))for(let y=1000;y<metrics.height;y+=1000){await page.evaluate(value=>scrollTo(0,value),y);screenshots.push(await shot(key+'-'+y));}
    report.pages.push({source:row.source,target:row.target,variant,width,...metrics,screenshots});
   }catch(error){report.failures.push({source:row.source,variant,width,error:String(error)});}
  }
  console.log('compared '+width+' '+row.source);
 }
}finally{
 report.status=report.failures.length?'FAIL':'PASS';assert.equal(sha(fs.readFileSync(path.join(root,'portal/data/unification-manifest.json'))),report.manifestSha256,'candidate did not change during browser inspection');
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(out,'comparison.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>全関連HTMLの同幅比較</title><style>body{font:16px system-ui}section{border-top:1px solid #ddd;padding:20px}img{width:240px;max-width:100%;margin:8px}</style><h1>同じ元資料・同じ幅の比較</h1><p>'+report.status+' · '+report.candidate+'</p>'+report.pages.map(row=>'<section><h2>'+row.source+' · '+row.width+' · '+row.variant+'</h2>'+row.screenshots.map(file=>'<a href="'+file+'"><img loading="lazy" src="'+file+'" alt="'+row.source+'"></a>').join('')+'</section>').join('')+'</html>');
 await active.close();await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({status:report.status,groups:report.groups,pages:report.pages.length}));if(report.status==='FAIL')process.exitCode=1;
}
