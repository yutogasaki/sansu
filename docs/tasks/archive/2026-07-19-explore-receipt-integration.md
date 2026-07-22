# Task: Explore Receipt Integration

- Date: 2026-07-19
- Owner: Codex `/root/learning_progression_audit`
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: None

## Goal

- 現行探索を、回答とrun終了の保存成功後だけ進むreceipt駆動へ接続する。保存失敗時は子どもを責めず、同じProblem・同じAttemptIdentity・同じラン状態から安全に再試行できるようにする。
- 帰還、救出、中断、再出発の終了境界を保存し、同一プロフィールへ複数のactive runを残さない。

## In Scope

- 回答commit receiptへ実際の `result` を含めるrepository・型・unit test同期
- `ExploreRunState` のcommit済みattempt key保持と、保存済みreceipt必須reducer action
- reducerでrun / gate / 1始まりattemptNumber / result / 実出題skill / attemptKeyを照合し、偽造・不一致receiptを拒否、同receipt再適用を無視
- プロフィール解決後の `startExploreRun` 成功を回答解禁条件にするExplore UI統合
- 回答保存中の二重送信防止、成功後だけ正誤進行・エネルギー・演出を適用する処理
- 保存失敗時にProblem、入力answer、AttemptIdentity、attemptCount、energyを維持するインライン再試行UI
- `finishExploreRun` による `returned | rescued | abandoned` 終了保存、同statusの冪等再送、別status競合、run終了receipt
- 帰還・救出は終了receipt後だけsummaryへ進み、active中の退出は `abandoned` 保存成功後だけ遷移するUI境界。terminal summaryからの退出・再出発は既に保存済みの終了を再利用する
- 新run開始時に同一プロフィールの別active runを安全に `abandoned` 化するtransaction保険
- reducer / repository unit、回答二重送信と保存失敗再試行のE2E、複数activeを残さない検証

## Out of Scope

- 既存 `logs`、`memoryMath`、`memoryVocab`、プロフィール学習履歴、SRS、Due、weak、解放、昇格への書き込み
- run再開、発見図鑑・発見featureの永続化、ホーム・きろく統合
- `ReturnSummary`、Research Libraryコンポーネント、Research専用CSSの再設計
- `affectsSrs = true`、スキップ操作、学習planner / 3問束統合

