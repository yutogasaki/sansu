#!/usr/bin/env python3
"""Sansu library inspection, derived from hub audit.py SHA256 04333f8cf4dee4cb91188527be446075164340726eab397de2b58e403844f743. Honors source-context bases and includes every resource; never executes source pages."""
import argparse
from collections import Counter
from datetime import datetime,timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote,urlsplit

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def compact(s):return re.sub(r'\s+',' ',s).strip()

class Inspect(HTMLParser):
    def __init__(self,text):
        super().__init__(convert_charrefs=True);self.ids=set();self.links=[];self.items={};self.stack=[];self.scripts=[];self.styles=[];self.base=None
        self.feed(text);self.close()
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='base':self.base=attrs.get('href')
        if attrs.get('id'):self.ids.add(attrs['id'])
        if tag not in {'a','link','script','img','source','audio','video','iframe','object','form','image','use'}:pass
        else:
            for key in ['href','src','poster','action','data','xlink:href']:
                if attrs.get(key):self.links.append((tag,key,attrs[key]))
        key=attrs.get('data-portal-item')
        if key:self.items[key]={'tag':tag,'attributes':attrs,'text':''}
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append((tag,key,[]))
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if self.stack and self.stack[-1][0]==tag:self.stack.pop()
    def handle_data(self,data):
        if any(tag=='aside' and key is None for tag,key,_ in self.stack):return
        for _,_,parts in self.stack:parts.append(data)
        for _,key,_ in reversed(self.stack):
            if key:self.items[key]['text']+=data;break
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:
                for name,_,parts in self.stack[i:]:
                    if name=='script':self.scripts.append(hashlib.sha256(''.join(parts).encode()).hexdigest())
                    if name=='style':self.styles.append(hashlib.sha256(''.join(parts).encode()).hexdigest())
                self.stack=self.stack[:i];break

