# main統合候補の検証

2026-09-09、ユーザーの「コミットメインプッシュ」に対応。`origin/main` の `a2d2ddd` を基点とする独立worktreeへ、見出し/退出操作、家内履歴/保存復帰、写真/空報酬の変更を切り出した。先行mainの直接操作と家のアイコン/カードを保持。共有checkoutの別作業・ステージ済み削除は含めていない。

[実画面一覧](review.html)・[コンタクトシート](contact-sheet.png)。[親の実装記録](../README.md)、[家の実装記録](../../2026-09-09-house-edges/README.md)、[写真の実装記録](../../2026-09-09-photo-exits/README.md)は、それぞれ当時の共有checkoutの証拠。今回の独立候補と同じ配布物ではない。

## 対象と結果

固定production `http://127.0.0.1:5392`、version `a2d2ddd-ui-ux-integration:c78323b9-7226-4076-a0b5-1fbfdfb6b01f`、Island有効。delivery `mystic-island-v1`、visual `mystic-island-shore-garden-v18`、learning `mystic-island-learning-v2`、resident `patchwork-otter-v1`、art direction `moon-garden`。[source.json](source.json)にbuild入力と配布ファイルのSHA-256を保持する。

- lint / typecheck / build / assets通過。既存IslandMilestoneのFast Refresh warning 1件。precache 94件、10.53 MiB / 12 MiB。
- 全unit 329ファイル / 3,555件通過。最初の起動はmaxWorkersだけを指定してmin/max不整合となり、テスト未開始。`--minWorkers=1 --maxWorkers=4` で全件実行した。
- [写真](photo-report.json)：390×844 / 320×568 / 768×1024 / 844×390で実撮影・保存・家/元の棚への帰還、画像/棚の障害と再読込、削除取消/遅延完了/通常完了、不明写真、空報酬の退出を通過。
- [家](house-report.json)：同4サイズで履歴/再読込/学習復帰、実初回3問の賞状展示、保存abort/再確認、実SWオフライン再表示、入口/賞選択のフォーカス、操作全体の表示を通過。16品は明示aggregate fixture、文字拡大は別診断。
- [ナビ](navigation-report.json)：390×844 / 768×1024で入口/見出し一致、設定と下書き復帰、履歴、配置、実写真、記録更新を通過。
- [classic smoke](smoke-report.json)：独立worktreeのDEVで31項目すべて通過。上記productionのPWA二版更新とは別。

完全ログ・native保存dumpはローカル `/tmp/sansu-ui-ux-verify/` と `/tmp/sansu-ui-ux-*.log`。単体とbuildの入力をこの候補へ固定し、コミット対象のindexとsource hashを照合する。文書はindexをcheckout外へ書き出した検査でも確認する。

## 判定の範囲

- 視覚：同じ候補の実画面で退出・家・写真の連続性を確認。01はナビ用プロフィール、02/03は家の実初回学習、04/05は写真用プロフィール、06は別viewportの同じ手順。ひとりの学習履歴として扱わない。既存アートHOLDは解除しない。
- 無説明理解・安全：音off/reduced motionと操作/保存保持は技術確認。子どもの観察N=0。
- Runtime：上記の局所回帰は通過。実機・全島成熟・throughput・PWA二版更新・新ホームDEVの全経路は再検査していない。

この記録はGit main反映の検証であり、本番環境へ配布済みであることの確認には代用しない。
