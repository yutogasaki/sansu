# 庭小屋・花壇・街灯の軽量化と試験配置

2026-09-18。追加Meshy生成・クレジット消費なし。生成済み3点を既存の木・岩・ベンチと同じ試験用の島へ配置した。

- 対象: `http://127.0.0.1:5243/prototypes/asset-lab/?set=garden`
- 候補: `island-asset-lab-garden-v1`、delivery: `dev-asset-lab`
- ソース版: [provenance.json](provenance.json) のファイルSHAと [report.json](report.json) のgit revision。dirty checkoutのローカルDEV検証であり、本番build/公開の証拠ではない。
- [同じカメラでの2K／配信用比較](comparison.jpg)・[390px全景](390-runtime-all.png)・[768px全景](768-runtime-all.png)

## 容量と形状

| 素材 | 元2K GLB | 配信用近景 | 近景三角形 | 遠景三角形 |
|---|---:|---:|---:|---:|
| 庭小屋 | 9.46 MB | 1.98 MB | 11,401 | 4,055 |
| 花壇 | 10.06 MB | 1.92 MB | 8,353 | 5,461 |
| 街灯 | 8.97 MB | 1.76 MB | 6,099 | 1,569 |

追加3点は28,491,424→5,668,084 bytes、80.1%削減。遠景形状も含めると6,310,784 bytes。既存3点を含む6種の近景GLB合計は10,584,992 bytes。これはGLBの容量で、JS・デコーダー・ゲーム全体の転送量やGPUメモリではない。

Blenderで1K化し、既存工程でbaseColor 1024、normal/metallicRoughness 512、UASTC level 2/RDO .5/Zstd 18へ圧縮。近景のgeometry・UV・normal accessorは変更前と一致。raw/finalは変更せず、各素材の `optimized/` と `runtime/` へ別保存。

遠景はUV・法線を考慮したmeshoptimizer簡略化。花壇は花びら・UV境界が多く、誤差制限内では5,461三角形に留まる。遠景ファイルは生成・構造検証までで、このラボは近景のみを表示し、実ゲームでのLOD切替採用は未実施。

## 見た目・操作

通常距離では圧縮による目立つ形や色の変化は見られない。拡大では木目・石の微細な質感が柔らかくなるが、屋根、扉、花びら、支柱の主要な形は保持。既存素材との色のまとまりは保たれている。最初の配置では花壇が住人に隠れたため、手前へ移して比較可能にした。初回証拠はローカルの `output/playwright/garden-runtime/`、修正後は `output/playwright/garden-runtime-v2/`。

庭小屋の中央扉は現行Life施設の入口と異なるため、施設置換・住人利用・購入・保存には接続していない。花壇は背面が薄く、街灯は発光未設定。今回は素材表示の候補確認であり、本番の完成判定ではない。

## 検証

- `npm run verify:core`: PASS（431 files / 4,063 tests、docs/lint/typecheck/build/assets check）。本番precacheへ新GLBは追加されない。
- `ASSET_LAB_SET=garden ASSET_LAB_OUTPUT=output/playwright/garden-runtime-v2 node tools/e2e-asset-lab.mjs`: PASS。390×844・768×1024、2K／圧縮版、全景＋各3素材の拡大、読込失敗・再試行・reload・横はみ出しなし・reduced motion。page/WebGLエラー0。
- 初回読込で圧縮GLB6件のみ取得し、2Kが先読みされないことを確認。通常版と圧縮版は同じ描画三角形数・draw calls。
- パイプラインPythonテスト10件PASS。
- `npm run e2e:smoke`: PASS。最終lintはerror 0（既存Fast Refresh warning 1）。既存3種のbenchmark/stress/runtime比較ハーネスも、共通ラボのimport変更に追従し、それぞれのbuildが成功。過去の性能計測を再実行したという意味ではない。
- 実機FPS、利用者の理解、住人との利用整合、学習throughputは測定対象外。PCブラウザーの幅変更をスマホ実機検証としない。表示CPU時間やwarm-cache読込時間を性能改善率として使わない。

視覚: 試験配置の候補として良好。無文字理解/安全: 未観察（N=0）。runtime: ラボ範囲PASS、ゲーム設備への採用は未検証。

## 再利用

`npm run dev:asset-lab` の後に上記URLを開く。追加素材の圧縮は `node tools/asset-pipeline/build-runtime.mjs garden-hut flowerbed streetlamp`。既存のKTX/Node依存環境は [制作runbook](../../runbooks/3d-asset-pipeline.md) を参照。

配信用ファイルは `assets/island-garden-hut-v1/runtime/near.glb`、`assets/island-flowerbed-v1/runtime/near.glb`、`assets/island-streetlamp-v1/runtime/near.glb`。同じ場所の `far-geometry.glb` は近景のmaterial/textureを共有して使う。
