# 分析全体を、学ぶ・育つ・暮らす・試す体験へつなぐ

- Date: 2026-09-08
- Review By: 2026-09-09
- Status: Active

## Goal

2026-09-09追加: [島と操作の領域分離](../../design/audits/2026-09-09-island-panel-layout/README.md)を固定28で確認。3幅の6画面でスクロール中の戻る遮蔽が37/72位置から0へ改善、canvas実高と全storeを保持。固定28は294 suites/3244 tests・型/build/assets PASS。音QA03は録音先頭が不足して元FAILを保持し、採取コードの同期負荷を修正中。

2026-09-09追加: 固定24の[衣装・模様と家具利用の有限確認](../../design/audits/2026-09-09-island-expression-matrix/README.md)は、両幅それぞれ残25組のportrait・選定9場面の利用が通過した。復元と明示注入を含む診断fixtureの項目単位の合成で、実取得・単一連続run・全直積・固定26の合格ではない。到達不可の元FAILと、実収納/再配置から同じ住民が再開する操作を保持。音の未計測prefix、画面の重なり、造形全体とHuman N=0は別の残差として追う。

このセッションの7作品104項目と追加12作品の分析全体を、学習を阻害せず自発的に遊び・学びたくなる島へつなぐ。仕様35のきせかえは一部分。18観点、12の気持ちよさ、10デザイン、8成長、8欲求、16報酬、24比較項目を対応表で追跡し、採用項目を仕様化・実装・実画面検証する。

