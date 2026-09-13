# 不思議な島 v3

## Goal / SSOT

添付v3に沿って段階実装する。正本は[仕様50](../../product/50_mysterious_island_discovery_spec.md)。元HEADと差分はgit履歴・検証時の記録に残す。

## Plan / Dependencies

1. 現行確認と仕様同期。48の4品は実装済み、49/v2案のPゲートはLifeに存在しない。
2. 保存下地：版付き購入receipt・返金保持・意図ID衝突拒否。価格変更前に必要。
3. 純粋な現在条件判定と表示記録の分離。
4. 4品A：G0、R1/R3、M2、現在のお試し、学習への即復帰、実画面確認。
5. 成長・有限ひかり・土地のcheckpoint移行と互換検証。
6. Bの8追加品・残る関係/魔法/出会い・本人保存/再演を縦断実装。
7. 全体回帰と継続評価。実参加者の理解・意欲は自動認定しない。

## Verification

保存下地は購入/返金/旧イベント/二重送信/競合/abortの回帰とverify:core。画面・routing・移行追加後はverification_matrixの島行と関連本番Lifeハーネスを適用する。

## Progress

- 添付ZIPを安全に展開し原文をdocs/product/mysterious-island-v3へ保持。外部送信・デプロイなし。
- 保存下地を実装。新購入は `life-48-v1` receipt、旧省略イベントは固定旧価格で再生。撤去の表示/処理は個体の実支払額を共有。同内容retryを先に処理し、別内容の意図ID再利用を拒否する。新旧4品価格は2/4/6/8のまま。
- AのG0/GF3/GF6/GP2/GP3/R1/R3/M2の純粋な現在条件判定を追加。住人の利用可否を別関数とする。まだruntime描画へ接続していないため表示済みの発見とは扱わない。
- 対象27テスト通過（購入5、既存repository5、simulation11、discovery6）。verify:core通過（353 files / 3676 tests、docs/lint/typecheck/build/assets）。smokeは30通過/1失敗。旧Root Tangle 768×1024の2回目誤答後案内でtimeout。コード変更なしの対象5サイズ再実行は5件全通過。初回FAILは保持し、原因は未確定（再現しないタイミング依存の可能性）。
- 添付manifest全件の内容hash一致を確認。SOURCE_EXCERPTSのみ拡張子を `.md.txt` へ変更し元キーから対応付けた。
- 全体移行、価格切替、成長の直近24時間積算、有限ひかり、追加土地/所有上限、表示記録、本人保存、再演、Bは未完。学習writerと旧schemaは変更していない。外部送信/公開なし。

- Review By: 2026-09-20

## Docs To Touch

- docs/product/50_mysterious_island_discovery_spec.md
- docs/product/01_app_spec.md
- docs/index.md

開始HEAD: `7a159d677ffa27db2ff031b8472cb8495c049fcb`。

## 次の具体的接続

- `landscape.ts`は現在`districts(state)`で成熟地区だけを描画。G0の低い土を追加し上位の縁と二重化しない。
- `residentMotion.ts`は座席接触を保った利用動作。R1/R3の顔の向きを追加する際、bodyを回して座席から離さない。現在`benchRelation`は条件のみでvisit選択や報酬には作用しない。
- `LifeWorld.tsx`は可視render後のframeと背景/context-lossの中断を管理。M2は表示時計をここへ接続し、画面外/遮蔽/メニュー/仮配置を可視事実に数えない。
- `IslandLife.tsx`の現物tapはもちもの詳細へ進む。無料の観察面と現在対象のお試しを追加し、下部まなぶ・編集・退出を常に優先する。使用中の連打で演出の期限を延ばさない。
- 発見保存は経済や学習と別namespace。条件判定だけで自動保存しない。最初の可視事実と直近20件、本人12件を分ける。

## 保存下地の検証対象

- 開始HEAD＋作業ツリー（未commit）。src全ファイルをパス順にpath/NUL/content/NULで連結したSHA-256: `8f06fca5c55dfa7785baf2fb5ca5a9440c978c96a2f217a1fc2460a4632cdcdf`。
- ログ: `/tmp/sansu-v3-core.log`、`/tmp/sansu-v3-smoke.log`。
- 既存のdocs期限警告、IslandMilestoneのFast Refresh警告、build chunk size警告あり。エラーなし。
- 視覚と子どもの無説明理解/意欲は未評価。新しい判定の描画接続、島/PWA/throughput固有E2Eと実SW offlineは後続Aの統合候補で必要。今回のsmokeだけではv3全体の受入を満たさない。

対象再実行: `SANSU_E2E_ROOT_TANGLE_ONLY=1 SANSU_E2E_DIAGNOSTIC_DIR=/tmp/sansu-v3-root-diagnostic node tools/e2e-smoke.mjs`。ログ `/tmp/sansu-v3-root-retry.log`、診断JSON `/tmp/sansu-v3-root-diagnostic/smoke-report.json`。フルsmokeの完全合格へ読み替えない。

## 第2段階：記録下地とG0の実景

- `discoveryJournal.ts` / `discoveryPresentation.ts` / `discoveryRepository.ts` を追加。LifeRecordの任意fieldに保存するため既存schema/profile削除境界は維持。経済revision/学習/報酬のreplayを変えない。UI callerは未接続。
- `plantGatherings`をG0条件と地面で共有し、未成熟3株の土を表示。成熟面と個体の土を二重描画しない。
- [実画面と検証](../../design/2026-09-13-island-discovery-ground/README.md)。verify:core 3688件通過、最終接続面調整後lint/typecheck/16対象tests/build。最終DEVのphone/tabletで移設/復元/再読込/学習復帰PASS。
- 次はR1/R3・M2の表示と観察UI。新しいrecordPresentedScene呼出しはPWA critical hold、画面/プロフィール世代guard、失敗retryと一緒に接続する。未表示の条件から呼ばない。


## 第3段階：現在の花の観察とM2

- 配置した花の詳細に「みてみる」を接続。同じ個体の葉/つぼみ/開花の姿を拡大し、触ると葉/花びらが約3秒上へ動く。reduced motionは同じ期限の静的差分。植物本体・成長・支払額・報酬を変更しない。
- 実render後の可視時間1秒を満たした現在のお試しだけJournalへ保存し、その後に任意の「のこす」を表示。critical persistence hold、unmount/背景/context lossの中断、保存失敗retryを接続。下部まなぶはいつでも退出できる。
- 最初の実画面でleafの元scaleをアニメーションscaleが上書きして球状に拡大する欠陥を発見・修正。操作E2E合格を視覚合格に読み替えず、薄い形状の回帰を追加。
- verify:core PASS: 355 files / 3690 tests、docs/lint/typecheck/build/assets。ログ `/tmp/sansu-v3-observation-core.log`。初回画像は `/tmp/sansu-v3-magic-runtime-1` に診断履歴として保持。
- 残るA: R1/R3の視線/観察、G0以外の集まりの可視記録、一覧/本人保存の解除・再演。価格/成長/有限ひかり/土地のcheckpoint移行、Bは未完。Human N=0、release全体の判定は保留。

