# 文書オーナーシップマップ

## 目的

このファイルは、主要な話題ごとの正本を対応付けるための案内です。
同じ内容が複数文書に見えるとき、実際にどこを直すべきかをここで判断します。

## 使い方

1. 変更した話題を見つける
2. まず正本を更新する
3. 補助文書は、参照先の案内や状態メモが必要なときだけ更新する

## 対応表

| 話題 | 正本 | 補助文書 | 更新するタイミング |
|---|---|---|---|
| プロダクトの挙動と約束 | [product/01_app_spec.md](/docs/product/01_app_spec.md) | `docs/product/` 配下の子仕様 | ユーザー向け挙動、ルール、画面の役割が変わるとき |
| 探索ゲームの目標体験・ゲームループ | [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md) | [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md), [product/17_open_questions.md](/docs/product/17_open_questions.md) | 掘る、進む、帰還、橋、発見、リソース、失敗設計が変わるとき |
| 探索と学習ロジックの接続 | [product/11_learning_integration_spec.md](/docs/product/11_learning_integration_spec.md) | [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md), [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) | 問題選択、正誤処理、SRS接続、科目範囲が変わるとき |
| 探索の画面・遷移 | [product/12_screen_flow_spec.md](/docs/product/12_screen_flow_spec.md) | [product/06_screen_specs.md](/docs/product/06_screen_specs.md), [product/01_app_spec.md](/docs/product/01_app_spec.md) | `/explore`、探検基地、発見・帰還画面、既存ルートとの関係が変わるとき |
| 探索データ・保存・移行 | [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | [runbooks/schema-migration.md](/docs/runbooks/schema-migration.md), [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | 探索状態、Dexie schema、ログ連携、中断再開が変わるとき |
| 探索の世界観・モーション・音 | [product/14_ui_world_motion_spec.md](/docs/product/14_ui_world_motion_spec.md) | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md), [product/design_review_checklist.md](/docs/product/design_review_checklist.md) | 探索固有の世界観、演出、音、相棒表現が変わるとき |
| 探索MVPの段階導入と成功判定 | [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) | [ai/implementation_plan_explore_mvp.md](/docs/ai/implementation_plan_explore_mvp.md), [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | MVP範囲、段階、観察項目、成功指標が変わるとき |
| 探索転換に伴う既存機能の扱い | [product/16_legacy_feature_decision.md](/docs/product/16_legacy_feature_decision.md) | [product/17_open_questions.md](/docs/product/17_open_questions.md), 各既存機能仕様 | 維持、変更、統合、廃止、保留の判断が変わるとき |
| 探索転換の未決事項 | [product/17_open_questions.md](/docs/product/17_open_questions.md) | 関連する探索子仕様 | 未決事項の選択肢・推奨を整理するとき。決定後は該当する正本へ反映する |
| 画面・ドメイン固有の詳細挙動 | `docs/product/` 配下の画面仕様またはドメイン仕様 | [product/01_app_spec.md](/docs/product/01_app_spec.md) | 画面フローやドメインルールの詳細が変わるとき |
| デザイン原則・トーン・トークン | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md) | [product/design_review_checklist.md](/docs/product/design_review_checklist.md), [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md) | 共通の見た目ルールやトーン指針が変わるとき |
| デザイン適用の進捗 | [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md) | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md) | 進捗、残作業、状態メモが変わるとき |
| 共有タスクキュー | `.agents/tasks/TASKS.md`, `.agents/tasks/BLOCKED.md`, `.agents/tasks/DONE.md` | `docs/tasks/active/*.md`, `docs/done/YYYY-MM.md` | agent 間で共有する task queue / blocked / done index が変わるとき |
| 進行中タスクの文脈 | [tasks/active/README.md](/docs/tasks/active/README.md) と `docs/tasks/active/*.md` | [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | 作業が現在進行中のとき |
| 完了済み作業の履歴 | `docs/done/YYYY-MM.md` | 進行中タスク文書、関連仕様 | 作業が終わり、履歴として残すとき |
| 複数タスクをまたぐ記憶 | [wiki/memory.md](/docs/wiki/memory.md) | [wiki/risk_register.md](/docs/wiki/risk_register.md), [wiki/glossary.md](/docs/wiki/glossary.md) | 判断や事実を長く残したいとき |
| AI 共同作業の境界と運用 | [ai/contributor-guide.md](/docs/ai/contributor-guide.md) | `AGENTS.md`, `CLAUDE.md`, `.agents/agent-guide.md`, `.agents/memory/durable.md` | shared AI workflow、境界、adapter ルールが変わるとき |
| 検証方針 | [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | 運用手順、タスク文書 | 必須確認やレビュー基準が変わるとき |
| リリース・保守手順 | `docs/runbooks/` 配下の各ファイル | [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | 運用手順やリリース上の注意点が変わるとき |
| 再発見コストの高い設計判断 | `docs/adr/` 配下の各ファイル | 仕様、運用手順、`docs/wiki/memory.md` | 重要な設計判断を残すとき |
| 全体バックログ | [tasks/backlog.md](/docs/tasks/backlog.md) | [tasks/ui-fix-tasklist.md](/docs/tasks/ui-fix-tasklist.md) | 優先アイデアや保留項目が変わるとき |
| ワークスペース用語 | [wiki/glossary.md](/docs/wiki/glossary.md) | アプリ用語は [product/01_app_spec.md](/docs/product/01_app_spec.md) | 文書運用や用語の定義が変わるとき |

## 迷ったときのルール

- 1つのファイルに状態メモとルールが混ざっていたら、ルール文書を正本にして状態文書は参照先だけ残す
- タスクメモが長期知識になり始めたら、残すべき部分を `docs/wiki/memory.md` か ADR に移す
- 完了ログから現行挙動を読み取っている状態なら、正本側を更新する

## 探索転換中の読み分け

- [product/01_app_spec.md](/docs/product/01_app_spec.md) は、探索転換を含む全体方針と段階導入を支配する親仕様とする
- `10`〜`16` は、承認済みの探索転換先について各領域を支配する子仕様とする
- 実装がMVP段階にある間は独立した `/explore` から始め、`15` の判断ゲートを通る前に既存導線を暗黙に置き換えない
- 子仕様が親仕様と衝突した場合は、`CONSTITUTION.md` → `01` → 該当子仕様の順で解決し、下位文書を整合させてから実装する
- `17_open_questions.md` は未決事項の一覧であり、推奨欄だけを確定仕様として実装しない
- [ai/implementation_plan_explore_mvp.md](/docs/ai/implementation_plan_explore_mvp.md) は実装順の案内であり、プロダクト仕様を上書きしない
