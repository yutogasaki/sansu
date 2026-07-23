# docs/product/15_mvp_rollout_verification_spec.md — MVP・段階導入・検証仕様

> 状態: gameplayは **MVP-0/1**、run・回答receipt・終了status保存は **MVP-2a**、Study共通plannerからSRSへつなぐ最小縦切りは **MVP-2b**、version付きactive checkpointから同じrunへ戻る中断再開は **MVP-2c**、3 / 3 / 2問segment予約は **MVP-2d**、rapid-loop適格性と全source解放guardは **MVP-2e**。`/` は `/explore` へ転送し、連問探索を通常起動面にする。`/battle` の探検基地化と発見図鑑のメモリ内縦切りは実装済み。cold-openのproduction defaultは `classic-v1` とする。旧編み根版はREJECT、一本葉を引くBloom版と「3問で水やり」版はHOLDかつ非採用である。`snap-root-v1` slotのlocal validationには `dig-pop-painted-v2` を配線済みでruntime視覚と旧高速Studyとのclean revision・10反復適格throughputは個別サブゲートを通過したが、実配信targetの同一build証拠と無文字5人テストは未実施のためrelease Gate Cとproduction判定はHOLDである。発見図鑑のrun横断永続化はまだ行わない。

## 1. MVPの目的

MVPは学習効果を証明する前に、次を検証する。

1. 探索中に「どっちへ行くか」で迷うか
2. 岩が開く・発見する瞬間が気持ちいいか
3. 「もう1問だけ」が自然に起きるか
4. 不正解や小さな失敗が離脱ではなく再挑戦につながるか
5. 算数が遊びを止める通行料ではなく、行動として感じられるか

## 2. MVP-0 実装範囲

| 項目 | 仕様 |
|---|---|
| ルート | `/explore` 新規 |
| 現行入口 | 通常起動 / 初回設定完了 → `/` → `/explore`。`/battle` からも到達可能 |
| 状態管理 | 純粋reducer、メモリ内 |
| 問題 | Study共通planner候補のうち、計画時の解放上限内かつrapid-loop適格な生成済みProblemを新規segmentへ予約する。不足分は別identityのgame-only問題で埋める |
| SRS書き込み | runへ予約したplanner assignmentと実出題skillが一致する回答だけ。未対応入力・安全fallbackは対象外 |
| マップ | ノード型15ノード、開始から終点まで8行動。固定cold-openは0タップ開始、道選択は最初の3問完了後を含む区間境界だけ |
| 行き先 | 2択中心、1層だけ3択、終盤は合流 |
| エネルギー | 12 |
| 発見 | 水晶、化石、地底花、地図のかけら |
| 導入区間 | 深度1〜3を `解く → 即世界反応 → 同じ規則の拡大 → 3問目の身体オチ` として検証する。actor、固有名、図鑑登録は価値ゲート通過まで固定しない |
| 橋 | 導入区間後の深度5に1回だけ置く固定イベント。ひかりの橋はプロフィール近傍の足し算で未完成シーンを完成へ変える |
| 失敗 | 不正解でエネルギー -1、コンボ0。1回目は同じ問題、2回目以降は安全な支援問題を優先 |
| 帰還 | 任意帰還、エネルギー切れ帰還 |
| 再探索 | 帰還要約で未訪問ルートを1件だけ「出会えるかも」と予告し、行き先を保証せず再出発を促す |
| 保存 | run、回答event、終了statusを保存。SRS対象回答は学習ログ・MemoryState・プロフィール進捗も同一transactionへ保存。発見図鑑は未接続 |

## 3. MVP-1

- 既存問題生成アダプター接続
- テンキーUI再利用
- 最小限の回答結果ログをメモリ内に保持
- 3問束は未統合でよい
- MVP-1段階ではMVP-0のループと問題接続を同じ `/explore` で提供した
- SRS・永続回答ログへの書き込みは行わない
- Golden Discovery Page 縦切りとして、安定IDのcatalog、1ラン内の通常発見で開く3手掛かり特徴、receipt確定済みQ7 finaleで開く大発見1件、対応引き算時だけ付く `root-tangle` 観察provenanceをメモリ内で検証してよい