- 最終phone/tablet実画面: 3問実学習→購入→観察→連打→任意保存→学習即時復帰→再読込、実WebGL context loss、DEV24h開花を検査し両幅PASS。[比較画像とreport](../../design/2026-09-13-island-discovery-observation/README.md)。描画候補 `island-life-discovery-a-observation-v1`、source開始/終了hash一致。

## 第4段階：思い出一覧・M2再演・解除

- 「しまの ようす」と観察後から「しまの おもいで」へ接続。本人保存と自動履歴を別タブにし、未発見の空枠や総達成率を表示しない。経済refreshを呼ばないlive queryで最新journalを読む。
- `discoveryRecall.ts` は記録signatureを当時のsnapshotで解決する。先頭の別の花/現在の花を代用せず、開花や収納後も当時の葉を再演。元eventIdとsource replayを維持し、現在の島には書き戻さない。
- 現在の同IDが配置中なら「いまの島でみる」へ接続。収納/撤去後は現在入口を表示せず、過去の場面は維持する。本人保存の解除は対象1件の確認を挟む。
- 最初の両幅実UI検証PASS: `/tmp/sansu-v3-memory-runtime-1/report.json`。各3問実学習→花購入→保存→DEV24h成長→当時の葉を再演→現在の花びら→実収納→再演入口保持→解除取消/確定→学習/再読込。snapshotとlive個体、actions/credits/firstPresentedの不変を照合。Human N=0。
- React skillの確認: journal購読は閉じる時に解除、非同期の保存結果は元画面のalive guard、操作中の一覧戻りは無効、退出/まなぶは有効。表示用WebGLは閉じる/プロフィール切替で破棄。
- 次の本体実装: R1/R3の利用中視線と現在観察、集まりの可視事実。M2以外の再演は対応する本体描画と一緒に接続する。配置undo、24h成長/有限ひかり/土地checkpoint、Bの8品と他ルールは未完。

- 最終の両幅実UIは満杯fixtureの13件目拒否/指定1件入替までPASS。[比較画像とreport](../../design/2026-09-13-island-discovery-memories/README.md)。2回目の可視記録timeoutは診断履歴を保持し、原因未確定。全体verify:core 356 files / 3693 tests PASS。最終は選択タブの色tokenだけmintへ修正し、source開始/終了hash一致。

- 最終token修正後lint/build/assets PASS。docs:check PASS、git diff --check問題なし。最終ログ `/tmp/sansu-v3-memory-final-build.log`。


## 第5段階：R1/R3の実景の視線

- `relationGaze.ts` を追加。確定sceneで歩行距離/固定優先順を1回解決し、実際に座った住人の頭だけを対象へ向ける。R1は芽から、R3は利用中なら住人の頭を、空なら遊具を見る。利用終了/着座前/距離外は通常姿勢。
- ぽこもこは既存の頭/顔/耳を中立位置のままhead軸へまとめる。関係中のEuler順をYXZにし、横を向いた顔が正しく下を向けるようにした。3住人の実方向ベクトルと座面接触を対象10testsで検査しPASS。
- 初回DEV4ケースはPASS。最終方向修正後のハーネスで、同じ着座住人の近い→遠い→復元、残高/個体/学習store不変と学習復帰を再確認する。
- 次はR1/R3の現在観察と可視記録・再演。`LifeWorld` の実render後のpose/カメラ/遮蔽・foregroundから可視事実を取り、同じsceneの住人利用時刻をsnapshotへ固定する。条件だけでJournalを書かない。

- 最終DEV4ケースPASS、同一着座住人を照合。[比較画像とreport](../../design/2026-09-13-island-discovery-gaze/README.md)。全体verify:core 357 files / 3698 tests PASS。source開始/終了hash `0f63355040d53823b72712fc5892fa8f2e1564b74a3cc318066ddc18cf032b1d`、candidate `island-life-discovery-a-gaze-v1`。R1/R3表示記録はまだ発行しない。


## 第6段階：ベンチの現在観察・記録・再演

- `observationVisit.ts`、`observe` actionを追加。既存利用か実経路で来る待機住人を使用し、他の活動/主人公の行き先を取消さない。試験訪問は移動＋6秒、通貨/利用実績を増やさない。
- 初回observe保存時にLifeRecord版2へ上げ、旧版decoderによる収納への誤解を既存guardで防止。旧receipt/時計/action/所有/記録を保持し、新reader/writerは版1/2対応。価格/成長等のcheckpoint移行は未完。
- `RelationObservationView` は本体3D・住人利用を表示し、頭/対象/対象利用者のカメラ内・3D/DOM遮蔽を確認した1秒可視だけ保存。対象の直接tap/選択、距離外の通常反応、本人保存、当時の論理時計固定＋短い装飾時計による再演を接続。
- StrictModeで再演のprepareが親のalive再設定より先行する不具合を実画面/DB診断で確認し、RAF開始へ修正。失敗を残して同じ本人DBのreplay実保存を検査。
- [比較画像とreport](../../design/2026-09-13-island-relation-observation/README.md)。最終4ケースPASS: 早期学習退出は未記録、近い観察の保存、遠い配置の未記録、古い近い配置の再演、復元/学習。16秒refreshでも同一利用の記録/保存案内を増やさない。source `8b3ad346d256772de320baed00e8d48a9ff4f6d7e42489a22d4c3741d489cce5`。
- 全体verify:core 358 files / 3704 tests PASS。最後のDOM遮蔽点追加後も実UI4ケースと最終docs:check/lint/typecheck/build/assets PASS。lintは既存Fast Refresh warning 1件、error 0。Human N=0、release全体の認定なし。
- 次は通常島全体/集まりの可視事実、配置undo、24h成長/有限ひかり/土地checkpoint、B8品/残る魔法・出会い。既存GF6の幅条件とv3の条件を照合してから集合の記録を接続する。

### 段階7: 配置の取り消し

- 購入配置/移設/収納から同じ編集範囲内で1段階戻すUIを追加。購入の戻しは収納、返金なし。通常のmove/store追記＋undoOfで履歴を維持。
- 最新配置ID/逆操作/同一intent再送をtransactionで照合。競合/別owner/内容差し替えを拒否。現在の配置安全判定を再実行し、旧edge家具の復元も危険なら無変更で拒否。
- 最初の実UI検査は3操作の保存まで成功後、取り消しで閉じたメニューの「うごかす」を待つharness手順でFAIL。明示的な再開操作を追加、閾値やアプリ挙動は変更せず再検査中。初回ログ `/tmp/sansu-v3-undo-runtime-1.log` を保持。

- 実UI2回目はphone/tabletの各操作がPASS。ただし実行中に安全判定の回帰テストを追加したためsrcを含む開始/終了hashが不一致となり、候補全体はFAIL扱い。アプリ入力を固定して3回目を実施。
- 全体verify:core PASS: 359 files / 3710 tests、docs/lint/typecheck/build/assets。既存Fast Refresh warning 1件、error 0。PWA precache10.78MiB/12MiB。
- 次は集まりの可視記録と通常島内の可視記録。GF6の幅/奥行条件は現行discovery/space両方に存在し、単体の一列除外も確認済み。以前の不一致懸念を実装欠落と扱わない。v3成長/有限ひかり/土地checkpoint、Bの8品と追加ルール、release全体は引き続き未完。

