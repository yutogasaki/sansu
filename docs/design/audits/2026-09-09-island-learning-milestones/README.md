# 学習ヘッダーの大きな節目

島の成熟・東西への解放を、次の問題へ進んだまま既存ヘッダーへ最大6秒、短い2行で知らせる。入力・問題・音・「とじる」の位置を保持し、確認操作を増やさない。[仕様28](../../../product/28_mystic_island_spec.md)と[仕様30](../../../product/30_living_island_growth_spec.md)の表示方針変更。

固定37で通知が見えなかった点は当時の仕様に一致していた。[以前のFAIL分類の訂正](../../2026-09-09-island-renewal/connected-v17/first-unlock/README.md)と原測定を保持する。この新しい通知の成功へ古い入力・画像の結果を転用しない。

## 対象

- 固定39: `workshop-20260909-b3f96489e126`。
- source: `b3f96489e126f2ed3f4465ae9beb4d28b4a5b32d8b5ad14bb2d09fccc432c33d`、1089入力。基底 `d4d157f` に通知の6ファイルのみを重ね、同時作業のホーム面積変更を含めない。
- production: `http://127.0.0.1:5433`、version `workshop-20260909-b3f96489e126:4f47503e-33f0-4488-aa48-4b335131c04d`。
- Island / BuildPlay有効、Parkはlegacy構成。world `mystic-island-shore-garden-v17`、通知 `learning-header-v1`。
- 固定38はbuild/型/assets/lint通過後、コードレビューで未受理の重複入力が通知を無効化するraceを発見したため未採用。39は通知操作を既存の同期保存ロック通過後へ移し、原38を保持する。

## 検証状況

固定39は302 files / 3327 tests、型・lint・build・assets PASS。lintの既存Fast Refresh warning 1件を保持。通知hookのcontrolled lifecycle検査と実 `useIslandActions` の重複入力回帰は、実ブラウザの描画・支援操作とは別の証拠。

新しいproduction通知QAは7/7ケースPASS、session66473は終了コード0。7contextとブラウザの終了、1089入力・QA runtime closure490ファイルの前後一致を確認した。固定39の[正式80run](throughput-verification.json)も全15gate・eligible/PASS、終了コード0。Island PWAの8保護経路と実SW offlineもPASS。classicのスモーク31経路もPASSで、classic PWA4経路もPASS。4地区の全成長巡回は続けて確認する。

[検証値と原データのSHA](verification.json)と[実経路の画像一覧](contact-sheet.html)を保存した。選定16枚は実PNGと同じbytesで、拡大・切抜き・描き直しはしていない。

| 実ケース | 解放後の操作 | 最後の正答→次入力ready（単発ms） |
|---|---|---:|
| phone 東・選択式 | 同じ問題のまま約6秒で消失 | 189.8 |
| phone 西・選択式 | 表示中に退出→同予約へ復帰 | 185.4 |
| tablet 東・選択式 | 誤答を優先し通知を退避 | 189.4 |
| tablet 西・選択式 | ヒントを優先し通知を退避 | 187.3 |
| phone 東・数字 | TenKeyを保持、ヒント優先 | 189.1 |
| tablet 東・数字 | 同じ数字問題で約6秒後に消失 | 188.5 |
| phone 東・旧gift1件 | 右側表示と非重複、退出→reload | 189.0 |

全7ケースで通知2行・通知内ボタン0、既存のbrand/header/problem/入力/各キー/音/「とじる」の矩形を比較して最大差0 CSSpx、音/「とじる」は44px以上かつ中心hit可だった。期限で消す2ケースは5994.7ms／5998msで、同じ問題・入力位置を保った。全ケースの同予約・同revision再入場/reloadで再演なし（各入力ready後に2描画フレーム＋400msを観測）。この有限時間を超えた常時監視ではない。

初解放直前のnative profileとIslandRecordだけを宣言し、実plannerが作った3問を7回、計21正答して7区間を完了。過去の20/41区間を実回答した証拠ではない。数字ケースは別のlevel9プロフィールを明示し、問題/slots/予約/skill memoryは注入していない。数字の次予約は実plannerの6問だった。誤答優先の追加1回答とヒント2操作は別集計し、全実回答submissionは22回。区間を進める追加操作は0。

