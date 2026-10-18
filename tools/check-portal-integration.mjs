import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {checkEntryCards} from './check-portal-entry.mjs';
import {parse,elements,textOf,escape,technicalSurface,surfaceText,surfaceLabels,headingIssue} from './portal-html.mjs';
import {checkOriginals} from './check-portal-originals.mjs';
import {legacyPages} from './generate-agent-index.mjs';
import {checkPortalFlow} from './check-portal-flow.mjs';
import {destinations,evidenceState,trialSummary,humanLabel,taskPresentation,trialPresentation} from './integrated-portal.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
export function checkIntegration() {
 const out=path.join(root,'portal');
 checkOriginals(root,destinations);
 checkPortalFlow(root,out);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 const data=JSON.parse(fs.readFileSync(path.join(out,'data/integration.json'),'utf8'));
 const allowedReferences=new Set(data.resources.map(row=>path.resolve(root,row.source)));
 for(const row of data.resources){
  assert.equal(row.target,'../'+row.source,'canonical relative reference');
  assert.equal(row.mode,'reference');
  const abs=path.resolve(root,row.source);
  assert(abs.startsWith(root+path.sep),'reference remains in repository');
  let part=root;for(const segment of row.source.split('/')){part=path.join(part,segment);assert(!fs.lstatSync(part).isSymbolicLink(),'reference symlink rejected');}
  assert.equal(createHash('sha256').update(fs.readFileSync(abs)).digest('hex'),row.sha256,'referenced original SHA');
 }
 assert(!fs.existsSync(path.join(out,'resources')),'no copied original media or documents');
 const index=fs.readFileSync(path.join(out,'index.html'),'utf8');
 checkEntryCards(index);
 execFileSync('python3',[path.join(root,'tools/prepare-portal-comparison.py'),'--check'],{cwd:root,stdio:'pipe'});
 assert.deepEqual(data.project,JSON.parse(fs.readFileSync(path.join(out,'data/project.json'),'utf8')),'human and AI project inputs agree');
 for(const [,answer] of data.humanQuestions)assert(index.includes(escape(answer)),'human answer must use shared data');
 for(const source of data.project.docs) {
  const target=data.sources.find(item=>item.source===source)?.target;
  assert(target&&index.includes(`href="${target}"`),`standard document must remain reachable: ${source}`);
 }
 assert(index.includes('href="../.agents/index.html"'),'visible original portal link');
 for(const id of ['overview','decisions','tasks','documents','ai'])assert(index.includes(`id="${id}"`),id);
 assert.equal(evidenceState('new',[{candidate:'old',result:'PASS',userAcceptance:true}])[0].accepted,false);
 assert.equal(evidenceState('new',[{candidate:'new',result:'PASS',userAcceptance:false}])[0].accepted,false);
 assert.equal(evidenceState('new',[{candidate:'new',result:'PASS',userAcceptance:true}])[0].accepted,true);
 if(data.trials.some(t=>t.result==='PASS'&&!t.applies))assert(index.includes('過去の合格は、今の候補には使えません'));
 const libraryPath=path.join(out,'data/unification.json');
 const missingTargets=new Set();
 if(fs.existsSync(libraryPath)){
  const library=JSON.parse(fs.readFileSync(libraryPath,'utf8'));
  for(const row of [...library.pages,...library.documents,...library.resources])allowedReferences.add(path.join(root,row.source));
  for(const row of library.resources.filter(r=>r.state==='missing'))missingTargets.add(path.join(root,row.source));
 }
 let links=0;const cache=new Map();
 const document=file=>{if(!cache.has(file))cache.set(file,parse(fs.readFileSync(file,'utf8')));return cache.get(file);};
 for(const file of [...walk(out).filter(f=>f.endsWith('.html')),...data.resources.filter(row=>row.source.endsWith('.html')).map(row=>path.join(root,row.source))]) {
  const doc=document(file);
  const base=elements(doc,n=>n.tag==='base'&&n.attrs.href)[0];
  const baseFile=base?path.resolve(path.dirname(file),decodeURIComponent(base.attrs.href)):file;
  for(const node of elements(doc,n=>n.attrs?.href||n.attrs?.src||n.attrs?.poster)) {
   for(const key of ['href','src','poster']) {
    const value=node.attrs[key];if(!value||/^(https?:|mailto:|data:|tel:)/.test(value)||node.attrs.class==='pui-hub'||node.attrs['data-portal-project'])continue;
    const [withQuery,anchor]=value.split('#');const raw=withQuery.split('?')[0];
    const contextFile=node.tag==='base'?file:baseFile;
    const isReference=!file.startsWith(out+path.sep);
    const target=isReference&&raw.startsWith('/')?path.join(root,file.startsWith(path.join(root,'website')+path.sep)?'website/public':'public',decodeURIComponent(raw.slice(1))):path.resolve(path.dirname(contextFile),decodeURIComponent(raw)||path.basename(contextFile));
    assert(target.startsWith(out+path.sep)||allowedReferences.has(target)||[...destinations.keys()].some(source=>target===path.join(root,source)),`escaped publication: ${file} ${value}`);
    assert(fs.existsSync(target)||missingTargets.has(target),`missing ${file}: ${value}`);
    if(anchor&&target.endsWith('.html')&&fs.existsSync(target))assert(elements(document(target),n=>n.attrs?.id===decodeURIComponent(anchor)).length,`anchor ${file}: ${value}`);
    links++;
   }
  }
 }
 let preserved=0, inventoryItems=0;
 for(const [source,original] of legacyPages()) {
  const target=destinations.get(source);
  const old=parse(original), ai=document(path.join(out,'ai',target));
  if(source==='.agents/index.html')assert(fs.readFileSync(path.join(out,'portal.css'),'utf8').startsWith(elements(old,n=>n.tag==='style')[0].children[0].raw),'complete original CSS remains');
  // Every original element stays in order, with identical text and non-URL attributes.
  // A single return paragraph is the only addition to these complete AI pages.
  const oldElements=elements(old,n=>n.tag!=='root');
  inventoryItems+=elements(old,n=>['h1','h2','h3','article','section','details','a','img','input','nav','style','script'].includes(n.tag)).length;
  const aiElements=elements(ai,n=>n.tag!=='root');
  const body=aiElements.find(n=>n.tag==='body');body.children.splice(0,1);
  const actual=elements(ai,n=>n.tag!=='root');
  assert.equal(actual.length,oldElements.length,`${source}: full element preservation`);
  for(let i=0;i<oldElements.length;i++) {
   const before=oldElements[i],after=actual[i];assert.equal(after.tag,before.tag);
   assert.equal(textOf(after),textOf(before),`${source}: text at ${i}`);
   for(const [key,value] of Object.entries(before.attrs))if(!['href','src','poster'].includes(key))assert.equal(after.attrs[key],value,`${source}: ${key}`);
   preserved++;
  }
  // The human page must retain cards, images, disclosures, maps and local search.
  const human=document(path.join(out,target));
  for(const tag of ['article','img','a'])assert(elements(human,n=>n.tag===tag).length>=elements(old,n=>n.tag===tag).length,`${target}: ${tag}`);
  assert(elements(human,n=>n.attrs?.id==='search').length,`${target}: search`);
  const surface=surfaceText(elements(human,n=>n.tag==='body')[0]);
  assert(!technicalSurface.test(surface),`${target}: raw AI data on human surface: ${surface.match(technicalSurface)?.[0]}`);
 }
 const parity=JSON.parse(fs.readFileSync(path.join(out,'data/parity.json'),'utf8'));
 assert.equal(parity.length,inventoryItems,'full current inventory coverage');
 // S-002 records the historical source. Regenerated document/task indexes
 // legitimately change as documents are added; checkOriginals above checks
 // their complete current text, CSS, attributes and destinations separately.
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'qa/evidence/S-002/baseline.json'),'utf8'));
 assert.equal(baseline.reduce((total,row)=>total+row.rows.length,0),5328,'historical structural inventory');
 for(const old of baseline){
  const current=parse(fs.readFileSync(path.join(root,old.page),'utf8'));
  const structural=new Set(['h1','h2','h3','article','section','details','a','img','input','nav','style','script']);
  assert.equal(parity.filter(row=>row.source===old.page).length,
   elements(current,node=>structural.has(node.tag)).length,'complete current structural parity');
 }
 const visual=JSON.parse(fs.readFileSync(path.join(root,'qa/evidence/S-002/visual-inventory.json'),'utf8'));
 assert.equal(visual.rules.length,150);assert.equal(visual.media.length,9);assert.equal(visual.actions.length,8);
 const css=fs.readFileSync(path.join(out,'portal.css'),'utf8');
 for(const rule of visual.rules)assert(css.includes(rule.selector+'{'+rule.declarations+'}'),'frozen CSS rule preserved');
 assert.equal(5328+visual.rules.length+visual.media.length+visual.actions.length,5495,'complete historical inventory');
 assert(!index.includes('class="back"'),'no self-return link at entry');
 const entry=parse(index), indexSurface=surfaceText(elements(entry,n=>n.tag==='body')[0]);
 assert(!technicalSurface.test(indexSurface),`entry surface stays human readable: ${indexSurface.match(technicalSurface)?.[0]}`);
 for(const sample of ['Command failed: ["npm","run","verify:core"]','AssertionError: Unexpected fixture source','provenance.json','ef29eb2d9fc56444','npm run build','/tmp/check.log'])assert(technicalSurface.test(sample),`technical leak detection: ${sample}`);
 for(const trial of data.trials){
  assert(index.includes(escape(JSON.stringify(trial,null,2))),'full trial record retained in details');
  assert(!technicalSurface.test(trialSummary(trial)),'plain Japanese reason');
 }
 assert.equal(trialSummary({result:'FAIL',cause:'environment',reason:'Command failed'}),'検査環境に問題があり、自動確認が止まりました。');
 // These checks cover all eight human pages, including linked card headings and
 // folder summaries. Full internal titles/records remain in AI pages/details.
 for(const sample of ['2026-10-15 公開候補','10/9固定v3のcore4,803/classic32','source/dist archive','旧writer/実SW更新','入り江 c4','育つ島v1','83210fd','最新変更：現在地と次の一手を確認'])assert(headingIssue(sample),`heading record detection: ${sample}`);
 for(const file of ['index.html',...destinations.values()]){
  const labels=surfaceLabels(document(path.join(out,file)));
  for(const label of labels)assert(!headingIssue(label),`${file}: short human heading/card name: ${label}`);
  assert(!fs.readFileSync(path.join(out,file),'utf8').includes('<summary>根拠と詳しい内容</summary>'),'disclosures identify their contents');
 }
 for(const task of data.project.tasks){
  const copy=taskPresentation(task);
  for(const file of ['index.html','overview.html','tasks.html']){
   const doc=document(path.join(out,file)),surface=surfaceText(doc);
   const headings=surfaceLabels(doc);
   assert(headings.includes(copy.title),`${file}: canonical short task title`);
   for(const fact of [copy.current,copy.next,copy.unchecked])assert(surface.includes(fact),`${file}: visible current/next/unconfirmed facts`);
   assert(!headingIssue(copy.title));
  }
 }
 assert(taskPresentation({title:'新しい仕事',notes:'まだ状態の記録がない'}).current.includes('未確認'),'unknown task state never inherits a verified status');
 const formal=elements(document(path.join(out,'overview.html')),n=>n.attrs?.id==='formal-status')[0];
 assert(formal,'formal verification section');
 const formalSurface=surfaceText(formal);
 if(data.trials.length){
  const copy=trialPresentation(data.trials[0]);
  for(const fact of [copy.result,copy.scope,copy.failure,copy.remaining])assert(formalSurface.includes(fact),'latest result/stage/scope/remaining always visible');
  const status=elements(formal,n=>(n.attrs?.class||'').includes('trial-state'));
  assert(status.length>=2&&status.every(n=>textOf(n).length),'text accompanies result/current-candidate state colors');
 }
 const failed=trialPresentation({result:'FAIL',failedStage:'machine',passedStages:['scope','generate'],notCompleted:['build','browser','accept']});
 assert.equal(failed.failure,'自動検査');assert(failed.remaining.includes('配布用の生成')&&failed.remaining.includes('画面と操作')&&failed.remaining.includes('受入の照合'));
 assert.equal(humanLabel('最新変更を一つの公開候補へまとめる：10/9固定v3のcore4,803/classic32、主要旅程を確認'),'最新変更を一つの公開候補へまとめる');
 const docsSection=elements(parse(index),n=>n.attrs?.id==='documents')[0];
 assert(elements(docsSection,n=>n.attrs?.id==='global-search').length,'global search lives in documents section');
 assert(index.indexOf('id="search"')<index.indexOf('id="overview"'),'page search stays above questions');

 const artifact=elements(entry,n=>n.attrs?.class==='entry-artifact')[0];
 assert(artifact&&elements(artifact,n=>n.tag==='img').length,'image result at entry');
 assert(index.indexOf('class="entry-artifact"')<index.indexOf('class="original"'),'result beside use destinations before questions');
 assert(elements(artifact,n=>n.tag==='img')[0].attrs.src.startsWith('../docs/'),'result references canonical repository image');
 for(const id of ['search','result','global-search','global-results','global-status'])assert(elements(entry,n=>n.attrs?.id===id).length,`entry search: ${id}`);
 assert(elements(entry,n=>!!n.attrs?.['data-search']).length>=5,'entry page search covers all major sections');
 for(const row of JSON.parse(fs.readFileSync(path.join(out,'data/search.json'),'utf8')))assert(!headingIssue(row.label),'search result title stays short and human readable');
 assert(index.indexOf('class="snapshot"')<index.indexOf('class="use-cards"')&&index.indexOf('class="use-cards"')<index.indexOf('class="original"'),'first view priority');
 for(const url of ['https://sansu-seven.vercel.app/','https://sansu-seven.vercel.app/promo/'])assert(index.includes(`href="${url}"`),'known use destination');
 assert(index.includes('未接続'),'help remains unconnected');
 for(const file of ['index.html',...destinations.values()]){
  const html=fs.readFileSync(path.join(out,file),'utf8');
  assert(html.includes('id="reader"')&&html.includes('id="reader-close"'),'page-local accessible document reader');
 }
 const plan=fs.readFileSync(path.join(out,'plan.html'),'utf8');
 assert(plan.indexOf('目標と実行順の関係')<plan.indexOf('島を作る6段階'),'explain priority before milestone cards');
 const ids=new Map();
 for(const row of parity) {
  const [file,id]=row.ai.split('#');
  if(!ids.has(file))ids.set(file,new Set(elements(document(path.join(out,file)),n=>!!n.attrs?.id).map(n=>n.attrs.id)));
  assert(ids.get(file).has(decodeURIComponent(id)),`parity anchor ${row.ai}`);
 }
 console.log(`PASS: integrated portal ${links} local links/anchors, ${preserved} original elements, all 7 pages, two layers and candidate mismatch gates`);
 return {links,preserved,pages:destinations.size};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))checkIntegration();
