# docs/product/11_learning_integration_spec.md — 学習ロジック統合仕様

> 状態: 既定起動面の探索へ **MVP-2b の最小学習接続**と **MVP-2d の3 / 3 / 2問segment予約**を適用する。Study と共通の算数 planner が選んだ assignment だけをSRS対象とし、run・回答receipt・学習記録を同じ冪等保存境界で扱う。未対応入力や安全fallbackは引き続き学習進捗へ混ぜない。

## 1. 基本方針

探索を面白くするためにゲーム上の失敗・選択・運を導入する。ただし、算数カリキュラム、問題生成、SRS、Due、weak、解放、昇格はプロダクトの学習基盤として維持する。

## 2. 問題選択の原則

### 2.1 子どもに直接「問題難度」を選ばせない

子どもはルート、地形、報酬傾向、危険度を選ぶ。内部の問題はアプリが選ぶ。MVP-0/1ではプロフィールの現在レベルに近い単一数字入力スキルを選び、MVP-2以降は学習エンジンのDue / weak / 3問束を含む順序へ接続する。

理由:

- 易しい問題だけ選ぶことを防ぐ
- 苦手回避を防ぐ
- Due / weak を回す
- Concrete → Bridge → Symbol → Algorithm の流れを守る

### 2.2 ただし「リスク選択」は許可する

子どもが選べるのは、問題そのものではなく、ゲーム上のリスク。

例:

| 選択 | 問題難度 | ゲームリスク |
|---|---|---|
| 安全な道 | 通常編成 | 報酬普通 |
| きらきら道 | 通常編成 | レア率高いが橋イベントあり |
| 近道 | 通常編成 | エネルギー消費が大きい |
| チャレンジ岩 | 同一スキル内で少し難しめ | 失敗時ボーナス喪失 |

チャレンジ岩は正式版以降。MVPではルート差は発見傾向だけにしてもよい。

### 2.3 専用遭遇と問題選択

MVP-0/1の専用遭遇は、まずプロフィール近傍の候補レベルを確定し、その最短距離の候補内で世界アクションと意味が一致するスキルがある場合だけ適用する。

`ひかりの橋` は「2つの光が1つになる」という世界の変化と一致する足し算を、同じ近傍候補内で優先する。近傍候補に対応する足し算がない場合は、遠い足し算へ移動せず通常の橋ゲートを使う。これは子どもに難度を選ばせる機能ではなく、学習エンジンが選べる範囲の中から表示を対応づける機能である。

`根っこのからまり` は「引く数だけ根をほどき、残りを見る」と一致する引き算のうち、具体物またはBridge表現を持つ明示スキルだけを使う。単にskill IDが `sub_` で始まるだけでは専用遭遇へ入れない。筆算・記号問題など数量ヒントを保証できない場合は、同じプロフィールレベルの通常rootゲートを優先し、演出のために下位スキルへ移動しない。

Q7の調査ページfinaleは学習categoryとは独立した報酬roleであり、3つの保存済み手掛かりとQ7回答receiptがそろえば中立のページpayoffを開いてよい。ただし `根をほどいた` という動作、root固有のworld reaction、観察provenanceは、上記の対応引き算と同一receiptが確認できた場合だけ使う。大発見を保証するためにDue / weak / +1のcategoryを差し替えない。

現行の専用表現対応スキル:

- ひかりの橋: `add_1d_1_bridge`, `add_1d_2_bridge`, `add_2d1d_nc_bridge`, `add_2d1d_c_bridge`
- 根っこのからまり: `sub_tiny`, `sub_1d1d_nc_bridge`, `sub_1d1d_c_bridge`, `sub_2d1d_nc_bridge`, `sub_2d1d_c_bridge`

2回目以降の誤答では専用遭遇の見た目より、既存の `reviewFallbackSkillIds` と概念安全な支援順序を優先する。支援問題が同じ世界アクションと一致しない場合は通常の問題表示へ戻してよく、問題の意味を偽らない。

