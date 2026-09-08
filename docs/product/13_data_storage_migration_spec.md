# docs/product/13_data_storage_migration_spec.md — データ・保存・移行仕様

## 1. 基本方針

2026-09-09に[仕様35のカテゴリをまたぐ「ほしいもの」](35_island_customization_spec.md#カテゴリをまたぐほしいもの1件)を採用した。旧 `customization.desiredItemId` と `desire / clear-desire` receiptを保ち、家具・身支度だけをoptional `IslandRecord.rewardGoal` v1へ保存する。省略は追加目標なしで、読み取り時の移行・自動生成は行わない。両fieldの同時目標、未知版/ID、所持済み目標は拒否する。DB v8のstore/index、島schemaVersion、UserProfile、学習予約と評価、写真storeは変更しない。

目標の選択・変更・解除は無料で、専用writerがactive profileとcanonical意図を検査し、`['island-reward-goal-v1',profileId,revision]` の `reward_goal_changed` receiptをCASより先に照合する。結果不明の再送は元revision/意図を保ち、既存receiptなら最新の島を返して後の目標を上書きしない。対象の取得時だけ、所有追加・必要な減算・該当目標の解除を同一transactionに含める。別品取得・資格成立・試用/装備・通常学習では解除せず、全景/成長snapshotにも目標を含めない。旧fieldと新fieldの各操作境界は仕様35を正本とする。

2026-09-08に[身支度と観察記念の仕様41](41_island_expression_collection_spec.md)を採用した。DB v8のstore/indexと島schemaVersionを保ち、optional expressionの所有と選択を分ける。無料衣装/音へ戻す変更は同一transactionで追加装備を解除し、名前だけの変更は装備を保つ。新しい全景style v2と成長記録は当時の選択だけをcaptureする。旧配置/旧style v1/旧成長記録の省略を区別し、写真bytesや所有・資格・学習を巻き戻さない。取得/装備は専用receiptで再送を先に照合する。

2026-09-08に[置いた道具から始まる暮らし40](40_island_life_furniture_spec.md)を追加採用した。購入専用3kindは各1個の安定IDで既存itemsへ収納取得し、既存ほしの減算とreceiptを原子的に保存する。基本報酬の6kindを別に検証し、旧重複家具と自動成長を保持する。DB v8のstore/indexは変更しない。新kindを読む現在値と成長snapshot、旧全景適用の後発物保持を検査する。

2026-09-08に[部位のきせかえと景色の保存39](39_island_appearance_sets_spec.md)を追加採用した。DB v8のstore/indexを変えず、既存customizationへ検証済みの部位外見、既存3配置枠へ装い/音/旗のsnapshotを追加する。旧テーマの利用権は読み取り時に解決し、旧残高/receiptを作り直さない。単品・テーマ・完成セットは未所持分の減算/所有/適用/receiptを原子的に保存し、結果不明の再送は再見積りや新しい景色のcaptureより先に元receiptを照合する。実装と検証は全体タスクで追う。

2026-09-08に[仲間の仕事・展示・写真38](38_island_shared_memories_spec.md)を追加採用した。[現DB実装](../../src/db/index.ts)はv8で、既存全store/indexを維持し `islandPhotoAlbums / islandPhotos / islandPhotoBlobs` の3storeを追加している。共同記憶/展示はIslandRecordの小さなoptional状態、写真本体/thumbnailは専用Blob rowとし、通常の学習writer/学習transactionへ画像bytesと写真storeを追加しない。active profile、独立album revision/CAS、同操作receipt、profile削除の原子性は下記7.1と仕様38に従う。schema・repositoryの実装と、実画面・PWA・実参加者の検証完了は分けて扱う。

教科共通ゲームは [22_shared_subject_build_and_play_spec.md](22_shared_subject_build_and_play_spec.md) の実装契約に従いDexie v6へ `parks / parkPlans / parkEvents` を追加する。v5の全store・index・行・checkpointは無変換。profile削除は新3storeも同じtransactionに含める。ロールバックはv6対応buildのflag無効化で行い、v5しか知らない旧buildへの巻戻しやDB削除は使わない。

既存 `UserProfile` に探索データを大量追加しない。正式導入時はDexie version 5以降で探索専用テーブルを追加する。

既定起動面の探索へMVP-2bの最小学習接続を追加する。run行へplanner assignmentを予約し、SRS対象回答は探索event・run集計・既存回答ログ・MemoryState・プロフィール進捗を同一transactionで保存する。MVP-2eで不適格候補を除外した場合は別identityのgame-only fallbackだけを予約し、学習状態を変更しない。MVP-2cでは同じrun行のoptional active checkpointからrun再開を行い、発見図鑑のrun横断永続化は後続縦切りとする。

## 2. 既存テーブル

### 家に飾る学習成果（2026-09-09）

[仕様42](42_island_learning_keepsakes_spec.md)の展示は既存 `IslandRecord` のoptional欄だけを追加する。

```ts
learningKeepsakes?: {
  version: 1;
  displayed: IslandLearningKeepsakeId[];
};
```

IDは仕様42の固定16品に限り、資格は本人の保存済み `completedSets` から導く。別の所有数・達成数・日時を加算保存しない。`displayed` は最大16件、重複なし、catalog順で保存し、欠如は未展示として読む。未知版/ID、未資格の展示、破損した配列は拒否し、読み取りで移行や既定値の書込みを行わない。DB v8のstore/index、島schemaVersion、UserProfile、学習writer、財布、写真storeは維持する。

専用writerは `display { keepsakeId, displayed }` または `display-earned` を受け、active profileと資格、revisionを既存transactionで検査する。`['island-learning-keepsakes-v1', profileId, revision]` の `learning_keepsakes_changed` receiptはCASより先に照合し、同じ意図の再送は最新の島を返す。新しい資格の自動展示や後の収納の取消を再送へ混ぜない。通常回答はこのoptional欄を保持し、展示操作は学習/ほし/他の成果を変更しない。

詳細履歴は本人のcanonicalな完了plan/eventをreadonlyで取得する。25回以下の節目は最大25組、それ以降は節目に対応する1組に限定する。正確な日時・重複しない予約問題数・教科は確認できる部分だけを表示し、欠如や矛盾を現在日時や推定問題数で補わない。成長履歴/保存景色に現在の展示を後付けせず、旧写真bytesも変更しない。家内のcamera、home/keepsakes/noticesのsection、選択中の近景は一時状態であり、新たな保存欄を設けない。

### 紙テストの問題保持（2026-09-07）

既存プロフィールの `pendingPaperTests` にoptionalな `testSet`（完全な20問のsnapshot）と `mode`（auto/manual）を追加する。教科ごとに最大1件とし、再印刷ではそのsnapshotを正本にする。store/index/schema versionの変更や旧行の書換えは不要。旧行は採点・取消できるが、snapshotがない内容を再生成して同じ用紙と見なさない。

作成・採点・取消は最新のプロフィールを読む `updateProfileAtomically` で `appData` と互換 `profiles` を同時保存する。採点済み・取消済みIDへの再操作は履歴を追加しない。採点では同一snapshotの自動テスト待ちだけを解消し、並行して作られた別の待ち・別設定・SRS・回答ログを上書きしない。旧buildはsnapshotを使用せず再保存で落とす可能性があるため、再印刷の保証にはこの変更を含むbuildを使う。

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

G3-3はstore、index、schema versionを増やさない。rapid-loop適格性と全source解放上限は、新しいbase segment slotまたはretryを未保存状態から生成するときだけ適用し、保存済みsegment / assignment / Problem / retryを移行・再評価・書換えしない。

- 不適格候補はassignment、event、logを作らず、MemoryState、Profile、recentAttempts、Dueを変更しない
- 不足slot用のgame-only assignmentは、除外した学習候補とは別identityで `affectsSrs = false` として同じatomic segment reservationへ含める
- 旧runの現在slotを採用する場合は保存済みfull Problemを維持し、同じtransactionで新規生成する残りslotだけ現行policyを通す

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

### 7.1 version 8 — 写真の独立保存（2026-09-08）

`SANSU_V8_STORES` は `SANSU_V7_STORES` をそのまま展開し、次の3storeだけを追加する。upgrade callbackによる既存行の変換や書換えは行わない。

```ts
islandPhotoAlbums: '&profileId'
islandPhotos: '&id, profileId, [profileId+capturedAt]'
islandPhotoBlobs: '&id, profileId'
```

- `islandPhotoAlbums` はprofile別のversion 1/単調revision、`islandPhotos` は名前・構図・撮影時刻・PNG寸法/容量/SHA-256などの小さなmetadataを持つ。`islandPhotoBlobs` の同じphoto IDの1行へ本体PNGとthumbnail Blobをまとめる。未作成のアルバムは仮想のrevision 0として読み、閲覧で保存しない。
- [写真repository](../../src/domain/island/photosRepository.ts)の書込transactionは `appData / islandPhotoAlbums / islandPhotos / islandPhotoBlobs / islandEvents` の5tableだけ。active profileと本人の存在を先に確認し、album revision、最大12枚、本体とthumbnail合計24MiB、photo ID、metadata/Blobの一致を検査する。本体2MiB/長辺1600px、thumbnail128KiB/長辺320pxの制約とPNG/SHA-256検査は写真domainに従う。画像の検査・ハッシュ計算はtransactionの外で行う。
- 成功はmetadata/Blob/album revision/`photo_changed` receiptの全commit後。取消や再送のためにBlobをeventへ複製しない。receiptは `['island-photo:v1:operation', profileId, expectedAlbumRevision]` の主キーで直接取得し、同じcanonical intentだけ再送できる。結果不明時は元のphoto ID・時刻・metadata・実PNG・revisionを維持する。保存後に本人が削除した写真へ古い成功再送が来ても復活させず、`present: false` を返す。
- 一覧はmetadataを読む。本体を開く処理とthumbnailを渡すAPIを分けるが、現在のBlob storeは同じ1行に両画像を持つため、thumbnail取得でも該当Blob rowは読み込む。削除は両画像・metadataを一緒に消し、revision/receiptを残す。満杯、quota、未知I/O、壊れたrowを理由に既存写真を自動削除・初期化しない。
- [profile削除](../../src/domain/user/repository.ts)は上記写真3storeを既存の所有row削除と同じtransactionに含め、別profileの写真を保持する。写真のbytes/storeを島の `islandTables` や共通学習writerへ追加しない。通常回答は既存plan/Problemを正本として続ける。
- v7→v8の全既存store/index/代表行、学習予約・入江checkpoint・receiptの保持、profile削除、保存abort/CAS/同操作再送は[写真repository tests](../../src/domain/island/photosRepository.test.ts)で照合する。実canvasからの故障再送・背景化は[検証matrix](../ai/verification_matrix.md)の写真persistenceハーネスで別に確認し、unit testを実ブラウザの証拠へ読み替えない。

v8導入後のrollbackはv8を理解するbuildで機能を無効化する。v7だけを知る旧buildへの巻戻し、schema downgrade、IndexedDB削除をrollback手順にしない。

## 2026-09-07: Mystic Island additive storage

整数の多段筆算では、新規予約Problemにoptionalの`hissanVersion: 2`を持たせる。Island/Parkの版なしProblemは従来の筆算generatorで読み、保存済み`hissanStep`と`hissanValues`の行・列座標を再解釈しない。新しいProblemだけ多段generatorを使い、商とあまりの`correctAnswer`配列を連結しない。既存テーブル・index・Dexie versionは変更せず、旧planの一括書換えも行わない。表示・入力契約は [06_screen_specs.md](06_screen_specs.md)「多桁の筆算」を参照。

[28_mystic_island_spec.md](28_mystic_island_spec.md) の島モードは Dexie v7 の `islands` / `islandPlans` / `islandEvents` にプロフィール単位で保存する。v6 の学習・探索・遊園地データを変換・削除しない。島の初期化は初回アクセス時に行う。プロフィール削除の同一transactionへ3テーブルを追加する。

区間開始時に通常6問/複雑3問の完全なProblem・支援/筆算状態・学習sourceを予約し、再読込で再生成しない。active profile所有権、plan revision、action receiptを照合し、学習回答と既存writerの記録、最終問題の完了受取権を同一transactionへ保存する。支援・skipは独力確認Dueを残し、支援正解を独力正答に数えない。未受取権は次の区間を始めても保持し、受取をitemとclaim eventへ原子的に変換する。配置・回転・収納は島revisionを使ったCASで保存する。

島導入時のrollbackはv7 schemaを維持したまま `VITE_ISLAND_ENABLED` を無効化する。v8導入後は上記7.1のv8対応buildを使い、schemaのdowngradeやIndexedDB削除をrollback手順にしない。PWAは島の学習中・保存中を保護する。

島の再確認改善では、既存island行にoptionalの算数再確認状態と英語Due巡回位置を加える。旧行は未設定のまま読み込める。算数はskill単位の失敗問題識別と別表現/独力の確認段階を持ち、訂正正解で消さない。状態更新は回答または次区間予約と同一transaction、島revisionのCASとreceipt冪等性に従う。区間のProblemは予約後に差し替えない。新しいtable/index、既存履歴の書換え、schema downgradeは伴わない。

optionalの算数巡回数は新しい算数区間を予約する同一transactionでだけ進め、通常Dueと再確認の交互優先・再確認候補の巡回に使う。英語区間、再読込、報酬受取では進めない。
