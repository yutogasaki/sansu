"""Assemble unedited, SHA-checked images from the completed limited diagnostic."""
from pathlib import Path
import hashlib
import html
import json
import os

ROOT = Path(__file__).resolve().parent
REPORT = ROOT / 'shape-after-first-oom/actual/report.json'
BENCHMARK = ROOT.parents[1] / '2026-10-10-island-final-3d/whole-island-render.png'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
report = json.loads(REPORT.read_text())
assert report['pass'] and report['shapeOnly'] and report['sourceClosureUnchanged']
assert len(report['captures']) == 2
entries = [('採用した到達像 · native-05 · 別構図の15軒', BENCHMARK, sha(BENCHMARK))]
for capture in report['captures']:
    path = REPORT.parent / capture['file']
    assert sha(path) == capture['sha256']
    entries.append((capture['file'], path, capture['sha256']))
cards = []
for label, path, digest in entries:
    relative = os.path.relpath(path, ROOT)
    cards.append(f'<figure><a href="{html.escape(relative)}"><img src="{html.escape(relative)}" alt="{html.escape(label)}"></a>'
                 f'<figcaption>{html.escape(label)}<br><small>SHA256 {digest}</small></figcaption></figure>')
metadata = {
    'build': report['expectedBuild'], 'version': report['captures'][0]['appVersion'],
    'target': report['captures'][0]['url'], 'visualCandidate': report['hostCandidate'],
    'delivery': 'Explicit DEV QA; nativeGrowingArt=true in rendered telemetry. Normal build remains native=false.',
    'scope': 'Fixed mature 35 owners / 8 homes / 75 rights; desktop whole and hill close only.',
    'fullJourneyAccepted': False, 'independentObservers': 0,
    'rawReportSha256': sha(REPORT),
}
page = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>中央丘肩 c1 — 限定した実画面比較</title><style>
body{margin:0;padding:28px;background:#f4f5f7;color:#1f2937;font:16px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto}
h1{font-size:25px}p{max-width:1000px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
figure{margin:0;background:white;padding:12px;border:1px solid #d7dce3}figure:first-child{grid-column:1/-1;max-width:800px}
img{display:block;width:100%;height:auto}figcaption{padding-top:10px;overflow-wrap:anywhere}small{font-size:11px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;background:white;padding:18px}@media(max-width:700px){.grid{grid-template-columns:1fr}body{padding:14px}}
</style><main><h1>中央丘肩 c1 — 限定した実画面比較</h1>
<p>固定成熟状態の全景と丘近景。採用原本と実appの造形を比較するための資料で、購入・成熟・編集の全旅程や小画面を含むcritical pathの完了証拠ではありません。画像の切抜き・色補正・描き足しはしていません。</p>
<p>作者所見：肩の3本で右側にまとまりは出たものの、森は細い個体の列に見え、中央の裸地と角張った道が目立ちます。近景では幹と根の支持は見えますが、薄い床の継ぎ目が残ります。全島美術はHOLD。独立した理解／安全はN=0、runtimeはこの2画面の限定診断のみPASSです。</p>
<div class="grid">'''+''.join(cards)+'''</div><h2>実行の識別</h2><pre>'''+html.escape(json.dumps(metadata, ensure_ascii=False, indent=2))+'''</pre>
<p><a href="shape-after-first-oom/README.md">限定診断の原記録</a> · <a href="regression-summary/README.md">初回全旅程のメモリ不足と未実行範囲</a> · <a href="memory-diagnostic/README.md">保持量の分離実験</a></p></main></html>'''
(ROOT / 'shape-review.html').write_text(page)
(ROOT / 'shape-review.json').write_text(json.dumps({**metadata, 'images': [{'label': label, 'path': os.path.relpath(path, ROOT), 'sha256': digest} for label, path, digest in entries], 'htmlSha256': sha(ROOT / 'shape-review.html')}, ensure_ascii=False, indent=2)+'\n')
