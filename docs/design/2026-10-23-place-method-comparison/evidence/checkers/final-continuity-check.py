import json,hashlib,datetime
from pathlib import Path
p=Path(__file__).resolve().parent.parent
names=['85-H-final-new-session-state.json','85-H-final-new-session-live.json','85-H-final-new-session-world.json','85-H-final-new-session-app.json','86-H-continuity-edit-world.json','86-H-continuity-restored-world.json','86-H-continuity-final-world.json','86-H-continuity-final-state.json','86-H-continuity-final-live.json','86-H-continuity-frames.json']
r=lambda n:json.loads((p/n).read_text())
a,live0,w0,app=r(names[0]),r(names[1]),r(names[2]),r(names[3]);edit,restored,final,b,live,frames=[r(n)for n in names[4:]]
ew,rw=edit['world'],restored['world'];entry={'cell':{'x':4,'z':4},'before':0,'after':-1}
core=['candidate','fixture','land','plots','landmarks','keepsakes','villagers','character','drops','town','places']
equal={k:a.get(k)==b.get(k)for k in core};assert all(equal.values())
assert a['terrain']['heights']==b['terrain']['heights']
assert b['terrain']['undo']==a['terrain']['undo'][1:] and b['terrain']['redo']==[entry]
assert len(a['terrain']['undo'])==64 and len(b['terrain']['undo'])==63
assert live==live0 and live['count']==live['retained']==4
assert json.loads(ew['data-terrain-heights'])=={**a['terrain']['heights'],'4,4':-1}
assert all(json.loads(w['data-terrain-heights'])==a['terrain']['heights']for w in [rw,final])
assert ew['data-terrain-editing']=='true' and rw['data-terrain-editing']==final['data-terrain-editing']=='false'
for w in [rw,final]:
 assert w['data-terrain-revision']==w0['data-terrain-revision']
 assert w['data-growing-camera']==w0['data-growing-camera']
 assert w['data-method-candidate']==w0['data-method-candidate']
 assert w['data-terrain-selection']=='4,4'
assert rw==final
worldDiff=[k for k in set(w0)|set(final)if w0.get(k)!=final.get(k)];assert worldDiff==['data-terrain-selection']
frameFiles=[f['file']for f in frames['frames']];assert all((p/f).exists()for f in frameFiles)
times=[datetime.datetime.fromisoformat(f['at'].replace('Z','+00:00'))for f in frames['frames']];assert times==sorted(times)
assert times[0]>=datetime.datetime.fromisoformat(restored['at'].replace('Z','+00:00'))
report={'status':'PASS_SAME_SESSION_EDIT_UNDO_STATE_AND_DOM_CONTINUITY','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':{n:hashlib.sha256((p/n).read_bytes()).hexdigest()for n in names+frameFiles},'checkerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'referenceBuild85':app,'sameSessionId':live['sessionId'],'equalCoreFields':equal,'rawHeightsExactlyRestored':True,'derivedPlacesExactlyRestored':True,'history':{'initialUndo':64,'finalUndo':63,'finalRedo':1,'exactTransition':'Append 0→-1 with cap64, then Undo: finalUndo=initialUndo[1:], finalRedo=[0→-1].','redoEntry':entry,'fullTerrainEqualsInitial':False},'worldChecks':{'editHeight':-1,'restoredHeight':0,'editingAtEdit':True,'editingAtRestoreAndFinal':False,'restoredAndFinalDOMExactlyEqual':True,'restoredRevisionEquals85':True,'cameraAndCandidateEqual85':True,'onlyFinalWorldDifferenceFrom85':worldDiff},'liveChecks':{'exactCaptureEquality85To86':True,'count':4,'newFreshUsesAfterEdit':0,'postEditFreshUseClaim':False},'frames':{'metadata':frames,'totalSpanSeconds':(times[-1]-times[0]).total_seconds(),'timestampsAfterRestore':True,'filesHashed':True,'visualPositionReview':'Handled independently by the parent/visual reviewer; this checker verifies metadata and file hashes, not actor pixels.'},'placeProgressExactlyEqual85':a['placeProgress']==b['placeProgress'],'scope':'Ordinary UI edit/Undo reported in same85 session, corroborated by state/DOM/history/live captures. No runtime changes or DB injection.','limitations':['Position changes in three screenshots can show continued motion; they do not prove a new fresh place-use receipt, continuous route safety, or every intermediate frame.','No separate full state at the -1 edit; world DOM records edited heights and editing flag. Final full state verifies exact expected undo stack.','Reference build is85 app capture plus identical page session, not a separate86 app capture.','Undo cap intentionally discards one old history entry. Raw geometry restoration is not full history restoration.','Memory-only diagnostic fixture, not persistence or release verification.']}
(p/'final-continuity-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'coreEqual':equal,'history':report['history'],'liveSame':live==live0,'worldDiff':worldDiff,'frameSpan':report['frames']['totalSpanSeconds']},ensure_ascii=False))
