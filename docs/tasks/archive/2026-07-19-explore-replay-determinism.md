# Task: 探索の再現性とリプレイ理由を作る

- Date: 2026-07-19
- Owner: Codex
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: なし

## Goal

- 同じラン・ゲート・試行・スキルから同じ問題を再現できるようにする
- 帰還要約に未訪問ルートの気配を残し、別ルートを選ぶ2ラン目の小目標を作る

## In Scope

- 数学generatorへの明示random context注入と探索用seed分離
- 未訪問の専用遭遇、未体験地形、別ルートの順で選ぶ純粋selector
- 帰還要約の未発見シルエットと再出発CTA
- unit、E2E、Browser QA

## Out of Scope

- SRS、発見図鑑、ラン状態の永続化
- 報酬量、通貨、装備、デイリー目標
- E4の新しい演算遭遇

## SSOT References

- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`
- `docs/ai/implementation_plan_explore_mvp.md`

## Docs To Touch

- Must update: `docs/product/10_exploration_game_spec.md`, `docs/product/15_mvp_rollout_verification_spec.md`, `docs/ai/implementation_plan_explore_mvp.md`
- Intentionally unchanged: `docs/product/13_data_storage_migration_spec.md`（保存境界は変更しない）

## Definition of Done

- 同一seed tupleとprofile snapshotで問題全体がdeep-equalになる
- 候補追加や別generatorの乱数消費が選択済みskillの問題を変えない
- 帰還要約が未訪問の特別遭遇を優先して1件予告する
- CTAから新しいランへ戻れ、既存SRSログを書き込まない
- `npm run verify:core` と `npm run e2e:smoke` が通る

## Verification

- Commands: `npm run verify:core`, `npm run e2e:smoke`
- Browser: 390×844で帰還要約、予告、再出発を確認

## Progress

### Now

- E2の明示random contextとE3の帰還要約・再出発CTAを実装済み
- 同seed再現、global乱数非参照、候補順非干渉を全数学generatorで検証済み
- Browser 390×844で帰還予告から別ルートへ再出発できることを確認済み

### Next

- MVP-2の保存再開ではプロフィールsnapshot固定または生成済みProblem保存を選ぶ

### Decision Notes

- module-global乱数や`Math.random`差し替えを使わない
- 次ランへの理由は報酬増量ではなく、選ばなかった道の情報差で作る

### Risks

- profile snapshotが変われば同じseedでも教材段階が変わるため、保存再開時は別契約が必要
- 予告を確約文にすると再生成マップとの齟齬が出るため「出会えるかも」に留める
