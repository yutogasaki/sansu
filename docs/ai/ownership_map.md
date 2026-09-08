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
| 家の一角に飾る本人の学習成果 | [product/42_island_learning_keepsakes_spec.md](/docs/product/42_island_learning_keepsakes_spec.md) | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md), [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md) | 完了区間由来の資格、複数展示/収納、実家と家内視点の連続性、実記録の詳細、既存アルバム/通知への入口、旧snapshot/写真保持が変わるとき |
| 島の追加身支度・観察記念・朝夕と季節 | [product/41_island_expression_collection_spec.md](/docs/product/41_island_expression_collection_spec.md) | [product/36_island_experience_spec.md](/docs/product/36_island_experience_spec.md), [product/39_island_appearance_sets_spec.md](/docs/product/39_island_appearance_sets_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | 取得と装備、無料設定への復帰、観察資格、全景v2、有限足跡/音、旧snapshot/写真の互換が変わるとき |
| 島のポイント・テーマ・飾りの交換 | [product/35_island_customization_spec.md](/docs/product/35_island_customization_spec.md) | [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md), [product/28_mystic_island_spec.md](/docs/product/28_mystic_island_spec.md) | 獲得・選択交換・目標・実景プレビュー・所持と外見の保存が変わるとき |
| 島のカテゴリをまたぐ「ほしいもの」 | [product/35_island_customization_spec.md](/docs/product/35_island_customization_spec.md) | [product/40_island_life_furniture_spec.md](/docs/product/40_island_life_furniture_spec.md), [product/41_island_expression_collection_spec.md](/docs/product/41_island_expression_collection_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | 外見/家具/身支度で1件の無料目標、資格表示、旧field/receipt互換、対象取得時の原子的な解除が変わるとき |
| 島の発見・実験・個性・景色の記録 | [product/36_island_experience_spec.md](/docs/product/36_island_experience_spec.md) | [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md), [product/35_island_customization_spec.md](/docs/product/35_island_customization_spec.md) | 未発見案内・実条件と実演・来訪・成長予告・名前/旗/衣装/音・配置保存/写真が変わるとき |
| 島の道具・標本・部品制作と接続 | [product/37_island_workshop_spec.md](/docs/product/37_island_workshop_spec.md) | [product/36_island_experience_spec.md](/docs/product/36_island_experience_spec.md), [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md) | 入江の直接操作・標本観察・素材の組立・水/軸の接続・実演・住民利用・試作/undo/作品保存が変わるとき |
| 島の共同記憶・主島展示・写真保存 | [product/38_island_shared_memories_spec.md](/docs/product/38_island_shared_memories_spec.md) | [product/37_island_workshop_spec.md](/docs/product/37_island_workshop_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | 得意仕事・可視結果の記憶・展示snapshot・再訪・写真Blob/album CAS・profile削除・v8 migrationが変わるとき |
| 島の個別外見・セット・全景保存 | [product/39_island_appearance_sets_spec.md](/docs/product/39_island_appearance_sets_spec.md) | [product/35_island_customization_spec.md](/docs/product/35_island_customization_spec.md), [product/36_island_experience_spec.md](/docs/product/36_island_experience_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | 6部位の利用権/価格、12slotの外見/成長/旧snapshot、未所持分交換、既存3枠の装い/音/旗保存が変わるとき |
| 島の任意家具・取得後の暮らし | [product/40_island_life_furniture_spec.md](/docs/product/40_island_life_furniture_spec.md) | [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md), [product/35_island_customization_spec.md](/docs/product/35_island_customization_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | 購入専用家具の所有/価格/収納、旧基本報酬との分離、試用/選んだ住民の実接点/利用/再配置が変わるとき |
| 独力進行・再学習・実時間復習・単元別出題 | [product/34_learning_reinforcement_spec.md](/docs/product/34_learning_reinforcement_spec.md) | [product/29_learning_progression_spec.md](/docs/product/29_learning_progression_spec.md), [product/31_learning_units_spec.md](/docs/product/31_learning_units_spec.md) | 独力証拠の集計、卒業後の期限、単元coverage、復習予算が変わるとき |
| 学習単元・習得証拠と比較試作 | [product/31_learning_units_spec.md](/docs/product/31_learning_units_spec.md) | [product/32_math_unit_catalog.md](/docs/product/32_math_unit_catalog.md), [product/33_english_unit_catalog.md](/docs/product/33_english_unit_catalog.md) | 単元の境界、前提、表現別の証拠、新旧判定の比較範囲が変わるとき |
| 不思議な島・連問と暮らし | [product/28_mystic_island_spec.md](/docs/product/28_mystic_island_spec.md) | [product/01_app_spec.md](/docs/product/01_app_spec.md) | 島のループ、配置、報酬、学習区間、保存・導入が変わるとき |
| 育つ島・アップグレードと発見 | [product/30_living_island_growth_spec.md](/docs/product/30_living_island_growth_spec.md) | [product/28_mystic_island_spec.md](/docs/product/28_mystic_island_spec.md), [product/01_app_spec.md](/docs/product/01_app_spec.md) | 自動成長、有限の所有物、任意編集、暮らし、拡張、履歴・発見、旧予約との互換性が変わるとき |
| プロダクトの挙動と約束 | [product/01_app_spec.md](/docs/product/01_app_spec.md) | `docs/product/` 配下の子仕様 | ユーザー向け挙動、ルール、画面の役割が変わるとき |
| 範囲限定の解答中ゲーム・ぴったり連鎖 | [product/27_gameplay_first_pittari_spec.md](/docs/product/27_gameplay_first_pittari_spec.md) | [product/01_app_spec.md](/docs/product/01_app_spec.md) | 対象範囲、数を選ぶ一手、連鎖、観察・学習評価の境界が変わるとき |
| 教科共通の制作・試遊ゲーム | [product/22_shared_subject_build_and_play_spec.md](/docs/product/22_shared_subject_build_and_play_spec.md) | [product/01_app_spec.md](/docs/product/01_app_spec.md), [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | `/park`、部品・配置、短い学習区間、支援、再演、保存、導入flagが変わるとき |
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