## 4. MVP-2

### MVP-2a: 現行の保存縦切り

- 探索run開始、`affectsSrs = false` の回答event、run集計、`returned | rescued | abandoned` 終了statusをDexie version 5へ保存
- 保存済みreceipt後だけゲーム状態を進め、保存失敗時は同じProblem / AttemptIdentity / answer / energyから再試行
- 同じattempt再送と高速二重送信をevent・集計・ゲーム進行各1回へ冪等化
- 同じrun終了の再送を冪等化し、別status競合を拒否。同一プロフィールのactive runを最大1件へ収束
- 既存回答ログ、SRS、weak、解放、昇格へ書き込まない

### MVP-2b: 現行の最小学習接続

- StudyとExploreで共通の算数planner / 回答writerを使う
- `due | weak | maintenance | followup | main | plus-one | representation-retry` のassignmentを問題表示前にrunへ予約する
- 予約assignmentと実出題skillが一致する回答だけ、既存回答ログ、SRS、weak、解放・昇格用回答窓へ反映する
- unique `attemptKey` を境界に、run集計、探索event、学習ログ、MemoryState、プロフィールを同一transactionで原子的・冪等に保存する
- UIが送る `affectsSrs` は使わず、保存済みassignmentからrepositoryが判定する
- 未対応入力・生成不能のgame-only fallbackは `affectsSrs = false` のままにする

### MVP-2c: active run再開

- run行へversion付きoptional checkpointを保存し、route、energy、finds、attempt、完全なpending Problem、opening experience IDを復元する
- 回答eventがcheckpointより1件だけ先行したcrashは、保存済みreceiptを同じpending gateへ1回だけfoldする。stale revision、複数tail、assignment不一致を拒否する
- 確認済みdiscovery cursorを保存し、Q7大発見は未確認ならreload後に1回、確認済みなら0回再表示する
- checkpointなし旧active runは学習状態を変えずabandonedとし、fresh runへ移る。発見図鑑のrun横断保存は後続とする
- 2026-07-23実装証拠では `verify:core` の732テスト・build・asset gate、全23 smoke scenario、PWA更新3 scenarioを通過した。390×844 fixed-tenの専用scenarioでQ1誤答retry、Q3 route break、Q7未確認blocking discovery、Q8部分入力の4 reloadを同じrunId / gate / Problem / energy / finds / event境界で復帰し、入力文字列だけを破棄した

### MVP-2d: 3問segment予約

- runを `Q1〜3 / Q4〜6 / Q7〜8` に分け、各区間の最初のgate確定時にzero-tap routeを実nodeへ投影し、全slotの完全なProblemとassignmentをbulk reserveする
- segmentとassignment群はcheckpoint revision付きの同一transactionで保存し、保存成功後だけ最初のProblemを表示する。reload / 別tab / 遅延prefetchで既存segmentを上書きしない
- 3slot中1件でも既存policyと競合すればsegment / assignmentを0件追加するatomic rollback、同segmentの並行再送、同区間review cap、Due重複なしを自動検証する
- 区間途中でprofile unlockを注入しても残りslotのgate / category / Problem / sourceが不変で、次区間からだけ新snapshotを使うことを自動検証する
- 1回目誤答は同じProblem、2回目以降の支援は同じstepの別attemptとし、次slotを消費しない。予約Dueは回答commitまで学習済みにしない
- stale checkpointからの支援予約が0件書込みで失敗し、予約済み支援Problemがprofile更新後もdeep equalで復元されることを自動検証する
- 旧active runは現在stepから区間末尾までだけを予約し、過去のcheckpoint / event / assignmentを変更しない。高速loop適格性と `mathMaxUnlocked` 全source guardはMVP-2e相当の別ゲートとする
- 旧active runのpending full Problemを現在slotへそのまま採用し、回答前に残りslotを固定することを自動検証する
- Q7で保存されたQ8 full Problemがunlock後もdeep equalで復元される一方、blocking discovery確認前にはQ8が表示・入力可能化されないことを自動検証する
- 2026-07-23実装証拠ではclean revision `2b45b9396b164399a7d4ddc1b0fc6a9985833571` で `verify:core` の770テスト・build・asset gate、全23 smoke scenario、PWA更新3 scenarioを通過した。固定10問は4セル各10runで `evidence.eligible = true / pass = true`、all-correct中央値はStudy **124.9問/分**、Explore **262.2問/分**、未丸め比率 **2.100**、Q1 / Q2正解P95 **136.1ms**、同問誤答復帰P95 **450.0ms**。4中断の完全一致、追加0タップ、persistence integrity、学習状態不変、fixture / runtime identityを全件通過した

