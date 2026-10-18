# メニュー背後の海のクリッピング修復

2026-10-18。通常の育った島を縦長画面で全景表示したとき、正射影カメラの下側のrayが海より下から始まり、メニュー背後に背景色の帯が見えていた。native美術だけに適用していたカメラ後退を通常の島にも適用する。投影された島の大きさ・画角・メニュー配置は保持する。

くふう・愛着を支える表示修復で、仕様44の世界表示面積へ戻す変更。学習・保存・所有・造形・文言は変えず、仕様・ADR・長期memoryの変更は不要。

## 対象と画面

公開旧版 `febbd4cdece1fd205a0160f844c69ab71d5c0f67` を起点とする隔離コピーへ、`growingCamera.ts` と回帰テストの2ファイルだけを適用。修正コミットは `6c00737baad9960c860a8fbf04c8c153eefb29cd`、[PR #5](https://github.com/yutogasaki/sansu/pull/5)。他の未commit変更は配布対象に含めない。

公開旧版で帯を再現した後、取得済みの同じ旧版artifact（http://127.0.0.1:5399）と固定production build `http://127.0.0.1:5398/#/island`。`tools/growing-fixture-data.mjs` の同じ `growing` 合成保存、固定時刻、Asia/Tokyo、独立したブラウザで実行。本人の保存や実獲得ではない。旧版の版情報は [old-version.json](old-version.json)、修正版の版・flag・candidate・viewport・SW状態は [visual-report.json](visual-report.json) と [local-version.json](local-version.json)。両側rootのIsland=true / NatureTown=false、各revision一致を記録。同じ専用Chromeで8画面と両方のメニュー開閉・保存不変を確認した。

| 画面 | 旧版 | 修正版 |
| --- | --- | --- |
| 390×844 | [帯が出る旧版](before-390x844.png) | [海がタブ直上まで続く](after-390x844.png) |
| 390×1036 | [縦長の旧版](before-390x1036.png) | [縦長の修正版](after-390x1036.png) |
| 768×1024 | [タブレット旧版](before-768x1024.png) | [タブレット修正版](after-768x1024.png) |
| 844×390 | [横画面旧版](before-844x390.png) | [横画面修正版](after-844x390.png) |

修正版のcanvas下端と下部タブ上端は4画面でそれぞれ780 / 972 / 960 / 326pxに一致。メニューはタブの上にあり、[開く画面](after-menu-open.png)・閉じる・入口へのフォーカス復帰、学習ストアと所有物の不変を確認した。比較画像は取得済みの公開旧版artifactと修正版のローカルproduction配信を同じ専用Chromeで撮影し、両側のroot markerを記録した。

## 検証

2026-10-18 JST、隔離した同じ修正コミットで実行。

- `npm run docs:check`、`npm run check:current-ui-entry`、全体lint（0 errors / 既存3 warnings）、typecheck、production flags付き `npm run build`（assetsを含む）：PASS。対象カメラのVitestは6/6 PASS。
- `npm run e2e:smoke`：32シナリオPASS。
- 全体 `verify:core` は [GitHub Actions](https://github.com/yutogasaki/sansu/actions/runs/39091094496) で実行中。合否は完了後に追記する。
- 通常島の5画面比率×3回転×3ズーム×9画面位置で、海の交点とnear/far内を検査する回帰を追加。CIの全体テストに含める。
- `tools/e2e-growing-update.mjs` を基にした実SW更新：390通常motion / 768 reduced motion × 通常 / 検知後の通信中断、4ケースPASS。公開旧版のprecacheとWorkboxを実URLから取得し、隔離local originで旧→修正→同じ保存形式の復旧buildを配信。実UIで初回設定・家の配置・4問の回答・学習予約を作り、更新保留・一回のreload・所有と学習の保持・offline再読込・同じ予約への追加回答・復旧版の保持を確認した。[全reportとfingerprint](update-report.json)。

旅程：[旧版の学習](390-normal-old-learning.png) → [新版の島](390-normal-new-home.png) → [新版offline](390-normal-new-offline.png) → [互換復旧版offline](390-normal-rollback-offline.png)。旧版は取得した公開artifact、NEWとROLLBACKは同じ修正ソースの独立production build。source manifestは対象2ファイル・lock・Vite/Vercel設定のfingerprintと固定commit、dist manifestは全配信ファイルのSHA256を持つ。実機iOSの再起動・性能や子どもの理解/再訪の検査ではない。

初回失敗を合格へ読み替えない。全体lintの初回は並列Vite buildの一時config消失、旧 `e2e:island-pwa` は撤去済みLife rendererのselectorを待って失敗。これらはappの失敗ではなく検査条件の不一致として保全した。Growing専用更新の初回は配置直後の描画中に操作待ちがtimeout。実2フレームを待つ検査側補正と90秒の操作待ち、専用のChrome実ウィンドウで再実行し、上記4ケースを完了した。補正したharnessは `output/menu-release/update-native.mjs` と `production-helpers-current.mjs`。アプリの2ファイル以外は変更していない。作業端末の資源競合によりlocal全体unitは中断し、同一commitの独立CIで判定する。全体lintはビルド終了後に完走した。

詳細コマンド・初回失敗・local buildは `/tmp/sansu-menu-release-20261018/output/menu-release/`。公開の結果は別途追記する。

公開中の版の既存CIは[この実行](https://github.com/yutogasaki/sansu/actions/runs/38250555389)で620 files / 5,376 testsがPASSし、`native/authoredCoreGrowthIntegration.test.ts` の1件が失敗している。同じ固定mainであることを照合済み。この診断の依存57入力に変更対象の `growingCamera.ts` がないことは[依存確認](baseline-dependency-proof.json)で確認し、公開版の `nativeOwnedArt.enabled=false` と区別する。修正版の全体結果は完了後に比較する。

## 完走結果と最新mainとの統合

全体CIは `6c00737b` で620 files / 5,377 tests PASS、公開元と同じ `authoredCoreGrowthIntegration.test.ts` の1件だけFAILで完走。新しい失敗はなかった。[比較JSON](ci-comparison.json)。

検証中に、別の算数修正 `e24d40510eabae27e8d62e8695f612ff5f472585` がmainへ公開されたため、それを保持するmerge commit `05196dced2cbcc2bbfddc8b0ea9b42590d8d3922` を公開対象とした。最新mainからの差分はカメラと回帰テストの2ファイルのみ。算数側の全体CIも621 files / 5,381 tests PASS、同じ既存診断1件だけFAILであることを照合した。

最終統合版では、全体lint（0 errors / 既存4 warnings）・typecheck・production build/assets・docs check、カメラ/算数の関連2 files / 11 testsがPASS。両方の独立した全体検証結果を保持し、統合後の全体テストを同じ結果として再表記しない。[最終4画面とメニュー・保存の記録](final-visual-report.json)、[最終版情報](final-local-version.json)。

実SW更新も最終統合版で再実行し、4ケースともPASS。[最終更新report](final-update-report.json)。OLDは本人端末にも残りうる公開元 `febbd4cd` の取得済みartifact、NEWは `05196dce` の実build、ROLLBACKは算数修正を保持した公開main `e24d4051` の取得済みartifact。同じ予約の継続、取得済みの家/住人・学習の保持、通常/通信中断、offline回答・再起動を確認した。最終manifestは基点から変更された全ファイルと重要build設定、各dist全ファイルのSHA256、固定commitを含む。公開元と算数mainのsourceは、そのGit commitから書き出して照合した。

## 公開確認

2026-10-18 12:25 JSTに [公開版](https://sansu-seven.vercel.app/#/island) のrevisionが `05196dced2cbcc2bbfddc8b0ea9b42590d8d3922` へ切り替わり、Vercelの配信状態はsuccess。PR #5はmainへ統合済み。公開app versionは `05196dced2cbcc2bbfddc8b0ea9b42590d8d3922:00452bc4-c01f-4ad7-a0bd-addd2ddb7bec`。

12:26 JSTに専用Chromeの使い捨て合成プロフィールで公開URLを開き、実SW制御下で [海とメニュー](production-home.png)、[メニューを開く](production-menu.png)、[学習](production-learning.png) と島への復帰を確認した。manifestとapp root/島画面のrevision・version一致、Island=true / NatureTown=false、deliveryとcandidate一致をassertし、pageerrorは0。[公開結果JSON](production-report.json)。本人保存や実iPhoneは操作していない。

掲載する4サイズの修正版画像は、最新mainを保持した最終統合版05196dceのcaptureである。[比較JSON](visual-report.json) は旧版4画面と最終版4画面を対応付ける。最終PWA reportのcaptureファイルは保存先で `final-` を付けてコピーし、rawの元ファイル名も記録した。例：[最終版の島](final-390-normal-new-home.png) → [offline](final-390-normal-new-offline.png) → [最新mainへの互換復旧](final-390-normal-rollback-offline.png)。

公開後にmainの通常CIが同じ統合commitで再起動するが、統合前の独立した全体結果と統合後の関連検査・実旅程を、統合版の全体CI合格に読み替えない。既存の非配布3D診断1件は未修正として残す。