- 最終DEV両幅PASS、source開始/終了hash `72acc6ce0d8a323892b8a8d575692693bbc33d4c55fe84de3a2af4f584df56e1` 一致。[比較画像とreport](../../design/2026-09-13-island-placement-undo/README.md)。新しい島flag候補 `island-life-discovery-a-placement-undo-v1`。公開/commitなし。

### 段階8: 集まりのlive記録と当時/現在の実3D

- 保存済みのG0/GF3/GF6/GP2/GP3を通常島で実描画後に検査。参加物・土・隣接の連結への実rayとDOM遮蔽、画角、前景可視1秒を条件にlive保存。preview/メニュー/背景/context lossを除外。上位地面の表示中は同一成分の下位を重複記録しない。
- 同一意味の場面は通常refreshで再発行せず、崩れた配置はcollectorから外す。PWA保存hold・元owner・失敗retryを保つ専用保存hookを追加。経済refreshは呼ばない。
- 思い出から当時の集まりを不変snapshotで実3D再生し、元IDのreplayへ記録。現在リンクは同じ個体群の実配置を表示し、崩れた集まりを元の状態に補正しない。
- 対象6テストPASS（上位優先、実mesh/地面/DOM遮蔽/画角、表示1秒・一度のみ・非同期準備の取消）。phone-G0実UI診断PASS: 遮蔽中は未記録→live→任意保存→移設→当時の配置→現在の分離→undo→reload。全6ケースとcoreを検査中。
- 最初の全体coreは361 files / 3716 tests PASS。実UI2はGF6のliveが未発行でFAIL。実ray診断で中央1点を花に遮られていたことを確認。セルの縁と連結面の幅内の露出点も実meshへ照射し、同じ前景1秒条件を維持。再演の集まりカメラは通常島の仰角へ合わせる。6株の実モデル/通常角度を追加テストし、対象の可視検査5件PASS。修正後のGF6/GP3を個別診断中。
- 修正後のphone-GF6/GP3診断PASS（`/tmp/sansu-v3-gatherings-runtime-3` / `-4`）。上位を分割して下位のlive記録、元の保存/最初の記録を保持、当時と現在を別描画、undo/reloadを確認。最終phone/tabletを独立contextで検査中。

- 最終DEV全6ケースPASS。[実画面・benchmark比較・report](../../design/2026-09-13-island-gatherings/README.md)。source開始/終了SHA-256 `029da236e685d6664f37a92815b088a8a87a98d405fff0908cba9f78761e8c3c` 一致。candidate `island-life-discovery-a-gatherings-v1`。Human N=0、release全体の認定はしない。

- 最終reviewで短いvisibility/context-lossにも即時pauseを追加。対象18テストPASS。補強後の全6ケースを再実行しPASS、最終artifactを同じsourceで更新。最終verify:coreもPASS（361 files / 3717 tests、docs/lint/typecheck/build/assets、PWA precache10.79MiB/12MiB）。
- 次の統合範囲: 通常島のR1/R3 live、GP3の順に巡る動作、24h成長・有限ひかり・土地/所有上限のcheckpoint、B。今回のGP3記録の中核は表示された3台以上の床で、巡回の達成を記録文で主張しない。現行arrangeVisitsは地区の重みを上げる既存方式で、順に巡るv3の動作契約の完了証拠にはしない。

## 継続時のコミット運用（2026-09-13のユーザー指示）

「いいところでコミットメインプッシュしつつ継続」に従い、検証済みのまとまりでmainへcommit/pushし、仕様実装を続ける。このタスクの変更だけを含め、並行するデザイン検討の変更は混ぜない。

最初のcheckpointは `e0aac1b5c7e396c57372acb51be434cc5dcc4c59`、origin/mainへのpush成功を確認。ソースは最終検証のSHA-256と一致し、コミット対象だけをexportしたdocs:checkもPASS。原文ZIPの末尾空白/Markdown改行は原文保持のため変更していない。仕様全体・移行・releaseの完了commitではない。

### 段階9: 通常島のR1/R3 live記録

- `liveRelations.ts` は実描画の着席/視線readyから候補を作る。観察面から切り出した実mesh/顔/画角/DOM遮蔽の判定を共用。R3の実利用者も参加者へ保存する。
- collectorは参加住人と訪問の開始/終了を含むepisodeキーを扱い、別訪問の可視時間を混ぜない。snapshotはそのフレームの論理時計を使用。背景/context loss/配置preview/メニューの既存pauseを維持。
- reviewで無料観察訪問の閉じた後の出典混同を防ぐガードを追加。着席前/期限切れ/実遮蔽/画角外/DOM遮蔽/非表示mesh/訪問交代/試験訪問を実Threeモデルで検査。保存queueのPWA hold、失敗した元evidenceのretry、owner切替、退出後callbackを追加テストし対象8件PASS。
- 最初の実UI/全体coreは診断として実行中。並行reviewで上記ガードとテストを追加したため、開始/終了sourceが一致する最終候補としては扱わない。最終候補はコードを固定して再検査する。
- 初回coreは362 files / 3723 tests PASSだが、追加hookテストは開始後のため未包含。次のcoreはhook用関数名のReact lintエラーで停止し、コンポーネント名へ修正、対象lint PASS。
- 実UI初回はphone2ケースPASS後、tablet花の初期画角で実際に花が住人に隠れ、core=false・live未記録でFAIL。`/tmp/sansu-v3-live-relations-runtime-1` の失敗画面/DB reportを保持。判定を緩めず、ハーネスで実「ながめ」の回転操作を行い、見える角度に変えた後だけ記録を待つよう修正。固定sourceのtablet診断とphone最終を実行中。
- 既存の視線/観察ハーネスは通常liveが存在し得る契約へ更新。観察の早期退出ではcurrent-context-testの未発行を検査し、別sourceのliveを観察完了へ数えない。今回その旧ハーネス全体の再PASSとは主張しない。

- 最終DEV4ケースPASS、両実行のsource開始/終了 `78fa1893fc823eb0a4837d7ce879b407bd5e1ceac386f4faa4426b03afa0ee80` 一致。[実画像とreport](../../design/2026-09-13-island-live-relations/README.md)。最終verify:core PASS（363 files / 3726 tests、lint/typecheck/build/assets、precache10.79MiB）。Human N=0、release全体は未完。次はGP3巡回とv3の成長/有限ひかり/土地checkpoint、Bを継続する。

### 段階10: 成長・有限ひかりの経済checkpoint（実装中）

- 前段階の通常R1/R3記録は `2c75aa38d577fff9648597e3b0f18f76092f6b5b` としてmainへpush済み。
- v3の24時間は学習加速のrolling windowで、花の開花は有効6時間。速度0.5〜1.0、学習の発生/失効境界を積分し、追加学習なしの実時間目安を表示する。収納中は停止、既存の成長段階は保持。
- 初回updateのowner transactionで、生の旧recordと旧ルールで切替時刻まで進めたrecordを別にbackup。学習factの読取watermark、旧action境界、個体/残高/権利/成長の一致、固定ひかり予算、SHA-256を含むeconomyCheckpointを同時保存し、worldデータ版3へ切替。IndexedDBのstore/schemaを増やさず、旧版1/2のreaderは新版への書込を拒否する。
- rootの旧action/credit境界を書き換えず、遅れて届く旧区間の学習は元の旧価格/時間で補正。原本backupと初期のひかり予算を保持。新規の利用ひかりは予算以内に限定し、色購入で予算を再計算しない。
- 対象104テストPASS後、raw backup分離・prefix改変検知・将来timestampの保存済みcreditを補強。直近の境界12テストPASS。全体coreと実UIは未完。土地追加/上限拡張、GP3巡回、Bは次の統合範囲。

