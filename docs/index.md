# Documentation Index

## Purpose

This file is the main entry point for repository documentation.
Use it to find the right source of truth before editing docs, tasks, runbooks, or agent-operational files.

## Layout

- `docs/product/`
  Product and design source of truth
- `docs/ai/`
  AI collaboration rules, verification policy, and doc ownership
- `docs/wiki/`
  Durable shared knowledge such as memory, glossary, and risk register
- `docs/tasks/`
  Backlog, status, and active execution docs
- `docs/runbooks/`
  Repeatable operational procedures

## Read Order

1. [../CONSTITUTION.md](../CONSTITUTION.md)
2. [product/01_app_spec.md](/docs/product/01_app_spec.md)
3. [ai/ownership_map.md](/docs/ai/ownership_map.md)
4. [ai/verification_matrix.md](/docs/ai/verification_matrix.md)
5. [wiki/memory.md](/docs/wiki/memory.md)
6. [ai/contributor-guide.md](/docs/ai/contributor-guide.md)

## AI Collaboration Layers

- `docs/`
  Human and AI shared long-term knowledge and process truth
- `.agents/`
  Shared operations layer for both Codex and Claude Code
- `.claude/`
  Claude-specific adapter layer
- `.codex/`
  Optional Codex-specific adapter layer when committed repo config is needed

## Frequently Used Docs

教材の単元対応と算数Lv11の比較試作は[学習単元と習得証拠](product/31_learning_units_spec.md)を参照。

全教材の対応表は[算数の単元カタログ](product/32_math_unit_catalog.md)と[英語の単元カタログ](product/33_english_unit_catalog.md)。`npm run learning:report`で検索できるHTMLと比較JSONを生成できる。

学習で同じ場所が自動で育ち、住民の暮らし・任意編集・発見とアルバムへつながる最新契約は[育つ島の仕様](product/30_living_island_growth_spec.md)。

算数・英語の初回難度、独力正解による昇格、意味別の英単語ID、日を空けた復習は [学習曲線と段階進行](product/29_learning_progression_spec.md) を参照。

島を中心に設定・記録・通常練習を揃えた変更は [変更前後の実画面](design/audits/2026-09-08-island-shell/review.html) と [検証記録](design/audits/2026-09-08-island-shell/README.md) を参照。

初回設定後の直接開始・初回3問・通常の連続学習は [画面比較](design/audits/2026-09-08-learning-rhythm/contact-sheet.html) と [検証・測定記録](design/audits/2026-09-08-learning-rhythm/README.md) を参照。

二桁以上の掛け算・割り算は、部分積・商・あまりを一段ずつ扱う共通の筆算面へ改善。[実画面の一覧](design/audits/2026-09-07-written-arithmetic/review.html) と [検証・保存互換性の記録](design/audits/2026-09-07-written-arithmetic/README.md) を参照。

現在の開発優先は [不思議な島の仕様](product/28_mystic_island_spec.md)。通常の学習形式と速い連問を守りながら、光・配置・どうぶつの暮らしで継続を支える。

島は大胆な配色とコード生成3Dの`moon-garden`。現在の入力・学習支援・再確認・どうぶつとの自由な遊びは [実画面レビュー](design/audits/2026-09-07-island-loop/review.html) と [つながりの改善監査](design/audits/2026-09-07-island-loop/README.md) を参照。3D方式の判断と全6家具は [前回の3D監査](design/audits/2026-09-07-island-3d/README.md)、前回完成時の全ループは [比較レポート](design/audits/2026-09-07-island-3d/review.html) に保存している。

問題を解く画面の基盤実装は [島で解く体験の監査](design/audits/2026-09-07-island-learning/README.md)、以前の見た目と回答動画は [学習面のcontact sheet](design/audits/2026-09-07-island-learning/contact-sheet.html) を参照。

初期実装の保存・速度の検証は [不思議な島の実装監査](design/audits/2026-09-07-mystic-island/README.md)、当時の画面の流れは [contact sheet](design/audits/2026-09-07-mystic-island/contact-sheet.html) を参照。

以前の開発優先は [ぴったり連鎖の仕様](product/27_gameplay_first_pittari_spec.md)。学習範囲ごとに解答操作そのものを遊びにし、第一作は5・10の合成／補数に限定して検証する。以下の探索・遊園地資料は既存モードの契約として読む。

新作12盤面の起動方法と実画面・録画・確認範囲は [ぴったり連鎖のローカル受入](design/audits/2026-09-06-pittari/README.md) を参照。

