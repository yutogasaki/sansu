# 島で解く体験 — 実装・実画面監査

対象は [島仕様28](../../../product/28_mystic_island_spec.md) の「Solving inside the island」。学習中の見た目と反応を更新し、問題の意味・入力・保存・連問速度を維持する。ローカル実装と必要な検証は完了した。独立した子どもの観察と公開昇格は別の未検証ゲートとして残す。

## 対象と比較元

- delivery: `mystic-island-v1`
- world candidate: `mystic-island-three-v1`
- learning candidate: `mystic-island-learning-v2`
- DEV: `http://127.0.0.1:5198/#/island`
- 固定したproduction形式のローカルpreview: `http://127.0.0.1:5298/#/island`
- revision: `aa36adad7dcc-island-learning-99d08b2a0e4c`
- version: `aa36adad7dcc-island-learning-99d08b2a0e4c:9ef27e21-391f-4fa2-8d13-8c330f33c4fc`
- [build入力とSHA-256](evidence/build-source.json): Git HEADに未コミットの実装を含む。検証開始とbuild終了で入力ファイルの一致を確認した。
- 比較元: [前回の島監査](../2026-09-07-mystic-island/README.md)。正式固定10問の次入力P95はphone 194.0ms、tablet 194.2ms。今回の新しい学習面の証拠とは混同しない。

## 体験の意図

問題は海辺の作業台で解く。保存された一問の完了で小さな光が庭へ届き、住民が短く応える。その間も次の入力を受け付ける。三問または六問の進み具合は同じ庭に残り、区切りの報酬と島の暮らしへつながる。

学習物は同じ対象を同じ形で表す。個数、取り消された物、空き枠、色、位置、位、分数、選択肢の値と順番を変えない。筆算の途中段は一問の完了に数えない。

現行の筆算生成器は四則とも結果一段を持つ。実操作では「未完の桁入力でreceipt/成長なし」と「全桁の回答確定で一問完了」を検証する。複数段を持つ仮想receiptの表示分類はunit testの証拠であり、現行plannerに複数段の問題があるとは主張しない。

実操作で、筆算を一桁入力してからCで消すと後ろの欄がactiveのまま残る点を発見した。島だけ全消去と同時に先頭欄へ戻し、打ち直せるように修正した。共有フォームの既定値とParkの入力は維持する。

## 必要な証拠

| 要件 | 証拠 | 現在 |
|---|---|---|
| 島と作業台の整合、住民と光が棚に隠れない | [同一buildの実画面](contact-sheet.html) | 作者確認PASS |
| 数える・計算・choice・分数・筆算・英語 | [通常plannerの6形式×2サイズ、意味と実入力](evidence/production-learning.json) | PASS |
| 普通の連問は追加0tap、演出中に次入力 | [実回答録画](runtime/learning/phone-number-actual-learning.webm)、[正式80レーン](evidence/throughput.json) | PASS |
| 誤答で問題・キー位置を保持 | [正誤前後の座標・予約問題比較](evidence/production-learning.json) | PASS |
| 長押し・11・二重送信・訂正・小数・複数欄 | [タッチ/物理キー、fraction/HissanのCから再入力](evidence/production-learning.json) | PASS |
| 保存済みreceiptのみ反応、途中段に完了光なし | receipt分類5unitと実Hissan未完桁/最終確定 | PASS・証拠範囲は本文参照 |
| 支援と進行の再開、獲得の重複なし | [reload・Due/log・eventの検査](evidence/production-learning.json) | PASS |
| 音off、reduced motion、表示失敗、offline | [無音/静止/復旧](evidence/production-learning.json)、[実SW offline](evidence/pwa.json) | PASS |
| 既存モードとPWAの回帰なし | core・smoke・PWA update・Park・島E2E | PASS |
| 起動から次区間まで同じ視覚系列 | [contact sheet](contact-sheet.html)、[16画面の版とhash](evidence/critical-path.json) | PASS |

## 独立した判定

- 視覚の整合と楽しさ: 作者のローカル確認PASS。海・草・木の作業台、同じ絵の学習物、近くで受け取る住民が一つの画面に収まる。予想する楽しさは「一問で住民が応え、区間の光が庭に残る」。この仮説を子どもの再遊び実績とは扱わない。新規の独立した美術承認は未実施。
- 無説明理解と安全: 作者確認と独立した子どもの観察を区別する。未説明の利用者観察と実機での再遊び検証は未実施で、公開昇格の証拠として残る。
- Runtime integrity: PASS。正式80レーンと通常plannerの実入力、保存、PWA、同一build照合を通過した。ほかの判定と平均しない。

この監査はローカルでレビュー可能な候補を扱う。公開デプロイは含まない。

## 検証済みの事項

