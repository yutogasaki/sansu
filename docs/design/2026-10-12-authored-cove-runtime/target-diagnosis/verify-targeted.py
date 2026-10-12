import json, hashlib, pathlib, subprocess, datetime
root=pathlib.Path('/Users/yutogasaki/Projects/sansu')
out=pathlib.Path('/private/tmp/sansu-cove-distant-p9-diagnosis')
old=json.loads((root/'docs/design/2026-10-12-authored-cove-runtime/focused-v4/report.json').read_text())
files=set(old['sourceIdentity']['files'])
files.update(['src/components/island/growing/authoredCoveLife.test.ts','eslint.config.js'])
files={p for p in files if (root/p).is_file()}
def manifest():
 return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in sorted(files)}}
before=manifest();(out/'targeted-inputs-before.json').write_text(json.dumps(before,indent=2)+'\n')
commands=[['node','node_modules/vitest/vitest.mjs','run','src/components/island/growing/authoredCoveLife.test.ts'],['node','node_modules/eslint/bin/eslint.js','src/components/island/growing/authoredCoveLife.test.ts']]
results=[]
for command,name in zip(commands,['targeted-life.log.txt','targeted-eslint.log.txt']):
 with (out/name).open('wb') as log:
  result=subprocess.run(command,cwd=root,stdout=log,stderr=subprocess.STDOUT)
 results.append({'command':command,'exitCode':result.returncode,'log':name,'logSha256':hashlib.sha256((out/name).read_bytes()).hexdigest()})
 print(json.dumps(results[-1]),flush=True)
after=manifest();(out/'targeted-inputs-after.json').write_text(json.dumps(after,indent=2)+'\n')
changed=[p for p in files if before['files'][p]!=after['files'][p]]
result={'commands':results,'inputCount':len(files),'changedDuringRun':changed,'pass':all(x['exitCode']==0 for x in results) and not changed,'testSha256':after['files']['src/components/island/growing/authoredCoveLife.test.ts']}
(out/'targeted-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