### 世界表現の追加指示（2026-09-13）

ユーザーからC3を取り入れて進める指示を受領。指定のデザイン憲章、C3 README/実画像、07、MASTERを確認。通常島の世界美術は、巨大でうねる植物が家と住人を包む空間、曲面に沿う大粒で間隔のある水玉、黄色/桃色/青の色瓦、木の奥/根元の局所的な青緑/青紫の陰、広い余白へ更新する。静止した形/光/空間を主とし、全体の暗化や紫化、粒子の追加で代用しない。

ぽこもこの顔/輪郭/頭身/耳/配色/布の切替と既存住民の好み・動作を維持。参考画像の生成キャラは設定画にしない。C3は配信背景や固定配置/カメラの契約ではなく、世界表現の参照。進行中の経済移行を検証可能なcheckpointへ整えた後、通常島の美術を更新し、実画面とC3を比較する。視覚・無文字理解/安全・runtimeを別に判定する。別作業のデザイン資料を戻さず、関連する正本の取り込みは世界美術のまとまりで扱う。

- 段階10の最終core PASS（366 files / 3751 tests、docs/lint/typecheck/build/assets）。DEV両幅PASS、source開始/終了 `6c27e4b8743690ed2b7ac4911ce8d7769a7595be52c5a9e5ba94ae36f3c56693` 一致。[実画面・transaction検査の範囲](../../design/2026-09-13-island-economy-checkpoint/README.md)。C3の世界美術更新、土地/cap/GP3/B、release全体は引き続き未完。

### C3 world preview（継続中）

経済checkpoint `1b7edba39cc031b022b950ac85a7b52df0ea63b1` はmain push確認済み。C3はDEV Life previewで通常島に実装試行中。巨大枝/水玉の曲面葉/立体色瓦/草の低密度化を独立world rendererで作成。住民の既存mesh/布/歩行は同一で対象回帰PASS。`worldStyle`を発見snapshotに含め、旧snapshotは版なし=旧背景のまま再生し既存hashを書き換えない。

[最新DEV実画面と未採用理由](../../design/2026-09-13-canopy-runtime/README.md)。視覚HOLD（特にtablet上部の葉のcrop、平たい葉、根奥の陰）、Human N=0、runtime部分検証。対象14テスト/typecheck PASS。2回の比較で基準未達のため主要な樹形を変更したが、次はカメラと樹形を一体で再構成し葉の立体構造も見直す。未commit。production既定値は旧背景。土地/GP3/Bと全体releaseも継続対象。


- C3の葉を閉じた曲面へ作り直し、根の接地用後端とカメラ/枝の重なりを再構成。実UI両幅で旧世界のimmutable再生と現在への移動、live G0のworldStyle記録、全景/学習復帰、学習正本不変を確認。source `4c696b4b66a948d3096a4af3748a3b02639bfb70ef8db268450f8930b3719db7`、core 366 files / 3753 tests PASS。最新contact sheetは上記READMEの統合検証。背景版保存とDEV試作の技術checkpointとし、視覚HOLD・Human N=0・release未完を維持。C3の陰/素材/構図の改善とGP3/土地/Bを継続する。

### GP3の正式行程（実装中）

- C3/背景版の技術checkpoint `c6841424408eeb80371d4ad631872074aa7f3c18` はmain push確認済み。C3視覚HOLDは継続。
- `playTours.ts` に副作用のない同時出発計画を実装。現在のGP3成分の座標順で行き先を選び、直前の遊具を反復しない。3席が埋まっている場合は最大3住民の割当をまとめて解き、動かない住民のセルや使用中の席へ送らない。予約で空きがなければ待機。明示したぽこもこの行き先、進行中の訪問を優先し、成分の分離/収納/変更で旧巡回を取消対象にする。
- 対象9テストPASS。購入順・リクエスト順からの独立性、3個を順に訪ねる行程、入力不変も検査。初回typecheckでArray.atが既存target外と判明し、targetを変えず末尾indexへ修正。まだsimulation/runtimeから呼んでおらず、GP3完成・実画面PASSではない。未commit。
- 次の統合では正式な住民stateに巡回と利用時間の残りを持たせる。短い各遊具の滞在完了ごとにひかりを発行せず、既存30分の利用時間を積算して有限予算から発行する。待機は積算せず、移設/収納等の中断では未完分を払わない。描画だけの位置変更は移設時の保存位置とずれるため採らない。
- 旧データの途中の訪問/既得資源は新行程で再計算しない。保存版4と切替時刻/旧action境界を導入し、時刻までは旧経済checkpointから旧行動で再生、時刻以後に新規選択した遊具から巡回を開始する方向で統合する。同時刻の旧action順序、旧reader拒否、refresh分割不変、遅い学習事実、操作中断、二重発行防止を保存テストと実UIで確認してからmain checkpointとする。

- `LifeState.tourVersion=1` の明示stateで、正式な訪問の短い巡回と残り利用時間をsimulationへ接続。各停留は経路時間+8秒。巡回待機中は残り30分の利用時間を減らさず、区切りごとの通貨発行も行わない。30分の実利用を満たした時だけ既存counterと有限ひかりを進め、移設/収納/購入による中断・無料観察への切替では未完の巡回窓を破棄する。歩行は正式visitで計算する。
- 非同期の席解放では、直前の遊具だけを除外すると2台を往復し続けることが判明。cursorに一巡の訪問先を保持し、未訪問先が空くまで待つよう修正。旧版の行動はflagなしのまま。新flagでは静かな散歩も正式な経路時間+休憩へ進め、描画だけの別位置を作らない方針（既存の見た目/歩行姿勢は継続）。
- 島ドメイン17 files / 107 tests、typecheck、対象lint PASS。7日分の3住民巡回も終了し、全員が利用・ひかり上限8を維持。単独約0.94秒/並列検査約1.50秒のNode診断であり、実機性能PASSではない。端末でのreplay負荷と必要な短縮を確認する。
- 保存版4の切替とruntime projectionはまだ未接続。現行recordはtourVersionを作らないため、現アプリでGP3が動いたとは扱わない。次は切替時刻+同時刻の旧action境界（旧履歴の指紋を検証）を保存し、既存economy checkpointと旧訪問を保ったまま新規選択だけtourへ切替。15秒refreshの間も正式stateを描画時刻へ進め、実表示の住民stateを発見snapshotへ渡す。植物形状はそのsceneで構築した成長段階と一致させ、snapshotが未描画の成熟を先取りしない。旧記録/旧snapshotの契約も維持する。