def audit(repo,relative='portal'):
    repo=Path(repo).resolve();portal=repo/relative;evidence=Path('/Users/yutogasaki/Projects/sansu/qa/evidence/PI-001-SANSU/recheck-20261016T081724Z/library-audit');evidence.mkdir(parents=True,exist_ok=True)
    data=json.loads((portal/'data/unification.json').read_text());cache={}
    def inspect(path):
        path=path.resolve()
        if path not in cache:cache[path]=Inspect(path.read_text())
        return cache[path]
    failures=[];link_failures=[];classifications=Counter();checked=0
    for item in data['items']:
        target=portal/item['target'];view=inspect(target);actual=view.items.get(item['key'])
        if not actual:failures.append({'key':item['key'],'cause':'missing-item','target':item['target']});continue
        if item['kind']!='document':
            if actual['tag']!=item['tag'] or compact(actual['text'])!=item['text']:failures.append({'key':item['key'],'cause':'tag-or-text'})
            for key,value in item['attributes'].items():
                if key in {'href','src','poster','action','data-src','srcset'}:continue
                if actual['attributes'].get(key)!=value:failures.append({'key':item['key'],'cause':'attribute','attribute':key})
        else:
            import html
            detail=re.search(r'<details><summary>原文・出典・元データ</summary><pre>([\s\S]*?)</pre></details>',target.read_text())
            if not detail or json.loads(html.unescape(detail[1])).get('raw')!=item['text']:failures.append({'key':item['key'],'cause':'document-raw'})
        checked+=1;classifications[item['kind']]+=1
    for page in data['pages']:
        if 'sha256' not in page:continue
        if sha(repo/page['source'])!=page['sha256']:failures.append({'source':page['source'],'cause':'source-changed'})
        parsed=inspect(portal/page['target'])
        if [value for value in parsed.scripts if value!=hashlib.sha256(b'').hexdigest()]!=[value for value in page['scripts'] if value!=hashlib.sha256(b'').hexdigest()]:failures.append({'source':page['source'],'cause':'script-changed'})
        if parsed.styles[:len(page['styles'])]!=page['styles']:failures.append({'source':page['source'],'cause':'style-changed'})
        missing=set(page['anchors'])-parsed.ids
        if missing:failures.append({'source':page['source'],'cause':'anchor-missing','anchors':sorted(missing)})
    for resource in data['resources']:
        if resource.get('state')=='directory' and (repo/resource['source']).is_dir():continue
        if resource.get('state')!='local-reference' or not (repo/resource['source']).is_file():failures.append({'source':resource['source'],'cause':'unavailable-resource'})
        elif sha(repo/resource['source'])!=resource['sha256'] or (repo/resource['source']).stat().st_size!=resource['bytes']:failures.append({'source':resource['source'],'cause':'resource-changed'})
    links=0
    for file in portal.rglob('*.html'):
        parsed=inspect(file)
        for tag,attribute,url in parsed.links:
            split=urlsplit(url)
            if split.scheme or split.netloc or url.startswith('/'):continue
            base=(file.parent/unquote(urlsplit(parsed.base).path)).resolve() if parsed.base else file.resolve()
            target=(base.parent/unquote(split.path)).resolve() if split.path else base
            links+=1
            if not target.exists():link_failures.append({'source':file.relative_to(portal).as_posix(),'url':url,'cause':'missing'})
            elif split.fragment and target.suffix.lower() in {'.html','.htm'} and unquote(split.fragment) not in inspect(target).ids and split.fragment.lower()!='top':link_failures.append({'source':file.relative_to(portal).as_posix(),'url':url,'cause':'anchor'})
    output={'repo':repo.name,'targetCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
            'at':datetime.now(timezone.utc).isoformat(),'inputHash':sha(portal/'data/unification.json'),
            'candidateHash':sha(portal/'data/unification-manifest.json'),
            'pages':len(data['pages']),'documents':len(data['documents']),'items':len(data['items']),'itemsChecked':checked,
            'classifications':dict(classifications),'resources':len(data['resources']),'exclusions':data['exclusions'],
            'itemIssues':len(failures),'itemIssueDetails':failures,'linksChecked':links,'linkIssues':len(link_failures),'linkIssueDetails':link_failures,
            'routes':[{'old':p['source'],'new':relative+'/'+p['target'],'anchors':p.get('anchors',[]),'policy':'受入前は元URLを維持。保持期限未決のURLは削除しない。'} for p in data['pages']],
            'controlInventory':[{'source':r['source'],'key':r['key'],'tag':r['tag'],'attributes':r.get('attributes',{}),'title':r.get('title','')} for r in data['items'] if r['kind']=='control'],
            'acceptance':'unverified','browser':'not-run','independentReview':'not-run'}
    (evidence/'audit.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    with (evidence/'parity.md').open('w') as report:
        report.write('# 全項目の対応表\n\n同じ入力hash: `'+output['inputHash']+'`。機械照合と受入を区別する。\n\n| 元の場所・項目 | 統合先 | 保持する情報・操作・表現 | 検証方法・証拠 | 判定・除外理由 |\n| --- | --- | --- | --- | --- |\n')
        bad={row.get('key') for row in failures}
        for item in data['items']:
            old=item['source']+('#'+item['anchor'] if item.get('anchor') else ' / '+item['key'])
            new=relative+'/'+item['target']+'?item='+item['key']
            report.write('| '+old.replace('|','&#124;')+' | '+new+' | '+item['kindLabel']+'・本文・属性・出典（原文/識別子は同じ全件JSON） | audit.json / '+item['key']+'：本文・属性・script/CSS・アンカー | '+('機械照合NG' if item['key'] in bad else '機械照合済み')+'。表示・操作・独立審査は未受入 |\n')
        for resource in data['resources']:
            report.write('| '+resource['source'].replace('|','&#124;')+' | '+str(resource.get('target','')).replace('|','&#124;')+' | 元ファイル・容量・SHA・アクセス条件 | audit.json / data/unification.json / sourceFiles | 機械照合。表示/利用/配布条件は別判定 |\n')
        for row in data['exclusions']:report.write('| '+row['source'].replace('|','&#124;')+' | 原領域を維持 | 内容を転記しない | data/unification.json の除外一覧 | '+row['reason']+' |\n')
    return {key:output[key] for key in ['repo','pages','documents','items','resources','itemIssues','linksChecked','linkIssues','acceptance']}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('repo');parser.add_argument('--portal',default='portal');args=parser.parse_args()
    result=audit(args.repo,args.portal);print(json.dumps(result,ensure_ascii=False));raise SystemExit(bool(result['itemIssues'] or result['linkIssues']))
