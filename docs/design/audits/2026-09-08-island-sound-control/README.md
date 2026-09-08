# 音の明示再開ボタン

島のホーム・学習などのヘッダーに「おとを だす／おと オン」を追加。停止時はclick内でAudioContext.resumeと確認音のplayを開始し、保存のawaitより先にuser gestureを使う。再生イベントとrunning状態の両方を待ち、拒否・失敗・1500ms無応答では再試行を残す。設定のsoundEnabledだけを最新プロフィールへatomic保存する。

[実画面の比較](review.html) / [音ボタンの検証](sound-control-report.json) / [既存音声の回帰](feedback-report.json)

## Evidence boundaries

- 共有workspaceのDEVでphone/tabletの10チェックを確認後、並行する入江・カメラ編集で型検査が止まったため、HEADに今回の音と回答表示だけを重ねた固定コピーで追加検証した。共有workspace全体の完成判定にはしない。
- コピー: `/tmp/sansu-sound-control-isolated-20260908`、sourceHash `e77088e2d23b828a70c036981b0adddb237136e86a2fd41d48244b2fca9af369`。固定productionはlocalhost:5598、delivery `mystic-island-v1`、visual `mystic-island-living-v5`、learning `mystic-island-learning-v2`。各画像の実versionはreportに記録。
- 音ボタンは再開成功・確認音・正解音のデジタル出力、touch/keyboard、全テンキー、下書き・全学習テーブル・プロフィールmirror、再読込を確認した。resume保留、gesture途中の復帰、保存transaction abortは明示した故障診断。
- 最初のDEVハーネスはmobile unlockでAudioContextが入れ替わる前の出力を測り無音と判定した。実接続先ごとに無音の測定分岐を付け直すことで実出力を確認できた。アプリの音声経路はこの計測のために変更していない。元FAILは `output/playwright/island-sound-control-20260908/report.json` に保持。

## Gates

- 視覚: 作者目視で44px以上の音ボタンと文字を確認。390×844 / 768×1024とも次問・全キーを維持。表示領域の大きさで正解を認識しやすくしたが、再遊び意欲は未実測。
- 無音の理解・安全: ○と文字を維持。既存音声8ケースの音off/reduced motion、誤答の穏やかな表現を確認。OS/タブの消音検知、スピーカー実聴、実参加者の理解は未確認。
- Runtime: 固定コピーのlint（既存警告1件）、typecheck、195ファイル/2,240テスト、build、assetsがPASS。実productionの音ボタン10チェックと既存音声8ケース、classic PWA4、Island PWA8+実SW offline、smoke31がPASS。
- 島: [初回](island-first-report.json)でphone/tabletの各25区間、4地区成熟・固定7物・発見/再演・履歴・表示復旧・初回設定を通過。その後の通常入力の速度検査で停止した。Mac Metalを指定した[再確認](island-metal-report.json)では残りの全入力・設定/保存/再開など10ケースがPASSし、成長を含む11ケースの機能回帰を確認した。
- 速度: Mac Metalを明示した[正式固定10問](throughput-metal-report.json)は80run / 全15gate / eligible PASS。正解P95はphone193.0ms/tablet193.3ms、誤答192.4/193.5ms、区間境界192.4/192.9ms。追加操作0、全入力44px以上、保存と問題の整合・source不変を確認。自動操作のDEV測定で、実機の子どもの速度や機器専有は認定しない。

## Earlier failures and integration limits

- 既定headlessの[初回速度比較](throughput-report.json)はeligible=trueだがPASSではない。phone/tabletの正解P95は405.9/1039.9ms、区間境界978.4/1910.4msで一部未達。島の通常phone検査も初回1602.9ms、[再確認](island-second-report.json)2599.8msで未達だった。複数の別benchmarkの同時実行も観測した。Mac Metal指定では同じコードのphone再確認が195.4ms、続く正式80runが上記の基準内になった。描画backendと同時負荷の影響を分離し切った因果実験とは扱わず、既定headlessの失敗も保持する。
- 共有workspaceのdocs:checkと対象lintは通過。共有全体のtypecheck/buildは作業中の `IslandStage.tsx`、`workshopScene.ts`、後に `workshopPresentation.ts` の型エラーで止まった。固定コピーのPASSを、この並行変更を含む全体の統合PASSへ転用しない。

## Scope

ローカル実装と検証まで。commit・push・deployなし。英語の読み上げ設定、学習記録の意味、保存済みの問題は変更していない。親仕様は仕様28の音の節を既に参照しているため追記不要。

## References

- [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/): user gestureとresume、statechangeでの確認。
- [Howler mobile playback](https://github.com/goldfire/howler.js#mobilechrome-playback): unlockと再生イベント。
