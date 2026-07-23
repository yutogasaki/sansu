# docs/product/13_data_storage_migration_spec.md — データ・保存・移行仕様

## 1. 基本方針

既存 `UserProfile` に探索データを大量追加しない。正式導入時はDexie version 5以降で探索専用テーブルを追加する。

既定起動面の探索へMVP-2bの最小学習接続を追加する。run行へplanner assignmentを予約し、SRS対象回答は探索event・run集計・既存回答ログ・MemoryState・プロフィール進捗を同一transactionで保存する。未予約fallbackは従来どおり探索eventだけを保存する。MVP-2cでは同じrun行のoptional active checkpointからrun再開を行い、発見図鑑のrun横断永続化は後続縦切りとする。

## 2. 既存テーブル

維持:

- `profiles`
- `logs`
- `memoryMath`
- `memoryVocab`
- `appData`

既存学習データでは `memoryMath` / `memoryVocab` をskill / word単位のSRS正本とする。`UserProfile.mathSkills` / `vocabWords` は旧コード互換のミラーとして残し、プロフィール取得時に正本テーブルを重ねる。`logs` は全回答履歴、`UserProfile.recentAttempts` は直近300件の出題用リングバッファとして役割を分ける。1回答のログ・記憶・プロフィール更新は同一トランザクションで行い、旧MemoryStateの `isWeak` は初回参照時に履歴から復元して保存する。プロフィール削除時は関連する `logs` / `memoryMath` / `memoryVocab` / `exploreRuns` / `exploreRunEvents` / `exploreDiscoveries` と、同IDのいきもの端末状態・図鑑も削除する。

## 3. 新規テーブル案

```ts
exploreRuns: '&runId, profileId, [profileId+status], startedAt, status'
exploreRunEvents: '++id, &attemptKey, profileId, runId, [profileId+runId], timestamp, type'
exploreDiscoveries: '[profileId+discoveryId], profileId, kind, firstFoundAt'
```

version 5は上記3 storeを追加し、version 4の既存store・index・行は変更しない追加型migrationとする。upgrade callbackによる既存行の変換や削除は行わない。

`attemptKey` は `problem_answered` だけが持つ任意のunique indexとし、`run_started` など非回答イベントでは未設定でよい。発見は同じ `discoveryId` を別プロフィールが独立して持てるよう、`[profileId+discoveryId]` を主キーにする。`exploreSettings` は設定項目が生まれるまで追加しない。

## 4. 型案

```ts
export interface ExploreRunRecord {
  runId: string;
  profileId: string;
  seed: string;
  status: 'active' | 'returned' | 'rescued' | 'abandoned';
  startedAt: number;
  endedAt?: number;
  energyUsed: number;
  problemsAnswered: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  discoveries: DiscoveryInstance[];
  routeSummary: string[];
  updatedAt: number;
  learningAssignments?: Record<string, ExploreLearningAssignment>;
  activeCheckpoint?: ExploreActiveCheckpointV1;
}

export interface ExploreDiscoveryRecord {
  discoveryId: string;
  profileId: string;
  kind: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legend';
  firstFoundAt: number;
  count: number;
  lastFoundAt: number;
}

export interface ExploreRunEventRecord {
  id?: number;
  profileId: string;
  runId: string;
  attemptKey?: string;
  timestamp: number;
  type:
    | 'run_started'
    | 'node_selected'
    | 'problem_answered'
    | 'tile_opened'
    | 'discovery_found'
    | 'bridge_event'
    | 'return_started'
    | 'run_ended';
  gateId?: string;
  attemptNumber?: number;
  recordedSkillId?: string;
  result?: 'correct' | 'incorrect' | 'skipped';
  affectsSrs?: boolean;
  payload: unknown;
}
```

MVP-2aの `run_ended` は `returned | rescued | abandoned`、終了時刻、energy使用量、確定発見snapshot、route summaryを持つ。最終集計の正誤件数は回答transactionで既に更新済みのrun集計を正とし、終了UIから再加算しない。

## 5. 問題ログとの関係