cold-openの最初の3問は専用算数遭遇ではなく、保存済み正解数を一つの身体規則へ写す表示専用ビートである。各問の `Problem.categoryId`、演算、正答値、planner assignment、`affectsSrs` は通常の学習計画を正とし、演出のために差し替えない。delivery / feature-flag ID `snap-root-v1` のlocal validationへ載せる現行visual candidate `dig-pop-painted-v2` は、正解数 `0 / 1 / 2 / 3` を `ready / dig-one / dig-two / popped` へ写し、誤答はstageを進めない。旧 `landed`、一本葉を引く `tug / tumble`、水やり版 `pour / splash / bloomed`、payoff variantは現行候補から撤去する。土塊の個数、掘る距離、根生物の高さは正答値を表さず、相棒・スコップ・土・根生物は表示専用であり、planner / writer / SRS / receipt契約を変更しない。`dig-pop-painted-v1` はsource art 50 / 60のHOLDとして履歴に残す。v2はlocal runtimeへ配線済みだが、残る非補償ゲートが通るまでproduction defaultへ昇格しない。

### 2.4 ラン中の問題再現性

探索は各候補スキルの問題を `explore-problem-v1 / run seed / gateId / attemptCount / skillId` の組から作る独立乱数で生成する。同じプロフィールsnapshotと同じ組なら、式、正答、選択肢、数量視覚まで同じになる。別スキルの生成や候補順変更が、採用したスキルのオペランドをずらしてはならない。

数学generatorは任意の明示random contextを受け取り、探索から呼ぶ場合はmodule-global乱数や `Math.random` の一時差し替えを使わない。通常学習からrandom contextを渡さない既存経路は従来どおり非決定生成を続ける。MVP-2でラン保存・再開を導入するときは、同じプロフィールsnapshotを固定するか生成済みProblemを保存する。

## 3. 問題ゲート

探索アクションは `ExploreProblemGate` を通じて既存問題生成を呼ぶ。

現行ゲートは、`gateId`、`nodeId`、`dig | bridge`、`attemptCount`、任意の `skillId` / `bridgePlan` / `problem` に加え、問題表示後は予約済み `learningAssignment` を持つ。以下は将来のstakes統合まで含む拡張型案であり、現行実装型そのものではない。

```ts
export interface ExploreProblemGate {
  gateId: string;
  actionType: 'dig' | 'bridge' | 'switch' | 'return' | 'event';
  subject: 'math' | 'english';
  skillId?: string;
  source: 'normal' | 'review' | 'weak' | 'due' | 'bridge-sequence' | 'challenge';
  problemId: string;
  attemptCount: number;
  maxAttemptsBeforeAssist: number;
  stakes: ExploreProblemStakes;
}

export interface ExploreProblemStakes {
  onCorrect: ExploreRewardPlan;
  onIncorrect: ExplorePenaltyPlan;
  allowPartialProgress: boolean;
  affectsSrs: boolean;
}
```

### 3.1 次ループ契約: AttemptIdentityと学習記録境界

MVP-2の保存接続では、探索の1回答を次の4要素で識別する。`attemptNumber` はゲート内で **1始まりの正整数** とし、現行の0始まり `attemptCount` から作る場合は保存境界で `attemptCount + 1` に変換する。

```ts
export interface AttemptIdentity {
  profileId: string;
  runId: string;
  gateId: string;
  attemptNumber: number;
}
```

- 安定keyは `explore-attempt-v1 / profileId / runId / gateId / attemptNumber` のversion付きtupleから作る。同一identityの再送は同じ回答として扱い、SRSやゲームイベントを二重更新しない。
- 学習記録へ渡す `skillId` は、ゲートが最初に要求したskillではなく、支援・fallbackを含めて **実際に出題した `Problem.categoryId`** を正とする。
- 旧MVP-0/1の「プロフィールの現在レベルに近い問題」や、現行の未対応入力・生成不能fallbackは、planner assignmentではないため `affectsSrs = false` とする。探索イベントには残してよいが、既存回答ログ、MemoryState、weak、解放、昇格を更新しない。
- `affectsSrs = true` は、学習plannerが `source` と対象skillを確定し、runへ予約した assignment と実出題 `Problem.categoryId` が一致する問題にだけ設定する。UIが送るbooleanを根拠にしてはならない。

### 3.2 学習 assignment の予約

