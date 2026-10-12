from pathlib import Path
import gzip,hashlib,html,io,json,tarfile,time

repo=Path('/Users/yutogasaki/Projects/sansu')
out=repo/'docs/design/2026-10-12-growth-variation-runtime'
run=Path('/private/tmp/sansu-island-variation-c9');candidate=run/'candidate'
sha=lambda data:hashlib.sha256(data).hexdigest()
core=json.loads((run/'core/report.json').read_text())
runtime=json.loads((run/'runtime/report.json').read_text())
execution=json.loads((run/'runtime-execution.json').read_text())
snapshot=json.loads((run/'snapshot.json').read_text())
assert core['pass'] and core['sourceFixed'] and core['exitCode']==0
assert runtime['pass'] and runtime['sourceFixed'] and not runtime['errors'] and execution['exitCode']==0
assert core['revision']==runtime['revision']==snapshot['revision']=='island-variation-c9'
assert core['initialInputs']==core['finalInputs']==runtime['initialInputs']==runtime['finalInputs']==json.loads((run/'inputs.json').read_text())
names=['young','single','split','loop','separated','loop-restored','rotated','phone','tablet']
assert [c['name'] for c in runtime['captures']]==names
assert len(snapshot['copied'])==203 and not snapshot['removed'] and not snapshot['deletedTrackedPaths']
for capture in runtime['captures']:
 assert capture['host']['worldRevision']==capture['renderer']['worldRevision']
 assert 'ANGLE Metal Renderer: Apple M4' in capture['graphics']['unmaskedRenderer']
for directory in ['core','runtime','focused','benchmark']:(out/directory).mkdir(exist_ok=False)
proof={'revision':core['revision'],'archivedAt':time.time(),'scope':'Exact fixed c9 candidate; later main work is not represented','files':[]}
originals={}
def archive(source,relative,compressed=False,input_path=None):
 data=source.read_bytes();originals[str(source)]=sha(data)
 if input_path:assert core['finalInputs'][input_path]==sha(data),f'Candidate source differs: {input_path}'
 saved=gzip.compress(data,mtime=0) if compressed else data
 dest=out/relative;dest.write_bytes(saved)
 assert (gzip.decompress(saved) if compressed else saved)==data
 proof['files'].append({'source':str(source),'archive':relative,'originalSha256':sha(data),'archiveSha256':sha(saved),
  'originalBytes':len(data),'archiveBytes':len(saved),'gzipMtime':0 if compressed else None,
  'candidateInput':input_path,'matchesC9CoreInput':True if input_path else None})
for source,relative,compressed in [
 ('core/report.json','core/report.json.gz',True),('core/execution.log.txt','core/execution.log.txt',False),
 ('core-launcher.log.txt','core/launcher.log.txt',False),('inputs.json','core/inputs.json.gz',True),
 ('source-after.json','core/source-after.json.gz',True),('candidate-inputs.json','core/candidate-inputs.json.gz',True),
 ('snapshot.json','core/snapshot.json.gz',True),('prepare.py','core/prepare.py.txt',False),
 ('prepare.log.txt','core/prepare.log.txt',False),('core.py','core/core.py.txt',False),
 ('runtime/report.json','runtime/report.json.gz',True),('runtime/progress.json','runtime/progress.json',False),
 ('runtime-execution.json','runtime/execution.json',False),('runtime-execution.log.txt','runtime/execution.log.txt',False),
]:archive(run/source,relative,compressed)
archive(Path('/private/tmp/sansu-variation-runtime-launch.py'),'runtime/launch.py.txt')
for name in names:archive(run/f'runtime/{name}.png',f'runtime/{name}.png')
for name in ['first','corrected']:
 archive(Path(f'/private/tmp/sansu-variation-c9-focused-{name}.log'),f'focused/{name}.log.txt')
