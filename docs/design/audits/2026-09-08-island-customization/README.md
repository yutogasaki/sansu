# 島のきせかえ — 実装と検証

## 目的と範囲

[仕様35](../../../product/35_island_customization_spec.md)にユーザー訂正後の「学習阻害せず、学習意欲が湧くような実装」を採用。欲しい景色を自分の島で試し、学習区間ごとに10ほしを得て、3テーマ/3飾りを選んで交換する。無料切替、任意の欲しい物目標、セット所持も含む。通常の連問、自動成長、支援、学習判定を維持する。速さ・ノーミスによる倍率はなく、支援でも同額。公開deployや子どもの意欲向上の実証はこの実装検証と分ける。

## 最初の実画面で見つけたこと

- 初回3問を実回答した後のphone/tabletで3テーマを切り替えた。現行の家・木・パッチワーク住民と、テーマの観測所の屋根・キャンディの樹冠・結晶の樹冠が同じ場面で描画された。
- 最初の配色は広い地面・樹冠が淡く、元のmoon-gardenに比べて焦点が弱かった。星の島は紫の地面と藍色の海・金色の道、お菓子はベリー色の屋根とミント/ベリーの樹冠、結晶は青緑の海と紫/真珠色の面へ改訂した。照明を全体で明るくするのではなく、素材ごとの色を修正した。
- phoneで右端のカードへ移ると、ページ全体が約78px横へ動いて島や文字が切れた。documentの幅だけの検査では見逃したため、親scrollLeftと実際のstage左端も専用E2Eで検査する。
- 独立レビューで、CAS競合後の同じ選択の再試行が古いrevisionへ固定される問題を検出。確定した競合と、保存結果が不確かなI/O失敗を分ける必要がある。
- 結晶の岸飾りの一部が、拡張後の西土地・橋の通れる場所に重なる問題を独立レビューで検出。初期主島の外側という検査だけでは不十分なため、全拡張状態の経路・家具範囲まで照合する。

初期/改訂の診断画像は `output/playwright/customization-diagnostic/` と `output/playwright/customization-revised/`。共有DEVの診断であり、固定した最終buildの受入証拠ではない。

## 固定対象と修正

- 最終V2 Production: `http://127.0.0.1:5360`、同app入力のDEV: `http://127.0.0.1:5361`。固定source `/tmp/sansu-customization-20260908-161632` から起動。
- Revision: `customization-20260908-86209d824907`。実[version](version.json)と[736入力ファイルのmanifest](build-source.json)。world=`mystic-island-living-v5`、learning=`mystic-island-learning-v2`、resident=`patchwork-otter-v1`、cosmetics=`island-cosmetics-v1`。Island/BuildPlay有効、renderer=`three`。
- 原source archive、production build archive、全raw logは `output/island-customization/customization-20260908-86209d824907/`。archive名・容量・SHA-256は[archives.json](reports/archives.json)。旧V1は末尾`0b59b5b48c67`の別出力と`reports/v1/`に保持。主contact sheetはV2で揃える。
- 横ずれはgridの最小幅と親の横スクロール抑制で修正。実UIの右端カード選択時にstage.x、window.scrollX、親scrollLeftを照合し、カード列だけが動くことを確認。
- CASの確定競合時は次回を最新revisionへ戻し、結果不明の保存失敗は同一操作IDで再試行する。transaction abort後にDB全体が不変で、同じ選択の再交換が成功した。
- 結晶は前岸へ移設。main/east/westの全拡張状態、住民と6家具のクリアランスを造形テストへ追加した。
- [実画面の見比べ](review.html)は固定productionのスクリーンショット。実学習での獲得と、明示的な旧保存fixtureを分ける。

## 受入の証拠一覧