全17storeをreadonly native transactionで採り、通知の期限消失・同予約再入場/reloadは実行時の厳密比較、帰島は既存の厳密なdiscovery差分検査を通した（今回の新発見0件）。支援/誤答は読み取り扱いにせず、canonical receiptと現在の問題のpendingMathChecks、islandsのrevision/updatedAtだけを厳密に許し、成長・所有・旧giftを保持した。他の学習storeにはprofile/memory/plan/event変更が記録され、誤答だけlogsも1件増える。17storeの保存前後差分をJSONに列挙し、すべて不変だったとは記さない。写真3storeはこの最小fixtureでは空で、非空写真bytesの保存検査を代替しない。

計時は各ケース1回の最終正答クリック→次入力readyであり、正式P95・実機・子どもの速度ではない。normal motion・音offのChromium145.0.7632.6で、WebGL shadow deprecation/ReadPixels warningは原記録に残る。

今回のヘッダーQA実行源は `output/playwright/island-renewal/milestone-header-38-01.mjs`、原データは同名ディレクトリ内の `report.json` / `source-start.json` / `source-end.json` / 各caseのnative保存値・時系列・trace。ファイル名の38は準備時の番号であり、実配信対象と全画像は固定39。原QA・rawは変更していない。

ローカルの退避・検証入力は `output/island-experience/workshop-snapshot-39/build-source.json`、`output/island-experience/milestone-39-checks/verification.json`。原38の不採用理由は `output/island-experience/milestone-38-not-used.json`。通常のQAは固定39のtoolsを使い、成長巡回のみ新しい2行/詳細ARIAの期待へ更新した別QA `output/island-experience/milestone-regression-39-qa01/qa-manifest.json` を使用する。

## 正式な連問測定

同じ固定39 sourceの専用DEV5274で、10反復×2幅×正答のみ/誤答訂正×Study/Islandを交互に80run実行した。正答→次入力P95はphone206.8ms/tablet206.3ms、誤答→再入力は205.9/206.3ms、区間切替は197.8/198.2ms。追加通常操作0、ブラウザエラー0、全15gate・eligible/PASS。固定37に対して正答P95は+7.5/+6.1msで、版間の差を通知だけの因果や改善とは主張しない。

1089入力・QA・配信4moduleの開始終了一致、所有31PID/3groupの残存0、browser/専用DEV/一時profileの終了を確認。実配信versionは `workshop-20260909-b3f96489e126:900c63c4-5bd5-433e-9c95-3bd78814b300`。音off/reduced motion・固定問題・合成した初回済み島の自動keyboard検査であり、production7ケース・通常planner・実機/子どもの速度と区別する。

固定39 productionの[Island PWA検証](pwa-verification.json)は8保護経路と実SW offline/reload/回答/自動成長/同予約復帰がPASS。旧予約/旧giftの明示互換fixtureを含み、7storeとowner比較に限定する。元reportは保存し、空の写真storeから非空写真bytesの保持を主張しない。固定source/QA/配信dist前後一致、runner終了コード0。

## 独立した判定

| 観点 | 現在の判定 |
|---|---|
| 視覚・動き | 新ヘッダーの上記7ケースと実PNGを確認。島全体のSource Aとの造形一致はHOLD |
| 意味・学習への非干渉 | 上記の追加操作0・通知寿命・支援優先・再開保持はPASS。子どもの無説明理解・意欲はHuman N=0 |
| 実装整合 | 固定39のコード検査とproduction7ケースの実配信・保存・再開、別DEVの正式80runはPASS。Island PWAもPASS。classicスモーク31経路もPASS。classic PWA4経路もPASS。4地区全巡回は別途確認中 |

全GoalはACTIVE。この通知の完了を、仲間の3仕事・暮らしと収集の接続・造形全体・子どもの意欲の完了にしない。

[classicの回帰記録](regression-verification.json)は両ゲームflagを無効にした別構成。スモーク31経路とproduction PWA4経路は終了コード0、source/QA/dist前後一致。4地区全巡回は次の検証であり、この保存地点を最終受入にしない。
