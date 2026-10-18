#!/usr/bin/env python3
"""Add native project views and a full record search to an existing portal.

Uses Python's standard library only. All state stays in the repository's original
ledgers. Source pages, scripts, media, and verification engines are never written.
"""
import base64
import gzip
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import posixpath
import re
import sys
from urllib.parse import unquote, urlsplit, urlunsplit

HERE = Path(__file__).resolve().parent
TAGS = {'h1','h2','h3','h4','h5','h6','p','li','dt','dd','tr','td','th','a',
        'button','input','select','textarea','summary','img','audio','video',
        'source','svg','path','line','polygon','circle','rect','text','pre',
        'code','table','details','figure','figcaption','iframe','canvas'}
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
HUMAN = {'page':'ページ','text':'本文','heading':'見出し','link':'リンク','control':'操作',
         'image':'画像','audio':'音声','video':'動画','diagram':'図','table':'表',
         'disclosure':'開閉','code':'原文','document':'資料'}
DENY = re.compile(r'(^|/)(?:\.git|node_modules|\.mmmind/private|portal-evidence|task-graph/trial|\.codex|\.claude|private|personal|accounting|finance|payroll|banking|invoices?|customers?|students?|contacts?|roster|会計|経理|請求|名簿|個人情報)(/|$)|(^|/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx|sqlite3?|db|csv|xlsx?)$',re.I)
CONTACT = re.compile(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?<!\d)0\d{1,3}[-ー]\d{1,4}[-ー]\d{3,4}(?!\d)')

def digest(value):
    return hashlib.sha256(value if isinstance(value,bytes) else value.encode()).hexdigest()

def encode(value):
    return json.dumps(value,ensure_ascii=False,indent=2)+'\n'

def esc(value):
    return html.escape(str(value),quote=True)

def label(text):
    return re.sub(r'\s+',' ',text).strip()

def kind(tag):
    if tag.startswith('h') and len(tag)==2 and tag[1].isdigit(): return 'heading'
    if tag in {'input','select','button','textarea'}: return 'control'
    if tag=='a': return 'link'
    if tag=='img': return 'image'
    if tag in {'audio','source'}: return 'audio'
    if tag=='video': return 'video'
    if tag in {'svg','path','line','polygon','circle','rect','text','canvas'}: return 'diagram'
    if tag in {'tr','td','th','table'}: return 'table'
    if tag in {'details','summary'}: return 'disclosure'
    if tag in {'pre','code'}: return 'code'
    return 'text'