- `npm run verify:core`: PASS。112 test files / 1229 tests、docs・lint・typecheck・build・assetsを含む。[全ログ](evidence/core.log)。precacheは10.52MiB / 12MiB。既存のdocs棚卸し期限と大きなchunkの警告は残り、今回のエラーではない。
- 作者の初期実画面確認: 204pxの通常表示、154pxの筆算表示で住民の顔・足と入力を確認。低い115px表示も足元が棚に隠れない位置へ修正した。正式な同一buildの画面は下記のfocused/critical-path検証に保存済み。
- DEVの実操作: 正解の光と住民の反応の間に次の数字を入力可能。C後の先頭欄への復帰、十の棒を使う計算の全キー・支援・自然な次問を確認。正式速度の証拠は下記の固定10問で別途取得した。
- 最終productionのfocused検査: 21ケースPASS、127画像と実回答動画。通常plannerに予約させ、保存済み問題の置換・ブラウザ内のDEV回答hookを使わず実入力した。6形式をphone/tablet双方で確認し、比較対象21ソースファイルがbuild入力と一致。[全記録](evidence/production-learning.json)。
- [smoke](evidence/smoke.log): PASS。既存Study/Explore/保護画面を含む。
- [classic PWA](evidence/classic-pwa.log): 4フローPASS。最初はIsland有効buildを参照し、旧開始ボタン待ちで停止した[診断](evidence/classic-pwa-wrong-build-diagnostic.log)を保持。アプリは変えず、同じsourceから[flag無効の回帰用build](evidence/classic-pwa-build.json)を作り、検査ツールへ`SANSU_PWA_PREVIEW_DIR`を追加した。既存scenario・判定・待ち時間は維持する。
- [Island PWA](evidence/pwa.json): 更新保護4フローと実Service Worker下のoffline reload・回答保存・同じ区間の再開PASS。これはdesktop Chromiumであり、実機iOS/Androidのインストール・電池寿命の証拠とは別。
- [同一buildの全ループ](evidence/critical-path.json): 両サイズで一つの区間を実際に解き、報酬を選び、回転して配置し、住民がベンチを使い、再読込から次の学習へ進んだ。welcomeは学習面を持たないためlearning候補をnot-applicableとし、worldとbuildを照合。home以降はlearning候補v2も照合した。
- [Park回帰](evidence/park-summary.json): [DEV6](evidence/park-dev.json)と[production更新/保存3](evidence/park-pwa.json)がPASS。Islandを無効にした[同じsourceの別構成](evidence/park-target.json)を使用。Parkの3検査はSW block下のcheckpoint/persistence hookであり、実offlineの証拠はIslandの別検査で示す。
- [島の旧全ループ](evidence/island-legacy.json): 11シナリオPASS。登録・通常planner各入力・受取保留・配置/回転/収納・プロフィール分離・実6区間の成長・橋を通る337経路サンプル・WebGL復旧を省略せず再検査。[427ファイルの開始/終了source一致](evidence/island-legacy-source.json)。


## 正式な連問速度

固定10問、2サイズ×2条件×Study/Island×10反復、計80レーンを327秒で完了した。[raw結果](evidence/throughput.json)は `evidence.eligible=true`、`pass=true`、12ゲートすべてtrue。[実行ログ](evidence/throughput.log)と[source比較・旧島との差](evidence/throughput-source-and-baseline.json)を保持する。

| 指標 | phone 390×844 | tablet 768×1024 |
|---|---:|---:|
| 正解→次入力 P95 | 194.2ms | 195.4ms |
| 誤答→再入力 P95 | 193.4ms | 193.6ms |
| 全問正解時のIsland中央値 | 274.49問/分 | 273.89問/分 |
| 同条件のStudy中央値 | 123.18問/分 | 123.59問/分 |
| Island / Study | 2.228倍 | 2.216倍 |
| 旧島UIからの正解P95差 | +0.2ms | +1.2ms |
| 旧島UIからの問/分の変化 | +1.10% | −0.45% |

各サイズ180正解・20誤答サンプル。普通の問題間の追加操作と次問への入力混入は0、固定問題・atomic receipt・ブラウザエラー検査もPASS。開始と終了の425ソースのhash一致、production build入力554ファイルとの共通424ファイルも全一致した。残る1ファイルはbenchmark script。終了後にブラウザを閉じた。

この測定は無音・reduced motionの自動キーボード入力と固定fixtureによる実装の比較であり、子どもの解答速度や通常plannerの証拠ではない。通常planner、タッチ、通常モーションは同一productionのfocused検証で別に確認した。旧島UIとの差は小さく、意図した待ちや追加操作は増やしていない。

## 最終の表示・資料確認

Codex内ブラウザで5298を開き、初回の島welcome画面に出たrevision・version・delivery・world候補が上記の固定buildと一致することを確認した。[実画面](runtime/preview-welcome.png)。未登録の確認画面では個人プロフィールや回答を作らず、学習候補v2は同じbuildのfocused/critical-path実操作で確認した。

今回の保存schema・planner・writer・SRSの契約変更はない。製品の変更は28仕様、検査構成の変更はverification matrixへ反映済み。新しいADRやdurable memoryへの重複記載は不要と判断した。

最終の別担当レビューでは、学習・速度担当が現コードとproduction/fixed-tenの要件を照合し、未完の必須条件なしと判定した。視覚担当は最新20画面と旧島3画面を目視し、表情・接地・全キー・支援・短画面・配置後の暮らしに重大な不足なしと判定した。比較には `phone-number-ready.png`、`phone-base10-subtraction-ready.png`、`phone-hissan-ready.png`、`tablet-fraction-ready.png`、`phone-short-fallback-recovered-answer.png`、critical-pathの `phone-animal-use.png` と旧島の `phone-numeric-learning.png` を含む。いずれもAIによるローカルレビューで、子ども観察の代用ではない。