for source,relative in [
 ('tools/e2e-authored-island-variation.mjs','runtime/e2e-authored-island-variation.mjs.txt'),
 ('src/components/island/growing/native/authoredGrowthTerrainIntegration.test.ts','focused/authoredGrowthTerrainIntegration.test.ts.txt'),
 ('src/components/island/growing/authoredGrowthTerrainLife.test.ts','focused/authoredGrowthTerrainLife.test.ts.txt'),
 ('docs/design/2026-10-10-island-final-3d/whole-island-render.png','benchmark/whole-island-render.png'),
]:archive(candidate/source,relative,input_path=source)
delta=out/'core/source-delta-from-c8.tar.gz';delta_records=[]
with delta.open('xb') as file:
 with gzip.GzipFile(fileobj=file,mode='wb',filename='',mtime=0) as zipped:
  with tarfile.open(fileobj=zipped,mode='w|') as tar:
   for name in sorted(snapshot['copied']):
    source=candidate/name;data=source.read_bytes();digest=sha(data)
    assert digest==core['finalInputs'][name];originals[str(source)]=digest
    info=tarfile.TarInfo(name);info.size=len(data);info.mode=source.stat().st_mode&0o777;info.mtime=0
    tar.addfile(info,io.BytesIO(data));delta_records.append({'path':name,'sha256':digest,'bytes':len(data)})
with tarfile.open(delta,'r:gz') as tar:
 assert sorted(tar.getnames())==sorted(snapshot['copied'])
 for item in delta_records:assert sha(tar.extractfile(item['path']).read())==item['sha256']
proof['sourceDelta']={'archive':'core/source-delta-from-c8.tar.gz','files':203,'sha256':sha(delta.read_bytes()),
 'bytes':delta.stat().st_size,'source':str(candidate),'base':snapshot['cloneBase'],'baseInputsSha256':snapshot['baseInputsSha256'],
 'baseCoreReportSha256':sha(Path('/private/tmp/sansu-growth-terrain-c8/core/report.json').read_bytes()),
 'removed':snapshot['removed'],'requiresCompleteC8Base':True,'members':delta_records}
summary={'revision':runtime['revision'],'target':runtime['target'],'pass':runtime['pass'],'sourceFixed':runtime['sourceFixed'],
 'errors':runtime['errors'],'core':{'files':620,'tests':5373,'pass':True,'sourceFixed':True,'inputCount':len(core['finalInputs']),
  'startedAt':core['startedAt'],'finishedAt':core['finishedAt'],'elapsedSeconds':core['finishedAt']-core['startedAt']},
 'execution':execution,'runtimeElapsedSeconds':execution['finishedAt']-execution['startedAt'],'browserVersion':runtime['browserVersion'],
 'launchOptions':runtime['launchOptions'],'candidate':runtime['candidate'],'catalogRevision':runtime['catalogRevision'],
 'acquisition':runtime['acquisition'],'newOwnerIds':runtime['newOwnerIds'],'originalOwnerCount':len(runtime['originalOwners']),
 'matureOwnerCount':len(runtime['matureInvariant']['owners']),'natureAdvance':runtime['natureAdvance'],'cases':runtime['cases'],
 'steps':runtime['steps'],'initialGraphics':runtime['initialGraphics'],'captures':[],
 'gates':{'limitedUiJourney':'PASS','wholeRuntime':'PARTIAL','visualAppeal':'HOLD','independentComprehensionSafety':'NOT_TESTED','independentObservers':0},
 'excludes':runtime['excludes'],'focusedFirstFailure':{'result':'45 PASS / 1 FAIL','cause':'Test district origin0 collided with existing HOUSE_CELLS at (2,0); unstore correctly refused',
  'fix':'Test fixture logical/physical X offset +10; production behavior unchanged','correctedResult':'4 integration tests PASS',
  'originalFailedTestSourcePreserved':False,'reconstructedOriginalSource':False}}
for capture in runtime['captures']:
 h=capture['host'];s=json.loads(h['authoredState'])
 summary['captures'].append({'name':capture['name'],'file':capture['file'],'viewport':capture['viewport'],
  'host':{key:h.get(key) for key in ['buildRevision','appVersion','visualCandidate','worldRevision','districtWorldRevision','groundSourceRevision','groundShading','growthTerrainCandidate']},
  'renderer':{key:capture['renderer'].get(key) for key in ['worldId','worldRevision','nativeGrowingArt','authoredWholeArtEnabled','authoredGrowthTerrainCandidate','growingCamera','growingSceneCounters']},
  'graphics':capture['graphics'],'plan':capture['plan'],'ownershipHash':capture['ownershipHash'],
  'newOwners':[owner for owner in s['landmarks'] if owner['id'] in runtime['newOwnerIds']]})