- 保存版4/tourCutoverを接続。旧action原文・境界時刻・同時刻順序とhashを検証し、切替時の既存訪問を保持。15秒のrefresh間は正式stateを訪問/支払境界で進めるprojectionへ接続し、実表示の住民stateをsnapshotに渡す。新snapshotはcaptured-v1で再計画せず、旧snapshotは従来どおり。
- 最終core PASS（370 files / 3777 tests、docs/lint/typecheck/build/assets）。[GP3の両幅実画面](../../design/2026-09-13-island-play-tours/README.md): 3住民が3台を巡回、短い利用でひかり0、実live GP3の再演、実収納で巡回取消・記録不変、学習復帰。source開始/終了 `f15c536725417c3b81dc7629da2e496cf319af3f1df55e74562119e47e440b76` 一致。明示fixtureであり自然初回連結/実取得の証明ではない。Human N=0、C3視覚HOLDと全体release未完を継続。次は土地の2回目/南拡張、所有/配置上限の実機検証、Bの商品/関係/魔法、C3の改善を進める。


### 土地の追加拡張

GP3 checkpoint `6e26fd014a5ddb083cfdfd447445fa06b0ec4479` はmain push済み。土地は既存片側権利を保ち、逆側24/南48しずくを実装。新土地receiptと保存版5で旧履歴へ新解釈を差し込まない。見取り図・実地形・配置/全景の奥行きと新セルの通路検査を接続。

core PASS（371 files /3783 tests、docs/lint/typecheck/build/assets）。[実UIの両幅](../../design/2026-09-13-island-land-expansion/README.md)で3段階購入・南端両側のタッチ配置・再読込保持・学習復帰。source開始/終了 `490780a338a48ab1c11693eceb6585537db9c497b42ba60c3d590f3056a3baf0` 一致。C3視覚HOLD、Human N=0、release未完を継続。所有/配置120/60候補の実機検証、Bの商品/関係/魔法、C3品質、全体統合は次の範囲。思い出の拡張前後の実UI往復と住民の端までの歩行も追加確認対象。


### 木の苗・水鉢の基礎（継続中）

土地 checkpoint `b72180fd510d09c9052ab0575c0282c1184912f5` はmain push確認済み。木の苗/水鉢各4しずく、保存版6の新品receiptと既存4品の原価格保持、木6/18時間と収納停止、共通購入/配置モデル、通常訪問/個別観察、木のG0/M2、水の通常波紋を実装。購入UIはDEV Life preview限定。新しいキャラ設定/好みを作らず、既存のmesh/布を維持。

対象の成長/価格/保存/表示テストPASS。成熟木のM2記録が花びらと呼ばれる枝を発見し、木ははっぱとして回帰追加。最終coreは373 files /3790 tests、docs/lint/typecheck/build/assets PASS。実UIで初回はDEV detailsを開かず時間送りボタンを探したharnessが失敗。2回目は両幅の操作を通過したが途中のソース変更をhash照合で検出したため最終PASSにしない。修正後の固定sourceで3回目を検証中。未commit。木立/水辺の成熟表示、木陰での休み、R2/R4等とBの残り6品、C3視覚品質、全体releaseは継続対象。


- 固定source `725d43e354a39aa39a8cee1b09ba00bb217d9d56a759d7b3551a253cd355893b` で両幅PASS。[木の苗・水鉢の実画面](../../design/2026-09-13-island-plants-water/README.md)。苗/若木/成木、木M2の表示記録、通常波紋と報酬/記録不変、再読込保持、学習復帰。core373 files /3790 tests PASS。DEV基礎の技術checkpointとしてcommitし、視覚HOLD・Human N=0・Bの各まとまり/関係/残り6品・release未完を継続する。


## 木立・水辺のDEV接続

- GT3/GT6/GW2を `groves-water-v1` に接続。木陰・樹冠のつながり・水辺の縁、木陰での休みと水鉢の見比べを実装。キャラクター造形と旧の訪問選択/成長/報酬/占有・経路を維持する。
- 旧snapshotは旧土・姿勢・hashを保持。新snapshotに実表示のmotion設定と水面視線を保存し、再生側が反対motion設定でも当時の姿勢を保つ。
- [実画面と比較資料](../../design/2026-09-13-island-groves-water/README.md)。最終core375 files /3801 tests PASS、固定sourceのphone/tabletで実liveGT6/GW2、実収納GT3、undo、再読込、記録/学習正本不変、学習入力復帰PASS。source `cf3573fdf297a74023880823338750ef7945bf0d1edfe2b2cd39ee45dcd18c9e`。
- 初回はasync waitForFunctionのPromise早期終了をローカルPlaywright pollerから診断し共有waitForAsyncへ修正。2回目は葉で隠れた冗長な内部境界を必須とする可視判定を、実可視の接続で全木をたどれる判定へ修正。3回目は診断中source変更を検知し除外、固定4回目だけを最終証拠とする。
- 視覚HOLD（矩形の陰・単純な苗木の葉・C3の光と奥行きに未達）、無文字理解Human N=0、DEV runtime対象範囲PASSを別判定。次はR4水鉢/ベンチとR2用机を含む残り6品、魔法/出会い。C3品質、全PWA/offline/update/throughput/全smoke/実機性能は全体受入の残件。


## R4 水鉢とベンチ

- `water-bench-v1` に4歩以内・距離優先/同距離R1→R4→R3と現物対象選択を接続。3人の既存頭だけを水面へ向け、座面/造形を維持。旧snapshotは版なしとしてR4を候補に追加しない。
- [実画面と証拠](../../design/2026-09-13-island-water-bench/README.md)。core376 files /3808 tests PASS。最終固定source `a335336f2a7a840e14d9ef2f1fc0bb3b712038abf21ea532bd48c1a769b9f695` の両幅で覆い中の記録抑止、live記録/再演/本人保存、水鉢の実移動で同一住民・同一席の近い/遠い/復元、学習正本/残高保持、学習入力復帰PASS。
- 初回再演入口のR1/R3限定を実画面で発見・修正。2回目の両幅を最終証拠とする。最終入口とハーネスlint、修正後build/typecheck PASS。C3視覚HOLD、Human N=0、対象runtime PASSを分ける。
- 次はピクニックテーブルとR2。仕様の1人おやつ/2人会話、成木1本、成熟陰側の体向き、2役予約を一緒に扱う。2×2施設/通行可能アーチと残りの魔法・出会い、全体受入は未完。


## ピクニックテーブルとR2

- 8しずく/1マス本体/前後2席をDEV購入UIへ接続。空いた利用点を別予約し、1人のおやつ/2人の対面へ。成木1本・利用点間4歩以内のR2、単体利用、観察・記録・再演・現在入口を接続。旧キャラ造形/好みは維持。
- 新receipt `life-v3-picnic-v1` と保存版7、旧receipt/経済checkpoint/巡回/土地を保持。土地とテーブル購入の両順序で再生し、欠落・改変・版降格を拒否。旧activity版でもテーブルの同席重複を許さない。
- [実画面と証拠](../../design/2026-09-13-island-picnic/README.md)。固定source core378 files /3817 tests PASS。両幅の実購入→2人利用→DEV成木/R2→再演→収納→再読込/学習復帰PASS。C3視覚HOLD、Human N=0、対象runtime PASSを別判定。
- 次は残り5品（かざぐるま/アーチ/砂場/小屋/図書室）と対応R5/R6。M3は風車ではなく「着座住民の影へのタップ」で4秒の挨拶。M1/M4と出会い、全体検証/視覚品質も残件。


