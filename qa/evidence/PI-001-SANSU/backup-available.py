from pathlib import Path
import json,hashlib,ctypes,os,shutil,datetime
repo=Path(__file__).resolve().parents[3];model=json.loads((repo/'portal/data/unification-manifest.json').read_text());registry=json.loads((repo/'portal/data/unification.json').read_text());candidate=json.loads((repo/'portal/data/integration.json').read_text())['currentCandidate'];out=repo.parent/'.portal-recovery'/'PI-001-SANSU-library'/candidate[:16];out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lib=ctypes.CDLL(None,use_errno=True);clone=lib.clonefile;clone.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_int];clone.restype=ctypes.c_int
rows=[];total=0
for source,expected in sorted(model['sourceFiles'].items()):
 file=repo/source;dest=out/source
 if file.is_symlink():raise RuntimeError('Unexpected symlink: '+source)
 if not dest.exists():
  dest.parent.mkdir(parents=True,exist_ok=True)
  if clone(os.fsencode(file),os.fsencode(dest),0)!=0:shutil.copy2(file,dest)
 actual=sha(dest)
 if actual!=expected:raise RuntimeError('Source or recovery changed: '+source)
 size=dest.stat().st_size;total+=size;rows.append({'source':source,'sha256':actual,'bytes':size})
missing=[row for row in registry['resources'] if row.get('state')=='missing'];manifest={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidate':candidate,'sources':rows,'missing':missing,'folders':registry.get('folders',[])};target=out/'manifest.json';target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
report={'status':'PARTIAL' if missing else 'PASS','availableFileCheck':'PASS','at':manifest['at'],'candidate':candidate,'root':str(out),'availableFiles':len(rows),'bytes':total,'missingResources':missing,'manifestSha256':sha(target),'verification':'Every available cloned file checked against the exact source manifest. Missing historical resources remain missing and are not substituted.'};(repo/'qa/evidence/PI-001-SANSU/recovery-stable.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='missingResources'},ensure_ascii=False))