| 要求 | 対応する証拠 | 状態 |
|---|---|---|
| 実初回→学習→10ほし→試着/取消 | [専用production E2E](reports/customization.json)、実画面、DB前後比較 | V2両viewport PASS |
| 欲しい物→実学習→確定交換→無料切替 | 専用production E2E、保存receipt、実画面 | V2両viewport各6実区間、60獲得/40使用、実SW offlineで再着替え・連問 PASS |
| 3テーマ/3飾り/組合せ/全所持後 | 16組合せの造形検査、専用E2Eの明示旧島fixture、[V2追加14画面](reports/catalog.json) | 保存/UI/造形 PASS。旧18区間fixtureと、0区間/0ほし/全所持を付与した比較fixtureは別。学習実績と混同しない |
| 旧島一度だけの加算/競合/支援/失敗/履歴 | domain保存テスト73件、独立レビュー、専用E2E | 保存・再試行・旧/新アルバム PASS |
| 描画資源/住民利用/幅/復旧 | 造形・資源検査、実画面、[V2 production living](reports/living.json)、[V2 Island DEV](reports/island.json) | 同canvasの反復切替、25区間×両画面、成長/配置/暮らし/過去/復旧 PASS |
| 問題の意味と全入力/音off/動作抑制 | [全入力23ケース](reports/learning.json)、[音/読み上げ8ケース](reports/feedback.json)、[Island PWA](reports/island-pwa.json) | V2でPASS。数字/選択/分数/小数/筆算/英語、支援、描画復旧、音off/reduced motion、実SW offline回答・再開を確認 |
| 背景保存中の閲覧と手動保存のロック | [実区間＋保存通知遅延診断](reports/discovery-navigation.json) | V2両viewportで比較2入口の往復、同一予約の再開、60ほし/履歴不変 PASS |
| 全体品質/通常導線/オフライン/連問速度 | core、smoke、classic/Island PWA、Island/living、正式fixed-ten | V2 core194ファイル/2,232テスト、全12検査コマンド、正式80run/15gate/eligible PASS |
| 同一版の画面/媒体ごとの判断 | app入力archive、build manifest、[52実画面](review.html)、独立ゲート | V2で統一、全画像SHA照合、作者側の再評価済み。子どもN=0を分離 |

## 判定の境界

- 視覚的魅力：V2固定productionのphone/tabletを作者側で別担当が再評価し、3テーマの大きな配色と家/木の輪郭、3飾りの差、適用前後の連続性を受入可とした。V1からの視覚的後退なし。phoneの小さな飾りの変化は控えめ。「欲しくなる強さ」は未評価。描画担当の再評価を独立した子どもの観察とは数えない。
- 無説明理解・安全：別担当の実画像レビューでは問題・選択肢・支援・帰島・テンキーが読め、+10は島内に収まり、保存失敗時も未確定と再試行が表示される。全所持後も入力を維持。phoneのエラー時「よみなおす」は二行、tabletのアルバムではウサギが端で一部切れる軽微な境界がある。独立した子どもの観察はN=0で、無説明理解・注意の逸れ・自発的再遊び・意欲向上は未評価。
- Runtime：V2固定sourceでcore2,232テスト、専用UI、全体回帰、PWA、正式80run/15gateがPASS。最終workspaceのapp入力736ファイルは固定manifestと一致し、contact sheetの52画像もV2のraw画像とSHA-256が一致した。物理iOS/Androidと公開環境は認定しない。

## 最終検証結果

[集計と最終照合](reports/verification-summary.json)、[12検査のコマンド・開始終了・終了コード](reports/final-gates.json)を保存した。全て最終V2のapp入力に対する結果。

| 検査 | 結果と証拠 |
|---|---|
| verify:core | PASS。194ファイル/2,232テスト、docs/lint/typecheck/build/assets。[ログ](reports/core.log) |
| 背景保存中の閲覧 | PASS。phone/tabletの2ケース。[report](reports/discovery-navigation.json) |
| きせかえの実導線とカタログ | PASS。4シナリオ/40画面と追加14画面。[導線](reports/customization.json)、[カタログ](reports/catalog.json) |
| 島の成長と通常操作 | PASS。productionの実25区間×2/66画面、Island DEVの11ケース/113画面。[living](reports/living.json)、[Island](reports/island.json) |
| 全学習入力と音声 | PASS。全形式23ケース/138画面、音・端末内読み上げ8ケース。[入力](reports/learning.json)、[音声](reports/feedback.json) |
| 全体smokeとclassic PWA | PASS。smoke31、Island/BuildPlay無効のbuild、PWA4。[smoke](reports/smoke.log)、[build](reports/classic-build.log)、[PWA](reports/classic-pwa.log) |
| Island PWA | PASS。保護対象8導線と実SW offlineでの回答・成長・同一予約再開・音off・動作抑制。[report](reports/island-pwa.json) |
| 正式fixed-ten | PASS。80run、全15gate、eligible=true、通常の連問に追加操作0。[report](reports/throughput.json) |

