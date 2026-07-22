# Task: 根っこのからまりを縦切り実装する

- Date: 2026-07-19
- Owner: Codex
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: なし

## Goal

- 引き算の意味と世界変化が一致する2件目の没入遭遇を、量産基盤のページ分岐追加なしで完成させる
- リモート・PWAでも画像が確実に見え、スマホとタブレットで最後まで遊べる状態にする

## In Scope

- 深度5〜6へ1ラン最大1件の決定的配置
- Bridge/Concrete引き算だけを使うskill契約と通常root fallback
- `からまり → 開通 → 相棒通過` の853×1844ローカル画像3枚
- 共通没入UIを使うroot renderer、誤答支援、reduced motion
- PWA事前キャッシュ、domain/unit/E2E/Browser QA

## Out of Scope

- 根を切る操作、物理パズル、装備、通貨
- SRS・回答ログ・発見図鑑への永続化
- 探索問題ジェネレーター全体のseeded RNG化

## SSOT References

- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`

## Docs To Touch

- Must update: `docs/product/10_exploration_game_spec.md`, `docs/product/11_learning_integration_spec.md`, `docs/product/14_ui_world_motion_spec.md`, `docs/product/15_mvp_rollout_verification_spec.md`, `docs/ai/implementation_plan_explore_mvp.md`
- Intentionally unchanged: `docs/product/13_data_storage_migration_spec.md`（永続化境界は変更しない）

## Definition of Done

- 固定seedでroot-tangleが1件だけ配置され、通常rootと区別できる
- 対応する視覚引き算だけが専用表示となり、非対応問題は通常表示へ戻る
- 誤答で同じ問題とヒントが残り、正解で根が開き、相棒通過後に発見へ進む
- 390×844と768×1024で全ボタン44px以上、画像3枚が853×1844で読み込まれる
- 探索回答が既存SRSログへ書き込まれない
- `npm run verify:core` と `npm run e2e:smoke` が通る

## Verification

- Commands: `npx vitest run src/domain/explore src/components/explore/exploreAnswerInput.test.ts`, `npm run verify:core`, `npm run e2e:smoke`
- Browser: 390×844で未入力、誤答、持続ヒント、正答、根の開通を確認
- E2E: 390×844と768×1024、reduced motion、画像寸法、44px操作、SRSログ非書き込みを確認

## Progress

### Now

- domain、UI、連続性を保つ生成アート、PWAキャッシュを実装済み
- Browser実機で390×844を手動確認済み
- E2Eで390×844、768×1024、1024×768の連続誤答→支援切替→正答→開通→相棒通過を確認済み

### Next

- E4の第3遭遇へ、同じrenderer/phase/画像契約を再利用する

### Decision Notes

- 演算prefixだけでは専用表示へ入れず、数量表現を保証する明示skill IDを使う
- レベル12の記号問題を演出都合でレベル11へ下げず、通常rootへ戻す
- 画像は外部URLへ置かず `public/assets/explore/root-tangle/` に保持する

### Risks

- 問題オペランドは明示seed contextで再現可能になった
- 3枚のJPEGは約1.2MBあるため、今後の遭遇追加でも画像予算を継続監視する