### MVP-2e: rapid-loop適格性

- `due | weak | maintenance | followup | main | plus-one | representation-retry` の全sourceで、未知skillまたは `mathMaxUnlocked` 超過候補が新規SRS assignmentにならないことを自動検証する
- `100` / `1.2` は適格、`1000` / `0.25`、multi / choice、筆算 / algorithm、`application` / `number-advanced` は不適格となるpure policy境界を自動検証する
- 不適格DueのMemoryState、`nextReview`、logs、recentAttempts、プロフィール回答窓を前後deep equalで確認し、Dueのまま残ることを検証する
- 候補枯渇時も全segment slotが埋まり、不足分だけ別identityの `game-only-fallback / affectsSrs = false` となり、除外Dueの流用が0件であることを検証する
- policy導入前の保存済みsegment / retryをreloadし、Problem / assignmentがdeep equal、書換え0件であることを検証する。旧runの現在slotはそのまま採用し、残りの新規slotだけ現行policyを通す
- planner 1 call / segment、segment atomic rollback、通常planner 3問graybox、fixed-ten throughputを回帰確認し、入力適格性の強化で連問テンポやSRS writerを壊さない
- 2026-07-23実装証拠ではclean revision `89291b6a0bd39b1246f2e6536991a25a3f71866b` で `verify:core` の814テスト・build・asset gate、全23 smoke scenario、PWA更新3 scenarioを通過し、独立したlearning / runtime / code監査は残存P0/P1なしと判定した。固定10問は4セル各10runで `evidence.eligible = true / pass = true`。all-correct中央値はStudy **124.4問/分**、Explore **262.1問/分**、未丸め比率 **2.106**、Q1 / Q2正解20sample P95 **136.4ms**、Explore同問誤答20sample P95 **451.7ms**。4中断の完全一致、追加0タップ、receipt / assignment / checkpoint整合、除外Dueを含む学習状態不変、fixture / runtime identityを全件通過した

## 5. 起動面統合 / MVP-3

- `/` から `/explore` への `replace` 転送は前倒しで実施する
- 旧ホームを通常起動面から外しても、プロフィール・学習ログ・SRS・探索保存を移行しない
- `/battle` は「探検基地」とし、相棒、次の未発見の気配、68px以上の「すぐ たんけん」を主役にする。価値ゲート未通過のcold-open actorや固有名を基地の恒久的な顔にしない
- 既存2人ゲームは基地の下位導線として同じURLで維持し、通常探索と価値を競合させない
- きろくへの発見ノート永続化は後続

## 6. MVP-4

- `/study` は復習・テスト用に残す
- バトルの扱いを決定

## 7. 実装タスク分解

### Task 1: Docs

- `CONSTITUTION.md` 更新
- `docs/product/01_app_spec.md` 更新
- 新規仕様書追加
- ownership map / index更新

### Task 2: Explore domain

現行実装:

```text
src/domain/explore/types.ts
src/domain/explore/generator.ts
src/domain/explore/reducer.ts
src/domain/explore/rewards.ts
src/domain/explore/__tests__/*.test.ts
```

### Task 3: Explore route

```text
src/pages/Explore.tsx
src/components/explore/ExploreMap.tsx
src/components/explore/ExploreIntro.tsx
src/components/explore/ExploreHud.tsx
src/components/explore/ExplorePathChoice.tsx
src/components/explore/BridgeChoicePanel.tsx
src/components/explore/ExploreProblemPanel.tsx
src/components/explore/ExploreActionResult.tsx
src/components/explore/DiscoveryReveal.tsx
src/components/explore/ReturnSummary.tsx
src/components/explore/ExploreGlyph.tsx
```

