# iPad第6世代の描画再試行

2026-10-04。利用者からiPad第6世代・iPadOS 17.7.11、ホーム画面のPWAで「しまの えを ひらけなかったよ」、もういちどは同じ状態、最新版取得でも同じ失敗という報告。実端末の例外とGPU状態は未取得。OSのWebGL2非対応と断定しない。前回のエラー案内は取得されているが、前回修正による実端末の復旧は成立していない。

柱は愛着：保存した島へ戻る。正本は[親仕様](../../product/01_app_spec.md#81-pwa更新契約)と[52 §18.2](../../product/52_growing_island_game_spec.md#182-今の島からの引き継ぎ)。学習・保存schema・成長・取得済みのモデルを変えない。

## 確認したコードの問題

- Apple端末は初回からcompactだったため、手動再試行も同じMSAAなし・pixelRatio1・low-power設定だった。
- Threeのconstructorがcontext取得後に失敗した場合、呼び出し元にrendererが返らず、そのcontextを解放できなかった。新しいhelperはcanvas/contextを先に所有し、途中の失敗でも解放する。Threeによる追加の診断context取得も行わない。
- Growingの失敗は例外を捨てていた。constructor、scene初期化、render例外、context喪失を区別し、失敗した資源を解放する。保護者が開ける詳細に段階・例外・build・UAを表示する。本人名や保存データを収集せず、送信しない。

初回確保に失敗した場合は、新しいcanvasと標準のGPU選択・MSAAなしで一度だけ試す。手動再試行はこの復旧設定を直接選び、pixelRatio0.65（同じ表示面積で約42%の画素数）で描画する。家の共通rendererも確保失敗時の復旧を使う。実context喪失のポーリングも行い、最初の描画成功を誤って通知しない。

これは上記コード不備と明示故障に対する修正。**実iPadの原因が資源不足/電力設定だったとは未確認で、端末の復旧も未確認**。WebGL2対応とGPU確保の成功は別。WebGL2非対応向けの代替3Dエンジンは追加していない。

根拠：[Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)（WebGL2、context指定、破棄）、[WebKitのGPU利用](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)（powerPreference）、[WebGL仕様](https://registry.khronos.org/webgl/specs/latest/1.0/)（context生成/喪失）。powerPreferenceはヒントであり、端末での改善保証ではない。

## 検証

固定対象はmain `f59393bbe53c975581246067f151d137eaf0b212` に今回の所有パッチだけを適用した外部copy。別作業の木/家/人物の美術差分を含めない。[入力manifest](manifest.json)と[ブラウザreport](graphics/report.json)にapp/QAのhashを保存。ブラウザ前後のhashは一致。

- [verify:core](core.txt)：532 files / 4,667 tests PASS。docs/current-entry/lint/typecheck/build/assets PASS。helper回帰10件を含む。既存IslandMilestoneのFast Refresh warning 1件。公開形式186 precache files / 9.12 MiB。
- [GPUブラウザ回帰](graphics/report.json)：5シナリオPASS。Chromium/WebKitで、GPU選択の拒否を残したまま島/家の自動復旧、描画面積の制限を残したまま手動再試行、恒久的なGPU拒否時の有限再試行/詳細表示/実network再起動、実学習1回答と保存保持を検査。Chromiumの実context喪失→復旧も検査。使い捨てDEV fixtureと明示障害であり、実端末・自然獲得の証拠と区別する。
- [classic smoke](smoke.txt)：31/31 PASS。[全ケースの観測](smoke-report.json)。
- 実iPad第6世代・iPadOS 17.7.11：利用者の復旧確認待ち。


最初の[ブラウザ診断](diagnostic-first-limit/report.json)では、テストの画素制限を240,000に置き、0.65倍の復旧面でもそれを超えたため待機期限に達した。短い追加診断でcompact=768×960、recovery=499×624（311,376画素）を確認。検査の制限を両者の間の400,000に修正し、アプリの入力を変更せず再実行した。最初の失敗を保存し、実iPadの制限値とはみなさない。

## レビューと残る確認

- 安全/仕様：保存・学習の規則は変更なし。context確保・途中失敗・scene初期化失敗・喪失でGPU資源を解放し、二重解放を防ぐ。診断だけの追加contextを確保しない。再試行は有限で、別の設定を選ぶ。
- 視覚：既存compact画面と[復旧後の実画面](graphics/chromium-smaller-surface-recovered.png)を比較。モデル・配置・操作を維持し、復旧時だけ輪郭が粗くなる。美術の改善や魅力の合格認定ではない。
- 理解/安全：[保護者向けの詳細](graphics/chromium-gpu-unavailable.png)は折り畳み、子どもの再試行・学習を先に表示。保存削除を復旧手順にしない。子どもの無説明理解・再訪は未検証。
- runtime：明示故障での復旧はPASS。iPad第6世代の実例外/実起動とPWA再起動は利用者の確認まで保留。保存形式・PWAコードは未変更で、前回のclassic更新検査を繰り返す代わりに今回の公開版で更新/保存/オフラインの旅程を確認する。
