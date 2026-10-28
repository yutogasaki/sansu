import json,hashlib,datetime
from pathlib import Path
p=Path(__file__).resolve().parent.parent
names=['81-H-final-restored-state.json','81-H-final-step2-live.json','82-H-final-restored-state.json','82-H-final-restored-live.json','82-H-final-restored-world.json','85-H-final-new-session-state.json','85-H-final-new-session-live.json','85-H-final-new-session-app.json','85-H-final-new-session-world.json','81-H-final-app-dom.json']
r=lambda n:json.loads((p/n).read_text())
a,b=r(names[0]),r(names[2]);priorLive,restoredLive=r(names[1]),r(names[3]);oldWorld=r(names[4]);fresh,freshLive,app,world=r(names[5]),r(names[6]),r(names[7]),r(names[8]);oldApp=r(names[9])
new=[u for u in b['placeProgress']['useHistory']if u not in a['placeProgress']['useHistory']]
assert len(new)==2 and len(a['placeProgress']['useHistory'])==33 and len(b['placeProgress']['useHistory'])==35
facts=[{k:u[k]for k in ['actorId','targetId','at','revision']}for u in new]
for u in facts:u['atUTC']=datetime.datetime.fromtimestamp(u['at']/1000,datetime.timezone.utc).isoformat()
assert priorLive==restoredLive and restoredLive['count']==2
core=['land','plots','landmarks','keepsakes','villagers','character','drops','town','places']
assert all(a.get(k)==b.get(k)for k in core) and a['terrain']==b['terrain']
assert all(fresh.get(k)==b.get(k)for k in core) and fresh['terrain']['heights']==b['terrain']['heights']
assert {k:v for k,v in app.items()if k.startswith('data-')}=={k:v for k,v in oldApp.items()if k.startswith('data-')}
worldDiff=[k for k in set(oldWorld)|set(world)if oldWorld.get(k)!=world.get(k)]
assert worldDiff==['data-terrain-selection'],worldDiff
assert freshLive['sessionId']!=restoredLive['sessionId'] and freshLive['count']==freshLive['retained']==4
expected={('pokomoko','starter-bench'),('pokomoko','starter-flower:garden'),('v2','starter-bench'),('v2','starter-flower:garden')}
assert {(e['receipt']['actorId'],e['receipt']['targetId'])for e in freshLive['latest']}==expected
verified=[]
for e in freshLive['latest']:
 assert e['delivery']=='fresh-life-receipt' and e['documentVisibility']=='visible'
 assert all(e[k]for k in ['currentPlaceRevisionMatches','active','playActive','inFrustum','renderSucceeded','handlerAccepted'])
 assert e['worldRevision']==world['data-terrain-revision'] and e['candidate']==fresh['candidate']==freshLive['candidate']==world['data-method-candidate']
 place=next(x for x in fresh['places']if x['id']==e['receipt']['placeId'])
 assert place['revision']==e['receipt']['revision'] and any(t['id']==e['receipt']['targetId']for t in place['useTargets'])
 assert e['observedAtMs']>freshLive['pageStartedAtMs']
 verified.append({'actorId':e['receipt']['actorId'],'targetId':e['receipt']['targetId'],'observedAt':e['observedAt'],'afterPageStartMs':round(e['observedAtMs']-freshLive['pageStartedAtMs'],1),'delivery':e['delivery'],'allVisibleAcceptanceFlagsTrue':True,'worldAndPlaceRevisionMatch':True})
report={'status':'PASS_FRESH_SESSION_VISIBLE_USES_POST_UNDO_VISIBLE_USES_UNCONFIRMED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':{n:hashlib.sha256((p/n).read_bytes()).hexdigest()for n in names},'checkerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'postUndo':{'restoredCoreAndTerrainUnchanged':True,'historyCountBefore':33,'historyCountAfter':35,'newDomainAcceptedFacts':facts,'newFreshVisibleEvents':0,'sameLiveCaptureExactly':True,'cause':'Unknown. Existing UI rejection/retry and observer exclusion of retries can produce this mismatch; no retry trace was captured.'},'newSession85':{'sessionChanged':True,'build':app,'sameCoreAndRawTerrainAs82':True,'fullTerrainHistoryEqualTo82':fresh['terrain']==b['terrain'],'newSessionUndoCount':len(fresh['terrain']['undo']),'newSessionRedoCount':len(fresh['terrain']['redo']),'worldDOMDifferencesFrom82':worldDiff,'geometryRevisionAndCameraUnchanged':True,'verifiedFreshVisibleUses':verified,'inputMethod':'Operator reports fresh ordinary navigation to memory-only shore; no terrain edit or actor destination command. Capture-time hint close/panel open was later than all four events.'},'limitations':['Two new history facts corroborate domain acceptance, not an observed fresh visible action at that exact time.','85 proves the final candidate can produce four visible actor/target uses on fresh startup, not post-Undo continuity in81/82.','A fresh memory-only scene reload resets history from fixture; it is not persistence proof.','No runtime code or original captures changed.']}
(p/'post-edit-life-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'newDomainFacts':[(u['actorId'],u['targetId'],u['atUTC'])for u in facts],'fresh85':verified,'worldDiff':worldDiff},ensure_ascii=False))
