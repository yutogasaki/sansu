# 庭の連続性と空の見切れ修正 — 固定36

2026-09-09。`mystic-island-shore-garden-v16` を局所採用。rootは固定36のphone default0/2、tablet default0/2/all2を実見し、庭の同縮尺、全景の対角構図と岸の縮小を確認した。両幅のstarry/candy/crystalの修正後6枚とtabletの修正前starryも確認し、空の端切れ修正を局所採用した。

遠景を収める初期の全景では、旧版より島が小さくなる。庭の近景は引かない。横に並ぶ三つの保存楕円の骨格と[source A](../shore-garden-a.png)全面との差は残り、**全面parity HOLD / Human N=0 / Full Goal継続**。全テストの合格を子どもの理解・動機や公開完成の証明にはしない。

## 実対象と20枚の画像

[contact sheet](contact-sheet.html)には固定36のdefault拡張0/1/2を両幅6枚、all拡張2を両幅2枚、追加sky3種×両幅×固定35/36の12枚、計20枚を無加工で保存した。[verification.json](verification.json)に各PNG SHA、原report/QA/sourceの帰属と検査結果を記録し、contact sheetの各画像詳細には実描画の32camera値とframe時刻を残した。

| 比較 | 前 | 後 | この資料の画像 |
| --- | --- | --- | --- |
| 拡張と既定画角 | 固定34 / v14 / 5420 | 固定36 / v16 / 5422 | 固定36の8枚 |
| 追加skyの見切れ | 固定35 / v15 / 5421 | 固定36 / v16 / 5422 | 前後12枚 |

[以前の成長比較](../growth-v15/contact-sheet.html)は**固定34→35**の画像で、36ではない。以前のbefore/stagesを参照する際はこの版の違いを保つ。今回の34→36の全24captureは原 `output/playwright/island-renewal/growth-review-36-01` に保持し、空12枚の原出典は `output/playwright/island-renewal/sky-review-36-01`。

固定36の実対象は `http://127.0.0.1:5422`、revision `workshop-20260909-0c1dfa1c54fc`、source SHA256 `0c1dfa1c54fc86449797b91a5cb40b04798041cbccb6716d24f4e4fd6be3a0a6`、1076 inputs。実画像側はIsland/BuildPlay両flag=true。固定35をbaseに9つの明示差分を重ね、独立navigation作業のapp UI変更を除いた固定版である。可変の作業tree全体や、後続のnavigation統合版の証拠ではない。

コミット対象との[入力照合](index-source-check.json)では1075/1076が一致する。例外は未実行の `tools/e2e-island-pwa.mjs`。固定35の作成時に並行navigation向けの検査操作も含まれたため、コミットでは従来の操作契約へcandidate v16の変更だけを反映し、並行変更を作業treeへ保持した。appと実行済みQAの入力はすべて固定36と一致し、このPWA runnerの構文検査もPASS。PWAを実行したという意味ではない。

## 限定QAで通過したこと

成長比較は、固定35で使ったQAファイルを変更せずCLI引数で34→36へ向けて実行した。両幅×前後×default/allの8独立contextで、宣言した初期reloadの後は同document/canvasのまま拡張0→1→2を更新した。固定36のdefaultは3段階で32camera値が完全一致。明示allは本人の選択を保ち、土地の収まりに応じて画角が変わる。8行PASS、宣言したfixture更新以外の全objectStore保持、後続navigation/reloadなし、source/QA保持、browser終了を確認した。

このfixtureはcompletedSets=24、各居場所progress=6、2品収納の診断状態である。native保存のexpansionLevel/revision/updatedAtを明示更新し、Dexieへ変更を通知して実描画を待つ。全store比較は通常初期化後のbaselineと各宣言済み更新を基準とし、Blobも内容SHAで比較する。実回答で土地や成長を得た過程、通常学習、最大成長の実達成とは呼ばない。

空比較はstarry/candy/crystal×phone/tablet×前後の12行PASS。未拡張の島へmoon-gardenと対象sky1品の所有を診断設定し、本人の「しまぜんぶ」操作から実skyのstyle・mesh・Group・camera到達と全store不変を確認した。他11slotは既定legacy moon-gardenを保つ。実取得経路ではなく、`visibleMeshCount`だけで画面内の全投影面積や魅力を合格にしていない。旧版が見切れる画像も比較資料として保存したため、旧版の行が技術PASSであることは見切れ解消を意味しない。見切れの局所採否はrootの実画像確認と分けて扱う。

両QAともphone 390×844 / tablet 768×1024、reduced motion、home、Three renderer、Service Worker制御下。console/page error 0、全context終了、sourceStable/qaStable/browserClosed=true。draw回数と既存警告は要約JSON・原reportに保持した。normal motion、全外見の全成長段階、全重要経路、正式性能やPWAの検査へは広げない。

## 統合検査と旧失敗の扱い

固定36は **296 files / 3274 tests PASS（79.26秒）**、型/build/assets PASS、lintは0 errors・既存warning 1件。出典は `output/playwright/island-renewal/integration-tests-36.log`、`integration-build-36.log`、`integration-lint-36.log`。固定35で失敗した追加skyの投影3件と旧geometry hash比較1件を修正した後の別版の結果であり、[固定35の4件FAIL](../growth-v15/README.md)・元ログ・原画像は変更しない。

通常classic smoke36も別のDEV対象で31/31 PASS。実revisionは同じ36、deliveryはclassic-v1、Island/BuildPlay両flag=falseであり、上記の両flag有効の実画像とは別経路である。1076入力・runner・QAの開始終了一致、31 context終了、所有40 PIDの残存0、temporary browser profile削除、DEV 4173終了を確認した。出典は `output/island-experience/smoke-36-01/execution-summary.json`。このsmokeを島の視覚・正式時間・PWAの合格へ転用しない。

固定36の正式80run・PWA・CIは未実施。[固定33の芝と正式計測](../grass-v13/README.md)、[固定34の屋根](../roof-v14/README.md)や以前のPWA証拠は元の版へ帰属する。今回の20枚は、局所的な構図・見切れ修正と保存整合性の確認であり、source A全面との一致、子どもの自発再遊び、安全性・理解・動機の独立観察は未検証のままである。
