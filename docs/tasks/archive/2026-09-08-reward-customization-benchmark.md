# 欲しくなる報酬・島の着せ替えの追加ベンチマーク

- Date: 2026-09-08
- Review By: 2026-09-09
- Status: Completed

## Goal

追加の調査対象を選び、ポイント獲得、スキン・景観・家具の交換、収集、自己表現を調査する。ユーザーの「本能にぶっさしたい」を、見た瞬間の欲しさ、集める楽しさ、愛着、創作、完成の満足に分解する。

## Docs To Touch

- `docs/wiki/reward-customization-benchmark.md`
- `docs/wiki/index.md`
- Shared queue and completion records

## Scope

公式資料による対象選定と比較、Sansuへの候補提案。稼げる通貨と有償通貨、確定交換と抽選、確認事実と体験仮説を区別する。製品仕様の採用決定・実装は含めない。

## Verification

`npm run docs:check`、出典・現行版・通貨条件の照合、独立レビュー。

## Progress

- 2026-09-08: 作品群を分担して公式資料を調査開始。
- 2026-09-08: [追加12作品の比較](../../wiki/reward-customization-benchmark.md)を作成。欲しくなる8つの入口、報酬16カテゴリ、実操作で調べる24項目とSansuへの候補を整理した。
- 3担当の独立レビューで通貨名、作品固有の呼称、マイデザインの直接出典を修正。過去告知・開発ブランチ・現行ヘルプを区別し、選択購入・抽選・課金経路を分離した。
- 12件の連続ID・出典・未確認事項、16カテゴリ・6段階各4問、ローカルリンク検査がPASS。文書変更のみで、アプリ実装・製品仕様の採用変更はない。
- 担当文書のdiff checkはPASS。`npm run docs:check`は中間確認でPASSしたが、最終確認では並行して作成された `docs/tasks/active/2026-09-08-adaptive-subject-sections.md` のReview By / Docs To Touch不足により全体FAIL。担当外の文書は変更せず、既存期限WARNも保持した。前回のlearning-feedbackタスクの必須欄不足は解消済み。
- 「欲しさ」は設計仮説。実操作・子どもの選択や再訪・学習効果を評価済みとは扱わず、観察する場面と行動を記録した。
