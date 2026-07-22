# Task: Explore Persistence Receipts

- Date: 2026-07-19
- Owner: Codex + sub-agents
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: `docs/runbooks/schema-migration.md`

## Goal

- Dexie version 5へ探索専用保存境界を追加し、現行の学習進捗を一切変更せず、探索run開始と1回答を冪等・原子的に保存してcommit済みreceiptを返せるようにする。

## In Scope

- `exploreRuns`、`exploreRunEvents`、`exploreDiscoveries` のDexie version 5 schema
- version 4のプロフィール・回答ログ・MemoryState・AppDataを保持する追加型migration
- `startExploreRun` repository操作
- AttemptIdentityの安定keyを使う `commitExploreAttempt`
- `affectsSrs = false` の回答イベントとrun集計を1 transactionで保存
- 同一attempt再送・並行送信の冪等receipt
- transaction失敗時のrollback
- プロフィール削除への探索専用テーブル追加
- migration、冪等性、並行、rollback、プロフィール分離・削除のIndexedDB unit test

## Out of Scope

- 既存 `logs`、MemoryState、SRS、Due、weak、解放、昇格への探索回答書き込み
- reducerへの保存済みreceipt action統合
- `Explore.tsx` の保存待ち・失敗再試行UI
- active runの再開・自動帰還
- 発見ページ進捗のrepository実装
- Golden Discovery Page、画像、音、PWA資産の変更

## Docs To Touch

- Must update: `docs/product/13_data_storage_migration_spec.md`（実装するv5 schema、transaction、migration・削除契約）、本task、done log
- Intentionally unchanged: `docs/product/11_learning_integration_spec.md`（`affectsSrs = false` とreceipt契約は前タスクで確定済み）、`docs/product/01_app_spec.md`（v5専用テーブル・原子性の親契約に変更なし）、reducer・探索UI・Golden UI/PWA関連仕様

## Safety Boundaries

- version 5は新規store・indexの追加だけとし、v4既存行を変換・削除しない。
- `commitExploreAttempt` は型レベルで `affectsSrs: false` だけを受け付け、既存学習テーブルをtransaction対象にも含めない。
- 記録対象skillは必ずfallback後の `Problem.categoryId` とする。
- `attemptKey` の一意制約とtransactionの両方で二重集計を防ぐ。
- runの `profileId` とAttemptIdentityの `profileId` が一致しない回答は拒否する。
- event保存まで完了しなければrun集計もrollbackし、receiptを返さない。
- UI・reducer統合は次タスクへ分け、保存前に現行ゲーム進行を変えない。

## Definition of Done

- v4で保存した既存各テーブルの代表行がv5 open後もdeep-equalで残る。
- run開始でrun行と `run_started` eventが1 transactionで保存される。
- 同じrun開始入力は冪等で、同じ `runId` の別profile・seed・startedAtは競合として拒否される。
- 1回答で `problem_answered` eventとrun集計が同時に保存され、commit後だけreceiptが返る。
- 同じattemptを逐次・2接続並行再送してもeventは1件、集計は1回で、同じreceiptが返る。
- event書き込み失敗時にrun集計もrollbackされる。
- 異なるプロフィールのrun・event・discoveryが混ざらず、プロフィール削除で対象プロフィールの探索行だけが消える。
- 既存logs、MemoryState、profile学習進捗へ書き込みがない。
- Relevant docs updated or explicitly declared unchanged.

## Verification

- `npx vitest run src/domain/explore/__tests__/persistenceRepository.test.ts`: PASS（15 tests）
- `npm run verify:core`: PASS（56 files / 522 tests、docs、lint、typecheck、build、assets checkを含む）
- Independent diff audit: P0 / P1 findingsなし

## Outcome

- Dexie version 5を既存v4行の変換なしで追加し、プロフィール別のrun・event・discovery保存境界を実装した。
- run開始と回答commitを原子的に保存し、同一AttemptIdentityの再送・2接続並行送信でも集計を一度だけ進める保存済みreceiptを実装した。
- event失敗時のrollback、profile ownership、同じkeyの別result/category競合、プロフィール削除をfake IndexedDBで検証した。
- 現行近傍問題は `affectsSrs = false` のままで、既存logs・SRS・MemoryState・学習プロフィールを変更しない。

## Next

- reducer / UIが保存済みreceiptを受け取ってから進行する統合と、保存失敗時に同じProblem・AttemptIdentityを再試行する表示を別タスクで実装する。
