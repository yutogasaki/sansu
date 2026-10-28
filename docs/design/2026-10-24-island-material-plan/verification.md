# 資料の検証

対象：island-material-plan-v1 / 2026-10-24 JST。入力資料・メタデータの識別は [input-manifest.json](input-manifest.json)。製品source・保存・学習・配布は変更しない。

## 確認の範囲

- 全1,342行の行番号と重複・欠落を確認。プロンプト370件、欠落972件。画像の目視はScenario 18点＋既存6点。
- Scenario 18画像のSHA256は配布メタデータの preview_file.sha256 と全件一致。3Dモデル自体は取得していない。
- 全24参考の元画像を保存し、HTMLにも画像を埋め込んだ。画像の一覧表示に外部通信は不要。
- 表示検証：デスクトップ1440×1000とスマホ390×844。実画像の読込、全24件のカード、水辺の絞り込み2件、全件復帰、ページの横はみ出し、JSエラーを検査する。
- 初回はスマホ幅で長い出典パスが横へはみ出した。入力の折返しを修正して再検証。初回記録は [browser-check-first-overflow.json](browser-check-first-overflow.json) に保持。
- 実行環境：fnmでNode 22。Playwright CLIラッパーはnpmレジストリへのDNS失敗。既存Playwrightライブラリを使用した。初回Chromium起動はsandboxのmacOS Mach port拒否で失敗し、ローカル資料の表示確認に限って権限を上げて実行。

## 最終結果

- `fnm exec --using=22 npm run docs:check`：PASS。既存タスクの棚卸し／レビュー期限超過に関するWARNのみ。
- 1,342行の一意性・行番号0〜1,341の網羅、全24ローカル画像のmanifest SHA：PASS。
- [ブラウザ検査結果](browser-check.json)：全38個のimg要素（24原本の重複表示を含む）読込成功、参考カード24件、水辺2件→全件復帰成功。390幅のページ横はみ出しなし、JSエラーなし。
- [参考の見取り図](reference-overview.png)、[デスクトップ表示](desktop-review.png)、[スマホ表示](phone-review.png)を保存して目視確認。
- 資料HTMLは約2.6MB。原画像・台帳・表示証拠を含む新規フォルダは約10MB。埋め込み表示用画像のみ縮小・JPEG化し、配布元の原プレビューは無改変で保持。
- アプリsource変更がないためlint/typecheck/test/build/e2eは対象外。今回の資料検査をアプリや配布のPASSにはしない。

## 未確認

実モデルの背面・穴・UV・rig・容量、対象スマホの3D性能、通常製品への接続、子どもの理解・再訪。既存画像は保存済み資料で、新しいruntime captureではない。製品の美術・配布の合格は主張しない。

文書同期：本資料は既存方針に沿う提案・棚卸し。製品正本やADR、memoryの更新は不要。既存の未commit変更を保持し、このフォルダだけを追加する。commit/push/deployなし。