## SSOT References

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/13_data_storage_migration_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`
- `docs/ai/verification_matrix.md`

## Docs To Touch

- Must update: `docs/product/11_learning_integration_spec.md`、`docs/product/12_screen_flow_spec.md`、`docs/product/13_data_storage_migration_spec.md`、`docs/product/15_mvp_rollout_verification_spec.md`、本active task、完了時のdone log
- Intentionally unchanged: `docs/product/01_app_spec.md`（親契約に変更なし）、`design-system/MASTER.md`（新しいvisual tokenなし）、SRS / PWA仕様
- Shared-file caution: Research Library側の `docs/product/12_screen_flow_spec.md` と `src/index.css` の変更を保持し、編集直前に再読する。`ReturnSummary` / Research componentsへ触れない。

## Safety Invariants

- receiptがない回答は、エネルギー、attemptCount、問題、発見、コンボ、ルートを一切進めない。
- retryは最初に凍結したProblem / result / 1-based AttemptIdentityを再利用し、新しいattemptを作らない。
- 同じ `attemptKey` の保存・reducer適用はevent、run集計、ゲーム進行を各1回にする。
- current nearby問題は常に `affectsSrs = false`。SRS / 学習ログへ書かない。
- run終了保存が失敗した場合はsummary、exit、restartへ進まず、同じ終了操作を再試行できる。
- 同一runの同status終了は冪等、別terminal statusは競合。新run開始後に同一profileのactive runは最大1件。
- 失敗文言は短く非難せず、「こたえはそのまま」と次の安全な操作を伝える。

## Plan

1. receipt `result`、run終了入力・receipt・event・repository transactionと単一active invariantを実装する。
2. reducerをcommit済み回答receipt / run終了receipt actionへ置換し、正誤・偽造・不一致・重複をunit testする。
3. Explore UIをrun開始・回答commit・run終了の保存成功駆動へ接続し、保存中lockとインライン再試行を実装する。
4. E2Eで高速二重送信と保存失敗→同一identity retryを検証し、全checkと実機相当画面を確認する。

## Definition of Done

- `ExploreAttemptCommitReceipt.result` が保存eventから復元され、repositoryと全testが同期している。
- reducerの生 `ANSWER_CORRECT / ANSWER_INCORRECT / RETURN` actionがなく、検証済みreceiptなしで進行できない。
- forged / run mismatch / gate mismatch / attempt mismatch / skill mismatch / result mismatch / duplicate receiptを安全に拒否または無視する。
- start成功前と保存中は回答できず、高速二重送信でも回答event・run集計・ゲーム進行が1回だけになる。
- 保存失敗直後も同じ問題、回答、identity、attemptCount、energyが表示され、再試行成功後に1回だけ進む。
- returned / rescuedは意味どおり終了保存後にsummaryへ進み、active exitはabandoned保存後にだけ遷移する。terminal summaryのexit / restartは終了済みrunを再finishしない。
- 同一profileにactive runが複数残らず、同status finishは冪等、別status finishは拒否される。
- Relevant docs updated or explicitly declared unchanged. Done log entry created if the task ships.

## Verification

- Commands: 対象Vitest、`npm run docs:check`、`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run e2e:smoke`
- Unit: repository receipt result / finish idempotency / terminal conflict / ownership / concurrent or sequential starts with single-active、reducer correct / incorrect / forged / mismatch / duplicate receipt
- E2E: 390×844 reduced-motionで高速二重送信、保存失敗時の同一Problem / AttemptIdentity / energy維持、retry後のevent・集計・進行1回、既存learning logs不変
- Manual: start待ち、回答保存中、回答保存失敗、run終了保存失敗、reduced motion、キーボードEnter、44px以上の再試行操作

## Progress

### Now

- receipt駆動の回答・run終了・失敗再試行を実装し、仕様、unit、E2E、完了記録を同期した。

### Next

- run再開、発見図鑑永続化、学習planner / SRS対象回答は後続のMVP-2b縦切りで扱う。

## Outcome

- 回答receiptへ保存済み `result` を追加し、reducerをprofile / run / gate / 1-based attemptNumber / actual skill / result / stable key / `affectsSrs = false` が一致するreceipt必須actionへ置換した。
- `startExploreRun` 成功をrun stateへbindし、成功前・保存中・open attempt・rescuePending中の操作を閉じた。回答失敗時はProblem、入力answer、identity、attemptCount、energyを維持するインラインretryを実装した。
- `finishExploreRun` と `run_ended` eventを追加し、returned / rescued / abandoned、同status冪等再送、別status競合、profile ownership、single-active invariantを実装した。
- 最後のひかりで正解した場合は発見dialogを閉じるまでactiveを維持し、その後のrescued finish成功後だけsummaryへ進む。
- start失敗にはretryと安全なGame退出を用意し、回答・run終了失敗には子どもを責めない次操作を示した。
- `ReturnSummary`、Research Library components、Research専用CSSは変更せず、並行実装を保持した。

## Verification Results

- `npm run verify:core`: PASS（56 files / 537 tests、docs、lint、typecheck、production build、PWA / asset checksを含む）
- Reducer / persistence repository: PASS（24 + 19 tests。forged / mismatch / duplicate receipt、finish idempotency / conflict / ownership、single-active、学習store不変を含む）
- `npm run e2e:smoke`: PASS（19/19。start失敗退出、active abandoned、open-attempt帰還guard、高速二重送信、同一identity retry、最後の発見後rescue、return失敗retry、既存Research / encounter回帰を含む）
- Independent receipt integration audit: P0 / P1 findingsなし

### Decision Notes

- 正答・誤答の保存済み事実をreceiptの `result` でreducerへ渡し、UIの正誤判定だけを信頼しない。
- 正しい終了意味を優先してreturn / rescueは専用finishを使い、crashや取りこぼしへの保険として新run開始transactionでも古いactiveをabandoned化する。
- run再開と発見永続化は別縦切りとし、今回のfinal snapshotは現在の集計・energy・route・確定発見だけに限定する。

### Risks

- correct演出holdと発見dialogの間にrun終了を早めると最後の発見が欠けるため、救出終了は発見続行後に保存する。
- UI stateだけでは同一tickの二重送信を防げないため、同期ref guardと凍結attemptを併用する。
- Research Libraryの並行変更と競合しないよう、共有画面仕様は再読後に局所patchし、ReturnSummaryとResearch componentsを変更しない。
