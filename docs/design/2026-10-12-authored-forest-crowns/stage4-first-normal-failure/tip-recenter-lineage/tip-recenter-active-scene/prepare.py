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
prior_tip=DEBUG/'tip-recenter-probe'
old_ready=json.loads((prior_tip/'readiness.json').read_text())
assert sha(prior_tip/'readiness.json')=='878f5c2063f9427612fbe95b9e531c1197d85f5140cd381d6d918470c502d82a'
for name,value in old_ready['files'].items():
    assert sha(prior_tip/name)==value;external[str(prior_tip/name)]=value
for name in ['readiness.json','readiness.sha256','execution-01/result.json','execution-01/execution.log.txt','attempt-01/diagnostic-failure.json','attempt-01/float64-profile.json.gz','attempt-01/variants-so-far.json.gz','attempt-01/six-incident-sharp-tip-recenter-first.glb','attempt-01/input-parity.json']:
    external[str(prior_tip/name)]=sha(prior_tip/name)
for name in ['geometry.py','export_check.py','test_geometry.py','test_export_check.py','run-once.py']:
    assert sha(HERE/name)==sha(prior_tip/name), 'No math/oracle/runner changes'
observed=DEBUG/'tip-recenter-export-observation'
observed_ready=json.loads((observed/'readiness.json').read_text())
assert sha(observed/'readiness.json')=='a6387d6816a756aee6329784e6771786063228c145ea79bf084630eae79cdad6'
for name,value in observed_ready['files'].items():
    assert sha(observed/name)==value;external[str(observed/name)]=value
for name in ['readiness.json','readiness.sha256','execution-01/result.json','execution-01/execution.log.txt','observation-summary.json']:
    external[str(observed/name)]=sha(observed/name)
for path in sorted((observed/'attempt-01').iterdir()):
    if path.is_file():external[str(path)]=sha(path)
isolated=DEBUG/'tip-recenter-isolated-export'
isolated_ready=json.loads((isolated/'readiness.json').read_text())
assert sha(isolated/'readiness.json')=='7fa46e5de221053398333d84145447b01abc5dd290c68da23fa9dabf07b20f8a'
for name,value in isolated_ready['files'].items():
    assert sha(isolated/name)==value;external[str(isolated/name)]=value
for name in ['readiness.json','readiness.sha256','execution-01/result.json','execution-01/execution.log.txt','terminal-summary.json']:
    external[str(isolated/name)]=sha(isolated/name)
for path in sorted((isolated/'attempt-01').iterdir()):
    if path.is_file():external[str(path)]=sha(path)
addon=Path('/Applications/Blender.app/Contents/Resources/5.2/scripts/addons_core/io_scene_gltf2')
for name in ['__init__.py','blender/exp/export.py','blender/exp/gather.py','blender/exp/tree.py']:
    path=addon/name;external[str(path)]=sha(path)
for name in ['world_check.py','test_world_check.py']:
    assert sha(HERE/name)==sha(isolated/name)
assert {p:sha(Path(p)) for p in external}==external
files=['geometry.py','probe.py','export_check.py','test_geometry.py','test_export_check.py','run-once.py','prepare.py','export_isolation.py','world_check.py','test_world_check.py','exact_fingerprint.py','test_exact_fingerprint.py','README.md']
syntax=[]
for name in files:
    if name.endswith('.py'):
        compile((HERE/name).read_text(),str(HERE/name),'exec');syntax.append(name)
tree=ast.parse((HERE/'probe.py').read_text())
operators=sorted({ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call) and ast.unparse(n.func).startswith('bpy.ops.')})
assert operators==['bpy.ops.export_scene.gltf','bpy.ops.import_scene.gltf','bpy.ops.object.select_all','bpy.ops.wm.read_factory_settings']
assert sha(HERE/'export_check.py')==sha(prior/'export_check.py')
assert sha(HERE/'test_export_check.py')==sha(prior/'test_export_check.py')
test=subprocess.run([sys.executable,'-B','-m','unittest','-v','test_geometry','test_export_check','test_world_check','test_exact_fingerprint'],cwd=HERE,
    capture_output=True,text=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
(HERE/'pure-tests.log.txt').write_text(test.stdout+test.stderr)
assert test.returncode==0,'Preserve first failure before repair'
after={p:sha(Path(p)) for p in external};assert after==external
static={'compiled':syntax,'pureTestsExitCode':test.returncode,'testCount':16,'operatorAllowlist':operators,
    'externalInputParity':True,'blenderExecuted':False,'unchangedExportOracleSHA':sha(HERE/'export_check.py'),
    'normalTolerance':.002,'diagnosticRepresentationErrorBound':1e-6,
    'sourceMeshOrMaterialOrOwnerEdited':False,'mathOracleRunnerByteIdenticalToFirstTipProbe':True,'originalSceneGuard':'exact mesh/normal/matrix/parent/sharp/material; no repair assignments','copyMutationPolicy':'matrix drift observed, output world error unchanged <=1e-6; all other components exact','exportScope':'use_selection=True/use_active_scene=True; one scene, one exact named leaf,148 exact triangles','sharpStateEncoding':'same all444 mesh edge order/indices/flags, streamed typed SHA rather than retaining107MB raw list per snapshot'}
(HERE/'static-check.json').write_text(json.dumps(static,indent=2)+'\n')
files+=['pure-tests.log.txt','static-check.json']
seal={'preparedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'READY-NOT-EXECUTED',
    'files':{name:sha(HERE/name) for name in files},'externalInputs':external,
    'limits':{'threads':2,'maxConcurrentBlender':1,'rssObservedStopBytes':2*1024**3,'rssSampleSeconds':.25,'timeoutSeconds':60},
    'expectedBlenderBuildHash':'9e2066aef7ef','normalTolerances':{'rawInput':.002,'desiredOutput':.002,'roundtrip':.002},
    'worldCoordinateErrorBound':1e-6,'worldCoordinateErrorBoundScope':'diagnostic representation check only, not product acceptance',
    'comparison':'six-sharp tip only; explicit active temporary scene export; exact authoring scene; raw NORMAL/world points across2exports+reimport',
    'sourceFaceContract':'original152 stays unchanged; all clones explicitly omit original exactly-zero faces0,2,98,100 and retain148; no near-zero deletion',
    'roundtrip':'only eligible standalone leaves; GLB accessor check -> Blender reimport -> second GLB accessor check',
    'command':'SANSU_FOREST_TIP_RECENTER_APPROVED=1 python3 '+str(HERE/'run-once.py'),
    'rendered':False,'sourceCorrectionAdopted':False}
(HERE/'readiness.json').write_text(json.dumps(seal,indent=2)+'\n')
(HERE/'readiness.sha256').write_text(sha(HERE/'readiness.json')+'\n')
print(json.dumps({'readinessSHA':sha(HERE/'readiness.json'),'files':seal['files'],'externalInputCount':len(external),
                  'pureTests':16,'blenderExecuted':False}),flush=True)
