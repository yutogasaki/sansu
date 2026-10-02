# 学習と島の固定統合候補の確認

後続のmain反映候補は[最終確認](final/README.md)を参照。以下は最初の固定コピーの履歴で、対象範囲を変更しない。

2026-10-02。「やって」の依頼に対し、学習→仕上げ→進級と、開始時点の未コミットの島・家・メニュー・遊び方を一つの固定コピーで検証した。愛着とくふうの柱に関わる確認。学習の判定・費用・既得権・保存済み予約は変更していない。

**固定候補の対象チェックはPASS。最新の共有checkout全体や公開先のrelease認定ではない。** 実機iPhoneと子どもの無説明理解・定着は未確認。検証中に到着したポケット型メニューと家の本のlive更新などは[別作業一覧](later-current-work.json)へ分け、破棄・巻き戻し・ステージしていない。

## 対象の識別

- 基点は `920e76e068088ff372d16cefd7be331e5888a043`。そこへ依頼開始時の未コミット変更を含めた固定コピー `/tmp/sansu-integration-20261002.0mbu8ebi`。この固定候補に新しいcommit/push/公開操作は行っていない。
- 育つ島DEVは `http://127.0.0.1:5276`（Island/Growing/幻想/Preview有効）、標準Island DEVは5277、本番形式のGrowing previewは5278。実rootのflag、revision/version、candidate、URL、音OFF/reduced motion、SW状態は各reportへ記録。
- DEV revisionは `920e76e0-integration-20261002`、本番形式のrevisionは基点 `920e76e0`。後者を基点commitの内容そのものと誤認しない。未コミットを含む実内容は[build manifest](build-manifest.json)と[source snapshot](source-snapshot.json)で識別する。
- 画面は `finish-path-v2`、`growing-island-v1`、`growing-guidance-v1`、`house-paper-atelier-v1`、`island-paper-atelier-v1`、`shared-paper-atelier-v1`。後続の `island-pocket-v2` は今回の候補に含めない。
- コピーの13,302ファイルとapp/distの1,706入力は検証前後で全て同じSHA。対象ハーネスの独自hashに加え、この全体照合でbalance/navigationも固定入力の範囲を確認した。[集計](verification.json)。

## 結果

| 検査 | 結果・証拠 |
|---|---|
| docs・入口guard・lint・typecheck・全テスト・build/assets | 516ファイル / 4,587 tests PASS。[core](core.log) |
| 仕上げの見通しと実20問 | 両幅14ケースPASS。[report](finish-dev/report.json)、[log](finish.log) |
| 家・共有メニュー・設定 | Growing4サイズ＋標準2サイズ、6ケースPASS。[report](menu/report.json)、[log](menu.log) |
| 家から遊び方・島・学習への往復 | 両幅2ケースPASS。[report](house/report.json)、[log](house.log) |
| 旧保存・地区・時間・通常学習 | 両幅4ケースPASS。[report](balance/report.json)、[log](balance.log) |
| S1〜S5/A1〜A6の案内・実達成・不変記念 | 両幅6ケースPASS。[report](guidance/report.json)、[log](guidance.log) |
| 本番形式の実初回・実SW offline/reload | 両幅2ケースPASS。[report](guidance-production-retry/report.json)、[log](production.log) |
| 記録・設定・家・写真・同じ学習への復帰 | 390/768両幅PASS。[report](navigation/report.json)、[log](navigation.log) |
| 既存classic回帰 | 31/31 PASS。[log](smoke.log)。現行Islandの美術の証拠に流用しない |
| 終了時の持ち出し文書検査 | Git-visibleの新しいコピーでPASS、文書入力の変更0。[log](docs-portable.log)、[対象](document-export.json) |

[実画面の接触シート](screens.html)は、仕上げfixture、注入なしの本番形式の初回、家の隔離プロフィール、資源を明示したメニューfixtureを別の列に分けた。生成画像・モック・異なるプロフィールを一つの自然な履歴に見せる構成は使っていない。

### 学習の確認

