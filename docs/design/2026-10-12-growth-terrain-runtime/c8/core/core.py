from pathlib import Path
import hashlib,json,os,signal,subprocess,time
out=Path('/private/tmp/sansu-growth-terrain-c8');root=out/'candidate'
paths=set(json.loads((out/'inputs.json').read_text()))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
hashes=lambda:{p:sha(root/p) for p in sorted(paths)}
report={'revision':'growth-terrain-c8','target':str(root),'pass':False,'command':'npm run verify:core','startedAt':time.time(),'initialInputs':hashes()}
(out/'core').mkdir(exist_ok=False)
reportfile=out/'core/report.json';reportfile.write_text(json.dumps(report,indent=2))
env=os.environ.copy()
for k in list(env):
 if k.startswith(('VITE_','SANSU_AUTHORED_','SANSU_FLOOR_SHADING_')):del env[k]
env.update(SANSU_BUILD_REVISION='growth-terrain-c8',VITE_ISLAND_ENABLED='true',VITE_NATIVE_GROWING_ART='false')
with (out/'core/execution.log.txt').open('x') as log:
 process=subprocess.Popen(['npm','run','verify:core'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 report['processId']=process.pid;reportfile.write_text(json.dumps(report,indent=2))
 try:report['exitCode']=process.wait(timeout=7200)
 except subprocess.TimeoutExpired:
  os.killpg(process.pid,signal.SIGTERM);report['timeout']=True;report['exitCode']=process.wait(timeout=15)
report['finalInputs']=hashes();report['sourceFixed']=report['initialInputs']==report['finalInputs'];report['finishedAt']=time.time();report['pass']=report['exitCode']==0 and report['sourceFixed'];reportfile.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['pass','exitCode','sourceFixed','revision']}))
raise SystemExit(0 if report['pass'] else 1)
