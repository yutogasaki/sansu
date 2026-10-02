# 記録の文字量と「おやすみ中」の修正

ユーザーの[実機画像](user-reference.jpg)と「文字が多い」「無効にした覚えがない」という指摘に対応。現在のレベル・内容名を大きく、次の範囲は1行にまとめた。練習・独力正解・型/語coverageは独立した短い数字として残し、条件・履歴・確認テストは1タップで開く。通常の単一科目カードは390幅で約444px、設定停止455px、しあげ準備済み484px。44px以上の操作と読みやすいしあげボタンを残すため、検査基準は500px未満とした。混合科目は狭い幅で縦、大きな幅で2列。

`syncLevelState` はメインを選び直すと上位を無効にする。現在のメインを再選択するボタンも押せていた。「無効にした覚えがない」状況をこの処理だけで再現できるが、実ユーザーの保存・操作履歴を読んだわけではなく、その端末での原因は断定しない。記録の曖昧な「おやすみ中」と操作した人を推測する説明は削除し、設定への入口にした。選択済みのメインは再度押せない。学習設定の明示操作と保護者確認で、解放済み・無効の隣接次レベルだけを再開できる。現在レベル・解放上限・履歴・準備と、それより上の無効設定を保持する。最新の本人/範囲を原子的に確認し、自動で有効化したり、しあげ資格を飛ばしたりしない。

正本は[画面仕様06](../../product/06_screen_specs.md)、[進級仕様29](../../product/29_learning_progression_spec.md)、親仕様01の5.2。元のぽこもこ、共有の紙・藍・青を使用し、新しいアートは生成していない。

## 実画面と対象

[接触シート](contact-sheet.jpg) / [全撮影の一覧](screens.html) / [実操作の結果](current/report.json) / [入力のSHA](input-manifest.json)。`current` は65撮影、5サイズ×7状態の35ケースがPASS。算数・英語の設定停止、未準備、準備済み、設定不整合、最高範囲、混合科目を区別。開閉をEnterでも検査し、横はみ出しなし。全store比較で説明の開閉・設定を見るだけ・保護者確認の取消が不変。再開後は隣接レベルのenabledとappData内のprofile鏡像だけが変わり、再読込でも保持。準備済みの実しあげ入口と通常練習入口へ進む。

対象は `http://127.0.0.1:5278` のGrowing/Island有効DEV、Nature Town無効、delivery `snap-root-v1`、root UI `whole-app-atelier-v1`、進捗候補 `progress-clear-v3`。root実revision `development-local`、version `development-local:4f08be1d-46b5-4188-a68c-d250bc607c38`。HEAD `893aef9920db8403b4b3c79abc212c27b83a7e96` に未コミット変更を含む。各撮影に実URL・root・viewport・candidate・寸法を保持し、app/QA入力を開始終了で照合。補足1,778入力の固定コピーは私有 `/tmp/sansu-progress-clear-frozen-inputs`、環境ファイルはSHAだけを公開し、内容はコピー内に留めた。

明示した使い捨てnative fixture。算数Lv16の準備は本物のgenerator/coverageルールで作り、停止は上位へメインを変えて16へ戻す処理で再現。実ユーザーの保存を変更せず、実学習による新規獲得や実参加者の理解を測ったものではない。DEVの新しい隔離ブラウザなので本番SW/更新/オフラインの証拠にはしない。

## 検証と判定

- [coreのログ](core.txt): docs/current入口/lint/typecheck、520ファイル・4,605テスト、Growing有効build/assets PASS。既存lint warning1件、既存の期限超過doc warning4件、buildのchunk警告は維持。
- [classic smokeのログ](smoke.txt): 31件PASS。flag-offの旧モード回帰で、現行島の視覚評価には数えない。
- [読み込み・読込エラー/再試行・再開保存の失敗/再試行](faults/report.json): native IndexedDBへの明示診断。通常の発生頻度や実機故障の再現とは区別する。
- 作者の視覚確認: 現在範囲を主役にし、繰り返す説明/枠/ゲージを除去。390/768と小縦・小横・desktopの実描画を確認。対象内GO。
- 理解/安全: 無効化した人を決めつけない、正解不足と設定停止を混同しない、条件と記録を保つ。実参加者N=0、子どもの無説明理解・再訪はHOLD。
- runtime: 上記の対象内PASS。実機iOS、公開URL、PWA更新・本番保存の確認と世界最高の認定は含まない。commit/push/公開は未実施。

## 診断記録

採用画像へ診断の画像を混ぜない。`diagnostic-startup` はQA用Vite configの関数を誤ってspreadして定数を落とした起動失敗。configの呼出しを修正。`diagnostic-density` / `diagnostic-spacing` は既定のSurfacePanel余白とgrid gapの重複を解消する前。`diagnostic-guard` は新しいランダム問題が表示される前にQAが直前の問題を読んだためで、effect後に現物を読むよう修正。`diagnostic-height-criterion` は現行の読みやすいしあげボタンが当初の475px基準を約9px超えた記録。基準を500pxへ更新して全35ケースを再実行した。

`diagnostic-loading-probe` / `diagnostic-read-scope` / `diagnostic-strict-mode` はQAの故障注入先の診断。初期プロフィール読込と進捗読込を区別し、DEV StrictModeの二度のeffectでも有効な進捗の読込を止める。appDataのnative get完了遅延は通常の読み込み面、進捗が実際にmountされた後の読込失敗は実エラー/再試行、再開のnative transaction失敗は実保存エラー/再試行として分けた。
