# 島の報酬・成長バランス

[実画面と変更表](review.html) · [画面の識別/hash](capture-manifest.json) · [固定入力](build-source.json) · [統合時のファイル照合](integration-files.json)

## 変更と設計値

「すぐに星があつまりすぎ、星以外も」に対応。新予約は問題全体の完了1問につき1こを区間完了時に加算する。3〜6問ごと10こだった固定報酬を改め、飾り15/20/25こ、テーマ60/100/150こへ調整した。初めの飾りと貯めるテーマを選べ、全6商品の合計は370こ。誤答・筆算途中・支援を開くだけ・reload・放置では増えず、訂正と支援による完了は同額になる。

各場所の成長に必要な問題数は目盛りごと3/6/9/12/15/18問。累計3/18/63問で姿の段階1/2/3へ進む。最初の変化は3問で残し、以降の成長・土地・発見の解放を段階的にする。目盛りの途中を場所ごとに保存・表示し、育てる場所を変えても消さない。成熟を超える最大5問分は同じ場所で打ち止めとし、予約外の場所へ振り替えない。土地の解放条件は1/2場所の成熟、基本の自動配置は有限7物のまま。

初回3問・以降すべて6問の例は11/22/33/44区間で成熟、全体261問（旧24区間・141問）。実plannerは問題形式により区間長が変わる。今回の実UI検査では両サイズとも14/25/36/47区間で成熟し、その後も通常回答を継続できた。固定6問へ実plannerを置き換えてはいない。

残高・所有・整数の成長・土地・発見・過去snapshotは保持する。保存済み旧予約は10こ/1目盛り、新規予約から新方式。財布がない旧島のみ従来どおりcompletedSets×10を一度引き継ぐ。払い戻し・残高の再計算・既存成果の没収はない。無料の観察/配置/衣装/工作、採点・Due・SRS・昇格・問題の難易度は今回変更していない。最適な意欲や所要日数を実証した数値とは扱わない。

## 対象と境界

- 基準commit `463508f`、固定revision `463508f-balance-0eb78c6ab82a`。DEV `http://127.0.0.1:5390`、production形式preview `http://127.0.0.1:5391`。
- `VITE_ISLAND_ENABLED=true` / `VITE_BUILD_PLAY_ENABLED=false`。delivery `mystic-island-v1`、world candidate `mystic-island-living-v5`、learning `mystic-island-learning-v2`、art `moon-garden`。実version/candidate/画面hashはmanifestに記録。
- 共有workspaceでは別タスクの島体験・カメラ・入力なども進行中。795入力を固定した別コピーで実UI/速度を検査し、共有workspaceの全unit/typecheck/buildも別途確認した。担当runtime 12ファイル中11ファイルは固定版と一致、Island.tsxは他機能の後続統合があるが、今回の報酬計算・receiptの保存/表示は保持されている。
- 固定コピーの初期TypeScript検査は、並行中のworkshopとStageの未完成インターフェースで失敗した。そこでのproduction形式は `npx vite build` の成果物であり、固定コピーのcore一式合格とは主張しない。共有workspaceの後続版は実際の `npm run build`（tsc + vite + assets）を通過した。
- 新規アートの制作・承認ではない。実画面の確認対象は報酬・価格・目盛り・土地/履歴の継続。後続の別機能や公開版全体の認定へ拡張しない。

## Verify Report

### Summary

- Result: 検証対象のPASS。機能・保存の回帰、core相当の構成チェック、同条件80runの速度再測定がPASS。default coreの途中FAILは記録し、後続別作業と公開版の認定へ拡張しない。
- Change type: Mystic Island domain/page/storage、任意フィールドによる旧値互換、仕様同期。

### Commands

| 検査 | 結果 |
|---|---|
| docs/lint/typecheck | PASS。lintの既存Fast Refresh警告1件 |
| `npm run verify:core` | default並列で既存learningProgressionの1件が15秒timeout。他はPASS。元FAILを保持 |
| `npm run test:run -- --maxWorkers=2 --minWorkers=1` | 共有workspace 221ファイル/2,466件PASS。assert/timeoutは変更していない |
| `npm run build` | 共有workspaceのtsc/vite/assetsがPASS |
| `npm run e2e:smoke` | PASS（31ケース） |
| `npm run e2e:pwa-update` | classic buildと4つの実更新経路PASS |
| `npm run e2e:island` | [11シナリオ/113画面](island/report.json) PASS。4居場所の成熟と追加区間をphone/tabletで実回答し、有限7物・土地・途中分・発見/再演・配置・全入力・renderer復旧を確認 |
| `npm run e2e:island-pwa` | [8つの保護境界と実SW offline](island-pwa/pwa-report.json) PASS。旧予約/土地、途中分、回答/自動成長の再読込と保存も確認 |
| `node tools/e2e-island-customization.mjs` | [4シナリオ/40画面](customization-v2/report.json) PASS。実設定/回答/交換2件と明示旧値fixture2件を区別。再交換/取消/目標/残高不足/abort/重複防止/過去外見/実offlineを確認 |
| `npm run benchmark:island-fixed-ten` | 最初の80runは時間の一部FAIL。原reportを保持し、同じ条件の再測定80run/全15gateがPASS（eligible=true） |
| `git diff --check` | PASS |

