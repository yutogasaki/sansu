# 丸い岸断面 v2 — source-only HOLD

候補 `native05-growth-terrain-rough-v2`。v1 の成熟地形の同XZ直壁を、幅0.54の実上面の丸い肩と水際0.045へ下がる裾、下側の閉じた岸断面へ改稿した。取得済み baseline template 全体、6権利・足場・入口・seam・2 sockets は v1 と exact 同一。v1 原本・証拠は保持している。**美術 HOLD / 独立観察 N=0 / runtime 未実行**。本体配信を置き換える前に後継の合成 v3 へ進むため、この版は保存した source 候補である。

[承認全景](../../2026-10-10-island-final-3d/whole-island-render.png)、[c8 実画面比較](../../2026-10-12-growth-terrain-runtime/runtime-contact-sheet.html)を基準にした。色だけの変更ではなく成熟 patch の上面そのものが水際へ降りる。原 native05 GLB `8398eda9…` と PBR は不変。原本の relief samples / coast vocabulary を継承した新 topology / normals であり、原三角形保持とは称さない。

| 保存した同一カメラの source 比較 | exact catalog GLB |
| --- | --- |
| [低岸](baseline-source.png) | [baseline](baseline-source.glb) |
| [横の丘肩](parallel-source.png) | [parallel](parallel-source.glb) |
| [海へ伸びる岬](seaward-source.png) | [seaward](seaward-source.glb) |

[編集可能 Blender](growth-terrain-family.blend)、[source manifest](source-manifest.json)、[catalog](authored-growth-terrain-kit.json.gz)。見える岸の直壁は薄くなり上面から水際への傾斜が読める。一方、固定低岸と青緑の丘の色境界・くびれ・独立した丘の量感は残る。全島につながる美術の合格ではない。人物や家を含まない単体図で親しみや実利用を加点しない。

## 固定・検証範囲

[source check](source-check-attempt-02.json) は全 baseline template の v1 一致、6権利と±0.46足場、variant/socket、既存 native05 への取得73→79権利を確認。追加歩行地点は parallel31 / seaward59 / shifted31、保持地点は入口へ接続。歩行候補の非連結1地点ずつを含め全丘を歩けるとは主張しない。実 owner obstruction / rig / browser は未検証。

[GLB audit](source-glb-audit.json) は全上面 POSITION / NORMAL / indices と catalog Float32 配列、全 bank POSITION / indices の一致。baseline3776 / parallel7432 / seaward7476 triangles、zero-area0、有向閉体不一致0、signed volume正。GLB import 後の Blender normals の完全一致までは証明しない。

最初の audit は seam endpoint の断面段数差で12 edge不一致。[attempt01](history/attempt-01)を保持。生成した中間 ring が固定の top/top-.12/bottom に収束し、同一点を同じ index にする修正で [attempt02](execution-attempt-02.json) が通った。baseline の値・閾値は変更しなかった。

[一回の比較描画 result](source-preview-result.json) / [log](source-preview-execution.log.txt): 2026-10-12 11:23:32–58 UTC、PID62262、exit0、25.899秒、CPU2、Cycles CPU16samples、1280×800、sample peak1,965,719,552B。120秒/3GiB上限、入力SHA前後一致、終了確認済み。source専用camera/light/海面であり app / performance 証拠ではない。

## 再現と保存

[保存 builder](build-authored-growth-terrain-kit.mjs.txt) は v2 の exact bytes（現行 tool は後継へ移る）。この内容を一時 `.mjs` として repository root から `node <saved-builder.mjs> --check --draft` で再抽出照合できる。[repro log](reproducibility-check.log.txt) は PASS。source probe、GLB audit、builder syntax / ESLint は PASS。source freeze は [一覧](source-freeze.json)。core/browserは root が後継固定後に実施する。

catalog revision `a74b436a5165badf2438a6c3a2d0632be9fe27a533b162b62de57aa26bf1ec01`、gzip `a7dc1ab184aec413acd31081376e82b2b87905d2aa305911a4618952cc9c423c`、expanded `0f8649f28774cac07c35199d5b3b56f6ccab428451a9a7c88ba4c2f3fef023a6`。
