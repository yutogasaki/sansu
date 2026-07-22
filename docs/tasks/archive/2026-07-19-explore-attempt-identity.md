# Task: Explore Attempt Identity 基盤

- Date: 2026-07-19
- Owner: Codex + sub-agents
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: `docs/runbooks/schema-migration.md`（Dexie v5を実装する次段階で使用）

## Goal

- 探索の1回答をプロフィール・ラン・ゲート・1始まりの試行番号で一意に識別し、将来の保存・再送・SRS接続が二重更新を起こさない純粋ドメイン境界を先に固定する。

## In Scope

- `AttemptIdentity = { profileId, runId, gateId, attemptNumber }` の純粋型
- 1始まりの正整数だけを受け付ける生成helper
- 同じidentityから常に同じversioned keyを作るhelper
- fallback後に実際に出題した `Problem.categoryId` を記録対象skillとして採用する境界
- identityの一意性・安定性・不正番号・fallback境界のunit test
- 学習統合仕様と保存仕様への次ループ契約の追記

## Out of Scope

- Dexie version 5 schema・migration・repositoryの実装
- 既存 `logs`、MemoryState、SRS、Due、weak、解放、昇格への書き込み
- 既存reducer、`Explore.tsx`、画面遷移の変更
- 保存済みreceipt actionの実装
- Golden Discovery Pageの内容・演出・検証結果の変更

## Docs To Touch

- Must update: `docs/product/11_learning_integration_spec.md`（AttemptIdentity・SRS対象判定）、`docs/product/13_data_storage_migration_spec.md`（冪等key・保存済みreceipt契約）
- Intentionally unchanged: `src/db/index.ts` のDexie schema・migration、`src/domain/explore/reducer.ts`、`src/pages/Explore.tsx` と探索UI、Golden Discovery Page関連仕様。これらは保存実装の次ループで扱う。

## Safety Boundaries

- `attemptNumber` は1始まりの正の安全な整数とし、現行の0始まり `attemptCount` をそのまま渡さない。
- 記録対象skillはゲートが最初に要求したskillではなく、fallback後の `Problem.categoryId` を正とする。
- 現行のプロフィール近傍問題は `affectsSrs = false` とし、学習plannerが出題根拠を保証するまでSRS・weak・解放・昇格を更新しない。
- 保存実装後も、commit済みreceiptを受け取る前にゲーム状態を進めない。保存失敗時は同じProblem・同じidentityで再試行できるようにする。
- この段階では高リスクなstorage、migration、UI、reducerへ変更を広げない。

## Definition of Done

- 4要素のいずれかが異なれば異なるattempt keyになり、同じ入力は同じkeyになる。
- `attemptNumber = 0`、負数、小数、非有限値を生成helperが拒否する。
- fallback後の問題を渡すと、その `Problem.categoryId` が記録対象skillになるテストがある。
- `docs/product/11_learning_integration_spec.md` と `docs/product/13_data_storage_migration_spec.md` にAttemptIdentity・保存済みreceipt・`affectsSrs = false` の契約が記載されている。
- Dexie schema、既存reducer、探索UIに変更がない。
- Relevant docs updated or explicitly declared unchanged.

## Verification

- `npx vitest run src/domain/explore/__tests__/attemptIdentity.test.ts`: PASS（8 tests）
- `npx vitest run src/domain/explore/`: PASS（83 tests）
- `npm run docs:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS

## Outcome

- 4要素からなるversion付き冪等keyと、fallback後の `Problem.categoryId` を正とする純粋な記録境界を実装した。
- 保存済みreceipt、保存失敗時の再試行、現行近傍問題の `affectsSrs = false` を学習・保存仕様へ固定した。
