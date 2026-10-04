# 島の55%停止：同期と更新保護の分離

2026-10-04。ホーム画面から開くiPadで55%停止が続くという報告への追加改善。[前回の変更](../2026-10-03-ipad-island-loading/README.md)は旧Lifeの再生をWorkerへ移したが、Growingの同期計算は画面上の書き込みtransaction内に残り、同期全体のPWA holdと島のタップによるセッション保護も更新を止めていた。実iPadの保存・起動版は取得しておらず、端末で今回どの待機が止まったかは未確定。実装・自動検証と実機の復旧確認を区別する。

柱は愛着：島と学習の保存を保って戻れるようにする。学習・経済・成長・所有・保存形式の規則は変更しない。正本は[親仕様の更新契約](../../product/01_app_spec.md#81-pwa更新契約)と[52 §18.2](../../product/52_growing_island_game_spec.md#182-今の島からの引き継ぎ)。

## 変更

- 同期を「DBの読み取り・Workerでの計算・照合して保存」に分けた。旧Life再生だけでなくGrowingの自然・町・学習完了・贈り物もWorkerで計算する。計算待ちをIDB書き込みtransactionへ入れない。
- 保存transactionで計算元の島と贈り物を照合し、並行保存があったら再計算する。3回競合したら上書きせず再試行を案内。贈り物の受領と島の保存は同時にcommitする。
- 読み取り準備を120秒で打ち切り、Workerを終了する。遅れて届いた結果から保存へ進まない。Workerの失敗を重い画面上の再生へ切り替えない。
- 島が表示できない読み込み・失敗中は、タップ後も修正版の更新を許す。島が表示できた・別画面へ移ったら通常保護へ戻す。実際の学習/保存transactionのholdは常に優先する。
- 55%が15秒続いたら「もういちど ひらく」を表示。最新HTMLを取得でき、保存保護がない場合だけ同じURLへ開き直す。DB、localStorage、SWやcacheを削除しない。

## 固定対象と検証

[manifest](manifest.json)と[全入力hash・ブラウザreport](report.json)が対象を特定する。main `f1c1e93f`に今回の所有パッチだけを加えたリポジトリ外の固定コピーで実行した。作業中の木・家の美術変更は含めない。配信flagsはIsland/Life/Discovery/Fantasy/Growing=true、LifePreview/NatureTown=false。実画面はGrowingの島で、世界の候補は既存の `growing-island-v1` のまま。

- `npm run verify:core`: **531 files / 4,650 tests PASS**、docs/current-entry/lint/typecheck/build/assets PASS。[ログ](core.log)。lintは既存 `IslandMilestone.tsx` のFast Refresh warning 1件、error 0。公開形式のprecacheは185 files / 9.11 MiB。
- 同じ固定入力のclassic回帰は `npm run e2e:smoke` **31/31 PASS**（[ログ](smoke.txt)）。実classic buildを指定した `npm run e2e:pwa-update` **4/4 PASS**（[ログ](pwa-update.txt)）と `npm run e2e:pwa-two-build` **2/2 PASS**（[ログ](pwa-two-build.txt)・[版と結果](pwa-two-build-report.json)）。保護フォーム・本当の保存hold・一度だけのreload・旧SW復旧・切断/オフライン再起動・cache/IDB/localStorage保持を確認。現行Growingの見た目や実iOSの証拠とは分ける。
- 追加の回帰は、読み取りと本当の保存holdの境界、DB待機のtimeout/遅い結果、Worker終了/取消、別画面の保存・届いた贈り物との競合、失敗/再試行の二重支払い防止、操作後の読み込み更新、表示/離脱時の通常保護復元、ネットワーク失敗/オフラインでの再起動禁止を確認した。
- 同じ固定sourceのDEV `tools/e2e-growing-balance.mjs` **4/4 PASS**（[reportと画面](balance/report.json)）。390/768幅で本当の初回配置・3回答・6しずく・通常種の配置・reload・同予約再開と、別枠の豊かな保存fixtureで旧版1→3・3方向の土地・時間利用を確認。保存ルールの変更ではなく、計算/transaction分離による通常フローの回帰を検査した。DEVとfixtureは本番SWや自然獲得の証拠と区別する。
- [再実行用ハーネス](browser-check.mjs)でChromium/WebKitの768×1024、touchあり・reduced motion、同じ固定production previewを確認。新しい本人の初回設定は実UIで行う。
- Workerが応答しない明示障害を初回Growing作成前に注入。55%の画面は応答を保ち、15秒の再起動ボタンから同じ版のネットワークHTMLを開き直して島を表示した。前後で学習の全native store内容が一致。
- 実回答1件を保存した島を旧schemaの明示fixtureへ移し、別ページにversionchangeを拒むnative IDB connectionを残して本物のupgrade阻害を再現。55%を表示し、古いconnectionを閉じると保存済みの島と学習を保持して開いた。これは実利用者の旧保存ではなく、取得済み状態を使った障害試験。
- Chromiumでは実SW制御のoffline再起動と、同じ予約の追加回答の保存もPASS。WebKitのoffline navigationは前回からの自動化のgapとして今回も合格扱いにしない。実iPadの速度/復旧/OS中断、子どもの理解や再訪は未確認。

初期診断も保存した。[再起動のタップが通常セッション保護に阻まれた失敗](diagnostic-recovery-click.json)をPWAの回帰へ追加し、読み取り待機の保護を修正。[WebKitで初回画面の描画完了前に次の設定を期待した失敗](diagnostic-webkit-early-start.json)は、画面を撮影してwelcomeに留まったことを確認した。ハーネスは初回3D viewportのaria-busy解除と2frameを待ってから初回設定を操作するよう修正した。固定した最終入力で両ブラウザを最後まで実行した結果のみをPASSとする。frame数は応答を保った診断で、FPS・iPadの処理時間の測定ではない。

## 画面と独立した判定

差分review：元の同期計算・時計・移行・受領の条件は純粋計算へそのまま移し、照合とcommitをtransactionへ残した。Safety/仕様/言葉はOK、今回の主目的を超える学習・成長・美術変更はない。利用者端末の原因特定・実iOS終了復帰は未確認として残す。

- 見た目：待機画面の既存の紙・文字・色を保持し、再起動操作を1つ追加。[WebKit待機](webkit-worker-stalled.png)・[復旧後](webkit-worker-recovered.png)。美術の作り替えや子どもの見た目評価ではない。
- 理解/安全：操作は44px以上、進行率のroleと操作ボタンを別にした。責める言葉や保存削除の操作は加えず、書き込み保護を優先。無説明の子どもの理解は未確認。
- Runtime：上記の保存/競合/更新保護/両engineの復旧とChromiumのofflineはPASS。実iPadの復旧確認は保留。

## 配信

main修正 `bcdcaf790b089186903d64b23ffb92e5263a868b` をpushし、Vercel成功と公開 `https://sansu-seven.vercel.app/version.json` のrevisionを照合した。レビューしたindexの1,534 app入力が固定候補と一致し、indexをリポジトリ外へexportしたdocs checkもPASS。作業中の別の美術差分は含めない。

公開768幅Chromiumの旧 `f1c1e93f` で、初回設定・実回答1件・SW offline再起動を済ませた。同じタブで再接続し、通常の「きろく」へ移る操作で `bcdcaf79` へ自動更新し、島を表示、全native学習storeの不変を確認した（[新版の島](public-update-new-online.png)）。ただし、その直後のoffline再読込は `ERR_INTERNET_DISCONNECTED` で失敗した。[初回の未完了report](diagnostic-live-update.json)と[実画面](diagnostic-live-offline-too-early.png)を保持し、この旅程全体はPASSとしない。`navigator.serviceWorker.ready` は旧active workerを返せるため、新しいshellのcache/worker準備完了を確認していなかった。初回失敗時のworker/cache状態は取得しておらず、原因を断定しない。

[公開ハーネス](live-update-check.mjs)は、切断前に現在のHTML/bundleのprecacheとactive controller、installing/waitingがないことを待つようにした。`SANSU_OPENING_LIVE_FRESH_ONLY=1` は現在公開版の初回/保存/offline検証として明示し、旧→新更新の証明へ置き換えない。初期不具合報告の端末が開けるようになったことは、利用者の確認まで合格扱いにしない。

別の空プロフィールから公開 `bcdcaf79` を検証し、実初回設定→実回答1件→実SW offline再起動→オンラインの記録/島往復→offline再起動→同予約への追加回答を **PASS**（[report](public-current-report.json)、[オンラインの島](public-current-online.png)、[offline追加回答](public-current-offline-answer.png)）。両再起動の前後で全native学習storeを照合し、最後の実回答でlogsが1→2になった。現在公開版の起動/保存/offlineに対する証拠であり、初回の旧→新旅程のoffline失敗を解消した証明とは分ける。実iPadは未確認。
