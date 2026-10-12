from pathlib import Path
import subprocess,time,os,signal,json,hashlib,datetime
D=Path(__file__).resolve().parent
inputs=[D/'build-source-preview.py',D/'source-manifest.json']+[D/f'{s}-source.glb'for s in ['baseline','parallel','seaward']]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p):sha(p)for p in inputs}
log=D/'source-preview-execution.log.txt';result=D/'source-preview-result.json'
assert not log.exists() and not result.exists(),'one source preview attempt only'
cmd=['/Applications/Blender.app/Contents/MacOS/Blender','--background','--factory-startup','--threads','2','--python',str(D/'build-source-preview.py')]
started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();peak=0;reason=None
with log.open('wb')as stream:
 p=subprocess.Popen(cmd,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
 print(json.dumps({'pid':p.pid,'startedUtc':started,'command':cmd}),flush=True)
 while p.poll() is None:
  try:
   rss=int(subprocess.check_output(['ps','-o','rss=','-p',str(p.pid)]).strip()or 0)*1024;peak=max(peak,rss)
  except (ValueError,subprocess.CalledProcessError):pass
  if time.monotonic()-t>120:reason='120-second limit'
  if peak>3*1024**3:reason='3GiB limit'
  if reason:os.killpg(p.pid,signal.SIGTERM);break
  time.sleep(.5)
 try:code=p.wait(timeout=8)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait()
after={str(p):sha(p)for p in inputs}
r={'startedUtc':started,'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':p.pid,'exitCode':code,'elapsedSeconds':time.monotonic()-t,'peakSampledRssBytes':peak,'effectiveThreads':2,'limitReason':reason,'sourceBefore':before,'sourceAfter':after,'inputsUnchanged':before==after,'evidence':'Source-only static comparison; not performance evidence or app acceptance'}
result.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
raise SystemExit(0 if code==0 and before==after else 1)