class Native(HTMLParser):
    """Preserve direct text, structure, CSS and JS; change only dependency URLs and keys."""
    def __init__(self,source,target,category,rewrite):
        super().__init__(convert_charrefs=False)
        self.source,self.target,self.category,self.rewrite=source,target,category,rewrite
        self.output=[];self.records=[];self.stack=[];self.seq=0;self.raw=[];self.title=[]
        self.anchors=[];self.dependencies=[];self.script_hashes=[];self.style_hashes=[]

    def handle_starttag(self,tag,attrs):
        raw=self.get_starttag_text(); values=dict(attrs);self.seq+=1
        key='item-'+digest(self.source+'\0'+str(self.seq))[:20]
        record=None
        if tag not in {'html','head','meta','link','style','script','title','br','hr'}:
            record={'key':key,'source':self.source,'position':self.seq,'tag':tag,
                    'kind':kind(tag),'kindLabel':HUMAN[kind(tag)],'category':self.category,
                    'attributes':values,'text':'','target':self.target,
                    'originalUrl':self.source+('#'+values['id'] if values.get('id') else ''),
                    'anchor':values.get('id'),'checks':{'structure':'generated','browser':'unverified','independentReview':'unverified'},
                    'verdict':'未受入（表示・操作・独立審査を別途照合）'}
            self.records.append(record)
            raw=raw[:-2]+f' data-portal-item="{key}"/>' if raw.endswith('/>') else raw[:-1]+f' data-portal-item="{key}">'
        if values.get('id'): self.anchors.append(values['id'])
        # Replace only values in the original start tag, preserving handlers and all unknown attributes.
        def replace(match):
            attr,quote,value=match.groups();decoded=html.unescape(value)
            result=self.rewrite(self.source,self.target,decoded,attr.lower(),tag)
            if result!=decoded:return attr+'='+quote+esc(result)+quote
            return match.group(0)
        raw=re.sub(r'\b(href|src|poster|action|data-src)\s*=\s*([\"\'])(.*?)\2',replace,raw,flags=re.I|re.S)
        if values.get('srcset'):
            rewritten=', '.join(self.rewrite(self.source,self.target,piece.strip().split()[0],'src','img')+(' '+' '.join(piece.strip().split()[1:]) if len(piece.strip().split())>1 else '') for piece in values['srcset'].split(','))
            raw=re.sub(r'\bsrcset\s*=\s*([\"\'])(.*?)\1',lambda m:'srcset='+m[1]+esc(rewritten)+m[1],raw,flags=re.I|re.S)
        self.output.append(raw)
        if tag not in VOID:self.stack.append({'tag':tag,'record':record,'raw':[]})

    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID and self.stack and self.stack[-1]['tag']==tag:self.stack.pop()

    def handle_endtag(self,tag):
        self.output.append('</'+tag+'>')
        for index in range(len(self.stack)-1,-1,-1):
            if self.stack[index]['tag']==tag:
                frames=self.stack[index:];self.stack=self.stack[:index]
                for frame in frames:
                    if frame['tag']=='script':self.script_hashes.append(digest(''.join(frame['raw'])))
                    if frame['tag']=='style':self.style_hashes.append(digest(''.join(frame['raw'])))
                break

    def handle_data(self,data):
        self.output.append(data)
        for frame in self.stack:
            if frame['tag'] in {'script','style'}:frame['raw'].append(data)
        for frame in reversed(self.stack):
            if frame['record']:
                frame['record']['text']+=data
                break
            if frame['tag']=='title':self.title.append(data)

    def handle_entityref(self,name):
        self.output.append('&'+name+';')
        for frame in reversed(self.stack):
            if frame['record']:
                frame['record']['text']+=html.unescape('&'+name+';')
                break

    def handle_charref(self,name):
        self.output.append('&#'+name+';')
        for frame in reversed(self.stack):
            if frame['record']:
                frame['record']['text']+=html.unescape('&#'+name+';')
                break

    def handle_comment(self,data):self.output.append('<!--'+data+'-->')
    def handle_decl(self,data):self.output.append('<!'+data+'>')
    def handle_pi(self,data):self.output.append('<?'+data+'>')

def document_html(text,rewrite,source,target):
    """A readable, full-text projection; original bytes remain available in the same record."""
    if source.endswith('.json'):
        try:return '<pre>'+esc(encode(json.loads(text)))+'</pre>'
        except ValueError:return '<pre>'+esc(text)+'</pre>'
    def inline(s):
        code=[]
        def hold(match):
            code.append('<code>'+esc(match[1])+'</code>')
            return '\x01'+str(len(code)-1)+'\x02'
        s=re.sub(r'`([^`]+)`',hold,s)
        result=esc(s)
        result=re.sub(r'!\[([^\]]*)\]\(([^)\s]+)\)',lambda m:'<img alt="'+m[1]+'" src="'+esc(rewrite(source,target,html.unescape(m[2]),'src','img'))+'">',result)
        result=re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)',lambda m:'<a href="'+esc(rewrite(source,target,html.unescape(m[2]),'href','a'))+'">'+m[1]+'</a>',result)
        result=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',result)
        result=re.sub('\x01(\\d+)\x02',lambda m:code[int(m[1])],result)
        return result
    out=[];code=[];in_code=False;table=False;listing=False;slugs={}
    for line in text.splitlines():
        anchor_tag=re.fullmatch(r'\s*<a\s+id=["\']([^"\']+)["\']\s*></a>\s*',line)
        if anchor_tag:out.append('<span id="'+esc(anchor_tag[1])+'"></span>');continue
        if line.startswith('```'):
            if in_code:out.append('<pre><code>'+esc('\n'.join(code))+'</code></pre>');code=[]
            in_code=not in_code;continue
        if in_code:code.append(line);continue
        isrow=line.strip().startswith('|') and line.strip().endswith('|')
        if table and not isrow:out.append('</tbody></table>');table=False
        if listing and not re.match(r'\s*(?:[-*]|\d+[.])\s+',line):out.append('</ul>');listing=False
        if isrow:
            cells=line.strip().strip('|').split('|')
            if all(re.fullmatch(r'\s*:?-+:?\s*',cell) for cell in cells):continue
            if not table:out.append('<table><tbody>');table=True
            out.append('<tr>'+''.join('<td>'+inline(c.strip())+'</td>' for c in cells)+'</tr>');continue
        heading=re.match(r'^(#{1,6})\s+(.+)',line)
        if heading:
            slug=re.sub(r'[^\w\- ]','',heading[2].lower()).replace(' ','-')
            duplicate=slugs.get(slug,0);slugs[slug]=duplicate+1
            anchor=slug+('-'+str(duplicate) if duplicate else '')
            out.append('<h'+str(len(heading[1]))+' id="'+esc(anchor)+'">'+inline(heading[2])+'</h'+str(len(heading[1]))+'>');continue
        item=re.match(r'\s*(?:[-*]|\d+[.])\s+(.+)',line)
        if item:
            if not listing:out.append('<ul>');listing=True
            out.append('<li>'+inline(item[1])+'</li>');continue
        if line.strip():out.append('<p>'+inline(line)+'</p>')
    if code:out.append('<pre><code>'+esc('\n'.join(code))+'</code></pre>')
    if table:out.append('</tbody></table>')
    if listing:out.append('</ul>')
    return ''.join(out)