- planner は `due | weak | maintenance | followup | main | plus-one | representation-retry` の source と、`categoryId`、`isReview`、`isMaintenanceCheck`、復習上限算入フラグを返す
- Explore は問題表示前にこの assignment を `runId / gateId / problemId` に結び付けて run 行へ予約する。同じ予約keyの再送は同じ assignment を返し、異なる category や source は競合として拒否する
- 問題生成は予約済み category をそのまま使う。専用遭遇は問題へ適合する場合だけ表示し、遭遇を成立させるために planner の category を差し替えない
- 生成不能・入力未対応時は明示的な game-only assignment を予約して `affectsSrs = false` とする
- `cold-open-fixed-ten-v1` はDEV限定の表示throughput比較fixtureであり、production plannerのassignmentではない。同一 `add_1d_1` を10回固定するため、Exploreでは `game-only-fallback / affectsSrs = false` を予約し、Studyでは非記録DEV sessionを使う。両laneとも実行前後で `logs`、MemoryState、プロフィール学習進捗を変えず、この結果をDue / weak / maintenance / followup / main / plus-oneの選択品質の証拠にしない
- 最初の誤答後に同じ問題を再試行する場合は同じ problem assignment を使う。支援問題へ切り替えた場合だけ `representation-retry` の新しい assignment を予約する。submit起点550msの操作可能予算内に予約できない、または予約に失敗した場合は処理をabortし、同じProblemとassignmentを再び操作可能にする。期限後に完了した結果で入力面を差し替えない

repositoryは、その回答に必要な永続更新がcommitした後だけ保存済みreceiptを返す。`result` はUIが再計算した値ではなく、保存済み `problem_answered` eventから復元した正誤を表す。

```ts
export interface ExploreAttemptCommitReceipt {
  attemptKey: string;
  identity: AttemptIdentity;
  recordedSkillId: string; // fallback後のProblem.categoryId
  result: 'correct' | 'incorrect' | 'skipped';
  affectsSrs: boolean;
  committedAt: number;
}
```

探索reducerはこのreceiptを受け取ってからゲーム状態を進める。run、gate、1始まりattemptNumber、保存result、実出題skill、予約assignment、version付き `attemptKey` が現在のgateと一致しないreceiptは拒否する。同じ `attemptKey` のreceiptを再受信した場合は二重進行させない。保存失敗時はreceiptを返さず、同じProblem・同じAttemptIdentity・入力answer・attemptCount・energyから再試行できる状態を維持する。

SRS対象回答のtransactionは、unique `attemptKey` を確認した後、run集計、`problem_answered` event、`logs`、`memoryMath`、プロフィールの `todayCount / streak / recentAttempts / mathLevels` を一体で更新する。どこか1件でも失敗した場合は全更新をrollbackする。同じattemptの逐次・並行再送では最初のeventから同じreceiptを復元し、SRSとゲーム状態を二重更新しない。

run開始も回答の前提にする。プロフィール解決後に `startExploreRun` が成功するまで問題操作を解禁しない。保存中は同一tickのEnter / clickを含む二重送信を止め、成功receipt後だけ正誤feedback、エネルギー、発見、問題更新を適用する。

帰還・救出は `finishExploreRun` が `returned | rescued` を保存した後だけsummaryへ進む。退出・再出発はactive runを `abandoned` として閉じてから遷移し、終了保存に失敗した場合は現在のrunを維持して同じ操作を再試行できるようにする。同一run・同一statusの終了再送は冪等、別terminal statusは競合とする。

### 3.3 active run checkpointと回答tail復旧

- Explore起動時はfresh runを開始する前に同一プロフィールのactive runを検索する。有効なversion付きcheckpointがあれば、同じrunId、seed、route、energy、finds、attempt、pending Problemへ直接復帰し、新しい `run_started` を作らない
- checkpointは完全なpending `Problem` と予約assignmentを照合できるkeyを保持する。回答途中の入力文字列は保存せず、reload後は同じ式・同じattemptNumberの空入力へ戻す
- route選択、bridge plan、問題予約はcheckpoint保存後に回答を解禁する。回答commit後も、投影したreducer stateのcheckpoint保存が成功するまで次問を解禁しない
- `problem_answered` eventだけがcheckpointより1件先行した場合は、checkpoint内のpending Problem / assignmentへ既存receiptを1回だけ適用してcheckpointを前進させる。`committedAttemptKeys`済みeventは再適用せず、未反映eventが複数、gate / category / source不一致、未知schemaでは自動replanや近似復元をしない
- checkpoint revisionは単調増加とし、回答commit、checkpoint更新、run終了は呼び出し元が見たrevisionを照合する。別tabや古い非同期処理によるstale更新は競合として拒否する
- opening experience IDをcheckpointへ固定し、reloadでactorや演出系統を切り替えない。確認済みdiscovery cursorは存在するfindの順序だけを前進でき、Q7 blocking発見はcursor保存成功後にだけ閉じる
- indexを増やさないrun行のoptional fieldとして保存するため、Dexie version 5を維持する。checkpointのない旧active runはSRSや発見を推測せずabandonedとし、finished rowはそのまま読む

