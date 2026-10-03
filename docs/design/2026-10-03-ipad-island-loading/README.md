# iPadで島が55%から開かない問題

ホーム画面のPWAで起きるという利用者報告への修正。55%はGrowingの初回同期で、旧Lifeからの引き継ぎを待つ段階。利用者の実保存は取得していないため、実機での原因を断定する記録ではない。

## 修正

- Growing選択時にも旧Life hookの初回refreshが走り、表示しない旧島の時計・保存を更新していた。旧controllerを明示的に無効にして、引き継ぎ元へ並行して書かない。
- 引き継ぎが画面上で `replayLife(old, Date.now())` を実行していた。検証済みsnapshotを復元し、旧保存の論理時計に実経過を加え、通常の留守上限7日・時計の逆戻り0を守る。
- 再生を読取専用Workerへ移動。失敗・120秒の停止はWorkerを終了し、既存の「もういちど」へ戻す。画面上の重い再生へ自動で切り替えない。
- 学習のぽこもこの取得済み着替えは、適用済みの着替え命令から読み取る。旧島を更新・再生して色を取得しない。

正本は[52 §18.2](../../product/52_growing_island_game_spec.md#182-今の島からの引き継ぎ)。保存形式、学習の予約・採点・報酬・所有品の規則は維持する。柱は愛着：保存を保ち、島へ戻れること。

## 検証対象と結果

今回の変更だけをHEAD `2a330fad` から取り出した隔離ソースで `verify:core`：523 files / **4,623 tests PASS**。共有checkoutのcoreは525 files / 4,628 tests PASSで、他の未確定変更を含む別の結果。classic smokeは最終31/31 PASS。

本番のflag構成（Island/Life/Discovery/Fantasy/Growing=true、Life preview=false）で固定buildを作り、768×1024で検査した。[manifest](manifest.json)はapp/distのSHA256、build version、実際の構成を保持する。buildのrevisionは `development-local`、baseline `2a330fad` ＋この修正で、公開版の証拠とは分ける。sourceHashは `3967cccc36e3c0feb5ba5251ae1b8a0218741f9c81a2fa87a19d65f0cd742ef9`。

- **WebKit**：20日留守の明示旧保存（合成学習15件、正式命令で花と水ばちを購入）でWorker起動失敗→再試行→実描画を確認。7日上限、元の保存と学習正本の不変を照合。1,341msは検証環境の1試行で、実iPadの速度保証ではない。[実行記録](webkit-report.json)。SW制御とWorkerのprecacheは確認したが、offline再起動はPlaywright WebKitの内部navigation errorで未確認。
- **Chromium**：同じ種類の明示保存で引き継ぎ・再試行・旧保存の不変、Workerのprecache、実SW制御のoffline起動、同じ学習予約への回答保存までPASS。[実行記録](chromium-report.json)。移行は2,525msの1試行。実取得や実機の計測とは別。
- unitは論理時計のずれ・長い留守・時計逆戻り・snapshot待機順、Workerのerror/messageerror/timeout/送信失敗とretry、旧controller停止と途中読取の取消、着替えの保持を追加。既存の保存・競合・PWA holdのテストも保持。

[WebKitの再試行面](webkit-retry.png) · [WebKitの実描画](webkit-ready.png) · [Chromiumのoffline復帰](chromium-offline.png)。[WebKit harness](webkit-harness.mjs)と[Chromium harness](chromium-harness.mjs)は診断の原文を保存。QAのdev fixtureを本番形式originへ明示的に投入する。利用者の保存に対して実行しない。

初期のQA失敗は `output/playwright/ipad-growing-migration` と `/tmp/sansu-ipad-*.log` に残す。classic最初の起動失敗は複数Viteサーバーが共有した依存cacheの504、次の1件は変更中のHMRと重なった診断。別cache・固定ソースで最後の31件を完了。WebKitのoffline失敗を成功へ読み替えない。

## 独立した判定

- 見た目：絵・形状・カメラの変更なし。実描画で既存Growingの島と読める操作を確認。新しい美術の承認ではない。
- 理解・安全：保存を消さない再試行と既存の短い文言。実参加者N=0で、無説明理解・再訪は未評価。
- runtime：対象の移行・保存・再試行とChromium SW offlineはPASS。実iPadのホーム画面からの再起動は利用者確認が残る。

公開後は公開URLのrevisionと旧→新SW更新・同じ学習予約を別に確認する。データ消去や旧writerへのロールバックを復旧手段にしない。

## 公開と実SW更新の確認

main修正 `3dc3051a37a3fe1436452ddee4eae1bcb973b32d` を本番へ反映し、Vercel成功と[公開version](public-version.json)を照合した。Gitに含めたapp入力は隔離候補の全hashと一致し、他の未確定変更を公開していない。

公開URLの768幅Chromiumで、旧版 `2a330fad` の実初回設定と1回答をSW制御のofflineへ保持してから、新版へ再接続・自動更新した。全7学習storeの不変、同じ予約/次問への復帰、新版のoffline起動・追加回答保存をPASS。[公開の更新記録](public-report.json)、[新版の島](public-new-online.png)、[新版のoffline学習](public-new-offline-learning.png)。実iPadのホーム画面での確認とは分ける。
