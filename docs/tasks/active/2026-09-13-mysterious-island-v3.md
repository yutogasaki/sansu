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
