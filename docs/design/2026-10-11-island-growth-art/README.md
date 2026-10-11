# 同じ島が育つ — 全島3D美術

2026-10-11。利用者「美術やって」を受け、採用済みの `whole-island-native-3d-05` から、小さな島・育ち途中・成熟の全島3Dを制作した。画像生成は使わず、地形、水路、大樹、若い花、開いた貝を実際のメッシュと編集可能な曲線で造形した。

同日追補：「続けて」に対し、[原本の部品を本人の所有と実床へ接続](../2026-10-11-native-owned-island/README.md)した。本書の固定build・60画面・所有不変は制作段階Aの美術確認の記録で、後続の本人島の検証へ流用しない。深い入り江と高い段泉を含む全地形への対応は、後続でも残る大きな課題として記録する。

[実アプリで見回す](http://127.0.0.1:5198/?islandArt=native05&artStage=young#/island) · [全島の比較ページ](index.html) · [実画面の経路](critical-path.html)

## 何が育つか

| 段階 | 実際に作った風景 | 編集可能な原本 | 表示モデル |
|---|---|---|---|
| 小さな島 | 低い丘、若い扇葉の樹、一つの鉱石の泉、森の小道、小さな入り江 | [small-island.blend](small-island.blend) | [small-island.glb](small-island.glb) |
| 育ち途中 | 広がる岸と丘、空洞と枝の回廊を持つ大樹、二つの泉、下る水路、若い花の枝、開いた貝の居場所 | [young-island.blend](young-island.blend) | [young-island.glb](young-island.glb) |
| 育った島 | 採用済みの完成景。青紫の大樹、鉱石の水源と三段泉、深い入り江、色を透かす貝の集会所、花の屋根と集落 | [成熟原本](../2026-10-10-island-final-3d/whole-island.blend) | [成熟GLB](../2026-10-10-island-final-3d/whole-island.glb) |

全景は三段階とも `position=[39,43,46] / target=[3,3.2,-6.3] / span=46`。家の寸法、元の住人の形と布、大樹・泉・貝の基準位置を維持する。家を小さくして広がって見せる比較にはしない。模型上の家は3軒→9軒→15軒で、本人の所有や人口の値ではない。

若い二段階は同じ完成地形から起伏を下げ、別の滑らかな海岸線を造形した。岸に合わせて海の浅さを着色し直した。泉は器と水面を分け、川床を下降する水に合わせて掘った。若木の根、花の幹と枝が樹冠を支持する。育ち途中の貝は成熟と同じ位置にある。

初稿で見つけた支持のない花弁、上り方向の水路を修正。近景で残った地面の筋状の陰影は、地形の分割を細かくし、三角形の縦横比に依存しない高さの傾きから法線を作って修正した。続いて、若い岸が原本の入り江を埋める部分で高さを急に平らな値へ戻していた不連続を、原本の起伏を延長して修正した。若い地面は幹・樹冠・岸の影を受け、細かい面による自己shadowの点状崩れを防ぐ。成熟原本の描画は維持する。修正前の実画面は [A1](diagnostics/verification-a1-shadow/report.json)、[A2](diagnostics/verification-a2-shore/report.json)。A2の編集可能な模型とmanifestも保存した。修正確認は [実アプリ768幅の岸](diagnostics/dev-shore-fixed-768.png) と [水辺](diagnostics/dev-shadow-fixed-768.png)。

## 本体とゲームの境界

本体の明示した美術確認へ三段階のGLBを接続した。全景・森・段泉・入り江・花の庭、昼夕、拡大と見回しを確認できる。模型を切り替えても、本人の配置・贈り物・記念・育成時計・学習は切り替えない。「いまの島へ」で通常の島へ戻る。

DEV、または `VITE_ISLAND_ENABLED=true VITE_ISLAND_ART_STUDY=true` の専用buildで `?islandArt=native05` を明示した場合だけ表示する。`artStage=small|young|grown` で初期表示を指定できる。通常配布buildからは三段階の大きなGLBと美術確認モジュールを除く。

今回は全島の成長美術と本体での表示が完了単位。地形・道・幹の空洞は実造形だが、ゲームの通行判定、住人の足、本人の所有部品、任意の配置と成熟への対応付けは未接続。従来v3の所有島は `HOLD_USER_REJECTED_NATIVE05_GAP` を維持する。全島GLBを固定背景に置いたことをゲーム完成とは扱わない。

次の実装では、この地形と部品を分解し、表示の床と実際に立つ床、入口と通行、所有IDと成長段階を一致させる。[制作順の契約](../../product/island-construction-strategy.md) と [美術戦略](../../product/island-art-strategy.md) に沿う。

## 原本と制作の整合

- mature原本のBlender/GLBは変更しない。GLB SHA256は `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。
- 新しい候補は `native05-growth-art-v3-small` / `native05-growth-art-v3-young`。各モデルのSHA、実メッシュ数、三角形数、泉の高さ、川の下降点、場所の位置は [art-manifest.json](art-manifest.json)。
- [artifact-check.json](artifact-check.json) で家と住人の頂点・法線・回転・尺度、住人のUVと埋め込み布画像のbytesを照合する。元の未使用の家UVには再export時のFloat32丸めがあり、最大差 `5.960464477539063e-8` を明記する。
- 表示時は取得したGLBのSHA256を照合してから読み込む。原本80材質の描画、海の反射、色を残した透過、布を使い、段階を変えると前の描画資源を破棄する。
- 再制作は公式Blenderで `build-growth-art.py`。完成原本を開いて派生を作り、原本が変わっていないことを確認する。出力モデルは一時ファイルから原子的に置き換える。

## 最終検証

対象は `http://127.0.0.1:5292` の固定した本体build。revisionは `native05-growth-art-a3`、versionは `native05-growth-art-a3:3d3d0889-5a9b-4c8a-977c-a65e7764c77e`。島と美術確認のflagを有効にし、実画面の候補と取得したGLBのSHAを確認した。成熟表示は `native-05-art-transfer-v1`、若い二段階は上記のv3候補。

| 検査 | 結果と証拠 |
|---|---|
| 基本検査 | `verify:core` PASS。564 files / 4,966 tests、docs・入口・lint・typecheck・build・assets。既存の `IslandMilestone.tsx` Fast Refresh警告1件は残る。[ログ](verification-logs/sansu-growth-core-03.txt) |
| 原本分類と形の整合 | 原本30部品/3,690 meshes/80材質のbuffer・transform照合PASS。新段階の家/住人/布・泉の下降・場所の位置は [artifact-check.json](artifact-check.json) PASS |
| 固定buildの美術表示 | 390×844 / 768×1024、三段階×五視点×昼夕の60画面、成熟原本との同camera比較10組、所有不変、通常の島/学習へ帰還、44px controlsとclipping、拡大/keyboard、1 canvas、読み込み失敗と実context lossからの再試行PASS。[72 capture entries / 88 raw PNGと実行記録](verification/report.json) |
| 描画の比較 | [全島三段階](verification/growth-comparison.png)、[スマホ小](verification/390-small-contact.png)・[途中](verification/390-young-contact.png)・[成熟](verification/390-grown-contact.png)、[タブレット小](verification/768-small-contact.png)・[途中](verification/768-young-contact.png)・[成熟](verification/768-grown-contact.png)。実画面だけを並べ、元の全画面は保持する |
| 現在のsourceとの対応 | 固定buildの検査後、通常smokeの終了後も1,577 source/モデル/設定ファイルのhash一致。[source-correspondence.json](source-correspondence.json) |
| 通常配布の境界 | 美術確認はfalse、三段階のGLBと美術確認chunkが通常distにないことを確認。precache 8.19 MiB / 12 MiB。[normal-build-boundary.json](normal-build-boundary.json) |
| 通常経路smoke | **31/32 PASS、既存の検査側不足1件。** `retries the same explore attempt after a save failure` で、未変更の `getExploreNumericAnswer` が `1, 2, □, 4, 5` の数列問題に対応せず、回答操作前に失敗した。学習/問題生成やclassic表示はこの美術作業で変更していない。美術の60画面の検査は別にPASS。smoke全体をPASSとはしない。[失敗を含む全32経路](diagnostics/smoke-final/smoke-report.json)・[ログ](verification-logs/sansu-growth-smoke-01.txt) |

完成した範囲は編集可能な全島の成長美術と本体内の明示した表示。[別々の受入判定](gate-review.json) は、作者が造形/素材/全景と近景を確認、新しい二段階の利用者採用は未確認、独立した子どもの理解/安全はN=0、runtimeは美術確認の範囲でPASSと記録する。headlessの一部近景にはごく細かな地形の線が残り、元の高解像度画像を保持する。実GPUの表示では大きな縞と岸の破断を修正確認した。全ゲームの美術受入、所有/実床への接続、実機/公開、SW offlineのGOにはしない。

初稿A1/A2の技術PASSと修正前の画面はdiagnosticsに保持した。最終版の証拠へ流用せず、新しい固定版を取り直している。実行ログは [verification-logs](verification-logs/)。通常経路の既存失敗を理由に、今回の美術と無関係な学習ロジックや検査helperを変更していない。

## 文書の接続

全島の大形から成長段階を作る順番と、画像ではなく実造形を基準にする判断を、美術戦略・構築戦略・文書入口・進行中の美術タスクへ反映した。検証matrixには三段階/60画面/実取得SHA/通常配布の除外を追加した。保存や学習の契約は変更せず、所有と実床への統合は親タスクの次工程として残す。
