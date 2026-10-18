import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url))),dir=path.join(root,'qa/evidence/PI-001-SANSU');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const candidate=JSON.parse(fs.readFileSync(path.join(root,'portal/data/integration.json'))).currentCandidate,manifest=sha(path.join(root,'portal/data/unification-manifest.json'));
const at=new Date().toISOString(),raw=path.join(dir,'file-browser-stable.json'),shots=path.join(dir,'file-screens-stable');
const result=spawnSync(process.execPath,['tools/qa-integrated-portal.mjs'],{cwd:root,env:{...process.env,SANSU_PORTAL_QA_REPORT:raw,SANSU_PORTAL_QA_SCREENSHOTS:shots},encoding:'utf8'});
const report={at,command:'node tools/qa-integrated-portal.mjs',candidate,manifestSha256:manifest,candidateUnchanged:manifest===sha(path.join(root,'portal/data/unification-manifest.json')),harnessSha256:sha(path.join(root,'tools/qa-integrated-portal.mjs')),exitCode:result.status,stdout:result.stdout,stderr:result.stderr,report:'file-browser-stable.json'};
fs.writeFileSync(path.join(dir,'file-browser-stable-meta.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=result.status||(!report.candidateUnchanged?1:0);
