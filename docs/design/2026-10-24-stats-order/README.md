# つぎへの道をカレンダーの上へ

記録の順番を「つぎへの道 → 期間合計・カレンダー → 英語基礎」に変更。操作・集計・保存は変更しない。正本は[親仕様](../../product/01_app_spec.md)と[画面仕様06](../../product/06_screen_specs.md)。

2026-10-24：[画面](390x844.png)と[UI report](ui-report.json)。隔離fixture、音なし、reduced motionで320/390/568横/768幅の4サイズPASS。先頭がつぎへの道、その直下がカレンダー、日付の選択・7/30日・年またぎ・時刻・reload・ログ不変を確認。対象ESLint、typecheck：PASS。独立index候補のbuild（型検査を含む）と新規export先のdocs:check：PASS。index不変・変更入力とUI source SHAの一致を確認。ログはローカル `output/playwright/stats-order-final` に保持。公開版・実機・児童の理解は未確認。

順番だけの変更のため、集計と巨大3Dの単体検査は再実行せず、[カレンダー実装の結果](../2026-10-24-stats-calendar/README.md)を保持。別作業の変更を含めない。