### Task 4: Router

- `/explore` 追加
- `/explore` では下部ナビを隠して全画面体験にする
- `/` は `/explore` へ `replace` 転送する
- `/study`・`/battle`・`/settings` の既存ルートを維持する

### Task 5: Question adapter

```text
src/domain/explore/problemAdapter.ts
```

既存 `generateMathProblem` / `MATH_GENERATORS` から、プロフィールの算数レベルに近い単一数字入力問題を取得するアダプターを作る。

### Task 6: Persistence

Dexie version 5のrun行にoptional assignmentとversion付きactive checkpointを保存する。index追加がないためversion 6には上げない。回答eventよりcheckpointが1件遅れた場合のtail replay、stale revision拒否、Q7確認cursorまでをrun再開境界とし、発見図鑑のrun横断保存は後続で拡張する。

### Task 7: Launch integration

`/` の起動面置換と `/battle` の探検基地UIは実施済み。通常起動は直接探索、探索からの退出後は基地から再出発という役割を維持する。発見ノート永続化はMVP-3の後続とする。

## 8. 検証

必須:

```bash
npm run docs:check
npm run lint
npm run typecheck
npm run test:run
npm run build
```

### 8.1 cold-open価値ゲート

cold-openは、productionの通常起動面、探検基地、図鑑、production assetへ採用する前に、次の三ゲートを別々に判定する。平均点や総合点をrelease判定へ使わず、一つでもHOLDなら全体をHOLDとする。delivery / feature-flag IDとvisual candidate IDは監査票へ別々に記録し、同じslotの再利用で旧visualの承認を継承しない。

#### Gate A: 視覚的磁力

画像に見えるものだけを次の6軸で各10点採点し、安全、テンポ、アクセシビリティ、コード品質、学習正しさを加点しない。

1. 入りたい世界
2. キャラクターへの愛着
3. 素材へ触れたい感覚
4. 構図と奥行き
5. ポップな大色面と焦点色
6. 出来事と語りたくなるpayoff

承認済み絵本調referenceをcold-open benchmark **52 / 60** とし、**52 / 60以上かつ6軸すべて8 / 10以上** を通過条件とする。source artはfull implementationへ進めるためのgate、production候補は実problem panel内の390×844と768×1024のruntime screenshotで再採点する。sourceの点数をruntimeの点数として報告しない。

#### Gate B: 無文字の因果理解と安全

- copy、状態名、意図説明を隠した同じ4状態を、意図を知らない5人へ見せる
- 5人中4人以上が同じ主動詞とpayoffを説明する
- 5人中4人以上が続きを見たい、または遊びたいと答える
- 「痛い、締め付けられた、捕まった、食べられた、ちぎれた、気絶した、切断された、武器で傷つけられた、怖い」という信頼できる危険解釈は **0件** とする
- payoffの64px黒シルエットで相棒と対象の頭・胴・両腕・両脚がそれぞれ一つの連続した身体として読め、前景や道具が首・顔・胸を横断しない

作者、実装者、意図説明を見た人の判断は事前screeningに使えても、この5人には数えない。

#### Gate C: runtime整合