## かざぐるまと花のアーチ

- DEV購入へ各12しずくの2品を追加。かざぐるまは座席なしの回転景物と近くを通る住民の見上げ、アーチは配置セルを占有しつつ四方向へ通行可能。花数/遊具数や専用の発見・魔法へ含めない。
- アーチの短い利用は経路時間＋400ms、同時利用1人。終了後30分の自動再訪間隔を持ち、明示呼び出しは再訪可能。短時間のくぐりでは利用ひかりを加算しない。これは30分利用報酬を短時間で連続取得させない実装上の選択。
- 保存版8/receipt `life-v3-wind-arch-v1`。旧版の価格・経済checkpoint・巡回・土地・テーブルの購入を保持する。キャラクター造形・好みは変更しない。
- [対象実画面と判定](../../design/2026-09-13-island-wind-arch/README.md)。視覚・無文字理解/安全・対象runtimeを別記する。
- 残り3品は砂場/園芸小屋/図書室。R5/R6、M1/M3/M4、出会い、視覚品質と全体受入は継続対象。


## 砂場と混合遊具

- DEV購入に砂場18しずく/1マス/最大2人を追加。前後の利用位置を別予約し、1人は山、2人が到着済みなら城を作る。片側が使えない配置では1人へ戻る。既存キャラの造形・配色・好みは維持。
- 砂場をGP2/GP3の遊具成分・共通地面・巡回へ含める。巡回は既存遊具の1席と砂場の2役を別々に扱い、占有済み利用位置へ重ねて送らない。ベンチのR3は砂場の実利用者にも視線を向ける。
- 保存版9/receipt `life-v3-sandbox-v1`、旧版購入/土地/checkpoint/巡回を保持。山や城は通常の利用表現であり、収集・成長促進・追加報酬へ変換しない。
- [実画面と検証範囲](../../design/2026-09-13-island-sandbox/README.md)。残り2品は園芸小屋/図書室、R5/R6と魔法/出会い、視覚品質と全体受入を継続する。


## 2×2施設と入口での単体利用

- DEV購入へ園芸小屋36/森の図書室72を追加。同種1棟は収納中も所有数へ含める。各4マス占有、整数の北西アンカー、手前の1か所の入口を、配置/移設/経路/選択/地図へ接続する。
- 小屋は入口で道具の手入れ、図書室は入口で読書。利用者だけが本/道具を持ち、終了/収納で隠す。既存キャラ造形・布・好みは維持し、物がない旧場面へ持ち物を追加しない。
- 保存版10/receipt `life-v3-facilities-v1`。旧価格/checkpoint/土地/巡回、無料移設・収納と実支払額の半額返却を維持する。
- [証拠と範囲](../../design/2026-09-13-island-facilities/README.md)。R5/R6の運搬は次の接続であり、この単体利用の完了とは区別する。観察の既存文字selectも、実在する苗/水鉢/砂場を含めるように揃えた。施設を対象とする関係選択はR5/R6と合わせて追加する。

## 施設からの運搬

保存版11 / `facility-trips-v1` の切替境界で、旧入口利用を保持したまま新しい運搬を開始する。入口で受け取り、同じ住民が本/道具を実経路で運び、ベンチ/植物で使用する。到着先を事前予約し、編集時に解除。30分枠内で利用を1回だけ計上し、運搬報酬や植物成長ボーナスを加えない。既存キャラ造形と学習正本は維持。

関係R5/R6のlive記録・現物観察・同一住民比較と全関係の優先順は未接続。今回は運搬の土台の区切りであり、B全体やR5/R6の受入完了ではない。視覚C3 HOLD・Human N=0・全release未完を継続する。

固定source `e8d6c48d17b766c4353191444089c4a1bb5e27df6307f1020e277c1953e4bb43`、core386 files /3849 tests PASS、両幅の本/道具4旅程PASS。[実画面と範囲](../../design/2026-09-13-island-facility-trips/README.md)。初回サーバー停止、UI2は購入保存前に次操作へ進む待機不足。保存済みstateを待つUI3を最終証拠とし、appは同一source。次はR5/R6の実提示に基づく発見保存と観察・比較への接続。

## 運搬の発見記録と再演

運搬checkpoint `2b42a1502e14ef18b2c57b1b0386f4efcdf0c5dd` はmain push済み。新しいR5/R6の実提示候補、運搬/表示版を含むsnapshot、本文・参加物復元・再演・本人保存・現在入口へ接続した。施設の無料観察は空いた住民だけを使い、道中もobservationTestを保持してlive/利用報酬へ変換しない。

R6の花への接近で道具と植物が隠れる状態を、同一配置/同一住民の純粋検査でも確認。表示版 `carry-care-v1` だけに手入れ用の立ち位置を追加し、他の住民・通常の匂い嗅ぎ・版のない旧snapshotの姿勢を保持する。観察では対象が見える画角を選ぶが、見えなければ未提示のまま。全関係の優先順と現物を指定して試す全操作・同一住民の距離比較・自然初回の受入は残件。

施設の新しいobserve actionを書く島だけ版12とし、旧版での誤再生を拒否する。既存利用を眺めるだけなら版11のまま。固定source `cee1cea9c4c41806b3ff6b0db94e036cd61d1ecffe9f40a41ffd81f6de6163bc`、core387 files /3857 tests PASS、最終UI4の両幅4旅程とowner APIの版12書込/再読込PASS。[証拠と残件](../../design/2026-09-13-island-facility-relations/README.md)。編集中のcore1/UI1、受け取りを撮影できなかったUI2、版12追加前のcore2/UI3を最終証拠へ混ぜない。次は現物指定・全関係の優先順・同一住民の比較を、過去の保存履歴への影響を分けて接続する。C3視覚HOLD・Human N=0・魔法/出会いと全releaseは継続。


## 同じ住民でのR5/R6距離比較

[実操作と比較証拠](../../design/2026-09-13-island-facility-distance/README.md)。本体コードは `225b58a` のまま、両幅の図書室/小屋4旅程で同じぽこもこ・同じ相手を近→遠→元の位置へ移設して比較した。遠い配置で入口通常利用と未提示、戻した配置で運搬/利用/提示へ復帰。旧保存イベント、残高、学習正本、再読込/収納後の保持を確認。明示呼び先とQA取得に基づく比較であり、自然初回や任意の現物指定の実装完了にはしない。

source `cee1cea9c4c41806b3ff6b0db94e036cd61d1ecffe9f40a41ffd81f6de6163bc` は変更なし。既存同一sourceのcore3857 testsを再利用、今回の拡張UI4ケースPASS。全関係の優先順とベンチから図書室等への現物指定は引き続き未接続。次の行動選択変更は旧保存の再演を変えない切替境界と全版allowlistの点検を先に行う。視覚C3 HOLD、Human N=0、魔法/出会い/全releaseは未完。


## 利用開始時の関係選択と保存版13

保存版13 / `relation-selection-v1` へ所有者の更新で移行し、旧action prefix/hash、進行中の利用と視線を保持。新しいvisitだけ実経路距離→R5/R1/R4/R3/R2/R6→相手IDで選ぶ。ベンチから図書室へ本を取りに行き、同じ席へ戻る。先客がいれば通常利用へ戻し、他の相手へ勝手に置き換えない。無料のベンチ観察にも有限の往復を接続し、観察provenanceを維持する。