### Findings

1. 最初の速度測定は正解後P95がphone806.8ms、区切りphone827.4/tablet653.8msで650ms超過。Island/Study throughput比はphone1.118/tablet1.547、誤答後は361.2/347.5msで基準内。追加操作0、80run/誤答20件ずつ、正確な保存、browser errorなし、固定ソース不変はPASS。`evidence.eligible=true`でも`pass=false`を維持する。[原データgzip](throughput-initial.json.gz)、[実行ログ](logs/throughput.log)。
2. 初回は複数のE2E/build/full unitと測定が重なった。負荷の影響が疑われるが、原因とは断定しない。再測定は今回の他の重い検査を終了し、同じアプリ・全80run・同じ650/550ms基準を使う。他タスクのマシン利用は制御していない。
3. 最初のきせかえE2Eは古いQAの「毎区間1目盛り」前提で失敗した。[最初のFAIL](customization-initial-failure.json)を残し、QAを独立した累計閾値0/3/9/18/30/45/63で計算し、途中分と財布まで照合する形に更新して全件再実行した。アプリの値を期待値として読み戻す検査にはしていない。
4. 成長E2Eの原stdoutに残る「25 real UI sections」は古い表示ラベル。原reportのmilestonesは14/25/36/47区間で、実行したループも新方式。workspaceのstdoutは実際の区間数表示へ直したが、過去の原ログは書き換えていない。
5. guide/chapters/rhythm/recoveryのQAにも旧区間数の前提があったため、新しい問題数/途中分へ更新し構文を確認した。これら追加ハーネス自体の全実行を今回のPASS数には含めない。

### 速度再測定の結果

[両回の集計](throughput-summary.json) · [再測定の全rawデータgzip](throughput-repeat.json.gz) · [再測定ログ](logs/throughput-repeat.log)

同じ固定アプリ、phone/tablet × Study/Island × 2シナリオ × 10反復の80runで全15gate PASS、`eligible=true` / `pass=true`。正解後入力P95はphone194.8/tablet193.1ms、誤答後194.8/194.5ms、区間境界219.1/193.1ms。問題間の追加操作0、誤答20件/サイズ、入力リセット、正確な保存、browser errorなし、測定中のソース不変を維持した。Island/Studyの正答throughput比は2.238/2.160。作者の自動キーボード操作の処理時間であり、子どもの解答速度とは異なる。

今回の他の重い検査は終了後に実行し、開始時と途中のprocess確認では別のunit/build/対象E2Eは見つからなかった。ただし全期間の端末負荷を統制した実機試験ではない。アプリ・試料数・assert・650/550ms基準は変えず、初回FAILから良い試料だけを取り出していない。

### Next Actions

追加の必須コード修正は残っていない。子どもの実参加による意欲・長期の貯めやすさ、iOS/Android実機は未評価。公開・commit・push・deployは実施していない。

## 別々の判定

| 観点 | 判定と根拠 |
|---|---|
| 見た目 | 作者確認では価格・残高・部分目盛り・初回と成熟の変化を両サイズで識別できる。星の通知は既存の短い演出を保つ。新しいアートや魅力の承認ではない |
| 無説明理解/安全 | 未評価（子どもN=0）。任意の目標と取消、速さ/連続日数の倍率なし、支援の同額、既存成果保持をコードと実UIで確認した。継続意欲の最適性は未検証 |
| Runtime | 保存/機能とcore構成検査はPASS。速度は同条件80runの再測定で全15gate PASS。初回の未達は別記し、検証対象外の後続変更や公開版の認定へ拡張しない |

## Diff Review / Doc Sync

- 保存: 問題/ログ/星/途中成長/完了を同じtransactionで更新。並行・再送・abort・旧予約・対象変更をunit/integrationと実UIで確認。任意フィールドの未知値を黙って初期化しない。
- 仕様: 親01、成長30、きせかえ35、wiki/memoryとverification matrixを同期。現在の仕様をdoneログで代用していない。
- 学習/tone: 学習の昇格や難度は変更せず、訂正/支援を減額しない。通常学習の追加操作は増やさない。
- 範囲: 報酬と成長ペースが主目的。別作業の工作/カメラ/命名/音の差分は保持し、それらの完成をこの検証から主張しない。

元の機械レポート・全113/40画面・初回の失敗は `output/playwright/island-balance-20260908/` に保持。この監査には17枚の未加工の主要画面を選んで複製した。全キャプチャ一覧にある非選択画像は元のoutputで確認できる。
