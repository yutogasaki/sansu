# 育つ島：開いてから段階的に画質を上げる

2026-10-04。iPad第6世代・iPadOS 17.7.11で[前回の復旧設定](../2026-10-04-ipad-gpu-recovery/README.md)によって開けたとの利用者報告を取得。ただし絵が粗く、「開くのを優先しつつ徐々に良くしたい」という依頼。

柱は愛着：先に島を開き、負荷の余裕がある場合は絵を鮮明にする。[親仕様](../../product/01_app_spec.md#81-pwa更新契約)と[52 §18.2](../../product/52_growing_island_game_spec.md#182-今の島からの引き継ぎ)を先に更新。対象は育つ島の軽量/復旧renderer。家の共通rendererの画質制御は今回変更しない。モデル・配置・操作・学習・所有・保存schemaは変更しない。

## 挙動

- 最初はpixelRatio0.65で表示。前景の実フレーム間隔が各段階で3秒以上・60サンプル以上安定すると0.8→1→1.25（端末密度まで）へ上げる。MSAA/影は戻さず、GPU資源を追加作成せずに同じcanvasを更新。
- 継続的な遅延なら一段下げ、そのrendererでは再昇格を止める。一度の遅延は過剰反応せず、非表示・サイズ変更・長い中断後は新しい観測から始める。
- 昇格後のrender失敗/context喪失では、ひとつ低い上限で新しいrendererを作る。保存状態・選択は親に残す。最低画質でも失敗する場合は既存の再試行案内へ戻り、無限に再起動しない。
- 指標はフレーム間隔であり、GPU時間/空きメモリの測定ではない。OSによるプロセス終了はWebGL例外と同じ復旧保証に含めない。画質上限の学習はその画面の寿命内で、永続的な端末設定や学習DBへの書込は追加しない。

## 固定対象と検証

main `3b8b36545f87c0b25c30253ed3eaedf66605281f` に所有差分だけを加えた外部copyで検査。別作業の木・人物・家の美術差分を除外。

純粋ロジックのfocused回帰11件PASS。最初のテストで、降格後にも故障フレームを流し続けて二度目の降格が起きたことを確認した。テストは最初の降格時点で安定フレームへ戻し、再昇格しない契約を直接検査する形に修正。アプリ側の降格を抑えて検査を通す変更はしていない。

実iPadでの昇格後の画質・長時間安定性は利用者確認待ち。前回の「開けた」という確認と、今回の画質向上の確認を分ける。


[初回のブラウザ検査](diagnostic-first/report.json)は、段階的な昇格と面積制限下の自動復旧まではPASS、再読込後の次の昇格待ちでtimeoutした。最終画面の診断が取れておらず、このtimeoutの原因は断定しない。[初回core](diagnostic-first-core.txt)とsource hashを保持。コードレビューで、最低画質での起動負荷だけでも上限を固定していたことを確認し、その段階では安定後に再評価するよう修正。高画質から実際に降格した場合や、描画障害で下げた上限は維持する。対応する純粋テストも更新し、最終固定入力で全coreを再実行した。

[最終core](core.txt)：533 files / 4,678 tests PASS。docs/current-entry/lint/typecheck/build/assetsもPASS。既存Fast Refresh warning 1件。公開形式precache186 files / 9.12 MiB。[最終入力](manifest.json)は1,540 app入力とQA hashを記録する。


[最終ブラウザ検査](graphics/report.json)：5シナリオPASS。Chromium/WebKitの768×1024、deviceScaleFactor2、Apple touch扱いで、初回0.65→0.8→1→1.25を実フレームで確認。400,000画素の明示制限を残したまま昇格失敗→低い上限で自動再開し、7秒後も再確保を繰り返さず操作可能なこと、全native保存の保持を確認。Chromiumでは昇格後の本物のcontext喪失→自動再開も確認。DEV使い捨てプロフィールと明示障害であり、実獲得・物理iPadのFPSやメモリ測定ではない。app/QAの前後hash一致。

## 画面とレビュー

- 視覚：同じ保存の[最初の低画質](graphics/chromium-initial.png)と[上昇後](graphics/chromium-sharper.png)、[WebKitの上昇後](graphics/webkit-sharper.png)を比較。モデル/配置/文字UIは同じまま、3Dの輪郭が改善する。影とMSAAは増やさない。新しい美術や魅力の合格認定ではない。
- 理解/安全：画質選択の操作を増やさず、本人の入力を妨げない。下げた上限で再開した[実画面](graphics/webkit-automatic-fallback.png)でも既存の入口を保持。子どもの理解/再訪は別の未検証項目。
- runtime：純粋制御・実ブラウザ昇格・制限時の復旧と保存保持はPASS。実iPadでの画質/温度/長時間動作は未確認。frame cadenceをGPUメモリ測定と同一視しない。


[classic smoke](smoke.txt)：31/31 PASS。[全ケースの観測](smoke-report.json)。保存/PWAの実装は今回未変更。公開版の実SW更新・保存保持・offline旅程も下記の通り確認した。

## 公開版の更新検証

コード `53187252fa60360f16430cbbbe1eb4a8aaa814dc` をmainへpushし、Vercel配信成功。[公開版の実SW更新結果](public-update/report.json)：旧 `3b8b3654` のnative onboarding/解答/オフライン保存を残したまま再接続し、通常の「きろく」境界から新版へ更新。全native storeの一致、最新版のprecacheとactive controller、更新後オフライン解答ログ1→2を確認。ChromiumのiPad UAによる確認で、物理iPadの確認ではない。
