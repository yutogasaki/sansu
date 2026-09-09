# 接続する岸と使える床 — 固定37

2026-09-09。`mystic-island-shore-garden-v17` の接続岸を**局所採用**。rootはphoneの固定36/37・全景拡張2とtabletの配置保存後reloadを実見し、個別の岸で縁取られた三つの塊から、庭と暮らしが続く床への改善を確認した。[source A](../shore-garden-a.png)全面との一致はHOLD、Human N=0、Full Goalは継続する。

[contact sheet](contact-sheet.html)に実アプリ22枚と別の実模型方向研究6枚を無加工で保存した。[verification.json](verification.json)に各PNGのSHA256、原report・QA・sourceの帰属を記録する。方向研究は生成画像ではなく実geometryの比較だが、productionアプリ操作・保存の証拠とは区別する。

## 実対象と変更範囲

| 対象 | 固定36（前） | 固定37（後） |
| --- | --- | --- |
| URL | `http://127.0.0.1:5422` | `http://127.0.0.1:5423` |
| revision | `workshop-20260909-0c1dfa1c54fc` | `workshop-20260909-794c920135eb` |
| visual candidate | `mystic-island-shore-garden-v16` | `mystic-island-shore-garden-v17` |
| inputs | 1076 | 1081 |
| Island / BuildPlay | true / true | true / true |

固定37のsource SHA256は `794c920135ebfeadbe7bb3a1db99d2bb53b38d115767d7d0bd20fea7543e17d8`。`9e02ceeea0688366a96919e782f9e1c6d8e36228`をbaseに19個の明示source/test差分と6ファイルのcandidate置換を重ねた。並行navigationのapp・QA・package・docs変更は含めていない。

接続楕円のz半径は3.35、岸の輪郭のblend幅は0.18。旧楕円の床y=0、保存済み座標、家・橋・所有家具・展示を保ち、東/西の解放段階に対応する接続床を加える。景観例外は、追加crystalテーマの自動水際飾りを新床の外へ置くことだけで、本人の所有物を移動する変更ではない。地面と岸の形そのものを変える。

## 限定された実アプリ検査

phone 390×844 / tablet 768×1024、reduced motion、Service Worker制御下。前後×default/allの8独立contextで、拡張0→1→2を同document/canvasのまま描画した。全24stageと24pageを原出力に保持し、この資料には初期・東・東西の全景、初期/東西の庭、前版全景を抜粋した。defaultの32camera値は3段階で完全一致し、明示allは実床の収まりに従って変わる。

fixtureはcompletedSets=24、居場所progress=6、基本2品収納の診断状態。各段階のnative expansionLevel/revision/updatedAt更新とDexie通知を宣言し、それ以外の全objectStore不変を比較した。Blobも内容SHAで照合する。実回答で成長・拡張・家具を得た過程とは呼ばない。

配置は別の4contextで、ランタン1件を `(0,1.75)` に加えた宣言fixtureを用いた。実UIで学習予約を作成して帰島後、矢印で東接続点 `(4.25,1.75)` へ移動した。

| 経路 | 両幅の結果 | 証拠の範囲 |
| --- | --- | --- |
| 固定36の同じ点 | 実preview invalid、保存不可、取消PASS | 旧拒否page PNGと取消の全DB比較 |
| 固定37の未保存/取消 | 実preview valid、取消PASS | 未保存page PNGと取消の全DB比較。取消そのもののPNGは未採取 |
| 固定37の再移動/保存 | 同じ点に保存PASS | 対象pose・revision/time・正確なitem_edited event以外の全DB保持、実模型PNG |
| reload / 同予約復帰 | 保存模型y=0と位置を保持、元の予約・入力待ちへ復帰PASS | reload後実模型と同learning PNG、planと全DB一致 |

実回答は0。予約開始の正確なtransactionを比較し、取消・閲覧・再開で未知の差分をbaselineへ吸収していない。東のランタン1点の実操作であり、西の家具利用や全家具の実操作へ拡張しない。8視覚行＋4配置行PASS、page/console error 0、12context全close、sourceStable/qaStable/browserClosed=true。原出力は計70 PNG。

原reportは `output/playwright/island-renewal/connected-review-37-01/report.json`、SHA256 `29ba4f7a742929b713d0ebd236db6d044a58e40513cdfa642b7887773c748941`。原QAは同階層の `connected-review-37-01.mjs`、SHA256 `f5ee33d6375760296552d4e07ab6b19a4b9ded9f854e4ab3dc6990443948416c`。元データを上書きせず、選んだPNGをそのままコピーした。

## 三つの幅の方向研究

`connected-direction-03` は固定36の画角と実模型で半径2.25 / 2.9 / 3.35を比較した別ハーネス。12行から拡張2×両幅の6枚を保存した。実アプリのrevision・DB・UI操作を持たないため、固定37の実行結果として数えない。3.35の広い接続を選び、その後に上記production検査へ進んだ。

## 統合検査と未完了

固定37はbuild/type/assets PASS、lint 0 errors・既存warning 1件。一方、元の全testは **297 files PASS / 2 files FAIL、3290 tests PASS / 3 tests FAIL（89.56秒）**。`waterSurface.test.ts`の2件は旧「海＋3つの別岸=4」期待に対し接続後が2、`optionalFurnitureTrial.test.ts`の1件は旧hammock配置のno-space期待に対し新床でreadyとなった。原 `integration-tests-37.log` とsource37を保持し、これらを全体PASSへ読み替えない。2testファイルだけを補正した別immutable検証版 `workshop-verification-37-02` では **299 files / 3297 tests PASS（85.36秒）**、型/lint PASS（0 errors・既存warning 1件）。検証source SHA256は `82a5a3e8a149ae1a20641b6c460b9734a87bfc71986f119334820859536f84ee`。appと実行QAは37と全件同一で、新buildではない。[index入力照合](index-source-check.json)もこの1081入力と全件一致する。元の3FAILと後のテスト補正・再検証を区別する。

