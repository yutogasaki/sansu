"""Lossless archive of the read-only C terrain diagnostic. Writes only this folder."""
import gzip,hashlib,json,shutil,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[3]
SOURCE=Path('/private/tmp/sansu-whole-massing-c-terrain')
def sha(b):return hashlib.sha256(b).hexdigest()
items=[];omitted=[];stored={}
# Prefer final v3 when identical raw payloads can be stored once.
files=sorted(SOURCE.rglob('*'),key=lambda p:(0 if 'south-west-v3' in p.parts else 1,str(p)))
for source in files:
 if not source.is_file():continue
 relative=source.relative_to(SOURCE);data=source.read_bytes();digest=sha(data)
 if source.name=='candidate-world.json.gz' and relative.parts[0]!='south-west-v3':
  omitted.append({'source':str(source),'relative':str(relative),'bytes':len(data),'sha256':digest,'reason':'Earlier full-world snapshot reproducible from retained candidate-probe.mjs; only final full-world snapshot retained.'});continue
 compressed=source.name in ['sections.json','leaf-source-triangles.json']
 archive_relative=Path('raw')/relative
 if compressed:archive_relative=Path(str(archive_relative)+'.gz')
 encoding='gzip' if compressed else 'identity'
 if digest in stored and source.name=='leaf-source-triangles.json':archive_relative=stored[digest]
 else:
  archive=ROOT/archive_relative;archive.parent.mkdir(parents=True,exist_ok=True);archive.write_bytes(gzip.compress(data,mtime=0) if compressed else data);stored[digest]=archive_relative
 archive=ROOT/archive_relative;decoded=gzip.decompress(archive.read_bytes()) if encoding=='gzip' else archive.read_bytes()
 assert decoded==data
 items.append({'source':str(source),'relative':str(relative),'archive':str(archive_relative),'encoding':encoding,'sourceBytes':len(data),'sourceSha256':digest,'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive.read_bytes())})
actor=Path('/private/tmp/sansu-authored-cove-c1/shape/report.json');target=ROOT/'inputs/actor-c1-report.json';target.parent.mkdir(exist_ok=True);shutil.copyfile(actor,target)
extra={'source':str(actor),'archive':'inputs/actor-c1-report.json','sourceBytes':actor.stat().st_size,'sourceSha256':sha(actor.read_bytes()),'archiveSha256':sha(target.read_bytes())}
# Inputs are canonical runtime/model data, distinct from generated TMP worlds.
expected={}
for report in [SOURCE/'sections.json',SOURCE/'south-west-v3/candidate-proof.json',SOURCE/'south-west-v3/candidate-physical-screen.json']:
 obj=json.loads(report.read_text())
 for path,digest in obj.get('inputs',{}).items():
  if path.startswith('/private/'):continue
  expected[path.lstrip('/')]=digest
current={path:sha((REPO/path).read_bytes()) for path in expected}
manifest={'scope':'Next M1 source-production candidate; current app/source unchanged by this diagnostic. Numerical floor/source-physics PASS only, no closed source solid or app art acceptance.','createdAt':datetime.now(timezone.utc).isoformat(),'gitHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'tmpRoot':str(SOURCE),'files':items,'extraInputs':[extra],'omittedReconstructibleWorlds':omitted,'canonicalInputsBefore':expected,'canonicalInputsAfter':current,'canonicalInputsUnchanged':expected==current}
(ROOT/'archive-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'storedRawMappings':len(items),'omittedEarlierWorlds':len(omitted),'canonicalInputsUnchanged':expected==current,'decodedArchiveBytesMatch':True},ensure_ascii=False))