### 3.4 immutable 3問learning segment

- 正解stepは `0〜2 / 3〜5 / 6〜7` のsegmentへ分ける。segmentの最初の実gateが決まった時点で、残りのzero-tap routeを実nodeへ純粋投影し、回答writeと混ざらない単一snapshotからStudy共通plannerをsegment長で一度だけ呼ぶ
- 各slotは絶対step、slot / sequence順、実gate / node、完全な `Problem`、encounter、source / review / maintenance / review-cap / `affectsSrs` を含むassignment、stable segment seed、planner / generator versionを持つ。run行のoptional `learningSegments` と `learningAssignments` を同一transactionで保存し、checkpoint revisionと所有profileを照合する。full Problemが正本でありfresh profileから再生成しない
- segmentを保存した後は、プロフィールの `mathMainLevel / mathMaxUnlocked / mathSkills` やDue状態が変わってもslotを再生成しない。次segmentだけ最新snapshotで計画する。Dueは予約だけでは消化せず、そのslotの回答commit時だけ既存writerへ渡す
- 1回目の誤答は同じProblemを維持し、2回目以降のrepresentation retryは元slotと同じstepの別assignmentとする。retryはcheckpoint revision / step / gate / attemptをCAS照合し、完全なProblemとencounterをassignmentと同時に保存する。retryは次slotを消費せず、segment本体を置換しない
- 旧active runがsegment途中で `learningSegments` を持たない場合は、過去の回答・assignmentを変えず、現在stepからsegment末尾までだけを一度予約する。既存segment、同slotの別gate binding、assignment policy不一致はfirst-writerの保存値を正本とし、推測mergeしない
- 旧active runのcheckpointに現在のfull Problemがある場合は、それを現在slotへbyte-for-byteで採用してから入力を解禁する。既存assignmentだけがありProblem未適用なら、その既存assignmentを現在slotとして復元し、同じ予約transactionで残りslotを固定する
- review候補の上限は固定booleanで一度だけ許可せず、既存assignmentと同じsegmentで既に計画したslotを含め、候補ごとにcallbackで再判定する。通常のDue候補は同segmentで1回だけ予約し、予約だけではMemoryStateのDueを消化しない
- Q7開始時のQ8 slot予約は保存済み学習planに限る。Q7のblocking discovery確認checkpointが保存される前に、Q8を `SET_PROBLEM` 相当のruntime stateへ適用しない
- profile / Memory / logs / runを読むplanner snapshotとsegment書込みは同じDexie transactionをlinearization点とする。別tabのStudy回答をtransactionの途中へ混ぜず、古いread snapshotを後からfirst-writerにしない
- これは出題順の安定化であり、`number input可能` と高速loop適格性の判定や全sourceの `mathMaxUnlocked` guardは次の独立境界で行う。segment予約によって不適格問題を適格扱いしない

## 4. 正誤処理

### 4.1 正解

- アクション成功
- MVP-0/1: ラン中の回答履歴だけをメモリに追加
- MVP-2以降: 永続回答ログを保存し、既存学習仕様に従ってSRSを更新
- コンボ加算
- 発見・報酬抽選
- 演出発火
- 保存成功receipt後の通常正解保持は180ms以下、専用遭遇は320ms以下を目標にし、同一区間の次問は追加操作なしで正解から650ms以内に操作可能にする。cold-openの1・2問目もこの上限を守り、3問目だけは候補ごとに検証した身体オチの読取時間を持てる。固有actorのための固定待機時間を学習契約へ埋め込まない
- 保存成功receiptから投影できる次gateは成功姿勢の表示中に予約してよい。ただしblocking discoveryを越えて先読みしない。submit起点650msの操作可能予算内に予約できない、または予約に失敗した場合は先読みをabortし、既存の通常planner経路で次問を作る。古い予約結果を現行gateへ適用しない
- 通常発見と通常調査手掛かりは約900msの非blocking toastとし、表示中も次問の入力を妨げない。大発見だけを明示的な続行操作のある区切りにする

