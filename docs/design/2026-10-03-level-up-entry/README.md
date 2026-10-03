# レベルアップと確認テストの入口を整理

2026-10-03。実機画像での「文字が多い」「しあげのまま」「いろいろなところにあって分からない」と、先頭への移動の依頼に対応。記録を見て次の学習を選びやすくする変更。学習判定・予約・採点・保存・印刷の処理は維持。

## 変更

- 現行Islandの子ども向け表示は「レベルアップ」。記録/学習の案内/実問題の見出し/結果/履歴を揃え、内部のfinish-test・kind・保存済み予約は改名しない。
- 記録の最初に「つぎへの道」。現在/次Lvと3つの数、挑戦または設定の操作を先に見せる。説明は短くし、詳細は閉じた「くわしく・きろく」にまとめる。「型」は「しゅるい」、無効な次範囲は短い状態と設定の入口で伝える。
- レベルアップ開始は記録に集約。まなぶは通常の練習と記録への案内、学習中の案内も記録へ。別の開始カードと、記録内の確認テスト開始ボタンを外す。
- レベルを変えない確認テスト/紙は設定の「保護者」へ。「定期テスト」「アプリ受験」の表示を「確認テスト」「アプリで確認」に揃え、レベルを変えない用途を明示。既存の保護者確認を通って開始し、印刷と採点待ちは保持。
- 保存と採点の契約は変更しない。準備は最近20回答・独力17正解・範囲被覆、クリアは実20問全問独力。既得のLvと履歴は残す。旧classicのホームイベントは別経路の既存機能で、名称整理の対象に混ぜない。

## 検証

- [core](core.log.txt)：520ファイル/4,606テスト、docs/入口guard/lint/typecheck/build/assets PASS。最後の短い無効設定の文言と仕様追補後、[lint](lint-final.log.txt)と[typecheckを含む本番形式build](build-final.log.txt)を再確認。
- [本番形式の実画面14ケース](first/report.json)：390/768、空/途中/被覆不足/無効/準備済み/英語/最高Lv。記録の最初のカード、名称、閉じた詳細、子ども側の確認テスト開始なし、まなぶから記録の一箇所へ、実20回答→保存Lv16→17→次の通常学習がPASS。準備を明示したnative隔離fixtureであり、子どもの自然な習得の証拠ではない。[log](ui-first.log.txt)・実行した[初回driver](ui-first.mjs)。
- [保護者の安定表示2ケース](parent-stable/report.json)：両幅PASS。[log](parent-stable.log.txt)。初回は文字のDOM準備直後に撮影して開閉animationの途中だった。元画像を保持し、800msの安定待ちを加えて撮り直した。画面の保存不具合とは扱わない。
- 既存classicの全31ケースはsmoke-closeoutに記録。最初は移動前の記録入口を使って失敗：[元log](smoke.log.txt)。新経路への修正時に独自assertをnode assertとして扱ったミス：[元log](smoke-final.log.txt)。本番の入口/guardを使うdriverへ修正して再検査。元の失敗はPASSへ上書きしない。
- [app/sourceとdistの照合](input-check.json)：実画面の開始終了で同じ入力。build revision `level-up-entry-20261003`、本番と同じGrowing/Island flags、実URL5286、root version/候補/音off/reduced motionは各reportに記録。今回のcandidateは `progress-level-up-v4`。

[接触シート](screens.html)で、記録→一つの入口→実回答→保存済み進級を確認。資源/準備のfixtureと実際の子どもの経験を混同しない。保護者の結果は同じfixtureの別の目的の画面として示す。

見た目/情報階層は作者が実画面で確認、runtimeは上記の対象範囲PASS。実機iPhoneと子どもの無説明理解/再訪/定着は未観察。本番へのcommit/push/公開確認はこの作業では行っていない。仕様06/29を同期した。

Final closeout: [classic smoke 31/31 PASS](smoke-corrected.log.txt). All 14 production UI cases and 2 stable parent captures passed.
