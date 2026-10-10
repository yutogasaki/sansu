# 育った島全体の完成目標 — 実3D美術1案

2026-10-10 / candidate `whole-island-native-3d-05` / GLB `8398eda9ac084a6e`。利用者の「実際につくる」「最終ゴールの美術3D」「例を1つ」を制作契約とし、島全体をBlenderで造形した。成果物は編集可能なBlender、内包texture付きGLB、同じ実モデルのレンダーと回転表示。画像生成は追加していない。

## バラエティを、空間の成り立ちから変える

native-01は幻想性不足、native-03の拡張案も「バラエティ豊かじゃない」「幻想的感がやや単調」と指摘された。面積や樹種を増やすだけでは、丸い樹冠と同型の家の繰り返しが残った。実際に提示した[旧稿](history/native-03/STATUS.md)を保存し、native-04では三地区の大きな形と素材を作り替えた。

native-04にも「幻想的が白いだけにみえる」と指摘された。[白い前版の実物](history/native-04/STATUS.md)を保存し、native-05は昼でも残る色と素材へ改訂する。大樹は青紫から翡翠へ変わる葉と琥珀色の幹、水庭は鉱石の空洞から出る青い泉、入り江は青/紫を透かす殻。同じ白いパステルに照明だけを足す制作を採用基準にしない。

| 場所 | 実際に造形した空間 | 遠景と近景の差 |
|---|---|---|
| 森 | 幹をくり抜いた住まい、枝が支える回廊と螺旋階段、青紫/翡翠の幅広い葉 | 葉の広がりと幹の空洞。中へ入る形と、回り込んだ側面が見える |
| 丘 | 鉱石の空洞を源に、地面に彫り込んだ三段の青い泉、連続した水の面と滝、庭をたどる道 | 紫の鉱石、厚い石の段、薄く深さの色を持つ水が連続する |
| 入り江 | 曲がった梁と青/紫を透かす貝殻状の屋根が囲む共同の庭 | 開いた入口、透過する薄い殻、屋根の下の居場所。独立した小屋や花の屋根と違う構造 |
| 新しい家 | 丸い傘状の屋根の家、二枚の葉が包む家、従来の家と長い共同住宅 | 同じ家の色替えに加えて、幅・輪郭・屋根の成り立ちが変わる |

元の庭から、その先の森・丘・水辺へ一続きに広がる**一つの成熟例**。native-02の元の8軒は位置と寸法を維持し、既存の相棒のメッシュ/顔/頭身/UV/布atlasをそのまま使う。模型には15軒あるが、戸数・面積・配置はゲームの上限や合体レシピではない。

参照の役割と観察範囲は[美術戦略](../../product/island-art-strategy.md)と[32枚のショーケース](../2026-10-10-island-design-strategy/index.html)に残した。参考作品から借りるのは地形・水・植物・暮らせる場所の関係。空洞の大樹、水庭、貝殻の集会所はSansuの造形提案であり、競合作品のモデルや固有ランドマークは使っていない。

## 見る・編集する

- [全島3Dビューアー](index.html)：島全体/森/水の庭/入り江/花の庭、昼/夕、回転と拡大。同じ視点と世界縮尺でnative-02へ切り替えられる。
- [編集用Blender](whole-island.blend)：7 collection、編集可能な曲線と厚み、実際の空洞/水の段/殻。元の布textureを内包。
- [ポータブルGLB](whole-island.glb)：実際の3D形状と材質、葉と水の頂点色、殻の透過材質、布2 textureを内包。
- [実3Dの全景レンダー](whole-island-render.png)：Blender 5.2.1 LTS / Cycles、1600×1200。

ローカル表示：`http://127.0.0.1:8230/design/2026-10-10-island-final-3d/`。

![同じ実モデルから描画した育った島全体](whole-island-render.png)

昼の形と素材の差を先に確認し、夕方の灯りは同じモデルへ与える。比較の前版は[保存済みnative-02](history/native-02/README.md)。表示の切り替えで島を拡大縮小せず、元の家の寸法とカメラをそろえて土地の広がりを見る。両モデルの海の表示範囲は同じ外周まで続け、海planeの端が比較へ紛れないようにする。

## 検証と採用の状態

[確認記録](verification.md)に、保存済みnativeの再読込、GLB/透過材質、元の家、布、実表示、操作、4幅、同じカメラの比較を記録した。証拠は[native-check.json](native-check.json)、[artifact-check.json](artifact-check.json)、[viewer-check.json](viewer-check.json)。実表示のcontact sheetは全てnative-05で、成長比較にだけ明示したnative-02を使う。元の8軒と住人221部品の頂点位置、住人のUV/布は一致を確認済み。

利用者「いい感じ。これをもとに、目標や組み合わせとか。ゴール戦略や仕組みに落として」を受け、native-05を美術の到達方向として採用。[判断の記録](art-decision.json)と[目標/組み合わせの設計](../../product/island-place-goals.md)へ接続した。完了単位は全島3D美術1案で、その採用を全ゲームの受入へ広げない。自然な取得、隣接/分離による成長、所有・歩行・学習・保存/PWA、子どもの独立した理解/安全、実端末性能は今後のゲーム統合で検証する。

## 再制作の入口

現在の再制作は `build-final-scene.py`。実際に提示した `history/native-04/whole-island.blend` を明示的な入力として開き、`fantasy-colour-world.py` で色/材質、水面、泉の空洞を造形する。入力のSHA256をmanifestへ保存する。`build-scene.py`、`fantasy-landscape.py`、`varied-world.py` からは関数と材質定義だけを読み、旧全島の生成処理を実行しない。native-04の三地区の制作sourceは同じ履歴へ保存している。中断したnative-03の試行sourceは現在の入力モデルの再現sourceとして扱わない。

repo rootから実行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python docs/design/2026-10-10-island-final-3d/build-final-scene.py
```

制作後は `viewer.js` の `MODEL_REVISION` にGLBのSHA256先頭16桁を入れ、表示bundleと実captureを同じ版へ更新する。

実capture後、`make-review-sheets.py` が撮影画像の構図と色を変えずに並べ、候補ID付きの確認シートを作る。画像を撮り直す前に検証JSONだけを新しい候補へ書き換えない。

```sh
node_modules/.bin/esbuild docs/design/2026-10-10-island-final-3d/viewer.js --bundle --format=esm --minify --outfile=docs/design/2026-10-10-island-final-3d/viewer.bundle.js
/Applications/Blender.app/Contents/MacOS/Blender --background docs/design/2026-10-10-island-final-3d/whole-island.blend --python-exit-code 1 --python docs/design/2026-10-10-island-final-3d/check-native.py
node docs/design/2026-10-10-island-final-3d/check-artifact.mjs
```

通常の資料サーバーで表示できる。`vite.config.mjs` はこの独立資料のdev/build用。実ゲームのroute・PWA・asset予算・配信flagを使ったリリースではない。
