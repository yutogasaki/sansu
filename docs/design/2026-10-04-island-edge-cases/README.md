# 島の起動・更新・訪問のエッジケース再確認

2026-10-04。前回の[55%待機改善](../2026-10-04-island-opening/README.md)に対する追加監査。続いて古めのiPadで70%停止・島と家だけ開けないという報告を受け、GPU初期化も確認した。実iPadの保存・起動版・OS中断は取得しておらず、利用者端末の復旧を確認した報告ではない。アプリ全体に不具合がないという保証ではない。

柱は愛着：保存済みの島と学習へ戻れること。正本は[親仕様の更新契約](../../product/01_app_spec.md#81-pwa更新契約)と[52 §18.2](../../product/52_growing_island_game_spec.md#182-今の島からの引き継ぎ)。学習・報酬・時計・成長・所有・保存schemaは変更しない。

## 再現した不具合と修正

1. 読み込みの更新例外がglobal countだけで、島のcleanup前の学習画面・同routeの新checkpointにも効いていた。routeと取得時のsessionを記録し、新しい学習では既存の保護を優先する。独立した取得/解放・重複解放も検査。
2. hook外からの模様替え・花・写真・本人の島削除が実保存holdを取らなかった。repositoryの書き込みtransactionで取得し、commit/abort後にfinallyで解放する。待機中や失敗で早期解放しない。既存のUI holdとの重複はcountで保持する。
3. 同期計算の前のプロフィール/学習履歴読み取りに期限がなく、10%段階で止まり続け得た。既存の120秒準備期限を適用し、遅い結果を同期/保存へ渡さず、新しい再試行を許す。
4. 訪問中の花の保存完了で古いvisitをsetし、帰宅後に訪問先へ戻していた。保存の失敗も未処理だった。訪問世代を照合して遅い表示変更を捨て、保存自体は完了まで保護する。保存中の重複押下を止め、帰宅は許す。失敗は既存alertで再試行を案内し、訪問の読取失敗も処理する。
5. WebGL初期化失敗はchildのエラー表示だけで、親の70%待機overlayが覆い隠していた。[GPU拒否による再現](diagnostic-graphics-before/report.json)と[70%画面](diagnostic-graphics-before/failure.png)を保存。失敗を親へ通知して待機を終了する。Apple touch（デスクトップUAのiPadを含む）の島と家はMSAAなし・pixelRatio1・影なしで負荷を抑え、他端末もsurface確保失敗時に一度だけ軽くして試す。実context喪失/描画例外では描画を止め、新しいrendererへ再試行する。Growingの離脱でもcontextを解放し、GPU待機/失敗中は保存holdを優先して更新できる。

70%はコード上でデータ同期後の描画初期化を示す。利用者端末でGPUが拒否された、どのPWA版を起動している、と断定はしない。現行[Three.jsはWebGL2を必要とする](https://threejs.org/docs/pages/WebGLRenderer.html)。[Safari15でWebGL2が導入された](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)が、これはアプリ全体の最低OSの認定ではない。WebGL2非対応端末の3D成功は保証できず、機種/iPadOSと実起動版は未取得。

[修正前のfocused失敗](diagnostic-before.log)は6 failed / 21 passed。[3修正時のfocused結果](focused-after.log)は27 passed。訪問の実IDB待機では[元の帰宅後再訪失敗](diagnostic-visit-before/report.json)と[画面](diagnostic-visit-before/failure.png)を保存した。[修正後の診断](diagnostic-visit-fixed/report.json)はPASSだが、最終固定版の旅程とは区別する。

## 固定対象と検証

main `5c637e76ad06e6dd1333c956aaab3117b7016f74` に今回の所有パッチだけを加えたリポジトリ外のcopyを使用。[manifest](manifest.json)の1,536 app入力とQA hashで対象を識別する。別作業の木・家・人物の美術差分は含めない。Growing公開flagsはIsland/Life/Discovery/Fantasy/Growing=true、LifePreview/NatureTown=false。実画面の世界は既存 `growing-island-v1` のまま。

- 最終 `npm run verify:core`: **532 files / 4,662 tests PASS**。docs/current-entry/lint/typecheck/build/assets PASS。[ログ](core.log)。既存IslandMilestone Fast Refresh warning 1件、errors 0。公開形式のprecache186 files / 9.12 MiB。
- 訪問修正前の[結果](diagnostic-three-fixes-core.log)と[入力](diagnostic-three-fixes-manifest.json)、4修正時の[core](four-fixes-core.log)と[入力](four-fixes-manifest.json)も保持。70%対策後に全coreを再実行した。

- 70%報告前の4修正の固定production previewで[Chromium/WebKit復旧](opening/report.json)はPASS。実UIの初回設定、明示Worker無応答→15秒のネットワーク再起動、実IDB upgrade阻害→解除後の復旧、実回答/全学習store保持を両engineで確認。Chromiumの実SW offline再起動と追加回答もPASS。WebKit offline navigationは前回からのgapとして未確認、実iOSとは分ける。
- [390幅](visit-390/report.json)・[768幅](visit-768/report.json)のDEV訪問は各2シナリオPASS。3人の使い捨てfixtureから実UIで花を保存し、本物の競合IDB writeを待つ間に帰宅、保存完了しても自分の島に留まる。明示put失敗→案内→同相手への再試行で花が1つ、pageerror 0、試験前後の入力hash一致。
- classic `e2e:pwa-update` **4/4 PASS**（[ログ](pwa-update.log)）。Growingの旅程と分け、共有の学習/保存/同route checkpoint/実SW version drift回帰を確認。

- 70%報告前の4修正の固定sourceのDEV [通常フロー](balance/report.json) **4/4 PASS**。390/768幅で実初回配置→3回答→6しずく→通常種の配置→reload→同予約再開を検査。別枠の豊かな旧保存fixtureで版1→3・3方向の土地・時間利用を確認。自然獲得の後半プレイや本番SWの証明へ置き換えない。

- 固定sourceから独立したclassic二buildを作り、[実SW更新](pwa-two-build/report.json) **2/2 PASS**（[ログ](pwa-two-build.log)）。学習フォーム/保存hold中の更新待機→安全な境界で一度だけreload、旧SWのネットワーク復旧、切断/新版本体offline再起動、cache/IDB/localStorage保持を確認。

## 差分reviewと画面の判定

- 70%対策後の[最終GPU回帰](graphics/report.json) **3シナリオPASS**。Chromium/WebKitの明示GPU拒否で進行率を終了、実network再起動/保存保持、実学習1回答の保存、renderer再試行を確認。両engineの島/家をApple touch扱いでcompact表示し、Chromiumは本物の `WEBGL_lose_context` による喪失→新rendererの復旧も確認。DEV使い捨てプロフィール・明示障害であり古いiPad実機の性能や起動の証拠とは分ける。試験前後の入力hash一致。
- GPU回帰の前段の[結果](graphics-before-network-check/report.json)も保持し、最新のnetwork操作追加版と区別する。
- 共通classic smokeの最初は30/31 PASSで、1080×1920の旧探索の2回目誤答後の案内待ちがtimeoutした（[失敗ログ](diagnostic-smoke-first.log)）。同じsourceの[ケース単独の画面/保存観測](diagnostic-root-repeat/smoke-report.json)と[全体再実行31/31](smoke-four-fixes-report.json)では再現しなかった。原因は未確定で、今回の島/GPU修正が旧探索の非決定的な停止を直したとはしない。
- GPU対策後の最終 `e2e:smoke` **31/31 PASS**（[ログ](smoke.log)、[全ケースの観測](smoke-report.json)）。

安全/仕様/言葉はOK、過剰変更はなし。保存の更新保護は全writerの実transactionに置き、読み取りの期限で実保存を打ち切らない。遅い訪問の完了は保存を保持し、表示だけを破棄する。子どもを責める言葉や保存削除の復旧操作は追加しない。

見た目は既存の島・alert・待機cardを使用。[軽い設定の島](graphics/chromium-compact-island.png)・[家](graphics/chromium-compact-house.png)と[失敗画面](graphics/chromium-gpu-unavailable.png)を確認した。模型/配置/色は保持し、影とMSAAを省く。美術の作り直し・魅力の合格認定ではない。理解/安全は短い失敗案内と元の操作からの再試行、保存中も帰宅できる。子どもの無説明の理解や再訪は未確認。runtimeと見た目/理解の証拠を分ける。実iPadの復旧は利用者の確認まで保留。

花の保存失敗は[390幅](visit-390/gift-save-error.png)・[768幅](visit-768/gift-save-error.png)で実画面を確認。狭幅でも案内が折り返し、島と「おはな」「かえる」の操作を表示する。

## 配信と公開検証

main修正 `f1a1b6315f657171868a3198bdb8705b42e37a36` をpush。Vercel成功と公開 `https://sansu-seven.vercel.app/version.json` のrevision一致を確認した。コミットの1,536 app入力と5 QA hashが固定候補に一致し、レビューしたindexをリポジトリ外へexportしたdocs checkもPASS。最初のindex checkではgitignore対象のログの参照が欠け、[失敗](docs-check-first.txt)を保存して必要な証拠ログだけを明示的にstageした。別作業の美術差分は保持する。

公開の旧 `5c637e76` で実初回設定・実回答1件・実SW offline起動を行い、同じタブを再接続して通常の「きろく」から修正 `f1a1b631` へ更新した。新版の島、Apple touchのcompact設定、全native学習storeの保持を確認。ただし、新版のoffline-pack準備を観測中の再navigationで `Execution context was destroyed` となり旅程は未完了（[初回report](diagnostic-public-update/report.json)・[切替中の画面](diagnostic-public-update/failure.png)）。この初回を全旅程PASSとはしない。実機の停止の原因や再navigationの原因は断定しない。

[公開ハーネス](live-update-check.mjs)は元の180秒の期限内でこのcontext破棄だけを扱い、描画のreadyを待って現在bundleを再取得し、実worker/cacheの条件を再度観測する。その他の例外・期限超過は失敗のまま。page navigationと観測中のcontext破棄を記録する。ChromiumにiPad UAを与えてApple用設定を検査し、実iPad・実iPadOSの試験とは分ける。

別の空プロフィールで公開 `f1a1b631` の[現在版の全旅程](public-current/report.json)はPASS。実初回設定→実回答1件→実SW offline再起動→オンラインの記録/島往復→offline再起動→同予約の追加回答を確認。compact設定を実DOMで照合し、両再起動で全native学習storeが一致、最後の実回答でlogsが1→2。初回5c→f1の未完了旅程をPASSへ置き換えず、現在版の起動/保存/offline証拠として扱う。

続く公開 **`f1a1b631` → `7fb7fc55`** の[実SW更新・保存保持・新版offline再起動・同予約の追加回答](public-two-build/report.json)は全旅程PASS。両buildのapp入力は同一で、revision/version/bundleが異なる。現在HTML/bundleのprecache・active controller・installing/waitingなしを確認後に通信を切り、オンライン更新後とoffline起動後で全native学習storeが一致、最後にlogsが1→2。compact設定も維持。初回5c→f1の未完了と実iPadの未確認は保持する。コード `f1a1b631` の[GitHub Core](https://github.com/yutogasaki/sansu/actions/runs/37167631576)・[Docs](https://github.com/yutogasaki/sansu/actions/runs/37167631600)もsuccess。
