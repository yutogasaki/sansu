# ぽこもこの水玉背景

- Review By: 2026-09-15

## Goal / Scope

「紫というか、不思議な水玉バックグラウンド」「草間彌生みたいな？」というユーザーの方向修正を共通画面へ反映する。白い布地と大小の藍・青・ピンクの静止した水玉を使い、見出し・カード・問題・入力は無地で読めるようにする。

## Boundaries

前回の固定コピー `/tmp/sansu-pokomoko-world` を継続。背景・共通見た目と識別のみを変更し、他作業の学習/島/保存/画角を上書きしない。アイコン・正式名・ルーティング・学習動作は保持。以前の速度未達を今回の装飾変更だけで解消したとはしない。

## Docs To Touch

親01、UI07、島28、MASTER、実画面監査、月次done。

## Verification

固定コピーのlint/typecheck/tests/buildとphone/tablet実画面・往復・保存。背景は埋め込みSVGの円のみで、外部asset通信やanimation・input layerを追加しない。前回の26画面と比較し、runtime/見た目/無説明理解は別評価。公開なし。

## Progress

- 親01/UI07/島28/MASTERを先行更新し、白い布地と大小の藍・青・ピンクの水玉を実装。背景はCSS内の静止SVGで、読ませる面を無地に保つ。
- 固定production `pokomoko-dots-463508f-v2` / `pokomoko-dots-v1`、phone/tablet各13画面を確認。実学習から設定・記録・reload・学習復帰の保存整合、通常/縮小motion、44pxナビ、横溢れPASS。
- lint/typecheck/build/assets、194ファイル/2,232 tests PASS。担当8ファイルの開始時hashを照合して共有workspaceへ統合。公開先・他作業全体・実機の認定ではない。
- [実画面比較](../../design/audits/2026-09-08-pokomoko-dots/review.html) / [検証と範囲](../../design/audits/2026-09-08-pokomoko-dots/README.md)。作者の見た目確認は完了。子どもの独立観察N=0、旧速度未達は今回再検証なし。
- ローカル実装として完了。commit/push/deployなし。

- 統合先検査は別作業のsharedJobController.tsの型エラー3件とPWA更新taskの必須節不足でFAIL。固定コピーの検証と区別してログを保存。公開前に共有workspace全体の再確認が必要。
