import json,hashlib,datetime,copy
from pathlib import Path
p=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-23-place-method-comparison/evidence')
names=[f.name for f in sorted(p.glob('81-H-final-*.json'))]
def read(n):return json.loads((p/n).read_text())
states={s:read(f'81-H-final-{s}-state.json')for s in ['before','step2','undo','redo','restored']}
worlds={s:read(f'81-H-final-{s}-world.json')for s in ['step1','step2','undo','redo','restored']}
base=states['before'];checks=[]
entries=[{'cell':{'x':4,'z':4},'before':0,'after':-1},{'cell':{'x':4,'z':4},'before':-1,'after':-2}]
t=copy.deepcopy(base['terrain'])
def setheight(v):
 if v: t['heights']['4,4']=v
 else:t['heights'].pop('4,4',None)
def edit(e):setheight(e['after']);t['undo']=(t['undo']+[e])[-64:];t['redo']=[]
def undo():
 e=t['undo'].pop();setheight(e['before']);t['redo'].append(e)
def redo():
 e=t['redo'].pop();setheight(e['after']);t['undo'].append(e)
def verify(stage,value):
 w=worlds[stage];h=json.loads(w['heights']);assert h==t['heights'] and h.get('4,4',0)==value
 if stage in states: assert states[stage]['terrain']==t
 checks.append({'stage':stage,'height':value,'worldHeightsMatchExpected':True,'fullStateTerrainCompared':stage in states,'undoCount':len(t['undo']),'redoCount':len(t['redo'])})
edit(entries[0]);verify('step1',-1)
edit(entries[1]);verify('step2',-2)
undo();verify('undo',-1)
redo();verify('redo',-2)
undo();undo();verify('restored',0)
core=['fixture','land','plots','landmarks','keepsakes','villagers','character','drops','town']
coreChecks={s:{k:v.get(k)==base.get(k)for k in core}for s,v in states.items()};assert all(x for d in coreChecks.values()for x in d.values())
assert states['restored']['terrain']['heights']==base['terrain']['heights']
assert states['restored']['places']==base['places']
assert states['redo']['terrain']==states['step2']['terrain']
assert states['restored']['terrain']['undo']==base['terrain']['undo'][2:]
assert states['restored']['terrain']['redo']==list(reversed(entries))
candidates={v['candidate']for v in states.values()};assert len(candidates)==1
assert all(w['selection']=='4,4'for w in worlds.values())
c=read('81-H-final-step2-cpu.json');d=read('81-H-final-step2-cadence.json');live=read('81-H-final-step2-live.json');app=read('81-H-final-app-dom.json')
assert c['status']=='stopped'and c['dropped']==0 and c['incompleteSpans']==0
for key in ['editableIslandWorld:cold','compileWorldDefinition:derived-edges','applyIntent:terrain-edit','GrowingWorld.rebuild:']:
 assert c['aggregates'][key]['calls']==2 and c['aggregates'][key]['failed']==0
assert d['visibility']=={'started':'visible','ended':'visible','hiddenObserved':False} and d['status']=='completed'
actions=[s for s in c['spans']if s['name']=='applyIntent'];cold=[s for s in c['spans']if s['name']=='editableIslandWorld' and s['detail']=='cold'];compile=[s for s in c['spans']if s['name']=='compileWorldDefinition'];scenes=[s for s in c['spans']if s['name']=='GrowingWorld.rebuild'];clicks=[x for x in d['timeline']['clicks']if x['label']=='じめんを さげる'];assert len(clicks)==2
cadEpoch=datetime.datetime.fromisoformat(d['startedAt'].replace('Z','+00:00')).timestamp()*1000
alignment=[round(c['startedEpochMs']+a['startMs']-(cadEpoch+click['atMs']),3)for a,click in zip(actions,clicks)];assert all(abs(x)<10for x in alignment)
assert all(a['endMs']<c['elapsedMs'] and a['endMs']<=scene['startMs'] for a,scene in zip(actions,scenes))
metrics=[{'edit':i+1,'actionMs':a['inclusiveMs'],'worldColdMs':w['inclusiveMs'],'compileMs':k['inclusiveMs'],'sceneMs':s['inclusiveMs'],'nonOverlappingRootSumMs':round(a['inclusiveMs']+s['inclusiveMs'],3),'clickToActionStartMs':alignment[i]}for i,(a,w,k,s)in enumerate(zip(actions,cold,compile,scenes))]
firstEditEpoch=c['startedEpochMs']+actions[0]['startMs']
liveBefore=all(x['observedAtMs']<firstEditEpoch for x in live['latest']);assert liveBefore
report={'status':'PASS_EDIT_UNDO_REDO_RAW_RESTORATION_WITH_HISTORY_CAP','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 /private/tmp/sansu-final-ui-check.py','checkerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceSHA256':{n:hashlib.sha256((p/n).read_bytes()).hexdigest()for n in names},'build':app,'candidate':base['candidate'],'fixture':base['fixture'],'operationSequence':[{'edit':entries[0]},{'edit':entries[1]},'undo','redo','undo','undo'],'transitionChecks':checks,'unchangedCoreFields':coreChecks,'restoration':{'rawHeightsExactlyRestored':True,'derivedPlacesExactlyRestored':True,'redoTerrainExactlyMatchesSecondEdit':True,'fullTerrainEqualsInitial':False,'initialUndoCount':len(base['terrain']['undo']),'finalUndoCount':len(states['restored']['terrain']['undo']),'finalRedoCount':len(states['restored']['terrain']['redo']),'reason':'64-entry history cap discards the two oldest initial entries when two edits are appended. Undo restores heights and moves these two new edits to redo; it cannot recreate discarded old history. Final undo is exactly initial undo[2:], final redo is [secondEdit,firstEdit].'},'renderedDOM':{'scope':'These five captures contain heights and selection only. No camera or full world DOM comparison is possible.','selectionUnchanged':True,'candidateUnchangedInState':True,'heightJSONMatchesStateAndExpectedTransitions':True},'timing':{'visibleTenSecondWindow':True,'twoSuccessfulColdBuildsAndCompiles':True,'incompleteSpans':0,'dropped':0,'edits':metrics,'longTasks':d['timeline']['longTasks'],'slowFrames':d['timeline']['slowFrames'],'maxFrameMs':d['intervalMs']['max']},'liveReceiptScope':{'count':live['count'],'allReceiptsBeforeFirstEdit':liveBefore,'receiptTimes':[x['observedAt']for x in live['latest']],'firstEditEpochMs':firstEditEpoch,'postEditUseProvedBy81':False,'note':'81 live capture contains earlier rendered receipts, not post-edit use. Await separate82 evidence.'},'placeProgressEqualToInitial':{s:v['placeProgress']==base['placeProgress']for s,v in states.items()},'limitations':['State and DOM snapshots corroborate the stated UI sequence; this is not an independent recording of every pointer action.','Step1 has world DOM only, no full state; final two Undos have a combined final state, no separate penultimate state.','Undo/Redo latency was not included in the two-edit CPU window.','400ms-scale long tasks persist; successful editing is not smooth interactive performance.','This is a shore-memory-only fixture. No DB persistence, reload, offline or release safety claim.','81 live receipts predate editing. Post-restoration resident use is not established by81.','World captures contain only heights/selection, not camera matrices or complete flags. State/DOM consistency is not a GPU mesh or visual-art quality comparison.']}
(p/'final-ui-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'metrics':metrics,'history':report['restoration'],'livePreEdit':liveBefore},ensure_ascii=False))
