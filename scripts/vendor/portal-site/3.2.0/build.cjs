'use strict';
// Writes one project's portal: the five fixed pages, every document page,
// the quick-jump index and the search text. Repos call this; they never
// write chrome themselves.
//   require('<vendor>/portal-site/3.0.0/build.cjs').build({root, outDir, slug, options})
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=require('./render.cjs'),C=require('./classify.cjs'),{siteModel}=require('./adapter.cjs');
const ACCENT={hub:['#1d2129','#eef0f3'],'keep-going':['#c94274','#fbeef3'],jishu:['#2f8f5b','#e7f5ed'],sansu:['#1b8a99','#e3f4f6'],'ayami-ballet':['#7c4dde','#f1ecfc'],mmmind:['#3b5bdb','#edf1fd'],'noren-studio':['#b4532a','#f8ede7'],'cast-life':['#d9701f','#fcf0e4'],business:['#475569','#eef1f5']};
// slug, title, directory under ~/Projects, portal entry inside it.
const PROJECTS=[['keep-going','KeepGoing','keep-going','portal/index.html'],['mmmind','MMmind','MMmind','portal/index.html'],['jishu','JISHU','Jishu','portal/index.html'],['sansu','さんすう','sansu','portal/index.html'],['ayami-ballet','AYAMI BALLET','ayami-ballet','portal/index.html'],['noren-studio','noren','noren-studio','portal/index.html'],['cast-life','CAST LIFE','cast-life','portal/index.html'],['business','Business','Business','index.html']];
const rel=(from,to)=>path.relative(path.dirname(from),to).split(path.sep).join('/');
const write=(file,body)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
const plain=html=>String(html||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim().slice(0,4000);

// A pinned copy refuses to run if any of its files changed.
function pin(){
 const lockFile=path.join(__dirname,'lock.json');if(!fs.existsSync(lockFile))return null;
 const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));
 for(const [f,h] of Object.entries(lock.files))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex')!==h)throw Error('Changed portal-site file: '+f);
 return lock;
}
function jumpIndex(m){
 const pages=[['ホーム','index.html'],['仕事','work.html'],['判断','decisions.html'],['資料','library.html'],['検索','search.html']].map(([t,u])=>({k:'ページ',t,u}));
 return [...pages,...m.decisions.map(d=>({k:'判断',t:d.title,u:'decisions.html#'+d.anchor})),...m.tasks.map(t=>({k:'仕事',t:t.title,id:t.id,s:t.id||'',u:'work.html#'+t.anchor})),
  ...m.docs.map(d=>({k:d.tier==='link'?'記録':d.tier==='tool'?'画面':'資料',t:d.title,id:d.id,s:d.tier==='list'?C.CATEGORIES.find(c=>c.id===d.cat).title:(d.id||''),u:d.href}))];
}
/**
 * @param {object} o
 * @param {string} o.root      repo root
 * @param {string} o.outDir    output directory (normally <root>/portal)
 * @param {string} o.slug      project slug (see PROJECTS)
 * @param {object} [o.options] adapter options: entrances, pins, tiers
 * @param {Array}  [o.projects] switcher rows {slug,title,accent,href}; default: sibling repos under ~/Projects
 * @param {string} [o.workspaceHref] default: ~/Projects/hub/portal/index.html relative to outDir
 * @param {string} [o.generatedAt]
 */
function build({root,outDir,slug,options={},projects,workspaceHref,generatedAt}){
 const write=(file,body)=>{if(options.outputFiles)options.outputFiles.set(path.relative(outDir,file).split(path.sep).join('/'),body);else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}};
 const lock=pin(),here=path.join(outDir,'index.html'),projectsDir=path.dirname(root);
 const own=PROJECTS.find(p=>p[0]===slug);if(!own)throw Error('Unknown project slug: '+slug);
 const m=siteModel({root,outDir,options}),[accent,accentSoft]=ACCENT[slug];
 const site={...m,slug,title:own[1],accent,accentSoft,generatedAt:generatedAt||new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}).slice(0,16),
  workspaceHref:workspaceHref||rel(here,path.join(projectsDir,'hub/portal/index.html')),
  projects:projects||PROJECTS.map(([s,t,d,e])=>({slug:s,title:t,accent:ACCENT[s][0],href:rel(here,path.join(projectsDir,d,e))})),
  tabs:[{id:'home',label:'ホーム',icon:'home',href:'index.html'},{id:'work',label:'仕事',icon:'work',href:'work.html'},{id:'decisions',label:'判断',icon:'decide',href:'decisions.html',count:m.decisions.filter(d=>d.group==='ready').length},{id:'library',label:'資料',icon:'library',href:'library.html'},{id:'search',label:'検索',icon:'search',href:'search.html'}]};
 for(const f of ['site.css','site.js','context.js'])write(path.join(outDir,f),fs.readFileSync(path.join(__dirname,f)));
 const page=(file,tab,title,body)=>write(path.join(outDir,file),R.shell(site,{path:file,tab,title,body}));
 page('index.html','home','ホーム',R.home(site));page('work.html','work','仕事',R.work(site));page('decisions.html','decisions','判断',R.decisions(site));
 page('library.html','library','資料',R.library(site));page('search.html','search','検索',R.search(site));
 for(const d of m.docs.filter(d=>d.read))page(d.href,d.tier==='list'?'library':'work',d.title,R.doc(site,d));
 write(path.join(outDir,'site-index.js'),'window.PORTAL_INDEX='+R.json(jumpIndex(m))+';\n');
 write(path.join(outDir,'site-text.js'),'window.PORTAL_TEXT='+R.json(Object.fromEntries(m.docs.filter(d=>d.read).map(d=>[d.href,plain(d.html)])))+';\n');
 const count=t=>m.docs.filter(d=>d.tier===t).length;
 return {site,model:m,version:lock?.version||'design',stats:{listed:count('list'),linked:count('link'),tools:count('tool'),read:m.docs.filter(d=>d.read).length,tasks:m.tasks.length,decisions:m.decisions.length,flow:m.flow.length,ownSummary:m.docs.filter(d=>d.tier==='list'&&d.summary?.own).length}};
}
module.exports={build,pin,ACCENT,PROJECTS};
