# 島の素材制作バッチ — 完了報告

2026-09-17 JST。元画像3枚の生成、Meshy各1回、raw保存、Blender調整、final GLB、再インポート検証、比較ページと自動化の骨格まで完了。

| 素材 | クレジット | 生成時間（サーバー実測） | 三角形 | 高さ | 最終GLB bytes |
|---|---:|---:|---:|---:|---:|
| 木 | 30 | 176.337秒 | 12,390 | 4m | 8,528,084 |
| 岩 | 30 | 170.779秒 | 4,005 | 0.8m | 9,027,128 |
| ベンチ | 30 | 172.683秒 | 7,709 | 1m | 7,780,668 |

残高970→880、合計90。各Meshy 7 standard / PBR / 2K / GLB。追加生成・有料後処理・購入・自動リチャージなし。元画像はbuilt-in image_genで各1枚、前回の家をスタイル参照として制作。生成プロンプトは各source/prompt.txt。

## 保存

- 木: `assets/island-tree-v1/`
- 岩: `assets/island-rock-v1/`
- ベンチ: `assets/island-bench-v1/`

それぞれsource/input.png、meshy_raw/model.glb、final/model.glb、manifest.jsonを保存。rawにはtask ID・status・サーバー時刻・元テクスチャも保存。finalには正面・背面・側面・底面・再インポート画像、hash付き検証JSON、見た目のレビューを保存。

## Blenderで行ったこと

- 5.2.1 LTSで個別シーンへインポート。既存ユーザーシーン保持。
- 指定高さへの等比変換、底面中央原点、変換を頂点座標へ焼込み。
- 岩をZ軸で180度回転し、元画像と正面を合わせた。
- UV、カスタム法線、PBRを保持。不要な減面・再法線計算・穴埋めはしない。
- 家と同じく、選択物かつ現在シーンのみを書き出す。
- 新しく読み込んだ最終GLBと、書き出し前の同一照明レンダーを比較。

## 自動化の骨格

`tools/asset-pipeline/` に予算・状態管理Python、MCP実行器、Codex bridge、Blender processor、比較ページgenerator、テストを配置。`docs/runbooks/3d-asset-pipeline.md` に次回実行・再開・復旧手順。

予算の送信前予約、排他ロック、atomic/fsync保存、画像hash確認、タスクIDによる再開、送信結果不明時の停止、FAILED時の再生成禁止、既存素材の上書き防止を実装。完了済みバッチの再実行はローカル検証だけ。今後の新バッチの有料実行は新たな予算承認が必要。

## 検証

- Python credit/state tests: 9 PASS。
- Vitest orchestration tests: 4 PASS。
- 追加MJSのESLint: PASS。
- Python構文チェック、git diff --check: PASS。
- docs:check: PASS（既存のレビュー期限切れWARNのみ）。
- 3素材ともGLB構造、PBR、raw非変更、埋込みテクスチャhash、寸法、余分なnodeなし、再インポート: PASS。
- 再レンダー平均絶対差0–1: 木1.12e-7、岩2.57e-7、ベンチ5.67e-8。
- 保存済みbridge＋実行器で完成バッチを再実行: VERIFIED×3、追加生成なし。
- galleryの全画像・ダウンロード参照先: 存在確認PASS。

## 見た目と残る範囲

木の水玉、岩の苔、ベンチの配色と隙間は再現。元画像より細部と色は穏やか。木の裏面に水玉はなく、裏側は推定。見た目は素材候補として利用可能というagent reviewで、ユーザーの最終採用や独立した子どもの理解観察ではない。ゲーム組込み、実機性能、衝突判定、座席位置、LOD、配信圧縮は未実施。

接続addonはprotocol 5 / server 7の警告あり。既存のexecute_code経路で全工程は成功。exporterのpacked texture sampler警告は埋込み画像hash一致と再レンダーで今回の保持を確認。手順はこの環境のBlender/MCPで検証済みであり、将来のバージョン更新時にはpreflightをやり直す。

アプリ本体・学習・保存・PWA・公開には変更なし。product spec変更不要。制作ツールと素材の検証をゲームのrelease検証として扱わない。
