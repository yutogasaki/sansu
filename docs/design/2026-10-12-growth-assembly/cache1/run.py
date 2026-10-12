from pathlib import Path
import subprocess,json,time,os,signal
out=Path('/private/tmp/sansu-growth-cache1'); r={'started':time.time(),'scope':'same four moves, 3GiB heap, latest-frame cache'}
with (out/'execution.log.txt').open('w') as log:
 p=subprocess.Popen(['node','--max-old-space-size=3072',str(out/'short-replay.mjs'),'east-shore-line'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True);r['pid']=p.pid
 try:r['exitCode']=p.wait(timeout=180)
 except subprocess.TimeoutExpired:
  r['timeout']=True;os.killpg(p.pid,signal.SIGTERM);r['exitCode']=p.wait(timeout=10)
r['elapsed']=time.time()-r['started'];(out/'execution-result.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