- 実問題、実TenKey、実planner / writer / receipt境界を使い、1・2問目の正解から次問入力可能までローカルP95 **650ms以内**、追加 **0タップ**
- 390×844でTenKeyの `789 / 456 / 123 / 0`、C、backspace、決定がすべて表示・到達可能で、scene、feedback、celebrationが入力を覆わない。physical keyboardの `0-9 / Backspace / Delete / Enter` も同じ問題へ作用する
- 390×844と768×1024の全状態で、顔、作用する手または道具先端、対象の接地または露出した足、payoff propがanswer-shelf fadeより上へ完全に見える。一つでも棚やfadeへ隠れた場合はruntime HOLDとする
- 不正解から同じ問題へ再入力可能になるまでローカルP95 **550ms以内**
- 旧高速学習と同一固定問題で回答数/分と操作中断回数を比較し、candidateが既存の問題処理量を下回らない
- sceneの個数、長さ、目盛り、順序、scaleによるanswer leak **0件**
- 390×844と768×1024のcrop、keyboard、touch、sound off、reduced motion、ARIA、個別・総asset容量、PWA precache、required regressionをすべて通す
- 実際にユーザーが開くapp targetについて、build revision、delivery / feature flag、DOM上のvisual candidate ID、cold-cacheまたはPWA update後のassetを同じ証跡へ記録する。source、prompt、local mock、別buildのcaptureでは代用しない
- 起動からcold-open、次の意味ある遷移先までを同一端末・同一buildでcontact sheet化し、REJECT / HOLD / legacy candidateや無関係な画風の混在を0件にする。意図した世界 / 観察 / 保存mode差はcandidate IDと素材契約で説明できること
- critical-path contact sheetは少なくとも390×844と768×1024の `cold launch / ready / dig-one / dig-two / popped / 道選択 / Q4通常問題 / 大遭遇idle / 大遭遇correct / Q7直前 / Q7 same-camera payoff / 図鑑 / Q8 / 帰還 / 再出発 / 基地` を、actual app target・同一build revision・同一deliveryで収録する。各captureには `pokko-field-v1`、surface candidate、visual mode、cache状態を機械可読manifestへ併記する
- 通常のsmoke testはversion管理された監査画像を上書きしない。監査captureは明示的なvisual-audit modeでだけ生成し、manifestのbuild revisionと画像群が一致しない証跡をrelease判定へ使わない
- app rootのbuild revision / delivery IDと各critical surfaceのlineage / candidate / modeが欠ける、同じrunに白い長耳・cream cat・リボン触角の洋梨型・旧マキモドンが現れる、またはQ7の観察対象と絵が一致しない場合、Gate CをFAILとする

固定10問比較は `npm run benchmark:fixed-ten` で実施する。fixture `cold-open-fixed-ten-v1` の順序は `1+1, 2+3, 4+2, 5+3, 7+1, 8+2, 9+3, 6+2, 3+3, 9+1` とし、390×844、reduced motion、sound off、physical keyboard、asset warm済みでlane順を反復ごとに交互化する。Studyは現行高速回答面の非記録proxy、Exploreは8回答の実run、実帰還、実summary / replay、別runの2回答で構成し、productionの1ランを10行動へ延長しない。

主比較はall-correctを各lane 10反復し、回答数/分の未丸め中央値比 `Explore / Study >= 1.000` とする。Q4 / Q8誤答scenarioも10反復するが、Studyの「訂正表示 → Next → 次問」とExploreの「同じ問題へ再入力 → 正解」は意味が異なるため、Studyの訂正表示・次問到達とExploreの同問再入力を別指標として記録し、両者のmiss-flow throughputを採否へ使わない。全非回答clickを中断として数え、Exploreはreceipt数とattempt数の一致、attempt key重複0、全件 `affectsSrs = false`、学習状態不変を必須とする。

全問足し算の固定10問ではroot-tangleの引き算遭遇を偽装せず、Q7は中立の調査ページpayoffとする。Exploreの許容中断は各laneでちょうど4件、順序も `Q3 route-choice → Q7 discovery-close → Q8 return → Q8 replay` とする。Q1〜2、Q4〜6、Q8〜10はblocking 0件、Q8は標本toastを閉じる操作なしでprimaryの持ち帰りへ到達し、再出発後は前runのoverlay / reaction / page進捗を表示しないことをfixtureでassertする。root固有のworld reactionと観察provenanceは、実plannerが対応引き算を割り当てるroot-tangle E2Eで別に必須とする。

各4セル10run、ExploreのQ1 / Q2正解20sample、Explore同問再入力20sample、Study訂正表示20sample、clean revision、harness専用server、delivery `snap-root-v1`、candidate `dig-pop-painted-v2` が揃わない計測はdiagnosticでありGate C証拠にしない。固定fixtureはTenKey、画面遷移、game-only reservation / receipt、throughputの証拠であり、通常planner / writer / SRS真正性は既存3問grayboxで別に検証する。ignoredの `output/fixed-ten-throughput/latest.json` だけを恒久証拠にせず、適格runのrevisionと集計値をversioned監査へ転記する。