| File | Role | SSOT |
|---|---|---|
| [product/01_app_spec.md](/docs/product/01_app_spec.md) | Parent product spec | Yes |
| [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md) | Design principles | Yes |
| [wiki/index.md](/docs/wiki/index.md) | Reusable knowledge map | Yes |
| [wiki/glossary.md](/docs/wiki/glossary.md) | Workspace glossary | Yes |
| [ai/ownership_map.md](/docs/ai/ownership_map.md) | Doc ownership and tie-breaks | Yes |
| [wiki/memory.md](/docs/wiki/memory.md) | Durable project memory | Yes |
| [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | Minimum verification by change type | Yes |
| [ai/contributor-guide.md](/docs/ai/contributor-guide.md) | Shared AI collaboration boundaries | Yes |
| [tasks/active/README.md](/docs/tasks/active/README.md) | Detailed active-task file rules | Yes |

## Exploration Pivot Specs

The repository is transitioning toward an exploration-first math game. [product/01_app_spec.md](/docs/product/01_app_spec.md) defines the overall direction and staged rollout, while the following child specs are authoritative for their exploration domains. The implementation may intentionally lag the target during MVP validation; check the rollout phase before changing the main flow. If documents conflict, follow the repository source-of-truth order and fix the lower-level document before implementation.

| File | Role | Authority |
|---|---|---|
| [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md) | Exploration loop, actions, resources, failure, and MVP run model | Target-state SSOT |
| [product/11_learning_integration_spec.md](/docs/product/11_learning_integration_spec.md) | Learning-engine, problem-gate, SRS, and subject integration | Target-state SSOT |
| [product/12_screen_flow_spec.md](/docs/product/12_screen_flow_spec.md) | Exploration routes, screens, and parent/child information split | Target-state SSOT |
| [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | Exploration persistence, schema, and migration boundaries | Target-state SSOT |
| [product/14_ui_world_motion_spec.md](/docs/product/14_ui_world_motion_spec.md) | Exploration world, tone, motion, sound, and companion behavior | Target-state SSOT |
| [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) | MVP phases, validation questions, and success measures | Target-state SSOT |
| [product/16_legacy_feature_decision.md](/docs/product/16_legacy_feature_decision.md) | Keep/change/integrate/deprecate decisions for legacy features | Target-state SSOT |
| [product/17_open_questions.md](/docs/product/17_open_questions.md) | Unresolved exploration decisions and recommendations | Decision queue, not settled behavior |
| [product/18_core_game_redesign_proposal.md](/docs/product/18_core_game_redesign_proposal.md) | Definition of fun, core-loop alternatives, recommended graybox, and migration boundary | Design proposal, not production SSOT |
| [product/19_problem_first_core_design.md](/docs/product/19_problem_first_core_design.md) | Problem-first design order, borrowed-mechanic policy, skill-coverage gate, and the wager core candidate | Design proposal, not production SSOT |
| [ai/implementation_plan_explore_mvp.md](/docs/ai/implementation_plan_explore_mvp.md) | Suggested Codex implementation sequence and stop conditions | Execution guide, not product SSOT |

## Supporting Docs

- [design/park-three-runtime.md](/docs/design/park-three-runtime.md): Three.jsによる組替え可能な遊園地の候補、起動・旧表示への復帰、実画面と録画。

- [product/22_shared_subject_build_and_play_spec.md](/docs/product/22_shared_subject_build_and_play_spec.md): 教科共通の遊園地MVP、学習・保存契約。
- [design/park-blender-production-brief-draft.md](/docs/design/park-blender-production-brief-draft.md): 遊園地のBlender美術制作指示書たたき台。未確定の提案資料。
- [design/park-blender-runtime.md](/docs/design/park-blender-runtime.md): v0.2に基づくBlender原本、透過素材、アプリ合成と検証。

| File | Role | SSOT |
|---|---|---|
| [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md) | Design progress and status notes | No |
| [tasks/backlog.md](/docs/tasks/backlog.md) | Full backlog | No |
| [tasks/ui-fix-tasklist.md](/docs/tasks/ui-fix-tasklist.md) | UI-area task list | No |
| [product/design_review_checklist.md](/docs/product/design_review_checklist.md) | UI review checklist | Yes |
| [wiki/risk_register.md](/docs/wiki/risk_register.md) | Cross-cutting risks and mitigations | Yes |
| [ai/archive_policy.md](/docs/ai/archive_policy.md) | Doc trimming and archive rules | Yes |
| [runbooks/pwa-release.md](/docs/runbooks/pwa-release.md) | PWA update procedure | Yes |
| [runbooks/backlog-triage.md](/docs/runbooks/backlog-triage.md) | Backlog triage procedure | Yes |
| [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md) | Release checklist | Yes |
| [runbooks/schema-migration.md](/docs/runbooks/schema-migration.md) | Storage migration procedure | Yes |

## Task And History Layout

- `.agents/tasks/TASKS.md`
  Shared active queue for both agents
- `.agents/tasks/BLOCKED.md`
  Shared blocked queue
- `.agents/tasks/DONE.md`
  Shared completion index
- `docs/tasks/active/`
  Detailed active task files
- `docs/tasks/archive/`
  Archived task or status material that no longer belongs in hot docs
- `docs/done/`
  Durable historical log

## Update Rules

- If behavior changes, update the governing spec first.
- If doc ownership is unclear, check `docs/ai/ownership_map.md`.
- If a change affects process or shared AI workflow, update `docs/ai/contributor-guide.md`.
- If a fact must survive across unrelated work, decide whether it belongs in `docs/wiki/memory.md` or `.agents/memory/durable.md`.
- Run `npm run docs:check` after doc or process updates.
