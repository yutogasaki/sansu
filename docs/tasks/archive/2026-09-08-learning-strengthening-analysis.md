# 忘却・復習・レベル分けの学習強化分析

- Review By: 2026-09-15
- 状態: 2026-09-08分析完了。改善案は未実装。
- 目的: 現行の復習間隔、再学習、昇格、単元証拠の問題点を研究と照合し、改善順と測定方法を整理する。
- 範囲: 読み取り監査・決定的な診断・研究整理。通常の出題、保存、判定のコードは変更しない。
- 正本: [仕様29](../../product/29_learning_progression_spec.md)、[仕様31](../../product/31_learning_units_spec.md)。提案は採用済み仕様と区別する。

## Docs To Touch

- `docs/wiki/learning-strengthening-analysis.md`
- `docs/wiki/index.md`
- `docs/done/2026-09.md`、`.agents/tasks/DONE.md`、`.agents/tasks/TASKS.md`

## Verification

コード行・一次研究5件への参照を照合し、合成診断を実学習者の分析として扱わない。`npm run learning:report`は対応エラー0/7ケース、維持誤答のfake DB診断とLv11の5つの純関数診断を再現した。対象10ソースのhashは最終照合まで一致。関連31テスト、`docs:check`、`git diff --check`はPASS。最初のtask見出し不足は修正した。他の作業者のUI・音・島の差分を保持した。

## 成果

[分析本文](../../wiki/learning-strengthening-analysis.md)に、卒業後の誤答のDue復帰、訂正と初回独力、レベル単位の偏り、過去の確認と現在の再確認、直前の関連練習、復習予算、間隔調整の順序を記録した。再現スクリプト・入力・結果・hashは`output/learning-strengthening/`。runtime変更・公開・実プロフィール分析は行っていない。