判定は `ready / beat-1 / beat-2 / payoff` のsource、実runtime、通常motion、reduced motion、sound offを証拠種別ごとに分ける。2回の視覚改善でもGate Aを満たさない場合は、色や装飾を足すのではなく主動詞、silhouette、構図、またはrendering方式を変更する。三ゲートすべてを通るまでproduction defaultは `classic-v1` のままとする。

delivery / feature-flag ID `snap-root-v1` のlocal validationへ載せる現行visual candidateは `dig-pop-painted-v2` とする。`ready → dig-one → dig-two → popped` で、相棒が根生物の身体や葉ではなく周囲の同じ土を掘り、土が飛ぶ、対象の足が見える、全身でぽんと抜ける、相棒が尻もちをついて柔らかい土塊が葉帽子へ載る、という一つの因果を作る。locked background、承認済みcharacter / prop reference、state overlayで制作し、runtime Gate Aは390×844で **52 / 53 / 52 / 53**、768×1024で **52 / 53 / 53 / 53**、各6軸8以上のGOとした。実TenKey、追加0タップ、answer leak 0、正解20件P95 **124ms**、誤答20件P95 **440ms**、asset / PWA / required regressionはruntime技術サブゲートを通過した。さらにclean revision `85b1bf19548db523b535d10549bd622294f149bf` の固定10問を10反復し、Q7の中立大発見を含む4中断でall-correct中央値はStudy **123.6問/分**、Explore **270.0問/分**、未丸め比率 **2.184**、Q1 / Q2正解P95 **121.7ms**、同問誤答復帰P95 **451.7ms** でthroughputサブゲートを通過した。ただし実配信targetの同一build critical-path contact sheetが未実施のためrelease Gate CはHOLD、Gate Bも未実施のためproduction判定はHOLDとする。証跡は [Dig Pop Painted v2 runtime監査](/docs/design/audits/2026-07-21-dig-pop-painted-v2/README.md) を参照する。

旧source candidate `dig-pop-painted-v1` はGate A **50 / 60** のHOLDである。背景、相棒、根生物、スコップがstate間でdriftし、`dig-one → dig-two` の差が弱かったため、v2とは別candidate IDとして扱い、承認を継承しない。

旧 `ready → tug → tumble → landed` は、編み根へ入った相棒の身体が切断・拘束され、根生物が浮遊する頭部に見える実機画像を見落としていたため撤回する。旧編み根と `nest-squash | nest-tip` はlocal / productionの安全候補へ戻さない。一本葉を引くBloom版も「赤い子の髪を引く」「独立した花が理由なく開く」という独立監査で75 / 100のHOLDとする。水やり版は身体安全と因果を改善したが、承認済み絵本調referenceより画面の材質、奥行き、キャラクター性、出来事性が弱く、旧混合採点84〜86をvisual採用根拠にしない。HOLDかつ非採用とし、`dig-pop-painted-v2` へvisual承認を継承しない。

旧Root Pullは旧混合採点でv1 **75 / 100（±4）**、v2 **77 / 100（±3）** のHOLDとなった。旧編み根版Snap Rootの **87〜88 / 100** は、新しいユーザー実機画像を最優先証拠として再監査した結果、子どもの安全2 / 10、first-six 31 / 60、総合 **50 / 100** のREJECTへ訂正し、数値価値Goを失効させる。反復ブラウザ測定の正解20件P95 **125ms**、誤答20件P95 **443ms** はplumbingのテンポ証拠として有効だが、旧visualの安全性や採用を証明しない。旧混合採点は履歴・診断にだけ残し、現行の三つの非補償ゲートを上書きしない。旧監査は [Superseded Snap Root突破ループ監査](/docs/design/audits/2026-07-21-snap-root-breakthrough-loop/README.md)、水やり版までの契約は [Snap Root Bloom安全ループ監査](/docs/design/audits/2026-07-21-snap-root-bloom-safety-loop/README.md) を参照する。

価値ゲートと別に、旧高速学習とcandidateを同じ10問で比較し、回答数/分、正答率、正解後待ち時間、誤答後復帰時間、操作中断回数を記録する。cold-openは既存の問題処理量を下回らないことを採用条件とする。

探索追加後:

- reducer単体テスト
- 生成マップが詰まないこと
- エネルギーが負にならないこと
- 帰還できること
- 不正解時に責める文言が出ないこと
- 390×844で探検基地の「すぐ たんけん」がスクロール前に完全表示され、横overflowがないこと
- 探検基地から `/explore`、協力、つなひき、2人ゲーム詳細の既存URLを開けること
- 下部ナビの名称が `基地` であり、探検基地に絵文字・敵撃破・架空進捗が混ざらないこと
- reduced motion確認
- スマホ縦確認（基準 390×844）
- タブレット確認（基準 768×1024。横向きの既存2カラムも回帰確認）
- ひかりの橋で未入力、誤答、持続ヒント、正解、完成の各状態が同じ遭遇内に留まること
- cold-openの3問が任意の正答値・演算・categoryで `ready → dig-one → dig-two → popped` と進み、問題値、演算、category、assignment、SRS扱いを演出都合で変更しないこと
- 1・2問目の土掘り、地面線、対象高、足の露出と、3問目の全身pop・尻もち・柔らかい土帽子が同じcamera、actor、対象、スコップ、土で読めること。根生物の身体や葉へスコップや相棒が接触しないこと
- cold-openの誤答でstageが進まず、現在のstageと同じ問題を維持すること
- 1・2問目は追加0タップ・submit起点ローカルP95 650ms以内で次問へ進み、3問目だけが候補ごとに検証した身体オチの区切りを持つこと
- 1・2問目のopening途中発見はtoastを出さず、TenKeyと身体変化を同時に操作・視認できること
- 正解後の次問先読みがtimeoutまたはerrorの場合はabortして通常plannerへ戻り、誤答後の支援先読みがtimeoutまたはerrorの場合はabortして同じ問題へ戻ること。どちらも期限後の結果で現行gateを上書きせず、blocking discoveryを越えて先読みしないこと
- reduced motionでも各stageの地面線、対象高、足の露出、最終位置、因果が残り、移動補間・土の飛散・跳ね・回転・zoomだけが止まること
- authoring sourceではlocked background、character / prop reference、state overlayを分離し、runtime deliveryではUI文字なしの承認済みflattened frameを使うこと。問題、TenKey、進捗、状態文言はDOMへ残り、source scoreとruntime screenshot scoreを混同しないこと
- bridgeがcold-openの背後に隠れず、深度5で橋の見た目、プラン、追加コストを明示してから専用遭遇へ入ること
- 根っこのからまりが1ラン最大1件、cold-open3問と深度4〜6のほたる花3手掛かりの後の深度7に決定的に配置されること
- 根っこのからまりで未入力、誤答、持続ヒント、根の開通、相棒通過が同じ遭遇内に留まること
- 専用遭遇がプロフィール近傍の対応スキルでだけ選ばれ、対応不能時は通常問題へ戻ること
- 専用遭遇がBridge/Concreteの明示スキル以外を受け取らず、視覚ヒントなしの専用画面を作らないこと
- 遭遇追加で探索ページ本体へ遭遇名ごとの状態分岐を増やさないこと
- ひかりの橋と根っこのからまりの全操作ボタンが44px以上で、画面外へはみ出さないこと
- `public/assets/explore/` のJPG/JPEG/WebP/AVIFがPWAの事前キャッシュへ入り、リモートとオフラインで同じURLから読めること
- 帰還要約が未訪問の専用遭遇を優先して予告し、「ちがう道へ しゅっぱつ」から新しいランを開始できること
- 8回答後は余剰edgeがあっても成功終端を優先し、8回答前の欠損edgeは「てがかりがつながった」と偽らず回復帰還になること
- 調査ページの特徴が重複せず、次の手掛かりが同時に2件以上出ないこと
- 3つの手掛かり特徴を順に見つけた後も4件目という順番だけでは大発見にならず、receipt確定済みQ7 finaleだけが最終特徴を1回開くこと。保存済み対応引き算の `root-tangle` 解決だけが固有の観察provenanceを追加すること
- 将来、価値ゲートを通ったcold-openページとほたる花の両方が進む場合も、帰還画面が最初の完了ページではなく最後に進めた主調査を選び、そのページの最終 `finding` を物語文に使うこと。検証中candidateはページ選択へ入れない
- legacy保存ID `discovery-page:jabarapon` / `discovery-feature:jabarapon-*` を持つ既存snapshotをデータ損失なく再読でき、保存IDが現行candidateの選択、マキモドンの再承認、子ども向け名称へ使われないこと
- root観察はcommit済みattempt key、node、encounter、直近discoveryが一致するまで開かず、保存中・保存失敗・mismatch・duplicate・前提不足・別遭遇では開かないこと
- rootのworld reactionと観察でresolved sceneのsource、camera key、object position、主要bounding boxが一致し、production root rasterが既存3件から増えないこと
- `found` 表示が学習上の `mastered`、SRS更新、解放・昇格を暗黙に発生させないこと
- Golden Discovery Page の基準画像が `public` やPWA precacheではなく制作領域に置かれていること
- 390×844で世界変化、3つの手掛かり、主操作が同時に読めること
- `startExploreRun` 成功前と回答保存中は回答操作が無効で、高速二重送信でも `problem_answered` event、run集計、エネルギー・発見進行が1回だけであること
- 通常起動と帰還画面からの再出発は、固定cold-openへ道選択なし・0タップで入り、初問前に選んだnodeと固定演出が食い違う状態を作らないこと
- 3問完了後にはじめて2件以上の実際に反映できる道選択が現れ、390×844では通過済み・未到達ノード、番号、同一コストの重複表示で主操作を埋めないこと
- 同一区間の正解後に続行ボタンや道選択を挟まず次問が出て、ローカル目標650ms・CI上限1500msを満たすこと
- 通常発見と通常調査手掛かりのtoast表示中も問題入力または次の区間選択が有効で、大発見だけがmodalになること
- 調査ページ外のレア標本も希少度だけではmodalにならず、Q8の最後の標本が大発見に続く2回目のblocking表示を作らないこと
- 不正解から550ms以内を目標に同じ問題へ再入力できること
- 回答保存失敗後も同じProblem、入力answer、1-based AttemptIdentity、attemptCount、energyを維持し、責めない再試行操作から成功後に1回だけ進むこと
- forged / mismatch / duplicate receiptがreducerを不正進行させないこと
- planner assignmentのcategory / source / review区分と実出題問題が一致し、専用遭遇の都合でcategoryを差し替えないこと
- 最初の誤答再試行は同じproblem assignmentを使い、2回目後の支援問題だけ新しい `representation-retry` assignmentを予約すること
- SRS対象回答の逐次・並行再送でもrun、event、log、MemoryState、todayCount、streak、recentAttempts、mathLevelsが各1回だけ更新されること
- 学習storeまたは探索eventの保存失敗時に、回答に関わる全更新がrollbackし、同じattemptから再送できること
- Studyの通常回答も共通planner / writerを通り、Due、weak、maintenance、followup、main、+1、skip guard、復習上限に回帰がないこと
- 帰還・救出はrun終了保存後だけsummaryへ進み、退出・再出発はabandoned保存後だけ遷移すること。終了失敗時は現在のrunから再試行できること
- 同一run・同一statusの終了再送は1件、別statusは競合となり、新run開始後の同一profile active runが最大1件であること
- game-only fallbackでは既存 `logs`、MemoryState、weak、解放、昇格が不変であり、予約済みSRS対象回答では既存学習仕様どおりにだけ更新されること

## 9. 成功判定

開発者・家族テストで以下を観察する。

- 説明なしで始められるか
- 子どもが行き先を自分で選ぶか
- 発見演出で反応があるか
- 不正解後に続けるか
- 1ラン終了後に「もう一回」が出るか
- 保護者が学習内容を理解できるか

数値:

- 1ラン完走率
- 2ラン目開始率
- 不正解後継続率
- 平均問題数
- 回答数/分と旧高速学習比
- 正解後の次問入力可能P95
- 不正解後の再入力可能P95
- cold-open三ゲート結果（視覚的磁力 / 60と各軸、textlessの主動詞・payoff一致人数／続行希望人数／危険解釈件数、runtime整合）
- 自主帰還率
- エネルギー切れ率