- 回答ログは既存 `logs` を使う
- 探索イベントは `exploreRunEvents` を使う
- `problem_answered` eventの `learningLogId` から既存 `logs` の回答へ参照できる。既存logs schemaへrun用indexは追加しない
- 学習上の正誤とゲーム上の結果を混同しない
- 1回答のidentityは `{ profileId, runId, gateId, attemptNumber }` とし、`attemptNumber` はゲート内で1始まりの正整数にする
- `attemptKey` は `explore-attempt-v1 / profileId / runId / gateId / attemptNumber` のversion付き安定tupleから作る
- 記録するskillはfallback前の要求値ではなく、実際に出題した `Problem.categoryId` を使う
- Study共通plannerがrunへ予約したassignmentと実出題skillが一致する場合だけ `affectsSrs = true` とする。未予約のプロフィール近傍問題は `affectsSrs = false` のまま、既存 `logs`、MemoryState、weak、解放、昇格を更新しない

### 5.1 原子的保存とcommit receipt

MVP-2の回答保存repositoryは `attemptKey` を冪等性境界として扱う。

1. 同じ `attemptKey` が既にcommit済みなら、新しいログ・SRS更新・ゲームイベントを作らず、既存結果に対応するreceiptを返す。
2. 保存済みassignmentからrepositoryが `affectsSrs = true` と判定した場合だけ、既存回答ログ、MemoryState、プロフィール内の直近履歴・連続日数・メインレベル回答窓を、run集計と `problem_answered` 探索イベントと同一transactionで更新する。UI入力のbooleanは判定に使わない。
3. `affectsSrs = false` の場合は探索イベントだけを保存し、学習状態を変更しない。
4. transactionが成功した後だけ、`attemptKey`、AttemptIdentity、fallback後の `recordedSkillId`、保存済み `result`、`affectsSrs`、commit時刻を持つ保存済みreceiptを返す。
5. transactionが失敗した場合はreceiptを返さない。呼び出し側はゲーム状態を進めず、同じProblem・同じAttemptIdentityで再試行する。

Dexie schema、migration、回答transactionは5.2、探索reducer / UIによるreceipt消費とrun終了境界は5.3の縦切りで実装する。

### 5.2 version 5 repositoryの実装範囲

最初のversion 5縦切りは次に限定する。

- `startExploreRun`: `exploreRuns` の初期集計行と `run_started` eventを同一transactionで保存する。同じ `runId` の同一入力は既存runを返し、別プロフィール・別seed・別startedAtとの衝突は拒否する。
- `commitExploreAttempt`: active runの所有プロフィールとAttemptIdentityを照合し、run集計更新と `problem_answered` eventを同一transactionで保存する。
- 未予約の近傍問題は `affectsSrs = false` とし、学習tableを更新しない。予約済み算数問題では同じtransactionへ `logs`、`memoryMath`、`profiles`、`appData` を含める。
- planner assignmentは既存version 5のrun行へoptional fieldとして追加し、indexを増やさない。従来run行と回答eventは `affectsSrs = false` として読み続けられるため、この縦切りだけを理由にversion 6 migrationは追加しない。
- 同じ `attemptKey` の逐次・並行再送では、最初にcommit済みのeventから同じreceiptを復元し、run集計を二重加算しない。keyが同じなのに正誤または記録skillが違う場合はデータ競合として拒否する。
- event追加に失敗した場合は、先に行ったrun集計更新もtransaction rollbackし、receiptを返さない。

この縦切りではSRS対象回答とreducer / UI統合に加え、MVP-2cとしてindexを増やさないoptional `activeCheckpoint` を同じversion 5 run行へ追加し、発見書き込みとは分離してrun再開まで実装した。

G3-2では同じrun行へoptional `learningSegments` を追加する。segmentはschema version、segment ID、絶対start / planned-from / end step、計画時プロフィール境界、実gate / nodeに結び付いた完全なProblemとassignment slotを持つ。新store / indexは追加せずDexie version 5を維持する。

