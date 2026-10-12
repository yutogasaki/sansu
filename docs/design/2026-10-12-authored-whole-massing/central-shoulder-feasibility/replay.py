"""Replay retained raw diagnostics without writing application/model sources."""
import argparse,gzip,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[3]
p=argparse.ArgumentParser();p.add_argument('--run',action='store_true');p.add_argument('--output',type=Path,default=Path('/private/tmp/sansu-central-shoulder-replay'));p.add_argument('--python',default=sys.executable);p.add_argument('--case',choices=['final','north-v1','north-v2','south-logical','south-v1','south-v2','sections'],default='final');args=p.parse_args()
manifest=json.loads((ROOT/'archive-manifest.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest();bad=[]
for name,digest in manifest['canonicalInputsBefore'].items():
 path=REPO/name
 if not path.exists() or sha(path.read_bytes())!=digest:bad.append(name)
if bad:raise SystemExit('Canonical input SHA differs; restore the recorded revision before replay:\n'+'\n'.join(bad))
for item in manifest['files']:
 data=(ROOT/item['archive']).read_bytes()
 if sha(data)!=item['archiveSha256']:raise SystemExit('Archive SHA differs: '+item['archive'])
 raw=gzip.decompress(data)if item['encoding']=='gzip'else data
 if sha(raw)!=item['sourceSha256']:raise SystemExit('Decoded raw SHA differs: '+item['relative'])
print('Canonical inputs and all decoded raw archive SHA values match.')
if not args.run:raise SystemExit(0)
if args.output.exists() and any(args.output.iterdir()):raise SystemExit('Choose an empty output directory; prior evidence will not be overwritten.')
args.output.mkdir(parents=True,exist_ok=True)
actor=args.output/'inputs/actor-c1-report.json';actor.parent.mkdir();actor.write_bytes((ROOT/'inputs/actor-c1-report.json').read_bytes())
for item in manifest['files']:
 raw=(ROOT/item['archive']).read_bytes();raw=gzip.decompress(raw)if item['encoding']=='gzip'else raw
 target=args.output/item['relative'];target.parent.mkdir(parents=True,exist_ok=True)
 if target.suffix in ['.mjs','.py']:
  text=raw.decode().replace('/Users/yutogasaki/Projects/sansu',str(REPO)).replace('/private/tmp/sansu-whole-massing-c-terrain',str(args.output)).replace('/private/tmp/sansu-authored-cove-c1/shape/report.json',str(actor));raw=text.encode()
 target.write_bytes(raw)
cases={'final':['south-west-v3/candidate-probe.mjs','south-west-v3/candidate-physical-screen.mjs','south-west-v3/geometry-summary.py','south-west-v3/bench-debug.mjs','south-west-v3/entry-routes.mjs','south-west-v3/assembly-extract.mjs','south-west-v3/material-provenance.py','south-west-v3/root-contact.mjs','south-west-v3/root-contact-floor.py'], 'north-v1':['candidate-probe.mjs','access-debug.mjs','west-entry-screen.mjs'], 'north-v2':['v2/candidate-probe.mjs','v2/candidate-physical-screen.mjs','v2/bench-debug.mjs','v2/geometry-summary.py'], 'south-logical':['south-logical/probe.mjs','south-logical/sections-screen.py'], 'south-v1':['south-west/candidate-probe.mjs','south-west/candidate-physical-screen.mjs','south-west/geometry-summary.py'], 'south-v2':['south-west-v2/candidate-probe.mjs','south-west-v2/candidate-physical-screen.mjs','south-west-v2/geometry-summary.py'], 'sections':['section-probe.mjs','analyze-sections.py']}
for name in cases[args.case]:
 script=args.output/name;command=[args.python if script.suffix=='.py' else 'node',str(script)]
 with (script.parent/(script.stem+'.replay.log.txt')).open('w')as log:subprocess.run(command,cwd=REPO,stdout=log,stderr=subprocess.STDOUT,check=True)
 print('Completed',name)
print('Replay output:',args.output)
