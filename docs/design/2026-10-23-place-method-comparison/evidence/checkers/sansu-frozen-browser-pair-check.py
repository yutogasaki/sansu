import json,hashlib,datetime
from pathlib import Path
p=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-23-place-method-comparison/evidence')
names=['74-H-frozen-cold-'+s+'.json' for s in ['state','cpu','cadence','app-dom']]+['75-H-dynamic-cold-'+s+'.json' for s in ['state','cpu','cadence','app-dom']]+['69-H-wide-shore-final-state.json','expanded-place-recipe-flower-flat-wide-fixture.json','frozen-query-check.json']
read=lambda n:json.loads((p/n).read_text())
a,b=read(names[0]),read(names[4]);source=read(names[8]);fixture=read(names[9])['state'];cpu=[read(names[i]) for i in [1,5]];cad=[read(names[i]) for i in [2,6]];dom=[read(names[i]) for i in [3,7]]
def norm(h):return{k:v for k,v in h.items() if v!=0}
def diff(x,y,path='placeProgress'):
 if type(x)!=type(y):return[{'path':path,'difference':'type'}]
 if isinstance(x,dict):return[r for k in sorted(set(x)|set(y)) for r in ([{'path':path+'.'+k,'difference':'missing'}] if k not in x or k not in y else diff(x[k],y[k],path+'.'+k))]
 if isinstance(x,list):return[{'path':path+'.length','frozen':len(x),'dynamic':len(y)}] if len(x)!=len(y) else[r for i,(xx,yy) in enumerate(zip(x,y)) for r in diff(xx,yy,path+f'[{i}]')]
 return[{'path':path,'frozen':x,'dynamic':y}] if x!=y else[]
checks=[]
for s in [a,b]:
 t=s['terrain'];last=t['undo'][-1];h=t['heights'].copy();k=f"{last['cell']['x']},{last['cell']['z']}";h[k]=last['before']
 checks.append({'lastAcceptedEdit':last,'reconstructedBeforeRawMatches69':norm(h)==norm(source['terrain']['heights']),'reconstructedBeforeRawMatchesLoadedFixture':norm(h)==norm(fixture['terrain']['heights']),'remainingUndoMatchesFixtureTail63':t['undo'][:-1]==fixture['terrain']['undo'][-63:],'remainingUndoMatches69Tail63':t['undo'][:-1]==source['terrain']['undo'][-63:],'redoMatchesFixture':t['redo']==fixture['terrain']['redo']})
equal={k:a.get(k)==b.get(k) for k in sorted(set(a)|set(b))}
geometryFields=['fixture','land','terrain','plots','landmarks','keepsakes','villagers','character','drops','town','places']
assert all(equal[k] for k in geometryFields)
assert dom[0]==dom[1]
assert a['candidate']==b['candidate']+'+frozen-query-v1'
assert all(c['lastAcceptedEdit']=={'cell':{'x':4,'z':4},'before':0,'after':-1} and c['reconstructedBeforeRawMatches69'] and c['reconstructedBeforeRawMatchesLoadedFixture'] and c['remainingUndoMatchesFixtureTail63'] for c in checks)
metrics=[]
for label,c,d in zip(['frozen','dynamic'],cpu,cad):
 agg=c['aggregates'];root=[s for s in c['spans'] if s['parentId'] is None];assert len(root)==2 and root[0]['endMs']<=root[1]['startMs']
 assert c['status']=='stopped' and c['incompleteSpans']==0 and c['dropped']==0
 for key in ['editableIslandWorld:cold','compileWorldDefinition:derived-edges','applyIntent:terrain-edit','GrowingWorld.rebuild:']:
  assert agg[key]['calls']==1 and agg[key]['failed']==0
 assert d['status']=='completed' and d['visibility']=={'started':'visible','ended':'visible','hiddenObserved':False}
 metrics.append({'mode':label,'worldColdMs':agg['editableIslandWorld:cold']['inclusiveMs'],'worldSelfMs':agg['editableIslandWorld:cold']['selfMs'],'compileMs':agg['compileWorldDefinition:derived-edges']['inclusiveMs'],'actionMs':agg['applyIntent:terrain-edit']['inclusiveMs'],'sceneMs':agg['GrowingWorld.rebuild:']['inclusiveMs'],'sceneLayoutMs':agg['worldScene.layout:']['inclusiveMs'],'nonOverlappingRootSumMs':round(sum(s['inclusiveMs'] for s in root),3),'longtaskMs':max(x['durationMs'] for x in d['timeline']['longTasks']),'rafMaxMs':d['intervalMs']['max'],'clicks':d['timeline']['clicks'],'startedAt':d['startedAt']})
deltas={k:round(metrics[1][k]-metrics[0][k],3)for k in ['worldColdMs','worldSelfMs','compileMs','actionMs','sceneMs','longtaskMs','rafMaxMs']}
report={'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS_GEOMETRY_AND_OPERATION_COMPARABILITY_WITH_FULL_STATE_DIFFERENCES','command':'python3 /private/tmp/sansu-frozen-browser-pair-check.py','checkerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'hashes':{n:hashlib.sha256((p/n).read_bytes()).hexdigest()for n in names},'buildDom':dom[0],'allBuildDomFieldsEqual':True,'candidateBaseEqual':True,'effectiveCandidateDifference':'frozen-query-v1 only; original URL strings were not captured in these artifacts','equalCapturedFields':equal,'fullCapturedStateEqualExcludingCandidate':all(v for k,v in equal.items()if k!='candidate'),'placeProgressDifferences':diff(a['placeProgress'],b['placeProgress']),'inputAndHistoryChecks':checks,'measured':metrics,'dynamicMinusFrozenMs':deltas,'replicatesPerMode':1,'renderedMeshDirectlyCompared':False,'separateNodeGeometryProof':{'record':'frozen-query-check.json','status':read(names[10])['status'],'worldHashEqual':len(set(r['hash']for r in read(names[10])['reports']))==1},'limitations':['No separately captured full pre-edit state: raw heights reconstructed from final Undo and matched both69 and loaded shore fixture.','74/75 terrain including full Undo/Redo is equal. Their pre-edit history follows the imported recipe fixture, not69 actual UI operation ordering.','placeProgress differs in eight timestamp/target leaves from natural use before editing. Thus full captured state and live actor/browser conditions are not identical.','Browser geometry inputs and derived places are equal; actual rendered mesh/GPU output was not hashed. Separate Node frozen-query proof checks exact world/floor/site/query hashes.','One visible cold edit per mode on same v15 build; ordering, GC, thermal state and live actor pose are uncontrolled.','CPU inclusive spans nest. Only the two non-overlapping top-level action and scene spans are added.','Frozen query improvement is supported for this paired operation; roughly500ms maximum frame gap remains and does not satisfy smooth direct editing.']}
(p/'frozen-browser-pair-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'equal':equal,'metrics':metrics,'delta':deltas},ensure_ascii=False))
