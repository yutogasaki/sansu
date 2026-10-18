const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo='/Users/yutogasaki/Projects/sansu',hub='/Users/yutogasaki/Projects/hub';
const evidence=path.join("/Users/yutogasaki/Projects/sansu/qa/evidence/PI-001-SANSU/recheck-20261016T081724Z","hub-preflight.json");
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=require(hub+'/common-portal/integration/verify.cjs').verifyIntegration(repo);
const site={...require(hub+'/common-portal/publish/sites.cjs').catalog.find(row=>row.slug==='sansu'),repo,root:'portal',include:fs.readdirSync(repo+'/portal'),standard:true,unified:true,originalRoot:'.agents',originalHref:'/sansu/original/index.html'};
const out=fs.mkdtempSync('/tmp/codex/PI-001-SANSU/hub-copy-');
const sanitize=require(hub+'/common-portal/publish/sanitize.cjs').createSanitizer([repo,hub]);
const report={at:new Date().toISOString(),candidate:JSON.parse(fs.readFileSync(repo+'/portal/data/integration.json')).currentCandidate,manifestSha256:hash(fs.readFileSync(repo+'/portal/data/unification-manifest.json')),out,sourceFiles:Object.keys(manifest.sourceFiles).length,outputFiles:Object.keys(manifest.outputs).length,sourceHashes:{},status:'UNVERIFIED'};
for(const name of ['distribution.cjs','policy.cjs','sites.cjs','sanitize.cjs'])report.sourceHashes[name]=hash(fs.readFileSync(hub+'/common-portal/publish/'+name));
let sharp;for(const name of ['sansu','hub','Jishu','MMmind','ayami-ballet/web']){try{sharp=require('/Users/yutogasaki/Projects/'+name+'/node_modules/sharp');break;}catch{}}
async function thumb(sharp,src,dst){if(!sharp)throw Error('Actual sharp provider unavailable');fs.mkdirSync(path.dirname(dst),{recursive:true});const rules=require(hub+'/common-portal/publish/verify.cjs').rules;for(let quality=80;quality>70;quality--){const bytes=await sharp(src,{animated:false}).rotate().resize({width:800,height:800,fit:'inside',withoutEnlargement:true}).webp({quality}).toBuffer();if(quality===71||!rules.some(([,rule])=>rule.test(bytes.toString('utf8')))){fs.writeFileSync(dst,bytes);return;}}}
(async()=>{try{report.distribution=await require(hub+'/common-portal/publish/distribution.cjs').distribute({site,out,sanitize,sharp,thumb});report.status='GENERATED_UNVERIFIED';}catch(error){report.status='FAIL';report.error=String(error);report.stack=error.stack;}finally{fs.writeFileSync(evidence,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,error:report.error,out}));if(report.status==='FAIL')process.exitCode=1;}})();
