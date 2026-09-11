# 島に置く前に確かめる：配置 v3

購入・移設・収納からの再配置で、実物の仮表示と利用経路を見て場所を決めるDEV試作。[実画面](review.html) / [一周の画像](contact-sheet.jpg)。契約は[仕様48](../../../product/48_island_life_spec.md)。

## 変わった体験

- 商品を選ぶと島へ戻る。島のタップでも、マス一覧でも場所を選べる。
- 育ちと色を保った薄い実物、置けるマス、家から利用位置への点を表示。実際の住人の集合予測ではない。
- ベンチ・ブランコ前面や既存施設の通り道をふさぐ場所は、保存と同じ配置判定で確定前に止める。×と短い言葉を併用する。
- 島と確定・取消ボタンがスマホの一画面に収まる。置いた後は通常の住人の反応へ戻る。
- 仮表示は消費・保存・住人の再選択を行わない。移設の仮表示中も住人は元の席を利用する。確定時のrevision・残高・経路チェックは既存のまま。

成長・経済・保存形式・行動規則はv2を維持。モデルファイルの変更は表示候補IDのみ。新しい管理画面や報酬回収は追加していない。

## 対象と版の境界

実画面は `http://127.0.0.1:5243/`、固定コピー `/tmp/sansu-island-life-v3`、候補 `island-life-placement-v3`。`DEV && VITE_ISLAND_ENABLED=true && VITE_ISLAND_LIFE_PREVIEW=true`。[source.json](source.json)のhashは `75cb124601fa624208d2d7214ae1cd0b9181a636243acc099ce1e37853e9665d`。

[検証の集約](verification.json)。

元HEAD `70ad92c15a976ae9be2c9513cd4825ea961e4dc0` と共有作業ツリーから作った候補であり、単独のコミットではない。[v2との差分](source-boundary.json)は配置UI・その検査・候補IDの8ファイルに限定する。実UIの再検査には、同じ検査へ失敗時の画面/本文保存とconsoleログだけを加えた[QA overlay](life-harness.mjs)を使用。アプリと判定条件は同一で、overlayのhashも記録した。

通常学習からの実UI検査は新しいブラウザプロフィール、phone 390×844とtablet 768×1024 reduced motion。各6区間、phone 30回/tablet 27回の実回答操作から11品を購入。成長は明示DEV6時間送りで、実際の一晩の再訪や子どもの体験ではない。

既存島は同じ入力の試作OFF `http://127.0.0.1:5244/`、[別flagのmanifest](legacy-source.json)。Island PWAとproduction guardは同じ固定コピーから両flag trueでbuildした `http://127.0.0.1:5245/`。classic PWAはcoreのclassic build。[島production版](island-production-version.json)と[classic版](classic-production-version.json)を別々に記録する。DEV・production・classicを一つの配布buildとして扱わない。

## 検証

| 検査 | 結果 |
|---|---|
| `npm run docs:check` | PASS。最終仕様・資料・タスク整理。[ログ](docs.txt) |
| `npm run verify:core` | PASS、326 files / 3,467 tests。配置判定の全セル比較、移設の不変性、元の席への接触を含む。[ログ](core.txt) |
| 新島の通常学習から一周 | 両幅PASS。直接タップ、前面/既存経路保護、確定ボタンの画面内収容、取消・再配置、喜び、接触、外観、同じ学習予約への復帰。既存7store不変、canvas再利用。[結果](report.json) / [ログ](life.txt) |
| キーボード/描画失敗 | 直接のWebGL context loss後も、マス選択と取消がキーボードで動き、残高/配置actionを保持。明示4credit fixture。[結果](keyboard-fallback.json) |
| 既存島 | 11シナリオPASS。両幅各48区間で4地区成熟、描画復旧、初回設定、入力/再開を検査。分数QA訂正前の合格5件と訂正後の6件を分離して集約。[結果](island-report.json) / [ログ](island.txt) |
| smoke | 31シナリオPASS。[ログ](smoke.txt) |
| 固定10問throughput | 80走行PASS、eligible=true。phone/tablet各10反復。[結果](throughput.json) / [ログ](throughput.txt) |
| classic PWA | 4シナリオPASS。[ログ](classic-pwa.txt) |
| Island PWA | 8保護フローと実SW offline回答/reload/再開PASS。[結果](island-pwa-report.json) / [ログ](island-pwa.txt) |
| production guard | 両flag trueのproductionでも試作UI/DBを作らない。[結果](production-guard.json) |

固定10問の正答/誤答/区間境界P95はphone 213.3/225.4/216.7ms、tablet 218.2/227.6/216.3ms。追加の通常操作0、空欄保持、入力とreceiptの整合がPASS。自動キーボード操作の計時で、子どもの速度ではない。lintは既存fast-refresh警告1、エラー0。precache 10.59MiB/12MiB、既存の大容量chunk警告あり。

### 最初の失敗と検査側の修正

最初のcoreはタスク文書の必須見出し不足で停止し、補って全coreを通した。[記録](diagnostics/first-core-run.txt)。最初の実UI検査はfull unit suiteと同時実行中、連続購入で配置detailsを待ってタイムアウトした。[記録](diagnostics/first-life-run.txt)。アプリ変更を加えず、失敗時採取を加えた同じ手順の再実行では両幅を完走。最初の失敗時には画面採取がなく、原因は確定できない。負荷下の操作欠落が再発した場合は、採取した画面・本文から再診断する。合格した再実行を、最初の失敗の修正証拠にはしない。

既存島の分数シナリオは、保存問題 `7/11 + 4/11 =`（答え `["1","1"]`）を画面が整数の一欄で出す既存仕様に対し、検査が二欄を要求して停止した。検査だけを既存 `integerFractionProblem` に合わせ、保存問題は分数のままであることも確認した。[元の失敗](diagnostics/first-legacy-run.txt)と[同じ問題の再現](fraction-replay.json)。訂正中に追加した筆算の保存形式への誤った仮定も検査側から除き、既存の画面形式の検証を維持した。アプリの出題・採点・入力コードは変更していない。長い成長シナリオを繰り返さず、元実行の合格範囲と残りのシナリオを別実行として集約する。

## 三つの判定

- **視覚：HOLD。** 作者による実画面レビューは、入りたい場所4・愛着5・材質3・構図/奥行き4・色の焦点5・出来事4、25/60。基準の初期キービジュアルを比較画面へ併記した。家/キャラのidentityと淡い芝生は維持したが、海・植生・素材・密度は基準に届かない。仮表示は意図した透明表示で、実物や住人の身体を透明化しない。
- **無説明理解・安全・再訪意欲：HOLD、子どもN=0。** ×と配置理由、動きなしでも見える経路、取消の残高保持は作者と自動検査の確認。独立した子どもの理解や動機の証拠ではない。
- **runtime：今回のDEV配置フローはPASS。** 全公開の合格ではない。最初のUIタイムアウトと各buildの境界を上記に残す。

後続はキービジュアル相当の仕上げ、子どもの短い操作観察、通常時間での価格/閾値/減衰、本番データ移行。5/3段階やレア、小島、他人の島は今回に追加していない。
