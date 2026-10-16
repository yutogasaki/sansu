// Standalone headless QA; never connects to a personal browser or sends data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {destinations} from './integrated-portal.mjs';
import {parse,elements,textOf} from './portal-html.mjs';
import {sha} from './portal-originals.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.SANSU_ORIGINAL_QA_OUTPUT||'/tmp/codex/S-004/side-by-side';
fs.mkdirSync(out,{recursive:true});
const inventory=JSON.parse(fs.readFileSync(path.join(root,'portal/data/original-inventory.json'),'utf8'));
const currentCandidate=JSON.parse(fs.readFileSync(path.join(root,'portal/data/integration.json'),'utf8')).currentCandidate;
const report={command:'node tools/qa-portal-originals.mjs',currentCandidate,at:new Date().toISOString(),inputSha256:sha(JSON.stringify(inventory)),widths:[1440,390],deviceScaleFactor:1,zoom:'100%',mode:'standalone headless Chromium; local files only',result:'BLOCKED',comparisons:[],operations:[],errors:[],decisionRecapture:'未取得（実アプリの旧新camera固定での撮り直しは別途必要）'};
const plan=[];
for(const [source,target] of destinations)for(const width of report.widths) {
 const doc=parse(fs.readFileSync(path.join(root,source),'utf8'));
 const selectors=['body'];
 const main=elements(doc,n=>n.tag==='main')[0];
 const mainElements=(main?.children||[]).filter(n=>n.tag);
 mainElements.forEach((n,index)=>{if(n.tag==='h2'||n.tag==='section'||/(?:intro|gallery|summary|milestones|flow)/.test(n.attrs?.class||''))selectors.push(`main > :nth-child(${index+1})`);});
 elements(doc,n=>n.attrs?.id&&['section','article','details'].includes(n.tag)).forEach(n=>selectors.push('#'+n.attrs.id));
 for(const [index,selector] of [...new Set(selectors)].entries())plan.push({source,target,width,height:width===390?844:900,selector,file:`${target.replace('.html','')}-${width}-${index}.png`,status:'未取得'});
}
let browser;
const visualState=()=>[...document.querySelectorAll('*')].map(n=>{
 const s=getComputedStyle(n),r=n.getBoundingClientRect();
 return {tag:n.tagName,hidden:n.hidden,open:n.tagName==='DETAILS'?n.open:null,rect:[r.x,r.y,r.width,r.height],style:['display','color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','gap','padding','margin','border','gridTemplateColumns','objectFit'].map(k=>s[k])};
});
const filterState=()=>[...document.querySelectorAll('[data-search],.doc-group,.spec-list,.asset-groups,details,#result')].map(n=>({tag:n.tagName,hidden:n.hidden,open:n.tagName==='DETAILS'?n.open:null,text:n.id==='result'?n.textContent:null}));
async function operations(old,copy,source,width) {
 for(const q of [' 學習 ',' 存在しない語S004 ',' 旧探索 ','']) {
  if(!await old.locator('#search').count())continue;
  await old.locator('#search').fill(q);await copy.locator('#search').fill(q);
  const before=await old.evaluate(filterState),after=await copy.evaluate(filterState);
  assert.deepEqual(after,before,'same filtering/status/history disclosure behavior');
  report.operations.push({source,width,operation:'search',query:q,result:'PASS'});
 }
 const summaries=await old.locator('details > summary').count();
 for(let i=0;i<summaries;i++) {
  const a=old.locator('details > summary').nth(i),b=copy.locator('details > summary').nth(i);
  // Open ancestor disclosures first, including nested asset lists.
  for(const item of [a,b])await item.evaluate(n=>{for(let p=n.parentElement?.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
  for(const item of [a,b]){await item.focus();await item.press('Enter');}
  assert.equal(await b.evaluate(n=>n.parentElement.open),await a.evaluate(n=>n.parentElement.open));
  for(const item of [a,b])await item.press('Enter');
 }
 report.operations.push({source,width,operation:'keyboard-disclosure',count:summaries,result:'PASS'});
 const originalUrl=old.url(),importedUrl=copy.url(),navCount=await old.locator('header nav a').count();
 for(let i=0;i<navCount;i++) {
  await old.locator('header nav a').nth(i).click();await copy.locator('header nav a').nth(i).click();
  const oldPath=path.relative(root,fileURLToPath(old.url())),newPath=path.relative(path.join(root,'portal/original'),fileURLToPath(copy.url()));
  assert.equal(newPath,destinations.get(oldPath),'original navigation reaches its imported counterpart');
  await old.goto(originalUrl);await copy.goto(importedUrl);
 }
 report.operations.push({source,width,operation:'navigation-links',count:navCount,result:'PASS'});
 // Tab controls, if an original adds them, must be explicitly exercised.
 assert.equal(await old.locator('[role="tab"]').count(),0,'new tabs require additional QA coverage');
 for(const ctx of [old,copy])await ctx.evaluate(()=>{document.querySelectorAll('details').forEach(n=>n.open=false);window.scrollTo(0,0);});
}
const composite=(left,right,dest)=>{
 const result=spawnSync('python3',['-c',`from PIL import Image, ImageChops
import sys,json
a,b=Image.open(sys.argv[1]).convert('RGB'),Image.open(sys.argv[2]).convert('RGB')
assert a.size==b.size, (a.size,b.size)
c=Image.new('RGB',(a.width*2,a.height),'white');c.paste(a,(0,0));c.paste(b,(a.width,0));c.save(sys.argv[3])
print(json.dumps({'samePixels':ImageChops.difference(a,b).getbbox() is None,'size':list(a.size)}))`,left,right,dest],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
};
try {
 browser=await chromium.launch({headless:true});
 for(const [source,target] of destinations)for(const width of report.widths) {
  const height=width===390?844:900,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route(/^https?:/,route=>route.abort());
  const old=await context.newPage(),host=await context.newPage();
  for(const page of [old,host])page.on('pageerror',e=>report.errors.push({source,width,error:String(e)}));
  await old.goto(pathToFileURL(path.join(root,source)).href);
  await host.goto(pathToFileURL(path.join(root,'portal',target)).href);
  const frame=host.locator('.preserved-original iframe'),copy=await (await frame.elementHandle()).contentFrame();
  await copy.waitForLoadState('load');
  assert.equal(await copy.evaluate(()=>innerWidth),width,'embedded original uses the same viewport width');
  assert.equal(await copy.evaluate(()=>devicePixelRatio),1);
  for(const ctx of [old,copy])await ctx.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})));});
  assert.deepEqual(await copy.evaluate(visualState),await old.evaluate(visualState),'computed colors, typography, layout and diagram geometry');
  await operations(old,copy,source,width);
  for(const row of plan.filter(p=>p.source===source&&p.width===width)) {
   for(const ctx of [old,copy])await ctx.locator(row.selector).evaluate(n=>{
    for(let p=n;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
    window.scrollTo(0,n.tagName==='BODY'?0:n.getBoundingClientRect().top+scrollY);
   });
   const left=path.join(out,'old-'+row.file),right=path.join(out,'new-'+row.file);
   await old.screenshot({path:left,scale:'css'});await frame.screenshot({path:right,scale:'css'});
   const pixels=composite(left,right,path.join(out,row.file));
   row.status=pixels.samePixels?'画素一致':'差あり';report.comparisons.push({...row,...pixels});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no runtime JS errors');
 assert(report.comparisons.every(p=>p.samePixels),'visual differences require review');
 report.result='PASS';
} catch(error) {report.error=String(error);process.exitCode=1;}
finally {
 await browser?.close();
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const table=['# S-004 元 | 新 の対応表','',`取得日時: ${report.at} / 結果: ${report.result}`,`入力SHA256: ${report.inputSha256} / 対象候補: ${report.currentCandidate}`,`幅1440×900 / 390×844、DPR 1、100%。左は元、右は新ポータル内の原形表示。`, '',report.error?'停止理由: '+report.error.split('\n')[0]:'', '', '| 元 | 新の同じページ | 幅 | 対応箇所 | 左右画像 | 結果 |','| --- | --- | --- | --- | --- | --- |',...plan.map(p=>`| ${p.source} | portal/${p.target} 内 original/${p.target} | ${p.width} | ${p.selector} | ${p.status==='未取得'?'未取得':`[${p.file}](${p.file})`} | ${p.status} |`),'','判断カードの同倍率・実camera撮り直し: '+report.decisionRecapture,'元ページを入口のまま残す。未取得の画像を代替画像で埋めない。'];
 fs.writeFileSync(path.join(out,'index.md'),table.join('\n')+'\n');
 console.log(JSON.stringify({result:report.result,comparisons:report.comparisons.length,planned:plan.length,report:path.join(out,'report.json')}));
}
