# 同じ枝を合成する成長岸 v3 — source-only HOLD

候補 `native05-growth-terrain-rough-v3`。**同じ取得足場と成熟4木の配置から、1枝→独立2枝→接続付き周回を作る source 粗形。美術 HOLD、runtime 未検証、独立観察 N=0。** 完成島3枚の切替ではなく、同一 seaward mesh を南北へ置き、条件成立時に短い実地形1partを加える。

[v1](../README.md) / [丸い岸断面 v2](../rounded-coast-v2/README.md) の原本・初回失敗・比較を保持。基準は [native05 承認全景](../../2026-10-10-island-final-3d/whole-island-render.png) と [c8 実画面](../../2026-10-12-growth-terrain-runtime/runtime-contact-sheet.html)。この資料の画像は地形単体の source 描画で、全島や通常操作の実画面ではない。

## 同じ原本と実三角形

[builder](../../../../tools/build-authored-growth-terrain-kit.mjs) / [この版の exact 保存](build-authored-growth-terrain-kit.mjs.txt) が [catalog](authored-growth-terrain-kit.json.gz)、[manifest](source-manifest.json)、GLB を同時に生成する。原 native05 GLB SHA `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` は不変。native05 の実 relief samples、丸い岸 controls と元 PBR を継承した新 topology / normals であり、元三角形の複製とは称さない。

v1 acquired template の全 floor / surface / site / edge / port、6権利と足場・入口・南北 seam は exact 同一。template へ追加したのは造成範囲予約 `growthReservation` の metadata のみ。高さ0.34375、底-0.65625、造成範囲 X[2.9,8]・Z[-4.5,4.5]。追加 floor は全て非所有の walk-only。v2 parallel の geometry も同一。

共通 seaward 枝は local 原点0/turn0、south=(0,0,-1)、north=(0,0,1)。枝の local Z=±0.6875、X[5.25,6.25] が接続可能な境界。南枝の北面は parent Z=-0.3125、北枝の南面は Z=0.3125 で、connection はその間の幅0.625×長さ1.0の実 ground / 岸 / 底。両枝の面積重複はない。接合線の高さは0.34375。

- branch landing: local `(5.75,0.5)` / `(5.75,-0.5)`。
- connection landing: parent `(5.75,-0.125)` / `(5.75,0.125)`。実上面で支持する内部 walk edge 1本を持つ。
- 接続なしでは両岸の bank を表示。接続ありの時だけ south の `bank-connection-positive` と north の `bank-connection-negative` を除く。同じ plan に従い GLB / domain / renderer の三角形を一致させる。
- 成熟木や所有 ID を source に焼き込まない。配信 manifest の `variationCases` を通常 UI が地区取得後の座標へ変換して操作する。source probe の synthetic state はその UI 成功証拠ではない。

| 同じ4木の local 配置 | 合成 | 同一カメラの source PNG / exact GLB |
| --- | --- | --- |
| single: (1,-1),(2,-1),(1,0),(2,0) | south 1枝 | [画像](single-source.png) / [GLB](single-source.glb) |
| split: (1,-1),(2,-1),(1,1),(2,1) | south+north 2枝、接続なし | [画像](split-source.png) / [GLB](split-source.glb) |
| loop: (2,-1),(2,0),(2,1),(1,0) | 両枝+coastal-loop | [画像](loop-source.png) / [GLB](loop-source.glb) |

[編集可能 Blender](growth-terrain-family.blend) はこの3構成を別 collection に保存。通常の2木用 parallel / seaward / shifted も維持し、[baseline](baseline-source.glb) / [parallel](parallel-source.glb) / [seaward](seaward-source.glb) の GLB がある。本体は同じ JSON 三角形を描画するため GLB を重ねない。

## 実視と限界

単体図では1本の岬、2本の岬、途中がつながる周回の差が読める。一方、細長い同じ丘2本と短い横接続という人工的な形、固定低岸との材色境界、bank 切替付近の折れと小さなえぐれ状の暗部が残る。**美術 HOLD のまま本体の粗形比較へ渡す。** 閉体検査は自己交差の完全証明ではなく、画像の暗部が全て解消したとは扱わない。人物・家・木を含まない図から親しみや実利用を加点しない。追加の局所描画反復はしていない。

[bounded runner](run-source-preview.py) / [render script](build-source-preview.py) の一回実行は [result](source-preview-result.json) / [raw log](source-preview-execution.log.txt)。2026-10-12 11:34:58–11:35:25 UTC、PID65565、exit0、26.581秒、CPU2、Cycles CPU16samples、1280×800、sample peak1,973,075,968B。120秒/3GiB上限、入力SHA前後一致、owned PID退出確認。source用camera/light/海面で、app / performance 証拠ではない。

## 検証と初回失敗

[source probe](check-source.mjs) / [強化connection検証後の結果](source-check-post-connection-validation.json) は2木の3配置と4木の3配置を実 domain derive/compose へ渡した。6権利・±0.46足場、既存地区の73→79取得を保持。single54 / split108 / loop110の追加地点は元入口へ到達し、loop は connection 内部から両口へつながる。全 owner obstruction / actual rig / 個人保存は未検証。

[GLB audit](source-glb-audit.json) は上面 POSITION / NORMAL / indices と catalog Float32 配列、全 bank POSITION / indices が exact 一致。baseline3776 / parallel7432 / seaward・single9708 / split15640 / loop15928 triangles。全6構成とも zero-area0、有向閉体edge不一致0、signed volume正。実際に renderer と physics が同じ source を使う本体検証は root が行う。

初回は新しい細い外周を旧 seam の矩形条件で誤分類したため閉体不一致、および狭い高斜面で landing が残らず domain 拒否。[history/attempt-01](history/attempt-01) を保持し、exact seam vertex 集合での識別と非所有枝の低い relief へ修正した。元床や閾値の緩和ではない。[attempt02](source-check-attempt-02.json) と最終 source check は PASS。

builder syntax / targeted ESLint / Python syntax、[公開後再抽出](reproducibility-published.log.txt)、GLB audit は PASS。全 core / browser はここでは実行していない。通常の取得/苗購入/成長/移動から同じ結果になること、全島美術、実生活・本人saveは後続。

配信候補 revision `d755b76f91f650ce9489408a1e49732e61c53ae0d13369f2df91275489108062`、gzip SHA `231cb97b9b26bf6095d7cc2d7acafb2ba0f8e532612d5e9778fe4c032b8f7e3a`、expanded SHA `35b66a59db2c8bb9f889db279bbe50298c582fda45ea2fb2634fca92562fe37f`。公開 prototype と保存 catalog/manifest の bytes は同一。[freeze](source-freeze.json) に一覧を残す。
