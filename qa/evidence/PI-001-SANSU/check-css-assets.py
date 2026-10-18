from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,re,hashlib,posixpath,shutil
root=Path(__file__).resolve().parents[3];out=root/'qa/evidence/PI-001-SANSU';data=json.loads((root/'portal/data/unification.json').read_text());known={row['source'] for kind in ['pages','documents','resources'] for row in data[kind]};initial=json.loads((out/'start-file-hashes.json').read_text());found={};external=[]
for row in [*data['pages'],*[row for row in data['resources'] if row['source'].endswith('.css')]]:
 source=row['source'];file=root/source
 if not file.is_file():continue
 text=file.read_text();styles=re.findall(r'<style\b[^>]*>([\s\S]*?)</style>',text,re.I) if source.endswith('.html') else [text]
 for css in styles:
  for value in re.findall(r'url\(\s*[\"\x27]?([^\"\x27)]+)',css):
   value=value.strip();url=urlsplit(value)
   if value.startswith(('#','data:')):continue
   if url.scheme or url.netloc:external.append({'source':source,'host':url.hostname,'policy':'既存の外部参照。取得/配布/実表示は未確認。原文を元CSSに保持。'});continue
   target=posixpath.normpath(posixpath.join(posixpath.dirname(source),unquote(url.path)))
   if target.startswith('../'):continue
   p=root/target
   if not p.is_file():found.setdefault(target,{'source':target,'state':'missing','referencedBy':[]})['referencedBy'].append(source);continue
   digest=hashlib.sha256(p.read_bytes()).hexdigest();entry=found.setdefault(target,{'source':target,'state':'PASS','bytes':p.stat().st_size,'sha256':digest,'alreadyInRegistry':target in known,'unchangedFromStart':initial.get(target)==digest,'referencedBy':[]});entry['referencedBy'].append(source)
report={'candidate':json.loads((root/'portal/data/integration.json').read_text())['currentCandidate'],'source':'原HTMLのinline CSSと明示したCSSのurl()から生成。font等の間接依存の補足。','resources':list(found.values()),'external':external};(out/'css-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
recovery=json.loads((out/'recovery-stable.json').read_text());cache=Path(recovery['root'])
for row in found.values():
 if row['state']!='PASS':continue
 p=cache/row['source'];p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():shutil.copy2(root/row['source'],p)
 if hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:raise RuntimeError('CSS dependency recovery mismatch')
(cache/'css-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'resources':len(found),'supplemental':len([r for r in found.values() if not r.get('alreadyInRegistry')]),'missing':len([r for r in found.values() if r['state']=='missing']),'external':len(external)}))
