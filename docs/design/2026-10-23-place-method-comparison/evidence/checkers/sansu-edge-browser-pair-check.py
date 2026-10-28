import json,hashlib,datetime
from pathlib import Path
p=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-23-place-method-comparison/evidence')
def read(n):return json.loads((p/n).read_text())
def diff(a,b,path=''):
 if isinstance(a,dict) and isinstance(b,dict):
  return [v for k in sorted(set(a)|set(b)) for v in ([path+'.'+k] if k not in a or k not in b else diff(a[k],b[k],(path+'.' if path else '')+k))]
 if isinstance(a,list) and isinstance(b,list):
  return [v for i in range(max(len(a),len(b))) for v in ([path+f'[{i}]'] if i>=len(a) or i>=len(b) else diff(a[i],b[i],path+f'[{i}]'))]
 return [path] if a!=b else []
files=[]; sets=[]
for number in [79,80]:
 names={}
 for kind,suffix in [('before','-before-state.json'),('after','-cold-state.json'),('cpu','-cold-cpu.json'),('cadence','-cold-cadence.json'),('app','-cold-app-dom.json'),('world','-cold-world-dom.json')]:
  matches=list(p.glob(f'{number}-H-*{suffix}'))
  if not matches and kind=='after': matches=list(p.glob(f'{number}-H-*-cold-after-state.json'))
  assert len(matches)==1,(number,kind,matches)
  names[kind]=matches[0].name
 files.extend(names.values());sets.append({k:read(n) for k,n in names.items()})
a,b=sets
core=['fixture','land','terrain','plots','landmarks','keepsakes','villagers','character','drops','town','places']
controls={stage:{k:a[stage].get(k)==b[stage].get(k) for k in core} for stage in ['before','after']}
assert all(v for fields in controls.values() for v in fields.values())
dataOnly=lambda d:{k:v for k,v in d.items() if k.startswith('data-')}
assert dataOnly(a['app'])==dataOnly(b['app'])
suffix='+memo-edge-check-v1'
assert a['before']['candidate']==b['before']['candidate']+suffix
assert a['after']['candidate']==b['after']['candidate']+suffix
worldDiff=diff(dataOnly(a['world']),dataOnly(b['world']));assert worldDiff==['data-method-candidate'],worldDiff
assert a['world']['data-method-candidate']==b['world']['data-method-candidate']+suffix
checks=[];observations=[]
for mode,s in zip(['on','off'],sets):
 before,after=s['before'],s['after'];bt,at=before['terrain'],after['terrain'];entry={'cell':{'x':4,'z':4},'before':0,'after':-1}
 expectedH={**bt['heights'],'4,4':-1};assert bt['heights'].get('4,4',0)==0 and at['heights']==expectedH
 assert at['undo']==(bt['undo']+[entry])[-64:] and at['redo']==[]
 stable={k:before.get(k)==after.get(k) for k in core if k not in ['terrain','places']};assert all(stable.values())
 assert s['world']['data-terrain-selection']=='4,4'
 assert json.loads(s['world']['data-terrain-heights'])==at['heights']
 c,d=s['cpu'],s['cadence'];agg=c['aggregates'];roots=[x for x in c['spans'] if x['parentId'] is None]
 assert len(roots)==2 and roots[0]['endMs']<=roots[1]['startMs']
 for key in ['editableIslandWorld:cold','compileWorldDefinition:derived-edges','applyIntent:terrain-edit','GrowingWorld.rebuild:']:
  assert agg[key]['calls']==1 and agg[key]['failed']==0
 assert c['incompleteSpans']==0 and c['dropped']==0 and c['status']=='stopped'
 assert d['status']=='completed' and d['visibility']=={'started':'visible','ended':'visible','hiddenObserved':False}
 clicks=[x for x in d['timeline']['clicks'] if x['label']=='じめんを さげる'];assert len(clicks)==1
 clickEpoch=datetime.datetime.fromisoformat(d['startedAt'].replace('Z','+00:00')).timestamp()*1000+clicks[0]['atMs']
 actionEpoch=c['startedEpochMs']+roots[0]['startMs'];alignment=round(actionEpoch-clickEpoch,3);assert abs(alignment)<10
 checks.append({'mode':mode,'operation':entry,'exactRawHeightsTransition':True,'exactAppendAndCap64UndoTransition':True,'redoEmpty':True,'unrelatedCoreFieldsUnchanged':stable,'placeProgressUnchangedDuringOperation':before['placeProgress']==after['placeProgress'],'onlySelectedCellHeightChanged':True})
 observations.append({'mode':mode,'worldMs':agg['editableIslandWorld:cold']['inclusiveMs'],'worldSelfMs':agg['editableIslandWorld:cold']['selfMs'],'compileMs':agg['compileWorldDefinition:derived-edges']['inclusiveMs'],'actionMs':agg['applyIntent:terrain-edit']['inclusiveMs'],'sceneMs':agg['GrowingWorld.rebuild:']['inclusiveMs'],'sceneLayoutMs':agg['worldScene.layout:']['inclusiveMs'],'nonOverlappingRootSumMs':round(sum(x['inclusiveMs'] for x in roots),3),'longtaskMs':max(x['durationMs'] for x in d['timeline']['longTasks']),'rafMaxMs':d['intervalMs']['max'],'rafMedianMs':d['intervalMs']['median'],'rafP95Ms':d['intervalMs']['p95'],'clickToActionStartMs':alignment,'startedAt':d['startedAt'],'clicks':d['timeline']['clicks']})
metrics=['worldMs','worldSelfMs','compileMs','actionMs','sceneMs','longtaskMs','rafMaxMs']
report={'status':'COMPARABLE_N1_WITH_NATURAL_USE_DIFFERENCES','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 /private/tmp/sansu-edge-browser-pair-check.py','checkerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceSHA256':{n:hashlib.sha256((p/n).read_bytes()).hexdigest() for n in files},'build':a['app'],'captureAttributeDifferences':{'app':diff(a['app'],b['app']),'world':diff(a['world'],b['world']),'note':'80 captures also include CSS class attributes; 79 captures only data attributes. All shared data fields compared.'},'controls':controls,'cameraAndWorldDOM':{'equalExceptCandidateSuffix':True,'differences':worldDiff,'camera':json.loads(a['world']['data-growing-camera']),'terrainRevisionEqual':a['world']['data-terrain-revision']==b['world']['data-terrain-revision'],'fullDOM':a['world']},'operationChecks':checks,'observations':observations,'offMinusOnMs':{k:round(observations[1][k]-observations[0][k],3) for k in metrics},'remainingStateDifferences':{stage:diff(a[stage],b[stage]) for stage in ['before','after']},'replicatesPerMode':1,'limitations':['One visible cold edit per condition, fixed ON then OFF order. No randomized repetitions or control of GC/thermal state.','Natural use records differ between conditions; full state equality and identical actor positions are not claimed.','Camera/world/build DOM and material geometry inputs match; actual GPU mesh or rendered pixels are not hashed.','CPU spans are inclusive and nested; only separate action and scene roots are added.','Shore memory-only fixture, not a persisted DB/offline save or production release test.','No claim all compile cost is removed or that remaining frame gap is smooth direct editing.']}
(p/'edge-browser-pair-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'metrics':observations,'delta':report['offMinusOnMs'],'diffs':report['remainingStateDifferences']},ensure_ascii=False))