### 4.2 不正解

不正解は責めない。ただしゲーム上の意味は持たせる。

現行MVP-0/1の既定:

- エネルギー -1
- コンボ0
- 1回目は同じ問題を再表示
- 2回目以降は、そのスキルの `reviewFallbackSkillIds` を最優先し、なければ明示した安全な前提スキル、同一概念の易しいスキル、より低いレベルの同familyを順に探す。安全な戻し先がない場合は「易しくなった」と偽らず、プロフィール近傍の別問題へ切り替える
- ヒント模様の短いフィードバックを出す
- 誤答feedbackの入力ロックはsubmit起点550ms以下を目標にし、同じ問題へ追加操作なしで戻す
- 誤答の視覚・音feedbackはローカル判定直後に始めてよいが、保存receiptが返るまでは入力をロックし、stage、energy、attemptCount、SRSを変更しない。再入力の待ち時間は保存完了後へ固定加算せず、submit時点からの総予算として扱う。2回目以降の誤答では、receiptで確定したstateから次の支援assignmentをfeedback中に予約してよい。適用時は既存の `runId / gateId / assignment` guardを通し、古い先読み結果で現行問題を上書きしない。予約がtimeoutまたはerrorになった場合はabortし、同じProblem、同じassignment、空の再入力面へ戻す。保存失敗時は同じfrozen answerとattempt keyで再試行できる状態へ戻す

プレイテスト後の比較候補:

- エネルギーは減らさない
- そのマスのボーナス報酬を失う
- コンボ0
- ヒント付きで進行

現行のエネルギー減を基準に観察し、低学年の離脱が強い場合のみボーナス減方式と比較する。

### 4.3 スキップ

MVP-0/1の探索画面にはスキップ操作を置かない。MVP-2以降に追加する場合は、学習ログ上の `skipped` とゲーム上の短期影響を分離し、長期報酬・図鑑を没収しない。

## 5. 3問束の探索内表現

MVP-0/1から操作テンポとして3問の連問区間を使う。MVP-2以降は、その区間へ既存の Concrete / Bridge → Symbol / Reverse → Mental / Algorithm を接続し、「同じ仕掛けを理解して突破する流れ」として見せる。

cold-openでも3問のassignment順はplannerが決める。`beat-1 / beat-2 / payoff` は学習ステップ名や答えの値ではなく、保存済み正解回数だけを、輪郭・位置・相棒との接触で伝える非色覚依存の進捗表示である。

例:

```text
1問目: 石の数を見て考える Concrete
2問目: 式で水晶を合わせる Symbol
3問目: 暗算で橋の鍵を開く Mental
```

子どもには「補習」ではなく「仕掛けの段階」として見せる。

## 6. 英語の扱い

初期探索は算数のみ。英語は以下の理由で別体験候補にする。

- 英語は4択で、地形を掘る必然性が弱い
- 抽象語が地底の具体物と合いにくい
- 中学生向け英語と低学年向け地底演出の年齢感がずれる

将来案:

- 英語: 店舗運営ゲーム
- 英語: 旅・図鑑・会話ゲーム
- 英語: 探検ノートの発見カード解読

## 7. SRS接続フェーズ

| フェーズ | 接続 |
|---|---|
| MVP-0 | 純粋reducerによる探索ループ。保存・SRS書き込みなし |
| MVP-1 | `generateMathProblem` / `MATH_GENERATORS` 接続、テンキー再利用、ラン中の回答履歴のみ保持 |
| MVP-2a | 探索run・`affectsSrs = false` の回答event・終了statusを保存し、保存済みreceipt後だけゲームを進める。既存学習ログとSRSは変更しない |
| MVP-2b | 学習planner対象回答を保存し、SRS / Due / weak / 解放 / 昇格用回答窓へ接続 |
| MVP-2c | version付きactive checkpoint、最大1件のanswer tail replay、確認済みdiscovery cursorでrun再開へ接続。発見図鑑のrun横断永続化は後続 |
| MVP-3 | ホーム探索CTA、いきものリアクション、きろくの発見ノートを統合 |
| MVP-4 | 検証結果から通常導線を探索中心へ移すか判断 |
