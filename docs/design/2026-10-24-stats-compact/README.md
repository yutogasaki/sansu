# 記録の通常表示を短くする

期間・合計・日付ごとの問題数を残し、重複見出し・説明文・各行の年を削除。科目と時刻は日付を開いたとき、集計条件は「内訳・数え方」を開いたときに表示する。保存・集計処理は変更しない。正本は[画面仕様06](../../product/06_screen_specs.md)。

## 検証

2026-10-24、[UI report](ui-report.json)の入力SHA・時刻・DEV設定で実行。隔離fixtureで、[320幅](320x568-compact.png)、[390幅](390x844-compact.png)、[横画面](568x320-compact.png)、[タブレット](768x1024-compact.png)の4サイズPASS。[日付展開](390x844-daily.png)も確認。7/30日切替、問題数・日数、0問、スキップ、深夜の実時刻、48px操作、横溢れなし、reload、保存ログ不変を確認。公開版・実機・児童の理解は未確認。

- 対象TSXのESLint、作業ツリーtypecheck：PASS。
- statsとStatsCloseActionのVitest：4ファイル13件PASS。
- 独立したindex候補のtypecheck/build：PASS（precache 8.83MiB/12MiB）。UI reportの全source SHAと候補の変更入力がstageと一致。新規export先でdocs:check：PASS、index不変を確認。最終ログはローカルの `output/playwright/stats-compact-final` へ保持。
- 全体検査とsmokeは[直前の日別実装の結果](../2026-10-24-stats-daily/README.md)を保持。今回の文章・開閉表示の変更に対し巨大3D検査は再実行していない。前回smokeは探索tabletの既存入力不安定で31/32、公開合格とは扱わない。

集計条件を消さず折りたたみ、空の日を評価せず0問で示す。親仕様・保存仕様・学習ロジック・運用手順の変更は不要。別作業の島・portal変更は含めない。
