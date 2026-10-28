# 制作方法調査の検証記録

2026-10-22 JST。対象はこのフォルダの研究記録と比較ページ。製品コード・モデル・前の試作・本人保存は変更しない。

- 基準画像：`../2026-10-10-island-final-3d/whole-island-render.png`。
- 現状画像：`../2026-10-21-cove-mechanism-v2/evidence-final/390-E2-near.png` と `contact-sheet-390-overview.png`。候補v2、revision `2c62b411e3278989`、配布 `standalone-study-only`。
- 公開コード確認：`sketchpunklabs/irregular_grid` commit `40014e3030b0b79cb2806ef7d32eb6700fe16a26`。読み取りのみ。新しい依存の追加・公開コードの実行なし。
- ChatGPT：ぽこもこプロジェクト「土地拡張案を比較」で2往復。送信メッセージの表示と回答完了をUIで確認。
- 読合せ：前回の美術HOLDを保持。高さ場の限界と初期形状の問題、生成失敗と通行不能、事実と仮説、現状画像と未制作候補を区別。

## 実施結果

2026-10-22 01:37–01:39 JST。対象ファイル・参照画像のSHA-256と参照先検査は [inputs.json](inputs.json)。研究ページ用の入力記録であり、製品の配布証拠ではない。

| 検査 | 期待 | 実結果 |
| --- | --- | --- |
| `fnm exec --using=22.23.3 npm run docs:check` | 文書の整合検査が終了コード0 | PASS。既存タスク等のReview By/棚卸し期限超過14件のWARNは残る。[生ログ](docs-check.txt) |
| `git diff --check -- docs/design/2026-10-22-making-methods docs/tasks/active/2026-09-27-living-fantasy-first-playable.md` | 追跡対象の差分に空白エラーなし | 終了コード0。未追跡ファイルの内容をこのコマンドが検証するという意味ではない |
| Python `HTMLParser` / `Path.is_file` | HTMLのローカル参照と切り替え先の画像が存在する | PASS、4参照。画像・研究記録・タスク記録のhashを保存 |
| CUA / IAB、`http://127.0.0.1:5281/docs/design/2026-10-22-making-methods/index.html` | 目標画像を表示し、既存近景と6コマを切り替えられる | 実表示と6コマへの切り替え、近景への復帰、画像・選択状態の変更を画面/AXで確認。確認窓は約626×757。全端末対応の試験ではない |

未検証は新方式の実画面・実操作・速度・制作負担、Cと不規則格子の効果、児童理解、本体適用。製品コードを変えていないため、本体のlint/型/ユニット/E2E/buildはこの作業では再実行していない。文書検査のPASSを美術や遊びの合格へ読み替えない。