- `reserveExploreLearningSegment` はactive checkpoint revision、profile、run、step境界を照合し、segmentと全slotの `learningAssignments` を同一transactionで保存する
- 同じsegment IDの再送は最初の保存値を返し、既存slotを別gate / Problem / policyで上書きしない。同一segment slotへ異なるproblem IDをbindしない
- segment予約だけでは `logs` / MemoryState / profile / Dueを更新しない。各assignmentは該当answer commit時だけ従来writerへ渡す
- checkpoint付き旧runにsegmentがない場合は現在step以降だけを追加できる。finished row、既存assignment、回答eventは変更しない
- 現在問がcheckpointへ既に保存済みなら、そのfull Problem / assignmentをsegment先頭へ採用し、入力解禁前に残りslotを予約する。representation retryはsegment外の同step assignmentとしてfull Problem / encounterを保持し、checkpoint revision / gate / attempt CASを通す
- plannerのprofile / Memory / logs読取とrun rowへのsegment書込みは同一transactionで直列化する。予約abortまたはpolicy競合はtransaction全体をrollbackし、未表示slotやretry assignmentを部分的に残さない

### 5.3 receipt駆動UIとrun終了境界

- `ExploreAttemptCommitReceipt` は保存eventの `result` を含める。reducerはrun / gate / 1始まりattemptNumber / result / 実出題skill / version付きattempt keyを照合し、同keyの再適用を無視する。
- UIはプロフィール解決と `startExploreRun` 成功まで回答を解禁しない。回答時はAttemptIdentityを一度作って凍結し、保存成功receipt後だけ正誤進行と演出を適用する。
- 保存失敗時はProblem、入力answer、AttemptIdentity、attemptCount、energyを進めず、責めないインライン表示から同じcommitを再送する。
- `finishExploreRun` はactive runを `returned | rescued | abandoned` のいずれかで閉じ、終了時刻、energy使用量、確定発見、route summaryを同一transactionでrun行と `run_ended` eventへ保存する。同じrun・同じterminal statusの再送は最初の結果を返し、別statusは競合として拒否する。
- 帰還・救出は終了receiptを受け取った後だけsummaryへ進む。退出・再出発は `abandoned` の終了成功後だけ遷移する。失敗時は現在のrunを保持して再試行する。
- `startExploreRun` は新run追加と同じtransactionで、同一profileに残った別active runを `abandoned` 化する。通常経路では意味どおりのfinishを優先し、この処理はcrash・旧データ・応答欠落時にもactiveを最大1件へ収束させる保険とする。

SRS対象assignmentでは既存 `logs` / MemoryState / weak / 解放・昇格用回答窓を更新し、game-only fallbackでは変更しない。MVP-2cのcheckpoint保存や復旧だけを理由に学習状態を更新しない。

## 6. 中断・再開

`active` のランはプロフィールごとに1つだけ保持する。MVP-2cは新run開始より先にcheckpoint付きactive runを検索し、直接同じ問題面へ自動復帰する。

- checkpointはschema version、単調revision、opening experience ID、reducer state、確認済みdiscovery cursorを持つ。入力途中の数字は保存しない
- 回答eventだけがcheckpointより1件先行した場合に限り、完全なpending Problemと予約assignmentへreceiptを1回foldする。複数tailや不一致は推測しない
- Q7 blocking発見は確認cursorの保存成功後にだけ閉じ、未確認なら再起動後に1回だけ表示する
- checkpointなしの旧active runは学習・発見を推測せずabandonedへ閉じる。finished rowは変更しない
- index追加がないためDexie version 5を維持し、バックアップなしの破壊的migrationを行わない

## 7. 移行

- Dexie schema migrationはrunbookに従う
- version 4からversion 5は新規store追加のみとし、既存 `profiles` / `logs` / `memoryMath` / `memoryVocab` / `appData` の代表行が保持されることをfake IndexedDBで検証する
- 既存プロフィールは変更不要
- 初回探索時はrunと `run_started` eventを作成する。`exploreSettings` は設定項目が生まれるまで作らない
- 既存学習ログは保持
- バックアップなしの破壊的変更は禁止
