# 日付ごとの記録をカレンダーにする

縦の一覧を、日〜土の7列カレンダーへ変更。各日には日付と問題数だけを表示し、回答のある日を共通の青色で示す。日付を選ぶと下に科目・スキップ・実際の回答時刻と結果を表示。0問の日も選択できる。期間外は空白とし、期間内の0問と区別する。7/30日切替で選択を解除する。集計・保存・学習条件は変更しない。

正本は[親仕様](../../product/01_app_spec.md)と[画面仕様06](../../product/06_screen_specs.md)。以前の[縦の一覧](../2026-10-24-stats-compact/README.md)は制作履歴として保持する。

## 検証

2026-10-24、隔離fixture・音なし・reduced motionで確認。[UI report](ui-report.json)はsource SHA・時刻・実URL・DEV設定を保持する。公開版、実機、児童の理解や再訪は未確認。

- [320幅](320x568-compact.png)、[390幅](390x844-compact.png)、[横画面](568x320-compact.png)、[タブレット](768x1024-month.png)：4サイズPASS。[30日表示](390x844-month.png)、[選択日の詳細](390x844-daily.png)。
- 7/30日・月またぎの曜日配置、年またぎ（2026年12月/2027年1月）、0問と期間外の区別、選択表示と解除、Enter/Space、スキップ別計上、深夜の実日付/時刻、横溢れなし、高さ64px、reload、保存ログ不変を確認。320幅では7列に幅を均等配分し、高さを確保する。
- 最初の表示検査で共通ボタンCSSによる48pxへの上書きを検出し、カレンダーの高さ64pxへ修正して全ケースを再実行。失敗記録はローカル `output/playwright/stats-calendar-02` に保持。
- 対象TSXのESLint、作業ツリーtypecheck、stats/StatsCloseActionの4ファイル13テスト：PASS。
- 独立index候補のtypecheck/build：PASS（precache 8.83MiB/12MiB）。全体lint：0 errors、既存prototypeの4 warnings。新規export先のdocs:check：PASS、index不変を確認。UI reportのsource SHAと候補の変更入力がstageと一致。ログはローカル `output/playwright/stats-calendar-final` に保持。Reactチェックリストで、選択状態の単一管理・安定key・期間切替でのreset・native buttonの名前/キーボード操作を確認。
- 全体・smokeの前回結果は[日別実装](../2026-10-24-stats-daily/README.md)に保持。今回、変更のない巨大3D検査や既存の探索tablet入力の不安定ケースを再実行していない。全体再実行PASSとは扱わない。

## レビュー

日付と問題数を主役にし、説明と科目は通常表示から外す。0問を赤くせず、選択は枠・aria-pressed、回答日は数値と色で示す。共通の紙面・青色・文字・フォーカスを再利用。保存書込・集計・SRS変更なし。親/画面仕様だけを更新し、保存仕様・運用手順・永続メモは変更不要。別作業の島/portal差分を含めない。