def generate(root,config,home):
    root=Path(root).resolve();files={};pages={};pending=[];documents={};resources={};exclusions={};items=[]
    repo_prefix=posixpath.relpath('.',config.get('outputRoot','portal'))
    def safe(source):
        p=root/source
        if Path(source).is_absolute() or '..' in Path(source).parts or '\\' in source:return 'リポジトリ外または非標準の参照。自動収集しない。'
        if DENY.search(source):return '機密・個人設定・非公開証拠または過去試行の作業領域。原領域に保持。'
        if not p.is_relative_to(root):return 'リポジトリ外の参照。自動収集しない。'
        for parent in [p,*p.parents]:
            if parent==root:break
            if parent.is_symlink():return 'symlinkの参照先は自動収集しない。'
        return None
    def native_name(source):
        return 'integrated/'+source.removeprefix('.').replace('/.','/')
    for group in config['pages']:
        for pattern in group['patterns']:
            for p in sorted(root.glob(pattern)):
                if not p.is_file():continue
                source=p.relative_to(root).as_posix()
                reason=safe(source)
                if reason:exclusions[source]=reason;continue
                if source not in pages:
                    pages[source]={'source':source,'target':native_name(source),'category':group['category']}
                    pending.append(source)
    def relative(target,source):
        # Both paths belong to the output namespace, regardless of the caller's cwd
        # (AYAMI's npm commands deliberately run from web/).
        folder=root/config.get('outputRoot','portal')
        return posixpath.relpath(str(folder/source),str(folder/(posixpath.dirname(target) or '.')))
    def rewrite(source,target,url,attribute,tag):
        if not url or url.startswith(('#','data:','mailto:','tel:','javascript:')):return url
        parsed=urlsplit(url)
        if parsed.scheme or parsed.netloc:return url
        if parsed.path.startswith('/Users/'):
            try:ref=Path(unquote(parsed.path)).relative_to(root).as_posix()
            except ValueError:
                exclusions['external-repository-reference']='他repoの資料。個人情報・許可範囲を確認せず転記しない。';return url
        elif parsed.path.startswith('/'):
            # Root paths in marketing pages are public app routes, not repository file paths.
            return config.get('publicUrl','').rstrip('/')+url if config.get('publicUrl') else url
        else:ref=posixpath.normpath(posixpath.join(posixpath.dirname(source),unquote(parsed.path)))
        reason=safe(ref)
        if reason:
            exclusions[ref]=reason
            return relative(target,'unification-exclusions.html')
        line_reference=re.search(r':(\d+)$',ref)
        if line_reference and (root/ref[:line_reference.start()]).is_file():
            ref=ref[:line_reference.start()]
            parsed=parsed._replace(fragment='L'+line_reference[1])
        p=root/ref
        # One legacy archive contains a duplicated path component. Repair only an existing exact target.
        if not p.exists():
            collapsed=re.sub(r'(^|/)([^/]+)/\2/',r'\1\2/',ref)
            if collapsed!=ref and (root/collapsed).is_file():ref=collapsed;p=root/ref
        if not p.exists() or not p.is_file():
            resources.setdefault(ref,{'source':ref,'state':'missing' if not p.exists() else 'directory','target':relative(target,repo_prefix+'/'+ref),'reason':'元ページの参照先。未確認を合格にしない。'})
            return relative(target,repo_prefix+'/'+ref)+('?' + parsed.query if parsed.query else '')+('#'+parsed.fragment if parsed.fragment else '')
        suffix=p.suffix.lower()
        # Native linked views are integrated once; old source files remain untouched.
        if suffix in {'.html','.htm'} and any(ref.startswith(prefix) for prefix in config.get('followHtml',[])):
            if ref not in pages:
                pages[ref]={'source':ref,'target':native_name(ref),'category':'関連資料'};pending.append(ref)
            dest=pages[ref]['target']
        elif ref in pages:dest=pages[ref]['target']
        elif suffix in set(config.get('inlineDocumentExtensions',['.md','.txt','.json'])) and any(ref.startswith(prefix) for prefix in config.get('followDocuments',[])):
            if ref not in documents:documents[ref]={'source':ref,'target':'read/'+digest(ref)[:20]+'.html','category':'資料・判断・手順'}
            dest=documents[ref]['target']
        else:
            dest=repo_prefix+'/'+ref
            if ref not in resources:
                content=p.read_bytes();resources[ref]={'source':ref,'bytes':len(content),'sha256':digest(content),'state':'local-reference','target':dest,'access':'元repoのアクセス条件を維持。配布可否はhubで別途選別。'}
        return urlunsplit(('','',relative(target,dest),parsed.query,parsed.fragment))
    def bar(target,page_title=None):
        origin=config['original']
        return '<aside class="pu-bar" aria-label="統合ポータル"><nav><strong>'+esc(config['title'])+'</strong><a href="'+relative(target,'index.html')+'">現在地へ</a><a href="'+relative(target,'search.html')+'">全ページから探す</a><a href="'+relative(target,'pages.html')+'">内容と操作の一覧</a><a href="'+relative(target,repo_prefix+'/'+origin)+'">元のポータルを開く →</a></nav><p>新版を確認中。全項目の表示・操作・独立審査が終わるまで、元の入口を保持しています。</p></aside>'
    def insert(raw,target):
        additions='<link rel="stylesheet" href="'+relative(target,'integration.css')+'">'
        raw=re.sub(r'</head\s*>',lambda m:additions+m[0],raw,count=1,flags=re.I)
        raw=re.sub(r'(<body\b[^>]*>)',lambda m:m[0]+bar(target),raw,count=1,flags=re.I)
        return re.sub(r'</body\s*>',lambda m:'<script src="'+relative(target,'integration.js')+'" defer></script>'+m[0],raw,count=1,flags=re.I)
    done=set()
    def process_pages():
        while pending:
            source=pending.pop(0)
            if source in done:continue
            done.add(source);entry=pages[source];raw=(root/source).read_text()
            if os.environ.get('PORTAL_INTEGRATION_TRACE'):print('page '+source,file=sys.stderr,flush=True)
            # Original visual modules are preserved in full; an explicit audit records contact exclusions.
            if config.get('excludeContacts',False) and CONTACT.search(raw):
                exclusions[source]='個人連絡先を含む資料。内容を転記せず原領域に保持。';continue
            parser=Native(source,entry['target'],entry['category'],rewrite);parser.feed(raw);parser.close()
            entry.update({'title':label(''.join(parser.title)) or source,'sha256':digest(raw),'bytes':len(raw.encode()),'anchors':parser.anchors,'scripts':parser.script_hashes,'styles':parser.style_hashes,'items':len(parser.records)})
            files[entry['target']]=insert(''.join(parser.output),entry['target'])
            for record in parser.records:
                record['pageTitle']=entry['title'];record['text']=label(record['text'])
                record['title']=record['text'][:100] or record['attributes'].get('alt') or record['attributes'].get('aria-label') or HUMAN[record['kind']]
                record['sourceSha256']=entry['sha256'];record['fingerprint']=digest(encode({k:record[k] for k in ['tag','attributes','text']}));items.append(record)
    document_done=set()
    while pending or len(document_done)<len(documents):
        process_pages()
        for source,entry in list(documents.items()):
            if source in document_done:continue
            document_done.add(source);raw=(root/source).read_text()
            if os.environ.get('PORTAL_INTEGRATION_TRACE'):print('document '+source,file=sys.stderr,flush=True)
            if config.get('excludeContacts',False) and CONTACT.search(raw):
                exclusions[source]='個人連絡先を含む資料。内容を転記せず原領域に保持。'
                files[entry['target']]='<!doctype html><html lang="ja"><meta charset="utf-8"><body>'+bar(entry['target'])+'<p>個人連絡先を含むため元の非公開領域に保持しています。</p></body></html>';continue
            title=(re.search(r'^#\s+(.+)',raw,re.M) or [None,Path(source).stem])[1]
            body=document_html(raw,rewrite,source,entry['target'])
            detail={'source':source,'sha256':digest(raw),'raw':raw,'category':entry['category'],'title':title}
            key='document-'+digest(source)[:20]
            record={'key':key,'source':source,'sourceSha256':digest(raw),'title':title,'pageTitle':title,'kind':'document','kindLabel':'資料','category':entry['category'],'text':raw,'target':entry['target'],'checks':{'structure':'generated','browser':'unverified','independentReview':'unverified'},'verdict':'未受入（表示・操作・独立審査を別途照合）'}
            items.append(record);entry.update({'title':title,'sha256':digest(raw),'bytes':len(raw.encode())})
            files[entry['target']]='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+esc(title)+'</title><link rel="stylesheet" href="'+relative(entry['target'],'integration.css')+'"></head><body>'+bar(entry['target'])+'<main class="pu-document" data-portal-item="'+key+'">'+body+'<details><summary>原文・出典・元データ</summary><pre>'+esc(encode(detail))+'</pre></details></main><script src="'+relative(entry['target'],'integration.js')+'" defer></script></body></html>'
    categories=sorted(set(record['category'] for record in items));kinds=sorted(set(record['kind'] for record in items))
    # Diagram is derived from the unchanged engine's dependency declaration, not a second hand-maintained flow.
    graph=None
    engine=config.get('graphEngine')
    if engine:
        engine_text=(root/engine).read_text()
        declaration=re.search(r'(?:const|let)\s+(?:deps|DEPS)\s*=\s*\{([^}]+)\}',engine_text)
        if not declaration:raise ValueError('Engine dependency declaration not found: '+engine)
        deps={name:re.findall(r"['\"]([^'\"]+)['\"]",values) for name,values in re.findall(r'(\w+)\s*:\s*\[([^]]*)\]',declaration[1])}
        names={'scope':'入力を確認','generate':'生成','machine':'機械検証','browser':'画面と操作','review':'独立レビュー','accept':'受入','report':'報告'}
        graph={'source':engine,'sha256':digest(engine_text),'dependencies':deps,'acceptance':'未確認（過去候補の合格は流用しない）'}
        nodes=list(deps);svg='<svg viewBox="0 0 360 '+str(len(nodes)*100)+'" width="360" role="img" aria-label="検証の依存関係"><defs><marker id="pu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#625599"/></marker></defs>'
        for i,node in enumerate(nodes):
            for dependency in deps[node]:
                prior=nodes.index(dependency)
                svg+='<path d="M 290 '+str(prior*100+46)+' L '+str(312+8*prior)+' '+str(prior*100+46)+' L '+str(312+8*prior)+' '+str(i*100+46)+' L 290 '+str(i*100+46)+'" fill="none" stroke="#625599" stroke-width="2" marker-end="url(#pu-arrow)"/>'
            svg+='<rect x="12" y="'+str(i*100+12)+'" width="278" height="68" rx="5" fill="#f6f5fa" stroke="#b6b5c2"/><text x="28" y="'+str(i*100+40)+'" font-size="18" fill="#282932">'+esc(names.get(node,node))+'</text><text x="28" y="'+str(i*100+64)+'" font-size="14" fill="#595766">今回の合否は未確認</text>'
        svg+='</svg>'
        relations='<ol>'+''.join('<li>'+esc(names.get(node,node))+'：'+('・'.join(esc(names.get(dep,dep)) for dep in deps[node])+'が必要' if deps[node] else '開始条件を確認')+'</li>' for node in nodes)+'</ol>'
        limits=re.findall(r'(?:LIMITS|VERSION|causes|RETURNS|CAUSES|limits|MAX)[^\n]*',engine_text)
        files['verification-flow.html']='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>確認の順序 | '+esc(config['title'])+'</title><link rel="stylesheet" href="integration.css"></head><body>'+bar('verification-flow.html')+'<main class="pu-document"><h1>確認の順序</h1><p>各矢印は開始前に必要な検査です。受入には機械検証・画面操作・独立レビューがすべて必要です。今回の対象版の結果は未確認です。</p>'+svg+'<h2>同じ関係を一覧で読む</h2>'+relations+'<h2>停止・再試行・承認の根拠</h2><p>既存の検証エンジンと記録を保持します。この図から実行や承認の消費は行いません。</p><details><summary>正本の宣言・元データ</summary><pre>'+esc(encode({'graph':graph,'engineDeclarations':limits}))+'</pre></details><a href="'+relative('verification-flow.html',native_name(config['original']))+'">現在地・履歴と次の行動を読む</a></main></body></html>'
    # Targets on the search page are relative to portal/ and remain valid from file://.
    registry={'schemaVersion':1,'title':config['title'],'original':config['original'],'acceptance':'unverified','graph':graph,'pages':list(pages.values()),'documents':list(documents.values()),'items':items,'resources':list(resources.values()),'exclusions':[{'source':source,'reason':reason} for source,reason in sorted(exclusions.items())]}
    files['data/unification.json']=encode(registry)
    compressed=base64.b64encode(gzip.compress(json.dumps({'items':items},ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
    files['search-data.js']='window.__portalSearchGzip='+json.dumps(compressed)+';\n'
    files['integration.css']=(HERE/'integration.css').read_text();files['integration.js']=(HERE/'integration.js').read_text()
    if config.get('homeSource'):
        home_parser=Native(config['homeSource'],'index.html','概要',rewrite)
        home_parser.feed((root/config['homeSource']).read_text());home_parser.close()
        home=''.join(home_parser.output)
    files['index.html']=insert(home,'index.html')
    files['pages.html']='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容と操作の一覧 | '+esc(config['title'])+'</title><link rel="stylesheet" href="integration.css"></head><body>'+bar('pages.html')+'<main class="pu-search"><h1>内容と操作の一覧</h1><p>元の画像・図・表・操作を保持した各画面です。検索では全項目と資料の原文を照合できます。</p>'+('<p><a href="verification-flow.html">確認の順序を図で読む</a></p>' if graph else '')+'<ul class="pu-results">'+''.join('<li class="pu-result"><h2><a href="'+esc(entry['target'])+'">'+esc(entry.get('title',entry['category']))+'</a></h2><p>'+esc(entry['category'])+' · '+str(entry.get('items',0))+'項目</p></li>' for entry in pages.values() if entry['target'] in files)+'</ul></main></body></html>'
    options=lambda values:'<option value="">すべて</option>'+''.join('<option value="'+esc(value)+'">'+esc(HUMAN.get(value,value))+'</option>' for value in values)
    files['search.html']='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>全ページから探す | '+esc(config['title'])+'</title><link rel="stylesheet" href="integration.css"></head><body>'+bar('search.html')+'<main class="pu-search"><h1>全ページから探す</h1><p>本文、図、画像、表、操作、資料をまとめて検索できます。分類と種類を組み合わせ、同じ条件のURLで戻れます。</p><form id="pu-form"><label>語句<input id="pu-query" type="search" autocomplete="off"></label><label>分類<select id="pu-category">'+options(categories)+'</select></label><label>種類<select id="pu-type">'+options(kinds)+'</select></label><button id="pu-reset" type="button">条件を解除</button></form><p class="pu-count" id="pu-count" role="status" aria-live="polite"></p><ol class="pu-results" id="pu-results"></ol><button type="button" id="pu-more" hidden>続きを表示</button><details><summary>出典・対象版・全件データ</summary><p>生成は内容の確認を意味しません。各元資料の確認日・対象版・履歴を保持しています。</p><a href="data/unification.json">全件の元データを開く</a></details></main><dialog id="pu-detail" class="pu-detail" aria-labelledby="pu-detail-title"><header><h2 id="pu-detail-title">原文・出典</h2><button type="button" id="pu-detail-close">閉じて一覧へ戻る</button></header><pre id="pu-detail-data"></pre></dialog><script src="search-data.js" defer></script><script src="integration.js" defer></script></body></html>'
    files['unification-exclusions.html']='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>元の非公開領域に残す資料</title><link rel="stylesheet" href="integration.css"></head><body>'+bar('unification-exclusions.html')+'<main class="pu-document"><h1>元の非公開領域に残す資料</h1><p>内容は転記していません。資料の利用・アクセス条件は元の領域で確認してください。</p><ul>'+''.join('<li>'+esc(reason)+'</li>' for reason in sorted(set(exclusions.values())))+'</ul></main></body></html>'
    return {name:base64.b64encode(content.encode() if isinstance(content,str) else content).decode() for name,content in files.items()}

if __name__=='__main__':
    request=json.load(sys.stdin)
    result=generate(request['root'],request['config'],base64.b64decode(request['home']).decode())
    json.dump({'files':result},sys.stdout,ensure_ascii=False)
