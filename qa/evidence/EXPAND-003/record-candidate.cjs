'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=process.cwd(),dir=__dirname,sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(path.join(root,p));
const names=args=>execFileSync('git',args,{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const app=names(['ls-files','src','public','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','.nvmrc']);
const appFiles=Object.fromEntries(app.map(p=>[p,sha(read(p))]));
const changed=names(['diff','--name-only']),untracked=names(['ls-files','--others','--exclude-standard']);
const sourceFiles={...JSON.parse(read('portal/data/unification-manifest.json')).sourceFiles,...require(path.join(root,'scripts/portal-work-model.cjs')).load({root}).sourceFiles};
for(const p of [...changed,...untracked].filter(p=>! /^(?:portal|qa|output|dist)\//.test(p)))if(fs.existsSync(p)&&fs.statSync(p).isFile())sourceFiles[p]=sha(read(p));
for(const [p,h]of Object.entries(sourceFiles))if(!fs.existsSync(p)||sha(read(p))!==h)throw Error('Changed input '+p);
const pins={};for(const [family,version]of [['portal-site','3.2.0'],['portal-workspace','1.1.0']]){const p=`scripts/vendor/${family}/${version}`,lock=JSON.parse(read(p+'/lock.json'));for(const [f,h]of Object.entries(lock.files))if(sha(read(p+'/'+f))!==h)throw Error('Changed pin');pins[family]={version,lockSha256:sha(read(p+'/lock.json')),provenance:JSON.parse(read(p+'/provenance.json'))};}
const tree=execFileSync('git',['ls-tree','-r','HEAD','--','src','public','scripts/vendor/hub-standard','scripts/vendor/portal-integration','scripts/vendor/portal-reader','scripts/vendor/portal-ui'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),preserved=[];
for(const line of tree){const m=line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);if(!m)continue;const b=read(m[2]),h=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');if(h!==m[1])throw Error('Protected file changed '+m[2]);preserved.push(m[2]);}
const record={at:new Date().toISOString(),timezone:'Asia/Tokyo',branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),initialDirty:false,sourceFiles,inputHash:sha(JSON.stringify(Object.entries(sourceFiles).sort())),appFiles,appHash:sha(JSON.stringify(Object.entries(appFiles).sort())),pins,protectedPreserved:preserved,changedFiles:changed,untrackedFiles:untracked.filter(p=>!p.startsWith('qa/evidence/EXPAND-003/'))};
fs.writeFileSync(path.join(dir,'candidate.json'),JSON.stringify(record,null,2)+'\n');console.log('PASS: candidate inputs, immutable pins and',preserved.length,'protected source/vendor files');
