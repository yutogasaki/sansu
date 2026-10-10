# 全島の実3D美術1案 — 確認記録

2026-10-10 / candidate `whole-island-native-3d-01` / delivery `standalone-art-viewer`。実ゲームのbuild/route/flagsではなく、編集用の3D模型と独立した表示。原画候補の採用や実ゲームreleaseを主張しない。実モデルの入力とSHA256は [artifact-check.json](artifact-check.json)。

| 検査 | 結果 | 範囲 |
|---|---|---|
| 保存済み.blendの実再読込 | PASS | Blender 5.2.1 LTS、7 collection、298 editable curve、8戸、packed布2 texture。builderのmemoryを見たものではない |
| GLB構造 | PASS | glTF2、1344 mesh、402,792 triangle、41 material、内包texture2。実モデルの家/接続枝/元の住人を確認 |
| 住人exporterのESLint | PASS | 対象のTSのみ |
| 表示bundle / 独立Vite build | PASS | esbuild、Vite7。専用資料のみ。既存Browserslist stale情報と634KBのbundle-size warningあり。ゲームのasset予算/性能合格ではない |
| 作者による全景/近景の目視 | 確認済み | 岸のcutout、水の接触、幹から育つ枝、住人の顔/足元、家の入口、橋、全景cropを確認。陰影/水decal/枝/道のsupportを修正 |
| ブラウザー操作 | PASS | 4つの視点、拡大/縮小、canvasの矢印回転、全景へ復帰。横overflowなし、ボタン44px以上、モデル読込済み、console errorなし |
| docs:check | PASS | 作業ツリーの文書整合。既存Review By警告12件は当タスク外 |
| 視覚の利用者採用 | 未承認 | 実物1案を示して調整する段階 |
| 無説明理解/安全、学習/保存/成長/PWA、実端末 | NOT_EVALUATED | 模型の操作検証で代替しない |

## 実3D表示のcapture

全captureの実targetは `http://127.0.0.1:8230/design/2026-10-10-island-final-3d/`。同梱bundleと同じGLBをstatic資料サーバーから実表示した。320幅も横overflowなし/読込/操作を確認。写真とsourceのSHA256はartifact-checkに固定した。

- [全景1440×1000](viewer-whole-desktop.png)
- [全景390×844](viewer-whole-phone.png)
- [回転後390×844](viewer-orbit-phone.png)
- [森へ拡大390×844](viewer-grove-phone.png)
- [全景768×1024](viewer-whole-tablet.png)
- [集落768×1024](viewer-village-tablet.png)
- [花の庭768×1024](viewer-garden-tablet.png)

全景は海の95×95 meshをauto-fitの対象にせず、島本体の形をfrustumへ収める。近景は対象の顔・家・枝を拡大する。全景と近景を同じGLBから表示する。ブラウザーresizeは実端末のtouch/pinch/FPSの測定ではない。

## 三つの独立した判断

視覚：明るさ/丸さ/接続した大形/集落と既存住人を作者が確認した実3D案。利用者の最終採用とベンチマーク越えの独立評価は未承認。

理解/安全：模型に説明なしの独立した子どもの観察を行っていない。配置→成熟→利用の因果の採用は次の同モデル状態列から確認する。

runtime：独立したGLB表示とネイティブ編集fileの整合のみPASS。ゲームの取得/保存/学習/入力/更新/経済/性能はこの作業の検査対象ではない。