classic smoke37も **31/31 PASS**。同じrevisionのclassic-v1・両flag=falseによる別経路であり、上記の島実画像とは分ける。1081 source/QAの前後不変、31 context終了、観測40 owned PID残存0、temporary profile削除、DEV4173終了、5423保持を確認した。出典 `output/island-experience/smoke-37-01/execution-summary.json`、raw report SHA256 `53e20414e944fecf18f7914b8cd3d629f46dac4966853949f221d47e738be9f3`。固定37の正式80runは後述の専用DEVでPASS、appコミット `569d1c0d67478676ef898cbae9bc16e8f9d4b351` のCore/Docs CIも成功（root確認）。37のPWAは未実施。`9e02cee`のCore/Docs CI成功、[固定36の検査](../growth-v16/README.md)、以前の[芝v13](../grass-v13/README.md)・[屋根v14](../roof-v14/README.md)はそれぞれの版に帰属する。

準備時の失敗も区別する。`connected-direction-01/failure.json` はesbuild仮想defineを実ファイル扱いしたfingerprint失敗でbrowser未起動。初回freezerのgit archive出力buffer制限はroot報告の固定化準備失敗で、`freeze-37-02.mjs`のarchiveファイル方式へ移してから37を作成した。これらは準備上の失敗として元記録/スクリプトを残し、アプリの3test FAILとは混同しない。

## 固定37の正式80run — 専用DEVの連問測定

[正式計測の要約](throughput-verification.json)は、固定37 source/QAをそのまま使った専用DEV `http://127.0.0.1:5224` の結果。production画像の5423とは別対象で、実revision `workshop-20260909-794c920135eb`・candidate v17・両flag=trueを配信moduleと実描画から確認した。10反復×両幅×2シナリオ×Study/Islandの80runで **eligible=true / PASS、全15gate PASS**。正答200・同問誤答訂正20・区間境界20サンプルを各幅で得た。追加の通常操作は0、入力の消去・初期44px操作・実atomic receipt・区間の自動継続も既存gateを維持した。

| 幅 | 正答P95 33→37 | 誤答訂正P95 33→37 | 区間境界P95 33→37 | 37 Island/Study正答速度比 |
| --- | --- | --- | --- | --- |
| phone | 199.9→199.3 ms | 198.4→198.2 ms | 197.5→197.7 ms | 2.3755 |
| tablet | 199.8→200.2 ms | 199.3→198.2 ms | 198.2→197.7 ms | 2.3596 |

固定33とrunner/helperはcandidate置換以外同一で、fixture・測定methodも一致する。小さな差を速度改善や保証とは解釈せず、両版が同じgateを満たした比較として残す。判定閾値は正答/区間650ms以下、誤答訂正550ms以下、正答速度はStudy以上。raw report `output/island-experience/throughput-37-01/report.json` のSHA256は `2c193fb78bd2140de2c5a714ce107bc5e90b8c5b83e2695cb27e2c9bd47c24db`。

1081 sourceとrunner fingerprint、配信module4件の開始終了一致を確認。runner session89938はexit0、browser終了後、所有DEV session98371/PID68749だけをSIGINTで終了した。観測9 PID・3 process group残存0、temporary browser profile削除、5224 listener 0。他serverと5423には停止操作をしていない。

この計測はcompletedSets=1を明示した隔離済み既存島fixture、固定10問、reduced motion・音off・自動keyboardによるDEV測定である。通常planner、初回unlockの同期生成、実端末/タッチ、人の学習速度の証拠ではない。Islandの実writer/receiptとStudyの非記録DEV fixtureの違いも保つ。測定中にmainへ追加されたnavigationコミット `8e36612` は対象外で、固定37/569dの結果をそこへ拡張しない。

## 初解放と次の入力の限定確認

[初解放の実画面と検証](first-unlock/README.md)は、解放直前の島だけを明示したfixtureから、通常plannerの実3問を回答したphone/tablet×東西の4経路。最後の正答から次入力まで186.9〜187.9ms、追加操作0、実12answer receiptと成長/次予約の保存を確認した。各1回の測定でP95ではなく、上記の固定10問80runとは別の証拠である。1081 app入力とQA closureは不変、全context/browser終了。解放した土地の描画は入力の計時後に帰島して別確認した。

学習中の節目通知は4経路ともDOMに存在するが不可視だった。入力・成長のPASSと、通知表示のFAIL/修正待ちを分ける。非表示のstageに通知を置いている構造を直す必要があり、これを全Goalの完了に含めない。rootはphone東解放後の床とtablet西解放後の入力画像を確認した。

見た目の局所改善、保存/入力の限定整合性、子どもの理解・安全性・自発再遊びの観察は別判定である。normal motion・全外見・全重要経路・子ども観察・source A全面parityは未検証/HOLDのままで、公開完成・元Goal完了・通常plannerや実端末を含む包括的な性能保証を主張しない。

コミット前のdocs検査は、画像28枚を含む4813 tracked pathsの正確なindexコピーでPASS（既存日付warning 7件）。current trackedの作業内容コピーは、並行navigationの未追跡文書への7リンクでFAILした。その作業を保持したまま今回のcommit対象から分け、両方の結果をverificationへ残した。