[最終実画面と範囲](../../design/2026-09-13-island-relation-selection/README.md)。固定source `150945e11145afb441dc5fd664dcdaa5f81aa5683525b93c35d3d0926932be1c`、core388 files /3868 testsと最終UI5の両幅4旅程PASS。ベンチ指定からの読書、近い花へのR1切替、施設指定での近/遠/復元、再演/保存/収納/再読込/学習正本保持を確認。旧visit視線の補強前core1、手順誤認とページ送り不足のUI1/2/4、途中で停止したUI3を最終証拠へ混ぜない。

次は任意の現物指定からの関係観察。今回の順序は新しい利用開始に適用し、指定中の進行中の読書を購入だけで中断する契約には変えていない。全体の自然初回・全住民/混合配置・魔法M1/M3/M4・出会いX1/X2/X3・C3視覚/Human N=0・全releaseは未完。

## 現物指定の関係観察（保存版14）

ベンチ/テーブル/施設から配置済みの現物を選ぶ無料観察を、同じ住民の実visitと保存版14へ接続した。視線だけなら同じ席、運搬なら実経路を使い、歩行中や先客を押し出さない。旧保存・同席者・報酬を保持し、おもいで→現在も住民IDを引き継ぐ。固定source `f91b2d7bd5bd225abe7b4cdf0233aa0f9ef2b12920e4b64b86efebdd56de8dcc` でcore390 files /3882 testsと、両幅の図書室/小屋4旅程PASS。[実画面・配信ラベル・検証範囲](../../design/2026-09-13-island-explicit-observation/README.md)。本人IDのsnapshot保持・元の施設へ戻る処理・地面より上の選択目印を補強した診断3はsource不一致で終了したため、core後の固定source UI4だけを最終証拠にした。魔法/出会い・視覚C3/Human N=0・全releaseは継続。

全体smoke/PWA更新/production島旅程/固定十問throughput・自然初回・全住民/混合配置は対象DEV旅程で代替していない。次は灯りと水のM4など、未接続の魔法と実提示/中断/保存を進める。


## 水鉢の魔法M4

実水面のタップ、灯りの近/遠/復元、5秒の星空とタップ位置起点の波紋、連打の統合、非表示中断、元の位置での再演を接続した。診断1は共通観察helperが関係観察のクラスだけを待った検査側の誤り。helperを実描画済み観察面へ一般化。診断2のスマホ旅程は完走したが、星の読み取りを改善している途中だったためsource不一致で終了。水鉢の縁/本体の入力も補強し、固定source `27d5645aefdb63c75a5f0b1d48f0268b6d7465ab9113e01862eb5fbb2b21da61` でcore2の392 files /3888 testsと両幅UI4がPASS。[実画面と検証範囲](../../design/2026-09-13-island-water-magic/README.md)。UI3は収納保存を待たず再読込した検査側の手順不備。UI4では保存済みstateを待つ。core1/診断2/UI3を最終の完走証拠へ混ぜない。全体smoke/PWA/throughput・視覚C3/Human N=0・M1/M3/出会いと全releaseは継続。

## ベンチの影の魔法M3

本人の既存リグを独立した影へ投影し、観察画面の実タップから約4秒だけ影の腕を動かす。本人の造形/姿勢/席と学習/経済は保持。3住民の純粋検査と、両幅の実タップ・連打・元の影への復帰・保存/再演・実visit期限での中断・収納/再読込/学習復帰がPASS。固定source `68b0d5ed05bc880f896d03154d15758c8753554168ffafdcb8052312159e58fd`、core394 files /3894 testsとその後のUI4を最終証拠にした。[実画面と範囲](../../design/2026-09-13-island-shadow-magic/README.md)。診断2の監査待機不足、診断3の配置条件誤認と編集中sourceを区別する。腕の影の実可視性と通常関係の再演の表示版を補強した。

次はM1の灯りと実歩行に沿う足あと、出会いX1/X2/X3。M3は観察画面への接続であり、島全景からの直接入力・最大数性能/混合配置・自然初回・全体smoke/PWA/throughput・C3視覚/Human N=0・全releaseは引き続き残件。特に小さな影の腕の読み取りは技術的PASSで補償しない。

## 灯りと実歩行の足あとM1

灯りの実利用点から歩行距離2以内の通れる地面を表示と判定で共用し、保存済みの行き先変更から実足位置に星を残す。元の歩行/速度/キャラ/席予約を保持し、最大6秒・各跡約2秒・停止/範囲外/編集時の無出力を接続した。全4魔法の終了後入力整理を500msへ統一。元の経路の再演と、現在の行き先指定を分け、追加報酬や行動版を加えない。

固定source `02aab7b19e7ec1464dab9bb8807ea8a2634243757aeb105dc85a871e4b60f17a` でcore2の396 files /3898 testsと両幅UI5がPASS。[実画面と検証範囲](../../design/2026-09-13-island-footstep-magic/README.md)。初回の満席待機は既存予約を守った正しい挙動。実予約から空いた行き先を選ぶ検査へ修正し、住民を再抽選しない。core1/UI4も完走したが、その後に外部の土地/外観変更で古い足あとと影を消す中断条件を追加したため、最終sourceとは区別する。

次は条件型の出会いX1/X2/X3。M1〜M4は対象範囲に接続したが、魔法の全配置・全中断・島全景からの操作の統合受入、所有/配置120/60候補の性能、自然初回、全体smoke/PWA/throughput・C3視覚/Human N=0・全releaseは未完。静止した世界の光と奥行きを魔法で補ったことにはしない。

## 花畑と木立の出会いX1・X2

通常のまとまりを実提示した後の小さな気配から、蝶の花/水間の移動と、小鳥の水のぞき/枝への帰還を接続した。実外周利用点間4歩以内を使い、抽選・追加報酬・行動保存版を加えない。元の植物/水鉢/通常まとまりをhash付きで保持し、現在の収納/再配置と過去の再演を分ける。既存住民の造形・布・配色・活動は保持。

住民に隠れる水や接続地面を避ける画角、実際の枝先への接触、定期更新時のGPU準備で場面を飛ばさない表示時計を補強した。観察/おもいでの背後の島だけ約8fpsへ抑え、世界時計や編集画面は変えない。core1後のUI12で小鳥の再生時の帰還が十分に実提示されなかったため、水のぞき/帰還後を各3秒にした。固定source `b765ad293e28748564dd989c985c9c4ed26de7e825a56c1988abf85c543fc3ba`、core2の399 files /3910 testsと、その後の両幅4旅程UI13がPASS。[検証履歴と独立判定](../../design/2026-09-13-island-encounters/README.md)。元の記録/保存版13/しずく24/ひかり8/学習正本を保持し、直接入力・再演・収納/再配置・学習復帰を確認。旧core1/UI12や編集中の診断を最終sourceへ混ぜない。