| 次の入力を操作できるまでのP95 | phone | tablet |
|---|---:|---:|
| 正解後 | 194.0ms | 193.6ms |
| 誤答後の答え直し | 193.5ms | 193.2ms |
| 区間の境界 | 192.6ms | 192.4ms |

速度はNode 22.22.3 / Chromium 145.0.7632.6、固定10問の自動keyboard操作によるDEV測定。各viewportで正解200、誤答20、区間境界20サンプル。通常plannerの実導線は別のproduction/Island E2Eで確認した。DEV版末尾`3044a65e-dcf9-4119-8021-97d8ca6809ae`とproduction版末尾`efd6f644-4c0a-45d3-8bd2-8ea12c697c52`はbuild nonceが異なるため、版文字列の同一性ではなくapp入力manifestで結び付ける。

[プロセス監視](reports/throughput-process-monitor.json)の3秒間隔149サンプルでは、当該benchmark以外のE2E/build/testコマンドを検出しなかった。機器全体の物理的な専有や、子どもの解答速度・学習意欲の測定を意味しない。coreの既存fast-refresh警告1件とchunkサイズ警告は保持し、asset budgetはPASS。

## 原失敗を保持する診断

V1のproduction living初回は12区間後の`.island-growth-return`クリック後にhomeのまま、albumへの30秒待機が失敗した。[原ログ](reports/v1/living.log)と[原report](reports/v1/living.json)を保持。帰島画像の書込み06:51:00.757 UTC、`flower-scent`発見保存06:51:01.208、失敗画像06:51:32.275で、保存と入力の時刻が近接していた。

[イベント記録を加えたV1診断](reports/v1/living-trace-01.json)は両viewportの25区間がPASSし、原失敗は再現しなかった。ただし[12区間の記録](reports/v1/growth-phone-12-major-input-diagnostic.json)で、背景保存が305msだけ`busy=true`と比較ボタン`disabled=true`を作ることを確認。成功したクリックはその期間を外していたため、原失敗の原因を確定したとは言わない。

修正では操作種別を分け、発見保存中の比較/アルバムの開閉だけを許可した。transaction・PWA hold・同期lockを維持し、学習開始・交換・配置・再演へ例外を広げない。閉じる可否も専用propに分離した。

同一QAコードの[旧版negative control](reports/v1/discovery-negative.json)は、実6区間後に自然発生した発見の完了通知を保留すると「比較が無効」でFAIL。修正版の[同じ診断](reports/discovery-navigation.json)は両viewportで比較2入口・閉じる・帰島、通知解除、60ほし/履歴不変、同じ予約の学習再開と実回答がPASSした。手動再開の通知保留中は比較も無効で、例外を背景保存に限定できた。

この診断はnative transactionを通常どおりcommitさせ、実際に登録された完了callbackの通知だけを遅らせる。DB値・成長・発見・問題は注入していないが、通常速度の証拠ではない。保留中の「ためす/おく」は表示数0だったため、その実操作は検証済みとは扱わず、既存`disabled={busy}`を維持したソース境界の確認に限る。旧版tabletはphoneの最初のFAILで停止した。

## 文書と作業の境界

親仕様01、島28、成長30、着せ替え35、デザインガイド/MASTER、docs index/ownership、検証matrix、wiki memoryへ同期した。共有worktreeの他タスクの差分は保持する。ローカルの実装・検証であり、commit・push・deployは含まない。