記録なし・途中・型不足・次範囲無効・挑戦可能・英語・最高レベルを両幅で確認。準備の不足を数で示し、回答数だけで必ず挑戦できると約束しない。準備済みfixtureから実UIで20問を解き、保存された `mathMainLevel: 16 → 17` とfinish履歴の `newLevel: 17`、結果の「Lv17へ レベルアップ！」、次の通常学習への到着を確認した。実際の子どもが準備に必要な時間・学習効果の測定ではない。

### 保存と島の確認

本番形式はDB注入なし。実初回設定→無料家→通常3回答→実6しずく→有料種→実SW offline再起動→同じ予約への追加2回答→再保存で、所有・残高・記念と学習ログ5件を保持した。preview DBが混ざっていないことも照合した。

DEVの旧保存移行・豊かな資源・ひろばは明示fixture。目標の選択と実達成を分け、後の色替え/移動/土地拡張で最初の記念が書き換わらないこと、家で本を読むだけでは学習/島の保存が変わらないことを確認。実two-build更新の代用にはしない。

## 修正と診断

- 持ち出したコピーの最初のdocs checkは、家/メニューのREADMEが参照する19個の `.log` がGitから除外されているためFAIL。[元ログ](core-first-missing-evidence.log)。必要な2証拠directoryと今回の証拠directoryだけ `.gitignore` の例外へ追加。元のログ本文を加工せず保存対象にした。製品の挙動・学習/保存仕様の変更は不要。
- 終了時の持ち出し検査では、後続作業のポケット型メニューのREADMEでも12個の参照logが除外されていることを確認。[元の持ち出し検査](docs-portable-first.log)。実在する元logを確認し、その証拠directoryだけ同じGit除外例外へ追加した。後続のアプリ内容をこの候補の動作PASSへ取り込んだという意味ではない。
- 本番形式の初回はphoneの全旅程PASS後、tabletの初回 `Page.captureScreenshot` がprotocol errorで停止。[元report](guidance-production/report.json)、[元ログ](production-first.log)。同じapp/dist/QA入力で再実行し両幅PASS。撮影エラーを保存不整合や修正済みアプリ不具合とは扱わない。
- ナビゲーションの既定7サイズの起動は、必要なphone/tabletへ明示的に絞るため担当が停止。[初回suite](initial-suite.json)、[停止ログ](navigation-default-stopped.log)と `navigation-default-stopped/` の途中画像を診断として保存。アプリ失敗や7サイズのPASSには数えない。
- coreの既存Review By警告4件、Fast Refresh警告1件、Browserslist/未一致precache glob警告は元ログに保持。エラーなしと警告なしを混同しない。

## 独立した判定と残る確認

- **見た目/情報設計**：作者が実画面で現在と次Lv、クリア後の進級、紙の家/メニュー/設定の連続性、狭幅の読み順を確認。Utility面の情報設計は対象範囲でGO。視覚の魅力の数値採点と利用者の好みは未評価。
- **無音理解/安全**：音なし・reduced motionでも数字と文言/形で進級と次の操作を示す。学習を迫る締切や偽の達成を追加しない。独立した無説明観察はN=0でHOLD。
- **runtime**：固定候補の対象旅程はGO。実機iOS/Android、公開先、旧公開writerからの実two-build更新、最大の島のGPU/バッテリー、子どもの翌日再訪・翌日/1週後の定着は未確認。別の固定guidance reviewのブラウザー実行も重なっていたため、今回を専有GPUのFPS/待ち時間の合格にしない。
- **現在の全体**：後続のメニュー/家/live保存の変更はこの候補外。最新全体の統合・公開判定は別の固定入力で行う。実装者の既知の操作と自動テストを、子どもが自分で戻りたくなる証拠に置き換えない。

見える進級が次の練習と島への再訪につながることが体験の仮説。今回の変更は検証記録と証拠の保存漏れ修正だけであり、親仕様01、学習02/29/31/34、島52、保存13、UI07、memory/ADRの契約を更新する必要はない。
