from pathlib import Path
import json,hashlib,re,shutil
src=Path('/private/tmp/sansu-l14-access-diagnosis')
dst=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-whole-massing/l14-approach-audit')
dst.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((src/'report.json').read_text())
assert len(r['inputHashesBefore'])==104 and r['inputsUnchanged']
assert r['inputHashesBefore']==r['inputHashesAfter']
point=next(x for x in r['safeLocal'] if x['cell']=={'x':3,'z':-4})
assert point['routeCount']==33 and point['routeSafe'] and point['clearPoint'] and not point['offered']
files=['probe.mjs','report.json','execution.log.txt','findings.md','handoff-hashes.json','archive.py']
for f in files:shutil.copyfile(src/f,dst/f)
# These are explicit extracts; original before/after objects remain in raw report.json.
for name,key in [('input-hashes-before.json','inputHashesBefore'),('input-hashes-after.json','inputHashesAfter')]:
 (dst/name).write_text(json.dumps(r[key],indent=2)+'\n')
manifest={'scope':'Durable archive of a read-only l14 baseline approach diagnosis for next M1 implementation design. No app correction or whole-app acceptance PASS is asserted.',
 'copy':{f:{'source':str(src/f),'bytes':(dst/f).stat().st_size,'sourceSha256':sha((src/f).read_bytes()),'archivedSha256':sha((dst/f).read_bytes()),'sourceAfterCopySha256':sha((src/f).read_bytes()),'bytesIdentical':(src/f).read_bytes()==(dst/f).read_bytes()} for f in files},
 'extracts':{name:{'source':'report.json','field':key,'bytes':(dst/name).stat().st_size,'sha256':sha((dst/name).read_bytes()),'count':len(r[key])} for name,key in [('input-hashes-before.json','inputHashesBefore'),('input-hashes-after.json','inputHashesAfter')]},
 'inputsUnchanged':True,'inputCount':104,'scopeLimitations':['Current runtime indexes flower/cove roots, not native groves; diagnostic temporarily registers actual native tree roots.','l14 has no own seat or PlaceUseTarget and no legitimate l14-specific use receipt.','Safe local point and real neighbor route do not constitute completed actor-use/full-footprint support/visual acceptance.','No app, source, fixture, owner, land grant, geometry, mature age, browser or core was changed or started.']}
assert all(x['bytesIdentical'] and x['sourceSha256']==x['archivedSha256']==x['sourceAfterCopySha256'] for x in manifest['copy'].values())
(dst/'archive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
readme='''# l14 の入口候補 — 次 M1 の限定診断

2026-10-12。**次 M1 の実装設計に向けた読み取り調査。app は未修正、本体受入 PASS ではない。** 元の 32 所有物・73 取得権、l14 のセル・ID・成熟・実 source 比率、住人の実 rig と余白を変更していない。

現在の runtime の obstruction guard は花と cove の root が対象で、**native grove は対象外**。本調査だけが実 tree/shared-tree/branch root を一時的に対象名へ登録した。描画を変えた完成版や、実 app が木を避けて歩く証明ではない。

## 一件に絞った原因

l14 `(2,-4)` は単独 owner の大きい willow。年齢 234 h による既得 1.3 倍が適用されている。共有 4 所有物への誤対応ではない。実幹の `sculpted tree wood` 2,720 triangles が既存候補を塞ぎ、候補探索が最初の論理 footprint 外で止まるため、その外側の安全な地点を発見しない。

| 診断上の障害物 | Triangles | 到達 refs | l14 の接近点 |
| --- | ---: | ---: | ---: |
| 現在の花＋cove | 115,808 | 1,386 | 4 |
| 実 tree 全体を追加 | 211,560 | 1,380 | 0 |
| l14 のみ追加 | 143,680 | 1,380 | 0 |
| l14 以外の全 tree を追加 | 183,688 | 1,386 | 4 |

全候補には実床がある。葉 3 材質と young branches をそれぞれ単独追加しても 4 接近点を保つ。幹だけでゼロになる。3 候補は実幹に衝突し、残る `(2.75,-3.5)` は点自体は clear でも既存の危険 edge 両端除外で落ちる。床欠落・樹冠の一括判定・owner 対応が原因ではない。

## 同じ床にある安全候補

**`(3,-4)`** は l14 から距離 1.0、実床高さ `0.209249989`。全 tree を含めても point-clear かつ HOME から到達でき、**33 点の実 world route の全区間が guard-clear**。現在の入口候補には含まれていない。新しい床・権利・ref・edge、木の縮小、rig の縮小は不要という限定的な根拠であり、住人の利用完走や全足裏支持を検証済みとする結果ではない。

次 M1 の最小案は、guard 後に既存の 1.1 範囲と実 neighbor から owner 固有の安全候補を一度解決し、診断値だけでなく目的地選択・着席・退出にも共用すること。危険な候補を越えて探索することと、その地点を歩行可能にすることは区別する。実経路・支持・seat への遷移・pose・退出の条件を維持し、安全候補がなければ失敗を残す。

**l14 自体には seat / PlaceUseTarget がなく、固有の正当な利用 receipt は存在しない。** l14 への接近・離脱と、実在する grove の利用 target での利用・退出を分けて検証する。l14 の架空の利用記録を作って通過扱いにしない。

## 原結果と再現範囲

- [findings.md](findings.md)：部位ごとの切分け、実装の呼び出し箇所、共通候補 resolver の最小案、次 M1 の focused 検証条件。
- [probe.mjs](probe.mjs)、[report.json](report.json)、[execution.log.txt](execution.log.txt)：実際に実行した script・生 JSON・生 stdout/stderr。raw log の warning も保持し、成功結果に置換していない。
- [開始時の 104 入力 SHA](input-hashes-before.json)、[終了時の 104 入力 SHA](input-hashes-after.json)：原 report の該当 object を明示抽出。開始・終了は全一致。原 report にも両方を保持。
- [archive-manifest.json](archive-manifest.json)：コピー前・保存後・元 file 再読込の SHA と byte 一致、抽出物の出自。
- [handoff-hashes.json](handoff-hashes.json)：調査引渡し時の元 file hash。

実行 script は当時の repo と `/private/tmp/sansu-l14-access-diagnosis` の絶対パスを保持している。再現時には 104 入力 hash が一致する環境を用意し、必要なパスを明示的に対応させる。生成された一時 module bundle は script から再生成可能なので保存対象外。app/source/durable の他作者ファイル、本人保存、既存 owner/取得権は変更していない。本アーカイブ作成時にも browser/core は起動していない。
'''
(dst/'README.md').write_text(readme)
assert all((dst/x).exists() for x in re.findall(r'\]\(([^)]+)\)',readme))
print(json.dumps({'archive':str(dst),'files':len(list(dst.iterdir())),'rawBytesIdentical':True,'inputCount':104,'inputHashesUnchanged':True,'reportSha256':sha((dst/'report.json').read_bytes()),'links':'PASS'},indent=2))