2026-09-09追加: [樹冠v8の局所改善](../../design/2026-09-09-island-renewal/direction.md#樹冠の局所改善固定26)を固定26（`workshop-20260909-88c3f5357ac2`）で確認。丸い葉塊と枝を支える厚み、成長/所有/identityを保持し、294 suites/3244 tests・型/lint/build/assetsが合格。両幅の各18実回答、0〜4区間の同予約復帰・全store保持と、別のgrove1診断fixtureを確認した。grove0の実回答を中間/最大成長の取得証拠にせず、固定26の正式80runもPASS（入力再開P95 200.2/199.6ms、追加操作0、固定問題・Human N=0）。PWAは固定23の版別記録を参照する。初期phoneの操作と樹冠の重なり、source A全体の造形/素材差、Human N=0を残す。

2026-09-09追加: [仕様42](../../product/42_island_learning_keepsakes_spec.md)の閉じた家内、実アルバム／掲示板／学習の棚と、島のpinch・pan・zoomを[固定23のチェックポイント](../../design/audits/2026-09-09-island-home-checkpoint.md)へ記録した。固定23は `workshop-20260909-ecdb5041e7c4`（1068入力）、実配信guard・292 suites/3232 tests・型/lint/build/assets/docs・Island PWA8保護経路が合格。家のDEV実画像、実物タップ、戻り先2経路は両幅で確認し、明示fixtureと実獲得を区別した。21準備版、22配信revision不一致FAIL、23初回camera/写真QAのFAILは保持。同app23＋修正QA overlayの実獲得／写真は両幅各25実回答・5区間、展示/収納/reload/実PNG/同予約保持まで合格。カメラ23-03も真正新規2経路＋明示成熟fixture2経路の計4経路が合格。Island core補助QA10経路と、保存地点後の正式80runも同チェックポイントへ合格を追記した。Goalを継続する。source A-v6 art parity HOLD、Human N=0、Full Goal Activeを維持し、この保存地点を全体完了・公開としない。

## Docs To Touch

- docs/tasks/active/2026-09-08-island-experience-coverage.md
- docs/product/01_app_spec.md
- docs/product/28_mystic_island_spec.md
- docs/product/30_living_island_growth_spec.md
- docs/product/35_island_customization_spec.md
- docs/product/36_island_experience_spec.md
- docs/product/37_island_workshop_spec.md
- docs/product/38_island_shared_memories_spec.md
- docs/product/39_island_appearance_sets_spec.md
- docs/product/40_island_life_furniture_spec.md
- docs/product/41_island_expression_collection_spec.md
- docs/product/13_data_storage_migration_spec.md
- docs/product/07_ui_design_guideline.md
- design-system/MASTER.md
- docs/index.md, docs/ai/ownership_map.md, docs/ai/verification_matrix.md
- docs/design/audits/2026-09-08-island-experience/
- Shared task queue and completion history

## Scope and completion

分析全体との対応表を最初に作る。既実装/改善/新規/見送りは理由と証拠を分け、難しさや所要時間だけで除外しない。採用した作業群の完了までGoalを維持する。一覧作成や一段階の実装で全体を完了扱いにしない。子どもの意欲・無説明理解・自発的再遊びは独立観察がなければ未検証。ローカル実装・作者検証と公開判断を分ける。

## Verification

2026-09-09保存地点: 樹冠 `2ef39b7`・有限表現QA `7473e7b` をmainへpush。後者のVerify Core/Docs CheckはPASS、固定26sourceのclassic smoke31経路も合格。次は島と操作帯の占有領域、任意パネルの戻るボタンの重なりを修正し、既存の音の未計測窓を限定検証する。

仕様36の受入項目、104件と横断索引の網羅、実際のphone/tabletの初回・成長・発見・再演・編集・再学習。verify:core、smoke、classic PWA、Island/living/PWA、正式fixed-ten。保存の失敗/競合/再送、旧データ、別profile、実offline、音off、reduced motion。最終固定版の画面とmanifest、視覚・意味/安全・runtimeの別判定。

### 直近の継続

- 固定20の回帰は通常smoke31項目、classic PWA4項目、実2build更新（`../../../output/island-experience/pwa-two-build-20-01/report.json`）、Island PWA（`../../../output/island-experience/pwa-20-01/pwa-report.json`）がterminal0。Islandは8保護経路と実SW offline/reload/回答/自動成長/同予約復帰を確認し、全1032入力・QA・distの前後一致を外側記録（`../../../output/island-experience/pwa-20-01/verification-context.json`）へ残した。2buildは同20 sourceのclassic構成2版であり、旧Island保存形式や非空写真の更新保持へ広げない。

- 固定20の正式fixed-ten（`../../../output/island-experience/throughput-20-01/report.json`）は80run、eligible/pass/source不変・browser終了がすべてtrue。phone/tabletの入力再開P95は195.6/195.9ms、区間切替P95は196.0/195.8ms、追加操作0。全正答のIsland/Study中央値比は2.406/2.428。固定DEVの明示10問・keyboard/reduced motion/音offの比較で、実参加者の速度や通常plannerの根拠へ広げない。

- 横断目標のdomain/UIと、目標保存で試用景色が戻る退行の修正を固定20（`../../../output/island-experience/workshop-snapshot-20/build-source.json`）へ統合（`workshop-20260909-0db80c949ca3`、1032入力）。lint/type/build/assetsと278 suite/3097 testsが合格。検証記録（`../../../output/island-experience/snapshot-20-verification.json`）。同buildを再利用した横断目標の実UI（`../../../output/island-experience/reward-goals-01/verification-context.json`）は両幅PASS。各37実回答・52全DB比較・計26画像を57.858秒で確認し、無料選択/解除、未資格0ほしの条件、3カテゴリの実取得時解除、試用保持と同予約復帰を通過。写真は空ストア保持に限定し、実音・故障・PWAへ拡張しない。
- 音の07失敗は、実source開始512frameと最初の保存4992frameの差4480sampleが、旧相関探索±2400の外だった。最小診断（`../../../output/island-experience/audio07-loop-diagnostic/report.json`）ではnative導出位置の両巡目が元波形と一致し、±1sampleは不一致。固定20は探索をやめnative時計で直接対応し、41音回帰が合格。実音の後半境界と冒頭93.333msは未検証で、旧07をPASSへ変更しない。
- 裁量と自己改善の依頼を受け、既存verify skillへ反復中の限定再現と統合版の最終確認の区別を追記。Vitestで見つかるtestに`node:test`を混在させる失敗はlintで検出する。失敗と改善・重複照合（`../../../output/island-experience/verification-workflow-retrospective.json`）とルールの正負例（`../../../output/island-experience/runner-rule-verification.json`）を保存した。

- ユーザーの速度改善要望を受け、domain/UIを並行実装し、反復中は担当の短い回帰と共通の型検査1回へ集約する。約150問×2幅の獲得経路を音や画角の各微修正ごとに再走させず、修正は限定再現で確認、全体の学習・旧データ・offline等はまとまった固定版で検証する。音の未解決検証は残差として保持し、独立機能の実装を止めない。完了基準は縮小しない。

- 資格07（`../../../output/island-experience/qualified-07/report.json`）は固定19で両幅156実回答、55全DB、31workshop、2来訪観察、4記念品明示取得と既存写真保持を確認。小鳥は両幅の目・嘴・羽が読める実画像比較（`../../../output/island-experience/nature-19-review/comparison.html`）まで作者確認。音は試聴/置換の実出力が通過し、長いloopの元波形照合でFAIL。未計測93.333msを保持し、hidden/設定退出/最終学習復帰は未到達。全1022入力/QA8/同app919の前後不変を確認。局所の進展を全視覚・全runtimeの合格へ広げない。

- 直前turnはユーザー指定のGoal指示文作成で、Goal実装上は進捗なし。明示継続後、共有treeと実processを再確認し、停止済みの旧検証を再起動せず次の保存版へ進めた。全104項目と横断索引を維持する。
- 鳥の実模型を維持した顔の画角v2と、独立レビュー/36純回帰合格の音port順序v5を固定19（`../../../output/island-experience/workshop-snapshot-19/build-source.json`）（`workshop-20260909-7a2d01e5fb1c`、1022入力）へ保存。最初の実ready画像には、その同じcallbackの画角・顔判定・canvas/viewportも保存する。lint/typeは合格（既存Fast Refresh警告1）。build/full tests/実画面は進行中で、視覚・実音の合格を先取りしない。
- 固定19のbuild/assetsは合格。全Vitestは273 suite/2997 tests合格、追加音テストが`node:test`のためVitestへ登録されず1 suite失敗、全体exit1。rootの当該testのimportだけを`vitest`へ揃えて36件合格したが、固定19の失敗を上書きしない。固定19検証記録（`../../../output/island-experience/snapshot-19-verification.json`）。実行依存8件を含む19自身から資格07を開始し、次版にテストadapter修正を含める。
- 音v5は最初のsequence 0より前にport順序で確認した前進gapだけを未計測prefixと区別する。元音の開始から最初の保存PCMまでを未計測として残し、内部/後退/順序不明gapや先頭block欠落は引き続き失敗とする。レビューと昇格記録（`../../../output/island-experience/audio-prefix-promotion-review.json`）。旧資格06はFAILのまま保持する。
- E04の家具/身支度を含む任意の永続目標について、仕様35/40/41を先に更新する追加実装を開始。外見の既存目標・receiptを維持し、全カテゴリで目標1件、無料選択/解除、実取得時の原子的解除、0ほし資格品の条件表示を扱う。固定19にはこの追加実装を含めず、現在の配信検証と区別する。

### 身支度41の次の実証と残差

修正版main QAの完走後も、X01〜X14の全体は未完。次を独立して閉じる。既存の作者検証やfixtureを通常学習からの獲得と読み替えない。

1. 有料6品/実試歩/全景v2/同学習復帰を修正版で完走し、追加衣装を着た同住民のF04実利用も確認する。
2. 実通常学習→蝶/葉鳥の実来訪記録、入江の実制作→音offのbell記録→4資格品の明示取得/装備は資格03で両幅通過。来訪の顔・輪郭はHOLDで、修正後の同一buildによる実画面確認を残す。
3. 追加衣装→改名で保持→同じ無料capへ戻る、三音→同じoff/無料3音へ戻る実操作・実音・hidden/学習/退出の停止。従来DEVの無料3音やPCM単体は新三音の実音証拠ではない。
4. 旧版実UIから作るsceneStyleなし/v1の更新閲覧/適用、旧memoryと当時写真の保持、後発家具/展示による全景適用の全体拒否。旧appearance QAのv1期待値を新F05へそのまま接続しない。
5. 残る別機能購入との同revision競合、古い無料cap receipt再送、学習開始待ち中の遅い成功、通知順序。実写真を持つ2profileの保持は保存03で異なる被写体の元画像/thumbnailまで通過した。旧版生成写真やPWA更新時の保持は別途確認する。

旧景色の実生成元は、固定06（`../../../output/island-experience/workshop-snapshot-06/build-source.json`）（`workshop-20260908-9039d0105c7d`、sceneStyleなし）と固定12（`../../../output/island-experience/workshop-snapshot-12/build-source.json`）（`workshop-20260909-3023b69183f8`、v1 writer）をsource/distで確認した。両者ともDB v8/写真3storeを持つため、DB version移行とoptional保存形式の前方互換を区別する。同一originで06の配置/実写真/記憶→12で別枠v1→17以降で旧閲覧/試用/取消/適用と新v2保存、後発家具/展示衝突を実操作するまとまりが未実施。資格品を含むnon-null v2も既存身支度06のnull中心snapshotと別に必要。旧noneは現無料設定/F05を保持、v1は当時無料設定を復元し追加衣装/収集音だけ解除、v2はnullも含め復元する。読取だけで旧保存を書き換えない。

## 現在の固定版と追加実装（2026-09-09）

- 固定18の資格06（`../../../output/island-experience/qualified-06/verification-context.json`）は両幅FAIL/sourceStable=true、各55全DB比較/31工作差分、実回答phone159/tablet150。実2来訪/4資格品明示取得と元写真保持を確認後、最初の試聴で録音起動時のframe1152→1920により停止し、実hidden/SPA退出/最後の同予約回答は未到達。元画像の比較（`../../../output/island-experience/nature-18-review/comparison.html`）で親も両幅の蝶の両羽と花が住民から分離する改善を確認。葉鳥は向きが変わっても目/嘴が小さくHOLD。顔の可視率だけでなく実pixel寸法と最終描画姿勢を評価する修正へ進める。旧06を後付けPASSにしない。

- 最新のGoal指示文提示turnは実装進捗なし。明示再開後、停止済みbuildと実配信を再確認し、固定18（`../../../output/island-experience/workshop-snapshot-18/build-source.json`）を`http://127.0.0.1:5404/`で配信した。revision `workshop-20260909-5fcfa6e8f3e0`、全1021files、Island/build-play有効。検証記録（`../../../output/island-experience/snapshot-18-verification.json`）はlint（既存warning1/error0）・型・build/assetsと全273files/2993tests PASS（88.40秒）。小鳥の顔/嘴を向けた観察構図と、蝶の実羽/胴体が住民の輪郭へ重ならない観察構図・記録gateを含む。実画像と音は別途確認し、この全体testだけで視覚や全仕様41を合格にしない。

- 音付き資格05（`../../../output/island-experience/qualified-05/verification-context.json`）は17 app＋QA09で両幅FAIL/sourceStable=true、pageerrors0。実観察/4資格品取得後、計測前の別音源で検出したrender discontinuityをglobal errorと扱い入口で停止し、試聴/hidden/SPA/学習停止は未到達。raw履歴は保持し、範囲別の計測草案（`../../../output/island-experience/expression-audio-worklet-scoped-draft/README.md`）では対象outlet・計測windowの連続性と、全期間の不正データ/上限違反を別々に厳密検証する。固定18は不変とし、測定側の修正だけを別QAへ固定する。旧04/05のFAILは変更しない。

- 今回の再開直前はGoal指示文だけを返し、実装進展なしと分類。明示継続後、現在のtree/固定17配信/停止済みprocessを再確認して再開した。全104行と横断索引を維持し、以下の限定結果を全Goal完了へ広げない。

- 保存03（`../../../output/island-experience/expression-persistence-03/verification-context.json`）は17 app＋QA03（`../../../output/island-experience/expression-persistence-qa-03/qa-bundle.json`）で両幅PASS/sourceStable=true、各45全DB比較/計22captures、実hiddenとnative abort/retry/CAS/profile/実SW offlineを通過。Aの実全景とBの実ウサギ近景を各初回答前に撮影し、元画像とthumbnail双方の異SHA、本人のgallery1件、実img/PNG出力の本人SHA、元metadata/bytes保持を確認。ホーム往復は実readyフレームとnative完了を伴う厳密な初発見差分だけ許す監査へ修正し、gallery内は全DB不変を維持。今回の追加発見は0件で、非空の発見差分分岐の実UI証拠とはしない。

- 保存02（`../../../output/island-experience/expression-persistence-02/verification-context.json`）も両幅PASSだったが、A/Bの最初の全景が同bytesのため、誤った本人画像への取り違えを識別できない限界を保持する。保存03は被写体を実UIで分け、この限界を解消した追加実行。旧02のraw結果は変更しない。

- 音付き資格04（`../../../output/island-experience/qualified-04/verification-context.json`）は17 app＋QA08で両幅FAIL/sourceStable=true、pageerrors0。2来訪/ベル実観察・4資格品取得後、最初の三音試聴でScriptProcessor callback時刻の連続判定に失敗し、hidden/SPA退出/学習中の音停止は未到達。生PCMと実sourceの補助診断（`../../../output/island-experience/qualified-04-phone-pcm-diagnostic.json`）では3音が一致したが、欠落のない実出力の証明には使わない。AudioWorklet草案（`../../../output/island-experience/expression-audio-worklet-draft/README.md`）でcallback到着時刻から実render currentFrameへ計測を変更し、22純回帰/専用lintを通過。実ブラウザはまだ未検証、旧04 FAILを維持する。

- 資格03（`../../../output/island-experience/qualified-03/report.json`）は固定17 app/QA07で両幅PASS/sourceStable=true、pageerrors0、52captures/136PNG。各153通常回答で蝶/葉鳥の実frame→native保存、31工作差分と音offの実bell、4品の0ほし明示取得/装備/解除/再装備、58全DB比較、元写真bytesと同予約1回答/reloadを確認。小鳥の顔・蝶の輪郭の視覚課題、実音、旧景色/残る保存境界は別に保持し、fullSpec41Passed=false。

- PWA17-01（`../../../output/island-experience/pwa-17-01/pwa-report.json`）は8 protected-flow経路、旧予約/gift/10ほしと明示移行、フックなし実SW支配下のoffline reload→回答→自動成長→同予約復帰がPASS。外側照合（`../../../output/island-experience/pwa-17-01/verification-context.json`）で17 app1018files/QA6files/dist151filesの前後一致を確認しsourceStable=true。明示native profileと旧契約fixtureを含む7stores比較で、実初回設定の獲得・写真全DB・実2build更新・参加者効果を含めない。

- 直前turnはユーザー指定のGoal指示文作成で、Goal実装としては進捗なし。明示継続を受け、停止済み資格02のterminal130と実保存を再照合し、同17 app＋不変QA07の新しい資格03（`../../../output/island-experience/qualified-03/report.json`）を開始した。全104項目と各索引の範囲は維持する。

- 資格02の中断記録（`../../../output/island-experience/qualified-02/interruption.json`）を保持。phoneは通常150回答→実蝶/葉鳥→音offの実bell→4資格品の明示取得/装備/解除/再装備→元写真bytes→同予約1回答/reload、58全DB比較/31工作差分まで完走。tabletは成長途中で中断し、終了fingerprint未採取のため全体PASS/sourceStableとはしない。資格01（`../../../output/island-experience/qualified-01/report.json`）の両幅FAILは、保存済み予約があるhomeの「つづきから とく」をQAが「まなぶ」で探したもの。実予約全体/ID/revisionと回答前全DB不変を検査するhome入口へ直し、QA07（`../../../output/island-experience/expression-qa-07/qa-bundle.json`）にqualified単独差分を固定した。

- PWAは旧予約/現行の更新checkpointとフックなし実SW offlineを対象に、実welcome・profile seed後の実home・旧10ほし契約を検査するQAを別bundle02（`../../../output/island-experience/pwa-qa-02/qa-bundle.json`）へ固定した。17 app1018files/配布artifact151files/QA依存6filesの外側fingerprintを準備し構文/plan PASS。現時点はbrowser未実行、写真の全DB保持や実2build更新とは別範囲。音の新しいQA草案は実出力と元PCMの対応、hidden復帰、診断のnative透過性、再接続、失敗時の生証拠保存の5点を修正中で、実音PASSとはしない。

- 親が資格03 phoneの実画像を確認。リボン蝶は花上に描画されるがウサギの胴体と重なり、小鳥はきのこ上で後ろ向きのため顔/嘴が読めない。旗へ装備した小鳥は近景で屋根の外に見える。実保存/取得が通ることと来訪自体の無説明理解・全体の魅力を分け、来訪の画角/輪郭を次の改善対象として保持する。

- 身支度06（`../../../output/island-experience/expression-06/report.json`）は固定17 app＋明示QA bundle06で両幅PASS、sourceStable=true/pageerrors0、142captures/322PNG。phone90/tablet87実回答、各147全DB比較/6有料取得、旗の同UUID/同32camera往復と別商品/退出/学習から帰島後の解除、3住民の無料cap互換、全景v2、写真同bytes、同予約回答/reloadを確認。旧05のQA早期判定FAILを保持し、観察資格4品の取得・実音・旧景色/保存全体は未完。続けて同17 app/同bundleの観察資格01を開始した。

- 身支度05（`../../../output/island-experience/expression-05/report.json`）は固定17の両幅で各38全DB比較・旗の近景/全景往復まで通過後、商品切替時のARIA反映を待たないQA判定でFAIL（sourceStable=true、pageerrors0、48captures）。後続の実HTML/PNGでは新商品・一般ARIA・focus解除を確認し、appの解除不良と区別した。親は両幅の近景画像を確認し、屋根の外の鳥輪郭、無料旗印、島名札、右上の試用バナーを読み取れた。全体の魅力・意欲は別HOLD。main/qualifiedのselectItemだけを期待ARIA待機へ修正し、明示QA bundle（`../../../output/island-experience/expression-qa-06/qa-bundle.json`）へ固定17のapp入力・他helper不変を記録。17appを再buildせず身支度06→観察資格01で再検証する。旧05FAILは保持。

- 家具06（`../../../output/island-experience/furniture-06/report.json`）は固定17で両幅の選定経路PASS、sourceStable=true/pageerrors0、338captures/412PNG。phone99/tablet96実回答から、各17利用/72全DB比較/3取得/6本人による配置復旧を確認。両幅でハンモックの置場なし→周囲の望遠鏡を明示移動→同じウサギで候補検索/保存/実利用→同予約への回答/reloadが完走した。親はphoneの実望遠鏡接触・ハンモック接触と所有後の着座を目視。旧05のphone FAILは保持し、衣装/模様と全家具の接点組合せ、全ての旧保存/故障境界、子どもの理解を含む全仕様40は未完（fullSpec40Passed=false）。次は同17の身支度05と観察資格01。

- 固定17（`../../../output/island-experience/workshop-snapshot-17/build-source.json`）へ1018 filesを固定。revision `workshop-20260909-d31a1dce912d`、sourceHash `d31a1dce912d9b83ef4b1dc1bb0cda976fd8b9b9f5c8d133b9317324b2907632`。退避完了後の同住民試用、同じ旗の近景/全景、実屋根に埋まらない同一鳥飾り取付、旗用試用バナー、対応するmain/観察資格QAを含む。型/lint（既存warning1、error0）/build/assetsと全273files・2972tests（`../../../output/island-experience/test-snapshot-17-workers4.log`） PASS。PWA 10.66MiB/12。`http://127.0.0.1:5403/`へ起動し、家具06→身支度05→観察資格01の実画面を検証する。旗は8外見の全頂点遮蔽・紐接続・同UUID/倍率の担当検査が通った段階で、実バナーとの重なりや視覚の魅力は未合格。退避修正も実身体の89回帰（`../../../output/island-experience/furniture-clearance-17-audit/related-tests.log`）を実ブラウザ経路で再確認する。

- 直前のGoal指示文を提示したturnは実装上の進捗なし。明示継続後に現在の共有差分・固定16の証拠を再照合して再開した。104行と全横断索引、F01〜F05の残りを維持し、以下の限定経路を全Goalの完了にはしない。
- 身支度04（`../../../output/island-experience/expression-04/report.json`）は固定16でphone/tablet両幅PASS、各87実回答＋同予約へ1回答、各140全DB比較、6有料取得/6実歩行/12環境組合せ/3住民の無料cap互換、130captures/298PNG、pageerrors0/sourceStable=true。各住民の追加衣装→改名で保持→同じ無料帽子へ復元、実写真metadata/PNG/thumbnail/exportの同bytes、全景v2と同予約/reloadを確認した。親はphoneのfox実帽子復元を目視。4観察資格品・実音・旧景色等はこのrun外で、fullSpec41Passed=falseを保持する。
- 家具05（`../../../output/island-experience/furniture-05/report.json`）は固定16で全体FAILを保持（sourceStable=true/pageerrors0、178captures）。tabletは99実回答＋復帰後3回答、17利用/72DB比較、3取得/6配置復旧/3同予約復帰/reloadを通過。ハンモックの置場なし→周囲編集→所有望遠鏡を本人が移動→同じウサギの候補検索→保存→実利用まで確認。親は実候補全景を目視。phoneは96実回答後のウサギ試用でFAIL。実traceは噴水成長による退避の途中で試用入口のstopWalkingが歩行を止めることを示し、同一ウサギの実退避後に試用検索へ渡す修正と境界回帰を進める。
- 観察資格4品の草案を専用QAへ移し、図鑑から実playへの退出、Settingsの両profile保存表、IDBの文字列順、workshopの正確なaction/receipt/未変更枝を確認する監査へ改めた。自然homeの初観察も実ready画像・native transaction完了を継続記録する。監査helperは隠れた別標本/棚/作品/履歴/学習/写真の破損を拒否する12回帰PASS、構文/担当lint/plan PASS。実ブラウザ未検証で、記念品の取得経路の合格にはしない。

- 固定16（`../../../output/island-experience/workshop-snapshot-16/build-source.json`）へ1008 filesを固定。revision `workshop-20260909-87381994b9b3`、sourceHash `87381994b9b3541e5cba8befeb0105daed6496ea064ffc39446c88b69ec16baf`。尾v2/身体採点対象、構図の高さごとの最小可視率診断、家具の選択住民検索、候補反映待機QA、無料cap互換QAを含む。型/lint（既存warning1、error0）/build/assets、全269files・2946tests（`../../../output/island-experience/test-snapshot-16-workers4.log`） PASS。PWA 10.65MiB/12。URL `http://127.0.0.1:5401/` で家具05の実画面を検証する。固定15未使用記録（`../../../output/island-experience/snapshot-15-not-used.json`）はコピー直後の独立レビューでA→B検索中→Aの旧key再利用を検出したため未build・未browserで保持。新探索開始時に旧keyを無効化し、戻した後の実preflightがAだけになる回帰を追加（trial8tests PASS、独立再レビュー済み）。
- 尾の回帰は専用/互換検証（`../../../output/island-experience/fox-tail-pose-audit/compatibility-tests.log`）を含め114tests PASS。foxは同じ尾を低い側方へ畳む `island-tail-seat-joint-v2`、他2種はv1を保持。立位の形・UUID・ベンチ支持面・離席に加え、旧foldだけを戻す対照で星の手元遮蔽を再現し、新姿勢の実ray非遮蔽を確認。共有構図（`../../../output/island-experience/shared-framing-15-audit/report.json`）は対象26＋関連76tests PASS。尾branchを身体採点へ戻し、低視点の瞬間不足→次の高さで成立を回帰化。視覚閾値・候補上限は不変、固定14の全test5FAILを改ざんせず新16で全体を確認する。尾の自然さや子どもの無説明理解は単体テストの合格対象外。

- 今回の再開直前turnはGoal指示文のみで、Goal実装上は進捗なし。明示継続後、現worktreeと固定14の実結果を再照合し、変更を再開した。共有tailの採点対象脱落とfox座位尾の実遮蔽を別原因として修正中。既存の学習・他作業差分と固定14は保持する。
- 身支度03（`../../../output/island-experience/expression-03/report.json`）は固定14 app＋旗待機QA1行の別bundleでphone/tabletの選定経路PASS。各87実回答/122全DB比較、112captures、sourceStable=true、errors0。6有料取得/明示装備、6試歩、12環境組合せ、全景v2往復、原PNG同bytes出力、同予約回答/reloadを確認。元02FAIL、14全test5FAIL、phoneの小鳥旗の小ささ、qualified4/audio/旧scene等の未充足は保持する。3住民それぞれの無料cap→合羽→名前変更で合羽保持→同じ無料capを選び直し→再装備を厳密DB/実rigで確認するQAを追加（構文/lint/plan PASS、実操作未実施）。
- 家具04（`../../../output/island-experience/furniture-04/report.json`）は固定14で各99実回答後に両幅FAIL（sourceStable=true、errors0、86captures）。phoneは望遠鏡のカワウソ1利用後、共通試用位置探索が不成立のままウサギへ切り替えてunreachable。仕様40を選んだ住民/相手の到達可能な試用位置へ具体化し、Page→runtime choice、既存位置の優先検査、選択変更による古い探索破棄を接続。実rigと保存/同一模型保持の新回帰を含むtrial8tests PASS。tabletは全9試用と19全DB比較PASS後、新suggestionが実previewへ反映される前のQA判定でFAIL。検索requestId/pose/keyの追随待機へ修正（構文/lint/plan PASS）。owned利用とno-space周囲編集の実UI往復は次版へ残す。

- 身支度02（`../../../output/island-experience/expression-02/report.json`）は固定14で両幅の全6試歩と各34DB検査まで進み、旗飾りpreviewのQA待機漏れでFAIL。後続実frameには両幅とも同じ旗飾りが表示されており、切り分け（`../../../output/island-experience/expression-02/failure-review.json`）はapp描画失敗と区別する。主QAの選択待機へflag.trimと実可視性を追補したが、14/02は不変。親はphoneの離席始点と接地後のPNGを確認した。全6試歩を通過し、両幅のカワウソ各2経路で離席phase/実座面/足裏/接地前mark0を検査。ウサギ/キツネは地上からの試歩で、実着座からの離席は未観測。取得・環境・全景v2・学習復帰は未到達。尾の自然さ/場面全体の魅力と子どもの理解N=0は別判定を保持する。

- 固定14の全体test（`../../../output/island-experience/test-snapshot-14-workers4.log`）は269files中268PASS/1FAIL、2941tests中2936PASS/5FAIL。失敗は既存`sharedActivityFraming.test.ts`の候補数/採用plan差と、0875 tablet starのreadability=falseなど。尾関節分離前後の実rig/既存共有poseと、構図の評価を分担して調査中。期待値や閾値だけで合格にせず、14は不変に保持する。F05の修正後の実画面は14を限定診断として観察し、全体testの失敗をrelease合格へ読み替えない。

- 全1008filesを固定14（`../../../output/island-experience/workshop-snapshot-14/build-source.json`）へ保存し、revision `workshop-20260909-9331617ebd23`、`http://127.0.0.1:5400/`へ起動。元の尾形状を関節へ分けた着座/離席、初回実描画からの家具歩行時計、実forwardの構図/茶卓の机・カップ独立評価、no-spaceから周囲を本人が編集する入口、身支度/配置の古い台詞を出さない境界、全景v2/離席/配置往復のQAを含む。型/lint（既存warning1、error0）/build/assetsとdocs:check PASS、PWA 10.65MiB/12。全体testと修正後実画面はこの固定版で別に確認する。

- 身支度の保存01（`../../../output/island-experience/expression-persistence-01/report.json`）は固定13 app＋新規immutable保存QAで両幅PASS、sourceStable=true、page errors0、各35全DB比較・計22captures/44PNG、実回答phone54/tablet51。native abortの全table rollback、通知欠落の同receipt retry、実2window CAS、同windowの実hiddenで遅延配送時に追加writerなし、A/Bprofile分離とAの遅延通知、実SW offlineで夕/冬の保持と朝への無料変更、同予約への実回答を確認。独立の実hidden記録も両幅PASS。写真storeが空の経路なので既存PNG保持をこの証拠に含めず、修正中の離席/画角や仕様41全体の合格とも分ける。browserは終了済み。

- tablet時刻診断（`../../../output/island-experience/furniture-timing-01/timing-analysis.json`）で、実99回答から同requestの開始→plan25.1ms→初回画角319.5ms→初RAFを追跡。初描画前の準備344.7msがreduced歩行300msを消費し、render時はcontactへ進んでいた。採取はrender後約1.1msで、単純なpoll取り逃しではない。初回実walking描画を起点に時計を始めるcontroller/runtime修正、実forward yawと茶卓のカップ/机独立遮蔽評価を保存し、担当69tests/型/lint PASS。修正後の実画面・全source回帰は次の固定版で確認する。
- 所有ハンモックのno-spaceは固定13の位置/保存配置を使うgeometry切り分け（`../../../output/island-experience/hammock-placement-diagnostic-01/moved-telescope.jsonl`）で再現。0.25刻み316向きでもウサギの候補はなく、望遠鏡を別の合法位置へ動かす対照では同じウサギの候補が得られた。idle yawは記録になくconstructor姿勢を用いたため実状態の全再現・連続空間の到達不能証明とはしない。仕様40に探索失敗から周囲を編集する入口を具体化し、未保存preview取消→持ち物、道具/住民選択・所有保持をUIへ接続。探索では保存を変えず、周囲の望遠鏡の明示変更後に同ウサギがハンモックを使うgeometry回帰を追加（担当2files/10tests・lint PASS）。実UI往復は次版で検証する。

- 今回の再開直前turnはユーザー指定のGoal指示文作成のみで、Goal実装上は進捗なし。明示継続後、現treeと固定13の失敗結果を再照合して修正を再開した。身支度QAの全景v2保存/復元に模様・足跡・表紙の独立変更と実renderer復元、古いcaptionの非表示検査を追加し、構文・担当lint・plan PASS（実操作は次版）。
- furniture-03（`../../../output/island-experience/furniture-03/report.json`）は固定13＋固定QAで両幅FAIL、sourceStable=true、page errors0、計105captures。phoneは実99回答から全9試用と所有望遠鏡2利用を確認し、配置探索の2経路で「利用不可→本人の探索→保存しない候補→明示配置→同住民の実利用」を通過。続く所有ハンモック/ウサギの探索がno-spaceで未解決。tabletは最初のreduced望遠鏡で記録の初frameが374ms後のcontactとなり、walkingの実描画を確認できず。試験の待機条件を緩めず、開始・経路計画・画角・描画時刻を別診断で確認する。
- furniture-03の実画像を親が確認し、ウサギの望遠鏡とキツネのハンモックは接点/支持面が読める一方、茶卓は2人の背で机とカップが隠れるため視覚HOLDを保持。固定13の実入力によるgeometry診断では、quaternion復元後のEuler表現の変化をyawとして読むと視点が反転することを再現。実forwardからのyawとカップ/机を別々に見る画角評価を修正中。geometry結果を実画面や全仕様40の合格へ転用しない。

- 固定13の全体テスト（`../../../output/island-experience/test-snapshot-13-workers4.log`）は268files/2916tests PASS。最初のexpression-01（`../../../output/island-experience/expression-01/report.json`）は両幅で衣装2×3住民＋2模様の未所持試用/取消まで（各16全DB検査、計20captures、実回答phone90/tablet87）通過し、ベンチ着座中のカワウソの足跡試歩が16候補すべてblockedでFAIL。sourceStable=true、page errors0を保持。自分のベンチ占有を通常地上歩行の障害物として初点から拒否しており、単に除外すると座面を貫くため、実座面から離席して接地する境界を修正中。rootは身支度の住民/requestごとに台詞を区別し、旧着座captionと取消済み試歩の表示残りを修正（型/担当lint PASS）。実画像は新固定版で再確認する。
- F05 QAへsceneStyle v2の保存→衣装/環境変更→実景試用/取消→明示適用→再編集を追加し、構文/担当lint PASS、未実行。別の[保存QA](../../../tools/e2e-island-expression-persistence.mjs)も準備（構文/lint/plan PASS）し、native abort・通知欠落/同receipt・CAS・実hidden・profile・非既定環境の実SW offlineを対象とする。既存13/原QA/失敗reportは不変で、次回は新しいQA bundleに固定する。

- Goal指示文を返した直前turnは、Goal実装上の進捗なし（追加実装・実検証なし）と分類。今回の継続で保存済みsourceを再確認し、全1005 filesを固定13（`../../../output/island-experience/workshop-snapshot-13/build-source.json`）へ保存した。revision `workshop-20260909-d63b3ccf1804`。F04の明示配置探索/近景とF05の衣装・模様・実歩行/足跡・環境/旗を含む現source全体で、10〜12の限定合成版と区別する。型/lint（既存warning1、error0）とbuild/assets PASS、PWA 10.65MiB/12。全testと実画面は検証中。
- F05 runtime統合と単体の実rig境界を保存。衣装12・足跡3・実歩行7・runtime住民3・環境runtime4tests、CAS後の古い試用を破棄して本人が再選択するhook9tests（`../../../output/island-experience/expression-hook-cas-01.log`）はPASS。これらを実画面やX01〜X14全体の合格にしない。X07/X08/X11のnative保存障害・profile・非既定環境のoffline検証を別QAで補う。
- surfaces03（`../../../output/island-experience/appearance-surfaces-03/report.json`）は診断版 `appearance-diagnostic-20260909-e5186375fdb5` の両幅で地面/壁の取得・無料復元/再装備・同予約と実回答・reloadを完走（各15全DB検査、計42captures）。購入なしreload対照のposition hash差による元HOLD/exit1は保持。実hash一致の切り分け（`../../../output/island-experience/appearance-surfaces-03/signature-resolution.json`）で、同じ成熟形状を段階成長/起動時直接生成する際のFloat32 batch丸め（最大約3e-8）を特定した。実行時matrix/normal/color/index等は一致し、購入操作の変形ではない。親も実画像比較（`../../../output/island-experience/appearance-surfaces-03/surface-comparison.html`）のphone地面とtablet壁の変更前後を目視し、ビスケット格子/広い苺色の壁の差を確認。全体の魅力・子どもの理解は未検証。

- F05の[実画面QA](../../../tools/e2e-island-expression.mjs)を準備し、構文/lint/plan PASS。通常回答で85ほしを得て10品試用・6有料品取得/別装備・3住民・朝昼夕/季節・写真外装とPNG不変・同予約復帰を通す。runtime統合前で未実行。4品の資格取得経路、実音、障害/別profile/offline等を別の未実施として残し、plan PASSをruntimeやX01〜X14全体の合格へ読み替えない。

- 固定12（revision `workshop-20260909-3023b69183f8`、`127.0.0.1:5397`）は11に共有作品の板面評価だけを加えた限定合成版。build/assetsと関連26tests PASS。shared-camera-03（`../../../output/island-experience/shared-camera-03/report.json`）はphone/tablet各28DB、計52captures、page errors 0、sourceStable=trueで終了。親も実画面比較（`../../../output/island-experience/shared-camera-03/work-before-after.html`）で板面遮蔽の解消を確認した。作品写真保存/住民仕事全経路/全体の魅力・無説明理解はこの結果に含めず保持する。

- 指示文を提示した直前turnでは新しい実装・検証を開始しなかった。Goal継続を受け、current worktreeと停止済みの実process結果を確認して再開した。以下の固定10/11は途中のF05を除く合成診断版であり、現在の全sourceやGoal全体の検証結果ではない。
- 固定10はrevision `workshop-20260908-7db377226341`、974 files、`127.0.0.1:5395`。manifest（`../../../output/island-experience/workshop-snapshot-10/build-source.json`）に09＋F04試用修正/39地面・壁の10file overlayを記録。全254files/2,816tests（`../../../output/island-experience/test-snapshot-10-workers4.log`）とbuild（`../../../output/island-experience/build-snapshot-10.log`）はPASS、PWA 10.59MiB/12。固定11は同10＋共有画角の読取診断とboundary testだけで、revision `workshop-20260908-ef88d720c8db`、`127.0.0.1:5396`。manifest（`../../../output/island-experience/workshop-snapshot-11/build-source.json`）へ生成元を残す。
- 固定10のfurniture-02（`../../../output/island-experience/furniture-02/report.json`）は両viewportで全3道具×全3住民の試用、取得した望遠鏡の初回利用まで通過。その後の本人の配置(-1,2.5)/回転πではカワウソが到達できず全体FAIL、sourceStable=trueを保持した。独立した細かい中心点経路だけには通路があったが、実身体と余白を保つ向きはなかった。仕様40の正当拒否として、利用可否のpreviewと本人の「つかえる ばしょを さがす」→確認→別保存を実装中。通れない体を通す修正や、保存した物の自動移動はしない。望遠鏡支持棒v2/ハンモックの遮蔽も実画像未確認。
- 固定11のshared-camera-02（`../../../output/island-experience/shared-camera-02/report.json`）は両viewportの読取診断が完走（各28DB/52 captures、sourceStable=true）。actual display枝・display-3・3部品・住民poseを照合した。以前の「右2部品が完全に隠れる」という記述は撤回する。3部品の接点は見えており、読み取り不足は作品を載せる板面/全体と大きな前景住民の重なりだった。同じactual作品の載せ面も4番目の評価対象に加える修正を保存。修正前4FAIL→修正後関連26tests PASS、実画像は新しい固定12で確認中。
- F05のdomain/storage、無料設定との原子的な互換、sceneStyle v2/旧履歴を接続し、担当195tests PASS。衣装/模様/足跡の造形と環境/旗renderer（専用18tests）は保存済み。rootは取得と装備を分ける画面、無料試用、朝昼夕/季節、短い音の試聴、実写真の外側の表紙/スタンプ、同予約への学習入口をPageへ接続。3D runtimeの統合と実画面は未完了。
- F05 rootのhook/音19tests（`../../../output/island-experience/expression-hook-audio-04.log`）は、別profileへの遅い取得結果の非混入、未知結果の同receipt再送、試聴連打で旧音源と通知を退役させることを含めPASS。UI3tests（`../../../output/island-experience/expression-ui-tests-01.log`）は無料試用/不足時取得拒否/取得後の別装備/学習と退出の維持を確認。最初のhook/音03はworker上下限の起動設定不一致でテスト未実行、04ではmin/maxを明示して実施し旧ログを保持。成長アルバムは現在側と保存当時の衣装/環境を分離し、旧履歴へ現在値を注入しない関連15tests PASS。いずれも子どもの魅力・理解の証拠ではない。

### 2026-09-08の経過（以下の固定版は当時のもの）

- F05を[仕様41](../../product/41_island_expression_collection_spec.md)へ追加採用。6有料/4観察資格の10品、無料の朝昼夕/4季節、所有と装備の分離、無料衣装/音への実復帰、全景v2/旧写真の互換を定義し、親01/36/保存13/index/ownershipへ接続。価格85ほし合計は初期仮説。X01〜X14の実装・実画面は未完了で、仕様採用を報酬分類の完成にしない。
- 固定09のappearance-06（`../../../output/island-experience/appearance-06/report.json`）はphone/tabletの選定経路PASS。各57比較/78全DB検査、実回答129/132、170 report captures/340 PNG、pageerror 0、app/QA/bundleAppInputsの開始終了hash不変。部位近景、実屋根25購入、全景保存、同予約3復帰を確認したが、candy地面と壁の単品差は親/担当の実画像レビューで弱いと判定。parts-v1だけにビスケット地面と苺色の壁を追加し、旧外見/歩行面/他部位を保持する修正中。初回の地面修正は3 suites36tests/lint PASS、修正後の実画像は次snapshotで確認する。

- 固定09のfurniture-01（`../../../output/island-experience/furniture-01/report.json`）はphone/tabletともFAIL、sourceStable true。実回答でphone99/tablet96ほしを獲得し、望遠鏡を選んだ実カワウソが使う経路を確認したが、次のウサギはunreachableで拒否された。試用の利用終点と戻ったカワウソの距離0.78が必要な住民間隔0.84を満たさないことを担当が再現。衝突条件を緩めず、全登場住民の実経路から未所持の試用位置を確定する修正中。18 report captures/24 PNGを保持し、残る道具・購入・配置・学習復帰の受入は未完了。望遠鏡と既存遊具の画面上の重なり、終了後の移動中captionも再確認する。
- 固定09のappearance-05（`../../../output/island-experience/appearance-05/report.json`）はユーザーのGoal指示文要求に合わせて停止（exit130）。phoneの57比較は完了、tabletと全体は未完了。306 PNGを途中証拠として保持。親がphoneのcandy屋根の現在/試用実画像を比較し、同じ近景で柄が変わり他部位が保たれることを確認した。停止runを全体PASSへ変更せず、Goal再開後は新しいappearance-06で両viewportを検証する。

- 最新の診断snapshot09はrevision `workshop-20260908-00c12e4ff805`、971 files、`127.0.0.1:5394`。manifest（`../../../output/island-experience/workshop-snapshot-09/build-source.json`）、build（`../../../output/island-experience/build-snapshot-09.log`）、全253files/2,806tests（`../../../output/island-experience/test-snapshot-09-workers4.log`）がPASS。F04（candidate `island-life-tools-v1`）、F03部位近景、shared配置完了後の画角復帰を含む。PWA precache 10.58MiB/12。root全lintはerror 0/既存warning 1、docs:check PASS。実画面の家具・近景・作品遮蔽はこの版で検証中。

- snapshot07の全体再実行は学習進行timeout1件＋写真hook2件でFAILを保持。学習進行の同じ12testsは単独でPASS。写真の固定5tick待ちがnative保存完了を保証しないことを確認し、同じ実operation Promiseを待つテストへ修正した。アプリの写真hookは変更せず、10tests/担当lint/型PASS。
- 新しいsnapshot08はrevision `workshop-20260908-f33f47242b8a`、951 files、`127.0.0.1:5393`。manifest（`../../../output/island-experience/workshop-snapshot-08/build-source.json`）、build（`../../../output/island-experience/build-snapshot-08.log`）、全245files/2,716tests（`../../../output/island-experience/test-snapshot-08-workers4.log`）を保持。並列数4、既存timeout/検査内容のまま全件PASS。PWA precache 10.54MiB/12。F04はこの固定版へ含めていない。
- appearance-01は未配置きのこへの差分要求でFAIL。実回答で西のきのこまで得るQAへ修正。固定08のappearance-02はphone132/tablet129実回答と各57比較まで通過後、学習へ戻るQAボタンの誤りでFAIL。画像122枚と全DB比較を保持。修正した独立QA bundleのappearance-03は実25ほしの屋根交換、無料の窓変更/復元、残額75/95まで通過後、全景保存枠IDのQA誤記を検出。全体をPASSへ書き換えず、残りのlocatorをまとめて照合する。
- 親がappearance-02の完成セットと単独屋根の実画像を比較。全景のテーマ差は読めるが、3土地全景で屋根の単品が小さい。部位近景と子どもの気づきやすさは未充足として残す。
- 同じ固定08と独立QA bundle04のappearance-04（`../../../output/island-experience/appearance-04/report.json`）はphone/tabletの選定経路PASS。各57比較・78全DB検査・実25ほし購入・slot-1名前/全snapshot保存・現在の窓との差を伴う試用/明示取消・同予約3復帰と実回答・reloadを確認。実回答はphone126/tablet132、146 captures、app/QA/bundleの開始終了hash不変、pageerror 0。仕様39のS02旧権利、S03別購入順/全セット購入、S05障害/CAS、S06後続成長、S07全段階接点、S09履歴、S11profile/offline/PWAはこのrunで未実施。屋根近景と子どもN=0も残す。
- F04を仕様40へ追加採用し、3道具のdomain/storage＋旧基本報酬分離を実装。新22/関連132の計154tests、担当lint PASS。UIの無料実景試用・取得・配置・住民選択を接続し、root hook10＋trial5＋既存きせかえUI9の計24testsとroot担当lint PASS。3D接点/演技と全体固定検証は未完了。永続firstUse/家具専用wishlistは実装しておらず、E04等の残差へ保持する。
- 固定08のshared-memories-05（`../../../output/island-experience/shared-memories-05/report.json`）はphone/tablet各27全DB検査・11工程trace、48画像、source不変で選定経路PASS。標本写真の幹遮蔽解消を親が実画像で確認。一方、作品Aは配置完了後もjob画角が残ってカワウソが部品を隠す。`settled`とcommitの両方が揃った時だけ展示画角へ返す修正をcurrentへ追加（修正前4FAIL→後4PASS、関連計26tests/担当lint PASS）。修正後の実画像は次の固定版で確認し、視覚HOLDを保持する。
- 仕様39へ部位近景の契約を追記。Reactは閲覧対象を購入intentから分離し、購入成功/試用取消でも対象と倍率を維持する接続。根拠写真と同倍率で比べるQAを更新し、UI/hook/trialの24tests・担当lint・docs:check PASS。近景rendererとF04の全回転/住民の実身体経路を接続中で、09はまだ固定していない。

## Progress

- 2026-09-08: 新しい広範Goalを受領。前のほし・きせかえGoalの完了を今回の完了証拠には使わない。現在のworktreeは既存の大きなstaged差分を含むため、index操作・既存差分の取り消しは行わない。
- 2026-09-08: 104項目対応表、domain保存、renderer暮らしの3独立調査を開始。親は現在のUIと仕様を照合。既存に10発見・3家具ペア・成長・編集・比較がある一方、未発見の案内、住民個性、来訪、名付けと自由な場面記録が不足していることを確認。
- 2026-09-08: E1–E6のdomain/保存/UI/render接続を実装。共有3組の距離/向き/相手の選択をpure `sharedSettings` に集約し、発見帳と実演を同一条件にした。名前/旗/衣装/3音景/3配置/実写真を接続。写真要求をframe取得時に消費し、renderer再mountの再DLと退出後の遅延dispatchを防ぐ。
- 2026-09-08: 実設定と通常回答3区間からのguide診断01/02はphone/tabletの未発見→無料ヒント→実成長予告/取消→観察/再演→写真→同じ予約の回答がPASS。02では次/現在の固定近景camera一致を検査。DEVであり最終source固定・速度・子どもの理解は証明しない。実画像で通常蝶の細い輪郭を指摘し、renderer側で修正/再検証中。
- 2026-09-08: E2/E3の実診断で全景の小ささ、住民/家/木による遮蔽、巨大なホタル光、小鳥の接点誤認を検出。runtimeチェックが通っても視覚をHOLDにし、実geometryの遮蔽を避ける観察cameraと造形を改善中。
- 2026-09-08: E5/E6のpersonal-20260908-1820は44画面、各6区間の実回答、名前/旗/衣装/3保存/試着取消/適用/後発成長/実PCM音/音off/学習停止/native abort/retry/reload/実画像写真がPASS。衣装が全景で小さかったため実住民portraitを追加。キツネ帽子の枠外を実画面の投影から検出し、実offsetと衣装共通倍率を守る修正を行った。修正版を再診断中。
- 2026-09-08: phase-1の全208 suites/2345 tests、lint（既存IslandMilestoneのrefresh warning1）、docs:checkはPASS。その後のportrait修正は専用6tests PASS。まだ最終固定buildの全体検証ではなく、追加E7/E8と未充足が残る。
- 2026-09-08: 全104行と9索引をコードへ照合した[残る体験の監査](2026-09-08-island-experience-remaining-audit.md)から、本人の道具・未知の正体・制作・仕掛け・別試作を[仕様37](../../product/37_island_workshop_spec.md)へ追加採用。3標本×3道具、4部品の水/軸接続、2作品案とundo、実住民利用まで実装する。その他のU3/U5/U6/U7と各報酬分類は対応表に残す。
- 2026-09-08: [途中診断の監査](../../design/audits/2026-09-08-island-experience/README.md)を追加。personal最終DEVはsource不変で52画面PASS、実actor portrait/全テーブル保持/音の現在出力/PNG画素一致を強化。自然の観察はなお見え方を修正中。E7/E8は標本/保存writerと接続/undo/simulatorを分担して着手し、次に単一rendererの入江と直接操作をつなぐ。
- 2026-09-08: E7/E8の標本・観察・正体・棚・2作品・20操作のdraft履歴と原子的writer、typed water/shaft simulatorを実装。親のrequest再送を合わせた4 suites / 46 tests PASS。実学習後の全学習テーブル/ほし/成長/予約保持、lost response・native abort・CAS・旧省略値をdomainで確認。Reactの任意入口、道具の直接操作と同じ区画を選ぶ代替操作、組立/盤面/保存UIを追加し、単一rendererへの接続と実UI検証を継続中。
- 2026-09-08: 工作専用の短い8材質音を追加。音ownerは学習/退出/背景/offで停止・解放。新12+既存6の音tests、実Chromiumの現在PCM出力/最大3voices/自然終了/停止/再起動を確認。実スピーカーの聞き分けは未評価。初回の実学習→3標本→A/B作品→undo/reload→同予約の回答を通す `tools/e2e-island-workshop.mjs` を追加し、実画面の到達待ち。
- 2026-09-08: world診断17のphone実画面を親も確認。巨大な光の面と対象の遮蔽は改善したが、ホタルの輪郭と反射の因果は説明抜きでは弱く、視覚HOLDを維持する。自動runtime PASSを視覚合格へ読み替えず、入江接続後にも残る改善として追跡する。
- 2026-09-08: 入江の開発診断03はphoneの全経路PASS、tabletはHMRによるnavigationで中断。証拠を分け、src/public/toolsをhash確認して `workshop-snapshot-01` へ固定。revision `workshop-20260908-3384cdae3463`、島/build-play有効のproductionを127.0.0.1:5384で構築し、build/asset budget PASS。
- 2026-09-08: 固定版 `workshop-diagnostic-04` はphone/touch/通常motionとtablet/keyboard/reducedの両方PASS。空DBの実回答1区間から3標本×道具、4部品の実組立、異なるA/B接続、2作品保存、undo/reload、同じ通常予約への実回答を32画面で記録。既知7テーブルと島のほし/成長/予約不変を検査。全テーブル/offline/住民/直接drag/速度をこの結果だけで合格にしない。
- 2026-09-08: 現物の木目/貝の縞/透過色、水とガラス、制作盤と木部品の色分離を実画面で確認。phoneに旧ホームの『すこし よけるね』が残る不具合を検出し、IslandStageで入江中の旧台詞を隠しcanvasの意味を切替。修正後画面は次の固定版で確認する。見た目・無説明理解は引き続きHOLD、子どもN=0。
- 2026-09-08: 保存操作をUIとscene共通FIFOへ統合。A→B→Aを保持し、重複観察だけをまとめ、CAS後の古い観察を退役。不明I/Oのundo/saveは元receiptで再送。queue/request/repositoryの35tests、担当lint、型検査PASS。明示住民の歩行→実手接触→実行も実装し、実UIでの取消/復元を検証中。
- 2026-09-08: `workshop-snapshot-02`（revision `workshop-20260908-3e077cc21848`、127.0.0.1:5385）に中心socket・旧台詞・secondary pointer所有・住民画角の修正を固定。build/asset budget PASS。gestures02は両viewportで長押し/取消/速い6区画なぞり/流木drag/穴中央の実組立/盤面drag/重複と範囲外/履歴A→B→A/undo/redo/同予約実回答がPASS。6実画像で旧台詞消失も確認。tablet cancelは合成pointercancel、phoneはnative touchCancelと区別。
- 2026-09-08: 固定診断のsrc複製が通常Vitest探索へ混ざることを確認し、既存除外に生成物 `output/**` を追加。実sourceの223 test filesが列挙され、snapshotの重複0を確認。socketは実camera rayの4失敗再現後に修正し、20tests/担当lint PASS。
- 2026-09-08: [仕様38](../../product/38_island_shared_memories_spec.md)へF01/F02を追加採用。選んだ住民の運搬/花びら/照明と共同記憶、主島3展示、同じ標本/独立作品snapshotへの再訪、12枚の実写真棚をつなぐ。写真bytesは学習writer外のv8専用3store、first-memoryは既存receiptの主キー参照とする。親01/36/37/保存13/index/ownershipへ接続。F03/F04/F05と16報酬/24比較全体は未完了のまま保持する。
- 2026-09-08: snapshot02の `workshop-persistence-04` はphone/tabletとも全保存matrix PASS。実native hidden、FIFO、abort全rollback、commit後通知欠落/retry、実SW offline/reload/通常回答、実UIの2人目追加/切替を全tableで確認。driver側のfocus emulationのみ補正し、document.hiddenを偽装していない。12画面を保持。
- 2026-09-08: 仕様38の3展示/1依頼/12記憶と独立作品snapshot、first receipt再利用、CAS/原子的保存をdomainへ接続。家具から展示への衝突、自動成長の配置、旧E6案の部分適用拒否まで含む新22/関連54tests PASS。実住民の仕事と主島展示のUI/render接続はまだ残る。
- 2026-09-08: 写真用v8の3store、profile原子的削除、12枚/24MiB/PNG寸法/実digest、旧v7保持、保存後削除への旧retry非復活を実装。写真/所有profile/既存削除の6files・211tests PASS。アルバム一覧はthumbnailだけを検証し、本体を読み出すのは一枚表示/書き出し時。camera/写真棚/PNG/明示削除をUIへ接続。
- 2026-09-08: snapshot03（revision `workshop-20260908-801242df2255`、127.0.0.1:5386）build/資産予算PASS。同時点の `verify-core-photos-01.log` は全229files/2531testsを含めPASS。lint警告4件中3件は生成snapshot内の旧warning重複だったため、通常lintもoutputを除外した。
- 2026-09-08: `photos-01` のphoneは実frameとの全画素一致、入江実表示、PNG同bytes、12枚満杯/削除取消/原子的削除、変換途中の学習復帰、実SW offline、実2人目の写真分離を通過。ただしtabletで住民選択後も全景を撮る不具合を検出し全体FAIL。phoneも写真hash差だけではportraitを証明しておらず、実画像の全景を確認して合格扱いを撤回。portrait gateを写真モードへ広げ、実camera倍率検査を加えて次版で再検証する。
- 2026-09-08: snapshot04（revision `workshop-20260908-e6ca51bf7c05`、127.0.0.1:5387）の `photos-02` は両viewport PASS。実camera近景倍率、全景/住民/入江の全画素一致、保存PNG同bytes、12枚上限、明示削除、変換中の学習復帰、実SW offline、2profile分離を確認。親が実住民近景と一枚表示を目視。子どもの理解、展示構図と住民仕事はこの証拠に含まない。
- 2026-09-08: 同04の `photos-persistence-01` はnative abort/同receipt再送まで通過後、次撮影の旧revision参照でFAIL。通知欠落後の再送成功snapshotをhookへ即採用し、旧liveQueryへの退行を防止、profile変更時に旧変換を取消。新10/写真関連24tests PASS。05で再検証する。
- 2026-09-08: 仕様38の展示geometryに実アンカー/占有/同一Object3D移管/独立作品の12tests、関連入江22tests PASS。3展示/記憶棚/配置preview/写真構図、A再演とBつくりかけ比較/明示切替、発見帳から入江への入口をUIへ接続。本人/住民の仕事controllerは統合中で実画面未合格。
- 2026-09-08: 保存待ちの停止/背景化後に遅い通知から仕事を開始する問題と、再送成功時のpreview/読取画面解除漏れを修正。演技開始は世代tokenで取消し、通常成功/再送に共通の完了処理を使う。実writer/制御hook 12回帰tests PASS。
- 2026-09-08: snapshot05（revision `workshop-20260908-c88b68985c4f`、127.0.0.1:5390、928files）build/asset budget PASS。写真保存修正の検証用で、shared本人/住民command未接続の境界を含む。仕様38全体やGoalの完成証拠にしない。
- 2026-09-08: 同05の全234files/2,580tests PASS。`photos-persistence-03` はphone/tablet各7項目PASS、errors 0、実hiddenを含めapp/QA hash不変。native保存/削除abort→元receipt再送、通知欠落retry→同window次シャッター、別visible windowの実削除→旧retry非復活、背景変換取消→同予約の通常回答を確認。12画像を保持。
- 2026-09-08: 同05の `photos-03` はphoneの最初4項目後にreloadのvisible canvas待ちでFAIL。現学習集中仕様のhidden 1×1 canvasを正しく扱うよう、QAの待ち先を実入力へ変更。旧結果は保持して `photos-04` で再実行する。shared hookは他画面取消後の古いprepare結果を返さない修正を含め13tests PASS、Stageには実行前scroll/2RAFとhiddenの未送信command取消を接続。これらは05以後のsourceで未固定。
- 2026-09-08: `photos-04` はphoneの実offline再起動/閲覧/通常回答まで通過後、元profileへの切替で同じhidden canvas待ちが残りFAIL。実入力待ちへ揃えた `photos-05` は固定05でphone/tablet各6項目PASS、errors 0、app/QA fingerprint一致、18画像。親がphone近景とtablet offline写真を確認。更新したQAの構文/担当lintとdocs:checkを確認し、次にshared仕事を含む固定版で展示/再訪を検証する。
- 2026-09-08: 保存と描画の独立調査を照合し、F03を[仕様39](../../product/39_island_appearance_sets_spec.md)へ追加採用。3シリーズ×6取得部位/12装備slot、旧テーマ権からの無料利用、単品/テーマ/完成セットの重複なし交換、3枠の全景保存、従来外見と新しい版の分離を定義。親01/35/36/index/ownershipへ接続。S01〜S11は未実施で、F04/F05とGoal全体は引き続き未完了。
- 2026-09-08: snapshot06（revision `workshop-20260908-9039d0105c7d`、938files、127.0.0.1:5391）へshared本人/住民仕事を固定。関連11files/113tests、型/lint、build/資産予算に加え、固定source全239files/2,632tests PASS。shared基本02はphoneの3展示と2回の同学習復帰を通過後、QAの上下左右1step合法という過剰前提でFAIL。実previewの斜め移動へ修正して次runを実行中。親は3展示全景と実物近景を確認したが、全3仕事/native hidden/意味・視覚は未判定。
- 2026-09-08: 仕様39を独立レビューし、確定abortと結果不明の区別、SKU利用権と適用slotの区別、12slotと全実物の所有表を追補。旧家具paletteの含有という誤記を現rendererに合わせて削除した。部位domain/storageとrootのpreview比較を実装開始。39は固定06に含まれず、現sourceの全体検証は未実施。
- 2026-09-08: 固定06の `shared-memories-04` はphone/tabletの選定経路を通過したが、実行中の共通QA helper変更を最終guardが検知し全体未合格を保持。各27回の全DB比較、同一物の展示/再訪、A保存元削除後の再演/B履歴保持、通常回答を観測。親も写真の木による標本遮蔽を確認したため、runtimeの画素一致を視覚合格にしない。実三角形の遮蔽から標本/作品各部品の構図を選ぶ修正と37 focused tests/型/lintを確認し、次の固定版の実画像で再検証する。
- 2026-09-08: 仕様39の18部位SKU/3完成セット、12装備slot、利用権と差額、旧appearance解決版、全景sceneStyleと成長snapshotをdomain/storageへ実装。担当92tests＋成長/学習関連46tests、型/lint PASS。新しい部位選択/内側slot/無料既定試用/一部だけ試用取消/明示購入/全景保存入口をUIへ接続。全景previewの住民衣装・旗・音も現在のsceneへ接続。rendererは独立部位/material化と実画面前の検査中。
- 2026-09-08: customizationのunknown exact intent保持/別action拒否/明示retry/単調revision/退出後継続抑止と、experience全景の同receipt再送をUI hookへ接続。customizationはhook13＋UI9＋request4＋preview4の30件を個別にPASS、experienceは20件PASS。独立レビューで見つけた既定の屋根試用→カテゴリ変更時の不正slotと、own commitのliveQuery先着で到着通知を消す競合を修正し回帰を追加した。実UI/実SW offline/速度/全体固定検査はまだこのsourceに対して未実行。F04/F05と自然観察の視覚HOLDも継続する。
- 2026-09-08: 仕様39 rendererを固定可能まで確認。関連8files/96tests、型/担当lint PASS。部位ごとのgroup/material更新、旧4テーマの表示互換、同じ木/crown・家具・橋床の保持、空のphone/tablet画角内投影を検査。Stage/runtimeのcandidateは `island-cosmetics-parts-v2`、実12slot診断に従来互換版も表示する。これをroot UI/全景hook/遮蔽修正とともにsnapshot07（revision `workshop-20260908-88de0b827246`、951files、127.0.0.1:5392）へ固定。build/資産予算PASS（PWA 10.54MiB/12）。全体検査初回は245files/2716testsのうち学習進行1件が15秒timeout、2715件PASS。buildとの同時実行を外し、制限時間を変えず同固定sourceで全体再実行中。元の失敗ログを保持する。
