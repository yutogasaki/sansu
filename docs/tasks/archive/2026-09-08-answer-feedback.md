# 正解の音と演出の確認

- Review By: 2026-09-15
- Status: ローカル実装完了。固定コピーの検証完了、共有全体の統合と公開は別。

## Docs To Touch

`docs/product/28_mystic_island_spec.md`、完了時に `docs/done/2026-09.md`。

## Scope

- 目的: 島で正解が伝わりにくいという指摘に対し、正解の印を読み取りやすくし、ユーザーが明示的に音を再開できるボタンを置く。
- SSOT: `docs/product/28_mystic_island_spec.md`「音と回答の判別」。親仕様は既にこの節を参照しているため変更不要。
- 範囲: 回答表示と `IslandSoundControl`、共通audioの停止状態購読/gesture再開、Islandヘッダーから既存のsoundEnabledをatomic保存する接続。採点・学習記録・音源・3D演出は変更しない。
- 実装: 正解の丸36px、文字20px、短い光。46pxの表示行を待機中も確保し、次問入力で片付ける従来の動作を保持する。
- 音ボタン: offまたは停止なら「おとを だす」、再生可能なら「おと オン」。click内でresume/playし、確認音の実playイベントとrunningの両方を待つ。1500ms無応答/再生拒否は再試行へ戻す。英語読み上げ設定は独立のまま。
- gesture開始とclickの間にHowlerが自動再開しても、押し始めた時の「音を出す」が誤って消音に反転しない。画面切替/背景化で未完了確認音を取消し、保存失敗は最新の正規設定へ戻す。
- リリース: ローカル変更のみ。公開環境への反映はこのタスクに含めない。

## Verification

- localhost:5198のDEV、phone 390×844 / tablet 768×1024。変更前後の音・正誤・訂正・区間完了・音off/reduced motion・英語音声8ケースがPASS。出力は `output/playwright/island-feedback-{check,after}-20260908/`。端末スピーカーの実聴・ユーザー環境での無音原因・子どもの理解は未確認。
- 初回の `verify:core` はlint成功後、別作業中の `workshopLayout.ts:126` の型エラー（TS7053 / TS2339）で停止。その後の共有workspaceでは進行中のカメラの `IslandStage.tsx` と入江の `workshopScene.ts` が型検査を止めた。今回の変更をHEADへ重ねた固定コピーで追加検証し、共有workspace全体の完成とは区別する。
- 全unit testは208ファイル / 2,348件PASS。対象diffの空白検査PASS。lintは既存の `IslandMilestone.tsx` のFast Refresh警告1件のみ。
- 実画面の魅力: 作者目視で36pxの丸・20pxの文字を以前より読み取りやすくした。phone/tabletの全キーと次問を維持。子どもの再遊び意欲は未検証。
- 無音時の理解・安全: ○と文字を残し、誤答表現は維持。reduced motionで動きを止める8ケースのE2EはPASS。実参加者の理解は未評価。
- Runtime: DEV `development-local:ad0e361f-25cf-480f-aacb-60df875c3f07`、delivery `mystic-island-v1`、visual `mystic-island-living-v5`、learning `mystic-island-learning-v2`、service workerなし。実画面の比較（`../../../output/playwright/island-feedback-after-20260908/review.html`）。公開build・固定10問速度の新しい証拠にはしない。
- 音ボタンの追加後は固定コピーでlint/typecheck/2,240テスト/build/assetsがPASS。共有workspaceのdocs:checkと対象lintもPASS。共有DEV・固定productionのphone/tabletで各10チェック、固定productionの既存音声8ケース、smoke31、classic PWA4、Island PWA8+実SW offlineがPASS。[音ボタンの実画面と検証](../../design/audits/2026-09-08-island-sound-control/README.md)。
- 島の成長は両viewportで実25区間を確認。通常入力の初回速度未達は保持し、Mac Metalで残り10ケースがPASS。正式固定10問もMac Metalで80run/15gate/eligible PASS、正解P95 193.0/193.3ms、追加操作0。既定headlessの速度未達や同時負荷は監査記録で区別した。

## Remaining

- 別作業の型エラーが解消した状態で共有workspace全体のtypecheck/buildが必要。表示と音ボタンはローカルまでで、公開していない。OS/ブラウザタブのミュートや実スピーカーの聞こえ方をアプリから検知したとは扱わない。
