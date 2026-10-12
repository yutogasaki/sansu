from pathlib import Path
import hashlib,json,shutil,subprocess,time
source=Path('/Users/yutogasaki/Projects/sansu');out=Path('/private/tmp/sansu-growth-terrain-c8');target=out/'candidate'
files=sorted(set(p for p in subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=source).decode().split('\0') if p and (source/p).is_file()))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={p:sha(source/p) for p in files}
subprocess.run(['cp','-cR','/private/tmp/sansu-districts-c7/candidate',str(target)],check=True)
copied=[]
for p,h in before.items():
 dest=target/p
 if not dest.is_file() or sha(dest)!=h:
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/p,dest);copied.append(p)
after={p:sha(source/p) for p in files}
assert before==after,'Source changed during snapshot'
assert {p:sha(target/p) for p in files}==before,'Candidate copy differs'
(out/'inputs.json').write_text(json.dumps(before,indent=2)+'\n')
(out/'snapshot.json').write_text(json.dumps({'revision':'growth-terrain-c8','copied':copied,'inputs':len(files),'sourceFixed':True,'finishedAt':time.time()},indent=2)+'\n')
print(json.dumps({'inputs':len(files),'copied':len(copied),'sourceFixed':True}))