(out/'runtime/summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
assert {name:sha(Path(name).read_bytes()) for name in originals}==originals,'An archive source changed while copying'
proof['sourceBeforeAfterEqual']=True;proof['gzipDecodedContentVerified']=True;proof['sourceDeltaMembersVerified']=True
proof['archiveToolSha256']=sha((out/'archive-c9.py').read_bytes())
(out/'archive-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
captions={'young':'苗4本・同じ取得床','single':'single：一群から一本の岬','split':'split：二群から二つの枝','loop':'loop：一群から二枝と外側の接続',
 'separated':'中央の木を収納・派生床と接続を解除','loop-restored':'同じ木を戻し、同じ地形と描画版へ復元',
 'rotated':'右へ回転・復元したloop','phone':'390 × 844・復元したloop','tablet':'768 × 1024・復元したloop'}
figures=['<figure class="benchmark"><figcaption>採用native05・全島の目標</figcaption><a href="benchmark/whole-island-render.png"><img src="benchmark/whole-island-render.png" alt="採用native05全島原本"></a></figure>']
for capture in runtime['captures']:
 name=capture['name'];p=capture['plan'];viewport=capture['viewport']
 figures.append(f'<figure><figcaption>{html.escape(captions[name])}</figcaption><a href="runtime/{name}.png"><img src="runtime/{name}.png" alt="{html.escape(captions[name])}の実画面"></a><p>{viewport["width"]} × {viewport["height"]} · patches {len(p["assemblies"])} / connections {len(p["connections"])}<br><code>{html.escape(capture["host"]["worldRevision"])}</code></p></figure>')
contact='''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>同じ4本から育つ岸 — c9実画面</title>
<style>body{margin:24px;background:#f5f6f8;color:#202631;font:16px/1.6 system-ui}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}figure{margin:0;background:#fff;padding:12px;border:1px solid #d9dee5}img{display:block;max-width:100%;max-height:690px;margin:auto}figcaption{font-weight:650;margin-bottom:8px}figure p{font-size:13px;overflow-wrap:anywhere}header p{max-width:1160px}.hold{color:#963d1e}code{font-size:12px}</style></head><body>
<header><h1>同じ4本・同じ成熟から、一本／二枝／周回の岸</h1>
<p>実app: /prototypes/place-qa/authored.html?art=whole&amp;terrain=grove · build island-variation-c9 · delivery DEV / native art=true（core通常build=false） · terrain native05-growth-terrain-rough-v3 · whole native05-growth-assembly-v1+source-shading-v1</p>
<p>限定UI旅程PASS、全体runtime PARTIAL。Chromium 145 / Apple M4 Metal。9枚は実canvasを含む無加工のviewport screenshot。撮影はreduced-motion、全景fit・回転・画面幅でカメラが異なる。同一カメラの等寸比較ではない。</p>
<p class="hold">美術HOLD、独立理解／安全は未検証 N=0。一本／二枝／接続の差は読めるが、追加の岬は橋でつながる別の台座に見え、元の全島は同じ。細い枝の反復、接合部の凹み・暗い折れ、広い空地と少ない家が採用原本に届かない。小画面でも付属部の差であり、3つの完成した全島の証明ではない。</p>
<p><a href="README.md">条件・限定した判定</a> · <a href="runtime/summary.json">実host／renderer／GPU／所有物の抽出</a> · <a href="archive-proof.json">原本と保存byteの照合</a></p></header><main>
'''+ '\n'.join(figures)+'\n</main></body></html>\n'
(out/'runtime-contact-sheet.html').write_text(contact)
print(json.dumps({'archive':str(out),'sourceFiles':len(proof['files']),'deltaFiles':203,'deltaBytes':delta.stat().st_size,
 'captures':len(runtime['captures']),'sourceBeforeAfterEqual':True,'corePass':True,'runtimePass':True}))
