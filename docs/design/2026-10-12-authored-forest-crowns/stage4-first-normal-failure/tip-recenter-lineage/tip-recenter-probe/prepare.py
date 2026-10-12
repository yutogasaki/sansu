"""Pure tests/static seal only. No Blender launch and no stage4/source mutation."""
import ast
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime,timezone
from pathlib import Path
HERE=Path(__file__).resolve().parent;DEBUG=HERE.parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not (HERE/'readiness.json').exists(),'Preserve any earlier prep before revising'
assert not (HERE/'execution-01').exists() and not (HERE/'attempt-01').exists()
prior=DEBUG/'sharp-fan-comparison';ready=json.loads((prior/'readiness.json').read_text())
assert sha(prior/'readiness.json')==(prior/'readiness.sha256').read_text().strip()
external=dict(ready['externalInputs'])
for name,value in ready['files'].items():
    assert sha(prior/name)==value;external[str(prior/name)]=value
for name in ['readiness.json','readiness.sha256','attempt-01/comparison-raw.json.gz','attempt-01/result.json','execution-01/result.json','execution-01/postflight.json']:
    external[str(prior/name)]=sha(prior/name)
for name in ['analyze-saved.py','saved-face-fan-analysis.json','trace-precision.py','precision-trace.json','README.md']:
    p=DEBUG/'preassignment-basis'/name;external[str(p)]=sha(p)
assert {p:sha(Path(p)) for p in external}==external
files=['geometry.py','probe.py','export_check.py','test_geometry.py','test_export_check.py','run-once.py','prepare.py','README.md']
syntax=[]
for name in files:
    if name.endswith('.py'):
        compile((HERE/name).read_text(),str(HERE/name),'exec');syntax.append(name)
tree=ast.parse((HERE/'probe.py').read_text())
operators=sorted({ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call) and ast.unparse(n.func).startswith('bpy.ops.')})
assert operators==['bpy.ops.export_scene.gltf','bpy.ops.import_scene.gltf','bpy.ops.object.select_all','bpy.ops.wm.read_factory_settings']
assert sha(HERE/'export_check.py')==sha(prior/'export_check.py')
assert sha(HERE/'test_export_check.py')==sha(prior/'test_export_check.py')
test=subprocess.run([sys.executable,'-B','-m','unittest','-v','test_geometry','test_export_check'],cwd=HERE,
    capture_output=True,text=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
(HERE/'pure-tests.log.txt').write_text(test.stdout+test.stderr)
assert test.returncode==0,'Preserve first failure before repair'
after={p:sha(Path(p)) for p in external};assert after==external
static={'compiled':syntax,'pureTestsExitCode':test.returncode,'testCount':9,'operatorAllowlist':operators,
    'externalInputParity':True,'blenderExecuted':False,'unchangedExportOracleSHA':sha(HERE/'export_check.py'),
    'normalTolerance':.002,'diagnosticRepresentationErrorBound':1e-6,
    'sourceMeshOrMaterialOrOwnerEdited':False}
(HERE/'static-check.json').write_text(json.dumps(static,indent=2)+'\n')
files+=['pure-tests.log.txt','static-check.json']
seal={'preparedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'READY-NOT-EXECUTED',
    'files':{name:sha(HERE/name) for name in files},'externalInputs':external,
    'limits':{'threads':2,'maxConcurrentBlender':1,'rssObservedStopBytes':2*1024**3,'rssSampleSeconds':.25,'timeoutSeconds':60},
    'expectedBlenderBuildHash':'9e2066aef7ef','normalTolerances':{'rawInput':.002,'desiredOutput':.002,'roundtrip':.002},
    'worldCoordinateErrorBound':1e-6,'worldCoordinateErrorBoundScope':'diagnostic representation check only, not product acceptance',
    'comparison':'two source-input controls, then six-sharp/all-sharp each at old Float64-bake pivot vs compensated tip-relative pivot; four deformed clones',
    'sourceFaceContract':'original152 stays unchanged; all clones explicitly omit original exactly-zero faces0,2,98,100 and retain148; no near-zero deletion',
    'roundtrip':'only eligible standalone leaves; GLB accessor check -> Blender reimport -> second GLB accessor check',
    'command':'SANSU_FOREST_TIP_RECENTER_APPROVED=1 python3 '+str(HERE/'run-once.py'),
    'rendered':False,'sourceCorrectionAdopted':False}
(HERE/'readiness.json').write_text(json.dumps(seal,indent=2)+'\n')
(HERE/'readiness.sha256').write_text(sha(HERE/'readiness.json')+'\n')
print(json.dumps({'readinessSHA':sha(HERE/'readiness.json'),'files':seal['files'],'externalInputCount':len(external),
                  'pureTests':9,'blenderExecuted':False}),flush=True)
