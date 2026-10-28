import json,hashlib,datetime
from pathlib import Path
p=Path(__file__).resolve().parent.parent
names=['53-H-footing-repaired-state.json','76-H-ordinary-restored-state.json','83-H-final-ordinary-state.json','83-H-final-ordinary-app.json','83-H-final-ordinary-world.json']
def read(n):return json.loads((p/n).read_text())
def diff(a,b,path=''):
 if isinstance(a,dict)and isinstance(b,dict):return[v for k in sorted(set(a)|set(b))for v in ([path+'.'+k]if k not in a or k not in b else diff(a[k],b[k],(path+'.'if path else '')+k))]
 if isinstance(a,list)and isinstance(b,list):return[v for i in range(max(len(a),len(b)))for v in ([path+f'[{i}]']if i>=len(a)or i>=len(b)else diff(a[i],b[i],path+f'[{i}]'))]
 return[path]if a!=b else[]
a,b,c=[read(n)for n in names[:3]]
core=['land','terrain','plots','landmarks','keepsakes','villagers','character','drops','town','places']
comparisons=[]
for name,old in [(names[0],a),(names[1],b)]:
 equal={k:old.get(k)==c.get(k)for k in core};assert all(equal.values())
 progress={k:old['placeProgress'].get(k)==c['placeProgress'].get(k)for k in set(old['placeProgress'])|set(c['placeProgress'])}
 comparisons.append({'reference':name,'equalCoreFields':equal,'progressEqualFields':progress,'progressDifferencePaths':diff(old['placeProgress'],c['placeProgress'],'placeProgress'),'historyCounts':[len(old['placeProgress']['useHistory']),len(c['placeProgress']['useHistory'])]})
assert c['fixture']=='ordinary-saved-island' and c['drops']==8
world=read(names[4]);app=read(names[3])
report={'status':'PASS_ORDINARY_SAVED_CORE_RESTORED_WITH_PROGRESS_DIFFERENCES','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 docs/design/2026-10-23-place-method-comparison/evidence/checkers/ordinary-final-restoration-check.py','checkerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceSHA256':{n:hashlib.sha256((p/n).read_bytes()).hexdigest()for n in names},'comparisons':comparisons,'finalFixture':c['fixture'],'drops':c['drops'],'land':c['land'],'build':app,'worldDOM':world,'candidate':c['candidate'],'scope':'Observed ordinary UI link return to saved island. Core saved fields and complete terrain Undo/Redo match53/76. Candidate rendering differs; placeProgress differences reported without inventing event timing.','limitations':['No direct database read or write. Captured fields, not all internal record fields, are compared.','No offline, multi-device conflict, arbitrary-save compatibility or deployment claim.','Restored ordinary geometry input is unchanged; this is not byte-identical renderer output across different candidate revisions.','The memory-only 96-cell diagnostic fixture and its diagnostic currency did not replace captured ordinary land/terrain/owners/drops8.']}
(p/'ordinary-final-restoration-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'comparisons':comparisons},ensure_ascii=False))
