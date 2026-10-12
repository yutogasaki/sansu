現行後継: [同じ枝を合成する v3](composed-shore-v3/README.md)（配信更新済み、source-only HOLD）。

後継の [丸い岸断面 v2](rounded-coast-v2/README.md) を保存済み（source-only HOLD、v1 原本は保持）。

# 同じ2本の置き方と成熟で育つ岸 — source rough v1

2026-10-12。候補 `native05-growth-terrain-rough-v1`。**実地形の粗形を本体比較へ渡す source 証拠。美術は HOLD、独立観察 N=0。** このフォルダの3画像は Blender の地形単体表示で、実アプリ、木の操作、全島の完成、通常購入や本人保存の成功を示さない。

同じ取得地区の6権利・入口・所有足場を固定し、成熟した同じ2本が岸に沿えば横の丘肩、海へ向けば長い岬になる。岸沿いで2本を移すと、同じ丘肩の発生位置が南から北へ移る。追加地形に配置権は付けず、実上面上の walk-only 地点だけを持つ。

## 原本と造形の境界

[承認 native05 全景](../2026-10-10-island-final-3d/whole-island-render.png)、[原 GLB](../2026-10-10-island-final-3d/whole-island.glb)、[元生成 script](../2026-10-10-island-final-3d/mature-island.py)を参照した。原 GLB SHA256 は `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。原本 bytes は変更していない。

| TRANSFER | DO NOT TRANSFER / 固定する境界 |
| --- | --- |
| 丸い海岸の曲線、低岸と丘肩の高さの差、港と丘の実 GLB relief samples | 元の15軒構図を現在の島と見立てない。未所有木・小物を増やさない |
| 原 harbor / hill / shore の PBR 材質 | 元三角形をそのまま保持したとは称さない。新しい地形に元法線を貼らない |
| 土の上面から岸・底まで一体の実体 | 描画だけの地面や walk grant だけの接続を作らない |

これは元 GLB の1785点の実サンプル、元海岸 controls、原材質から作った**新しい topology と派生 smooth normals**。所有足場のための低い固定面と、非所有帯の起伏を別責任としている。[source manifest](source-manifest.json) に sample provenance、材質の raw 値、bounds、制約を保存し、[source profile](source-profile.json.gz) に catalog と入力サンプルを保存した。使用材に texture 参照はない。原 roughness 約0.78、metalness 0、base color と double-sided を保持する。

## 本体へ渡す同じ三角形

[builder](../../../tools/build-authored-growth-terrain-kit.mjs) が [配信 catalog](../../../prototypes/place-qa/authored-growth-terrain-kit.json.gz) と [配信 manifest](../../../prototypes/place-qa/authored-growth-terrain-manifest.json)、下記 GLB を同時生成する。catalog の local logical XZ と physical XZ は同一、Y は共有海面基準（海面0）。通常取得地区の quarter turn / origin は本体の地区 composer が適用する。

- template / district: `native05-growing-shore-v1`、西入口 `(0,0)`。
- 固定6権利: `(1,-1), (2,-1), (1,0), (2,0), (1,1), (2,1)`。足場高さ `0.34375`。成熟しても元床・権利・入口は動かさない。
- socket `south` は `(0,0,-1)`、`north` は `(0,0,1)` の平行移動。追加 patch は同じ local mesh。baseline landing は `(3,-1)` / `(3,1)`、patch entry は local `(3.5,0)`。
- 造成 scope は X `[2.9,8]`、Z `[-4.5,4.5]` の非所有帯。選ばれた海側 seam bank だけを同じ plan で除き、元上面は残す。
- bottom は Y `-0.65625`。成長 patch 単体の内部 seam bank は省略し、baseline と合成すると閉じる。

| 同じ2本の配置 | local cells | 成熟結果 | socket |
| --- | --- | --- | --- |
| parallel | `(2,-1), (2,0)` | 横の丘肩 | south |
| seaward | `(1,-1), (2,-1)` | 海へ伸びる岬 | south |
| shifted | `(2,0), (2,1)` | 横の丘肩が北へ移る | north |

上記は manifest の `diagnosticCases`。取得後の座標変換と通常操作を本体側で行うための入力であり、この source 診断の synthetic owner pose を実 UI 操作の証拠に流用しない。

## 編集可能 source と同一カメラ比較

[編集可能 Blender](growth-terrain-family.blend) に3形を別 collection で保存した。GLB は baseline 床・岸・底を含み、成熟2形は south socket へ合成済み。runtime は JSON 三角形を使用するため、GLB を重ねて二重描画しない。

| 形 | 同じ1280×800カメラの source PNG | exact catalog GLB |
| --- | --- | --- |
| 低岸 | [baseline](baseline-source.png) | [baseline GLB](baseline-source.glb) |
| 岸に平行な丘肩 | [parallel](parallel-source.png) | [parallel GLB](parallel-source.glb) |
| 海へ向く岬 | [seaward](seaward-source.png) | [seaward GLB](seaward-source.glb) |

実視では低岸→高い横肩→長い岬の外形差が読める。一方、既存足場と成長域の材色の切替、均一に立つ岸壁、合流部のくびれが強く、承認全景の土・草がなじむ島の質感には届かない。**美術 HOLD のまま全島の実 UI 比較へ渡す。** 単体地形には住人・木・家・接続 deck がなく、親しみや生活感を加点できない。追加の局所美術ループは行っていない。

描画は [authoring script](build-source-preview.py) と [bounded runner](run-source-preview.py)。CPU2 / Cycles CPU 16 samples、120秒 / RSS3GiB 上限。2026-10-12 10:25:55–10:26:21 UTC、PID44355、exit0、26.02秒、sample peak 1,965,391,872 bytes。終了後 PID 消失確認済み。[raw log](source-preview-execution.log.txt) / [result](source-preview-result.json)。入力 SHA 前後一致。preview 海面は支持面ではない。照明・カメラ・海は source 専用で、実 app や性能証拠ではない。

## 確認と保持した初回失敗

[source probe](check-source.mjs) の [attempt04](source-check-attempt-04.json) は3配置が期待 variant/socket になり、全6権利と各±0.46の配置支持を保ち、残した追加 walk-only sites が入口から接続することを確認した。parallel の追加13地点、seaward の136地点へ到達。元 native05 への地区取得 API 診断は73→79権利。これは純 domain / source 診断で、実 mesh owner obstruction を含む全島歩行や実利用の合格ではない。

[GLB audit](source-glb-audit.json) は source GLB の上面 POSITION / NORMAL / indices と catalog の Float32 配列が exact 一致、全 surface の位置 / indices も一致。baseline / parallel / seaward 合成体の三角形数は3776 / 6320 / 6656、zero-area 0、閉じた有向 edge の不一致0、signed volume 正。GLB→Blender import 後の全 accessor parity まではこの audit の証明範囲に含めない。

1. [attempt01](source-check-attempt-01.json): open Catmull endpoint が閉曲線の隣接点を使い、seam に面積 `3.932865e-6` の重複。元出力を [history](history/attempt-01) に保持し、open endpoint を修正した。
2. [attempt02](source-check-attempt-02.json): boundary 上の landing で歩行幅を支持できず接続不成立。旧出力を [history](history/attempt-02) に残し、元床形状を変えず landing を0.25内側へ移した。
3. [attempt03](source-check-attempt-03.json): parallel の急な非所有斜面に、入口から切れた43個の候補地点。旧出力を [history](history/attempt-03) に保持し、実 geometry を変えずその歩行地点だけを除外。丘の全域を歩けるとは主張しない。

`node tools/build-authored-growth-terrain-kit.mjs --check`、builder の `node --check` / ESLint、source probe と GLB audit は PASS。[再抽出 log](reproducibility-check.log.txt) と [audit log](source-glb-audit.log.txt) を保存。別担当の real-asset integration 2件 PASS は親へ報告済みで、このフォルダに独立 test raw を複製していない。core / browser は本体固定後に親が実施する。

catalog revision `9efb5888f3c2d9b94414792f91afbc18c4bf31b9bbe2b2ebf2def70b8380bf1d`、gzip SHA `1e5963d215e1c24557c095322539e0bc14d5a12422a08790056fafddf53d4332`、expanded SHA `ef5b794cdf42eb268c9e5429bf8a6766187d3bee296ca0571df968fd05a05d79`。最終 source ファイル一覧は [freeze](source-freeze.json)。将来 Blender で編集した場合も catalog と同じ生成経路へ戻し、新 revision として扱う。通常購入・本人 save、無言理解、歩行全体、美術採用は未完了。
