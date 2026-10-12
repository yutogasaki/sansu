from pathlib import Path
import ast, hashlib, importlib.util, json, sys
sys.dont_write_bytecode=True
b=Path('/private/tmp/sansu-authored-shoulder-c1');p=b/'prepared';out=p/'runner-cove-contract-fix';old=Path('/private/tmp/sansu-authored-cove-c4')
spec=importlib.util.spec_from_file_location('prepared_runner',p/'regressions.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ast.parse((p/'regressions.py').read_text());m.REVISION='authored-cove-c4'
expected=json.loads((old/'core/report.json').read_text())['initialInputs']
cases=[('03-baseline27-editing','regressions/01-baseline27-editing/actual/report.json'),('04-wide27-water','regressions/02-wide27-water/actual/report.json'),('05-authored-flower-full-cove-off','flower-full-retry-2400/actual/report.json'),('06-authored-cove-full','full/report.json'),('07-ordinary-growing-balance','regressions/03-ordinary-growing-balance/actual/report.json'),('08-classic-smoke','regressions/04-classic-smoke/diagnostics/smoke-report.json')]
results=[]
for name,relative in cases:
 path=old/relative;raw=path.read_bytes();d=json.loads(raw);adapters=[]
 for capture in d.get('captures',[]): capture['file']=str(path.parent/capture['file'])
 if d.get('captures'): adapters.append('In-memory capture.file made absolute to locate the unchanged old raw screenshots')
 if name=='06-authored-cove-full':
  # c4 predates this new data attribute; the current GrowingWorld source explicitly
  # emits false when shoulder is absent. This adaptation is not runtime evidence.
  for capture in d['captures']: capture['metadata']['authoredShoulderEnabled']='false'
  adapters.append('Added current no-shoulder DOM attribute absent in c4; current source definition checked separately')
 result=m.inspect_result({'name':name},d,'',expected)
 results.append({'stage':name,'historicalRawReport':str(path),'historicalRawSha256':hashlib.sha256(raw).hexdigest(),'adapters':adapters,'inspection':result})
 assert result['pass'],(name,result)
newcore=json.loads((b/'core/report.json').read_text());drivers=['e2e-authored-floor-shading.mjs','e2e-authored-shoulder.mjs','e2e-authored-island-editing.mjs','e2e-authored-water.mjs','e2e-authored-flower.mjs','e2e-authored-cove.mjs','e2e-growing-balance.mjs','e2e-smoke.mjs']
fixed={f'tools/{name}':hashlib.sha256((b/'candidate/tools'/name).read_bytes()).hexdigest() for name in drivers}; assert all(newcore['finalInputs'][n]==v for n,v in fixed.items())
report={'scope':'Runner contract review only; six historical raw report shapes replayed, two new shapes statically matched to fixed driver source. No new browser/runtime evidence.','historicalReplays':results,'newDriverContracts':{'01-floor-shading-ab':'10 captures / 5 pairs; expectedBuild; observed.app.buildRevision; observed.world.authoredShoulderEnabled; pair booleans; initialInputs/finalInputs','02-shoulder-full':'20 captures: acquisition 6, fixed35 14; both scopes pass; acquisition paidDrops60/rights75; sourceClosureUnchanged; installedDependenciesUnchanged and separate before/after dependency maps'},'fixedDriverSha256':fixed,'allFixedDriversMatchCore':True,'candidateAppOrDriverModified':False,'pass':True,'runnerSha256':hashlib.sha256((p/'regressions.py').read_bytes()).hexdigest()}
(out/'contract-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':True,'historicalRealReportShapes':len(results),'newStaticallyReviewedShapes':2,'fixedDriverCount':len(fixed),'runnerSha256':report['runnerSha256']}))