次は自然にR5へ参加したカワウソのX3。現在の本には上下が読める模様がないため、既存キャラを変えず、実際に持つ本の向きの差分として検討する。カワウソを外から強制指定したり、出現を再抽選したりしない。全配置/混合配置、所有/配置120/60候補の性能、自然初回、全体smoke/PWA/throughput・C3視覚/Human N=0・全releaseは継続。

## 読書の本を持ち直すX3

追加の[75分の自然観察](../../design/2026-09-14-island-natural-reading/README.md)は未成立。元のQA行動列/realAtを保持し、2回の実活動切替も本はぽこもこが利用した。カワウソを強制指定せず、X3の保存/現在再確認へ進まないまま監視が終了した。app source `74514aaa` は全枠を通じて維持。アプリ例外0件。自然X3の未検証を残して実装を継続する。監視終了後、検証済み木肌DEV試作 `112de2c` はmainへ統合/push済み。

既存の自然な図書室→ベンチ運搬とカワウソ本人の到着を条件にし、通常R5の実提示後、本の向きだけを持ち直す表示を接続した。木/太陽の絵で上下を区別し、キャラの造形・布・色・手や頭の姿勢は維持する。無料のお試し/別の住民/歩行中は除外。両向きの実提示、古い訪問/移設/取消、同配置mesh再作成、hash付きの過去再演を扱い、行動版や報酬を増やさない。

固定source `74514aaad4483288a65ec4e85e8c576a832fcf64d813fad4e2762c37fea6bfec` でcore1の402 files /3928 testsと、その後の両幅UI2がPASS。[実画面・出所・独立判定](../../design/2026-09-13-island-reading/README.md)。UIは明示したsnapshotを実コンポーネントで描画し、実提示をsimulatedとして記録した後、アプリ内保存/再演/再読込を確認した限定範囲である。行動履歴・通貨・学習正本・元の記録を保持。

自然な初回診断ではぽこもこが読書、カワウソは休憩だったためX3は未成立。本人や時刻を再抽選せず、この結果を残した。次は自然初回と現在の同じ本人への再訪。C3視覚HOLD/Human N=0、M3全景直接操作、全配置/混合配置、所有120/配置60候補の性能、全体smoke/PWA/throughput・全releaseは継続。

## 既存導線と分数の回帰検証

同じapp sourceで全体smoke31/31とclassicのPWA更新4/4がPASS。旧島E2Eは両幅の成長/履歴等を通過した後、分母2桁へ1桁の誤答を入力して自動確定を待つhelperの不具合で停止した。アプリ側を緩めず、桁数と残りの分母/筆算欄を保って誤答を完成させるhelperへ修正。3件の単体検査と分数限定の再現確認後、旧島E2Eを全シナリオ再実行し11/11 PASS。両幅とも46回の実UI学習区間で全地区成熟を確認。[失敗・修正・検証範囲](../../design/2026-09-14-island-integration-checks/README.md)。

旧島有効/Life無効の別production buildでも、8つの更新保護hook検査と実SWのoffline再読込/回答/成長/同じ予約への復帰がPASS。実two-build更新や新しいLife全機能のPWAへ結果を広げない。

X3の自然行動は前の同じ購入記録/realAtから監視中。一巡後もぽこもこが読書、カワウソは別のベンチ休憩だったため成功に数えない。旧島の回帰合格は新しいLife全機能のPWA/throughput、C3視覚、Human N、全releaseの合格を意味しない。

## C3の木肌を移す描画方式の検討

続くDEV限定の[木肌/枝終端の実画面試作](../../design/2026-09-14-canopy-materials/runtime-study.md)は、独立worktree `codex/canopy-materials-20260914`・5233で検査。source `514104be2523771d08cb81279d9cf9e8cc9cd2893f5483ecbc393a86e2ce7d8f`、core404ファイル/3934テストと両幅UI旅程PASS。候補IDを実DOMで照合し、旧snapshot/行動/credits/学習正本不変と入力復帰を確認。木肌の非同期読込失敗/破棄後完了の3テストも含む。本番buildには素材/試作処理を含めない。視覚33/60・各軸未達/HOLD、Human N=0。地面・海・根元の奥行きとtablet上部cropが残り、細部だけを増やす方針は取らない。自然X3監視のmainを凍結するため、この試作のmain統合はその検証と分けて進める。

世界の枝だけを対象に、木肌albedoを2案生成し、既存の同じ3D形状で比較した。現行の無地batchがUVを捨てていたため、最初の後付けmapは単色になった。比較用moduleでmapを先に指定して座標を保持すると木肌が出ることを確認。彩度/細部を抑えた候補2を次の試作に選び、再現スクリプトのPNGも同bytesになった。[素材候補と比較](../../design/2026-09-14-canopy-materials/README.md)。

アプリ本体・キャラ・配信素材には適用していない。C3の奥行き/局所陰、枝の終端、素材容量と所有/破棄、実アプリ両幅の比較は次の課題。現在のC3視覚HOLDとHuman N=0を維持し、素材の見栄えを全世界の完成へ広げない。


## M3の全景直接入力と同じ本人への時計引継ぎ

全景の現物の影を実タップし、十分に見える場合は全景で、小さい/腕が隠れる場合は同じ本人の拡大観察で4秒挨拶する。本人を呼び直さず、表示時刻を引き継いで着座が巻き戻ることを防ぐ。保留入力を取消しても時計基点は保持。ownerを含むM3成立条件を保存時に再評価する。固定source `468b00716a58793ca754a7f5b008871c2a0c61158b6f5b0e5b31908f0b8d8f2f`、core3 405 files /3938 tests、UI6両幅3住民、phone全景拡大、両幅読書回帰がPASS。[実画面・最初の失敗・範囲](../../design/2026-09-14-island-world-shadow/README.md)。

時計追加前のcore1/UI5/zoom1/既存M3観察回帰と、最終core3/UI6/zoom2/読書回帰を区別。固定QA recordの実時間基点を検査開始へ合わせる明示fixtureで、獲得や自然発生の証拠ではない。C3視覚31/60 HOLD、Human N=0、全割込み/混合配置/最大数、新LifeのPWA/offline/update、fixed-ten10反復、自然X3、全releaseは継続。

同じM3候補の既存classic smoke31/31、既存production PWA更新保護4/4もPASS。新Lifeの全PWA/offline/updateや固定10問比較の代用にはしない。


## Lifeの実オフラインと投影失敗 A03

旧島のPWAハーネスが新Life DBを比較しないため、実初回/実学習/実購入から始まる専用検査を追加。両幅で実SW offlineの移動/収納/回答・reload・再接続を確認。Life書込みだけを故障させてもnative回答は保存済み、Lifeは元の3creditを保持し、UI retryだけで4creditへ進む。二重反映なし。

最初の故障診断で英語のDB例外が画面へ漏れたため、`useIslandLife` の表示だけを短い日本語へ変換した。保存/重複排除/owner/PWA hold/保存版は変更なし。source `d00da8603c1dcbb86f26180dd066a5133f5204e272d34a9d13a5c0f4c643d2c0`、core406 files /3940 testsと修正後UI3両幅PASS。[証拠と範囲](../../design/2026-09-14-island-life-storage/README.md)。公開4品のproduction境界であり、C3/魔法/追加8品のproduction統合、実two-build、全配置/固定10問/自然X3/視覚HOLD/Human N=0と全releaseは継続。
