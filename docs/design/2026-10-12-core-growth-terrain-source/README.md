# 原本の北東・東岸から育つ地形 — 粗形レビューで停止

2026-10-12。候補 `native05-core-growth-terrain-rough-v1`。**source/domain の限定検査は PASS、美術 HOLD、c10 全 core/browser は NOT RUN、独立観察 N=0。** ユーザーのレビュー希望に合わせ、この一回の全島比較で凍結した。新しい造形案や局所の磨き込みへ進まない。

[世界契約](../../product/island-world-contract.md)と[仕様 §9.1](../../product/52_growing_island_game_spec.md)に基づき、追加島の購入を経由せず、元 `native05-inlet-core` の既存成熟木の配置から北の高い肩・東の低い岬・外岸の接続を選ぶ。旧 v1–v3 の別取得地区は変更していない。

## いま比較できるもの

|状態|同じ4木の既存 local cell（ID順）|形状|全島 source 画像|
|---|---|---|---|
|north|(12,-8), (13,-8), (12,-7), (13,-7)|北肩1、接続なし|[north](source-north-whole.png)|
|east|(12,-5), (13,-5), (12,-4), (13,-4)|東岬1、接続なし|[east](source-east-whole.png)|
|loop|(13,-7), (13,-6), (13,-5), (13,-4)|両岸＋外岸接続1|[loop](source-loop-whole.png)|

[承認 native05](../2026-10-10-island-final-3d/whole-island-render.png)と比較する。**3枚の背景は原本 native05 の全3D scene（15軒）＋新地形であり、最新35owner本体ではない。** 図中の木は4木の実移動を再現していない。source 用カメラ・照明・海で、実アプリの成長・移動・通行証拠にはしない。960×600、Cycles CPU2、8 samples、同一カメラ。巨木の葉の上端が画面端に接するため、主景全体の評価には承認画も併用する。

作者判断では、別島＋橋から主島直結の大きな輪郭差へ進んだ。一方、北肩は翼状の斜面と長い直壁、東岬は平たい舌、loop は両者の間を埋めた追加形に見える。承認画の丸い岸・起伏の連続へは届かず、美術 HOLD。色変更や装飾追加で解決したとは扱わない。

## 実体と座標

- [再現 builder](../../../tools/build-authored-core-growth-terrain-kit.mjs)、[catalog](authored-core-growth-terrain-kit.json.gz)、[manifest](authored-core-growth-terrain-manifest.json)、[geometry profile](geometry-profile.json.gz)。配信先は同内容の [kit](../../../prototypes/place-qa/authored-core-growth-terrain-kit.json.gz) と [manifest](../../../prototypes/place-qa/authored-core-growth-terrain-manifest.json)。
- [編集可能 Blender](core-growth-family.blend)。[north](north-parts.glb) / [east](east-parts.glb) / [loop](loop-parts.glb) の部分 GLB と、[north 全景](north-whole.glb) / [east 全景](east-whole.glb) / [loop 全景](loop-whole.glb) を保存。
- 地形入力は `native05-world-source-shading.json.gz` の実原床。元10 floor 配列・全 site・73配置権を不変に保ち、template.id への参照名正規化だけを行う。源 GLB SHA は `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。
- 北 socket=(13,0,-8)、東=(13,0,-4)、turn0。各地形はその origin を引いた local 座標。接続は parent-local origin0。whole GLB の原本だけ `.45 * source + (5.65,-.3645,-1.03)`、新地形は authored world 座標。
- 接岸点は[原床の外周実頂点](original-boundary.json)を使用。北端点 `(13.177031231,.335070322,-9.235429268)`→`(13.693262482,.590180479,-6.650533371)`、東 `(13.638541126,.687802372,-5.341901188)`→`(14.650565624,.184709225,-2.762031322)`。境界 normal は源値、新上面は新 topology の面積加重 normal。原材の PBR 4種を継承。
- 北の最大 x≈17.932、追加上面最大 y≈1.349。東 x≈18.695、y≈.688。外岸接続は両口 x=15.25..17.25、z=-6.650533371..-5.341901188、中央幅最大2.6。新上面・岸・底は catalog と同じ配列から GLB を作る。描画だけの道や新配置権はない。
- 元 coast skin は変更していない。継ぎ目内部に残る bank や、見える壁への影響は**未監査**。bank は上面の丸い裾から底までの実側面だが同XZ断面を含む。全閉体・union manifold・GLBを別読出しした三角形一致は今回は未実施であり、保証しない。

## 行った検査と行っていない検査

[check-source.mjs](check-source.mjs) と [結果](source-check-attempt-01.json)は源 catalog＋現 domain を使う限定診断。4ownerセルを診断入力として構成し、通常UI操作はしない。

|項目|結果|
|---|---|
|原床10配列・site・73配置権の保持|deep equality PASS|
|north / east / loop の socket と接続選択|PASS|
|追加 floor の元床への正面積重複、scope、支持|domain compose PASS|
|新 walk-only site の到達|59/59、85/85、187/187|
|元島内部経路を除外した外岸2口の接続|north false、east false、loop true|
|全rig障害物、全35owner、本体UI、本人保存|NOT RUN|
|全体可変構築、美術完成、M1採用|未達|

最初の source build は接続口の傾斜による landing 支持 assert で停止した。[初回 script](history/attempt-01/builder.mjs.txt) と [失敗ログ](history/attempt-01/build.log.txt)を保持。閾値を変えず、非所有の新地形内で接合肩の高さへの移行範囲を広げてから生成した。

再現 `node tools/build-authored-core-growth-terrain-kit.mjs --check --publish` と対象 eslint は PASS（[repro](repro.log.txt) / [lint](lint.log.txt)）。[1回の preview 実行](source-preview-result.json)は 12:13:03–12:13:24 UTC、PID76884、exit0、20.823秒、peak sampled RSS 2,248,179,712 bytes、入力 SHA 前後一致、owned PID 退出確認。120秒 / 3GiB / CPU2 上限内。性能評価ではない。画像は無加工。

[source freeze](source-freeze.json)に現在の入力・出力 SHA を記録。配信 catalog gzip SHA `2fa98f58014db987421edf0110b1d18b8360c03e504cf2df3580f699a183b06a`、展開 SHA `19fa663c7acd385cb1b7e2b92b1696b9c564414a4204fbad43dc0a7940d7fd63`。この source を実アプリで評価した結果は、この3枚から推定しない。
