# あそびかたのUX改善 — 2026-10-02

通知から達成した記念を直接開く。スターター中は次の一手を一つ、遊びを選んだ後はその詳細を主役にし、ほかの候補は任意に開ける。達成ページは固定snapshotの旗・屋根・育った場所を大きく見せ、他の記録は小さく並べる。普通の入口は「ためしてみる」、通知は対象の「できたこと」。本を開いた通知は再表示しない。

[実画面の一覧](screens.html) / [結果](checks.json)。基準は[前回の実画面](../2026-10-01-island-guidance/fixes.html)。390×844と768×1024の実画面で、導入の主操作が候補と競合しないこと、記念の主役と「この場所へ」が見えることを作者が比較した。独立した子どもの理解・魅力・翌日の再訪の証拠とはしない。

## 検証した入力

mainの5987adeeを基に、この通知・本・表示とQAだけを切り出した固定コピー。別のバランス・メニュー作業を含めない。各reportにapp/source/dist/QAの開始と終了SHA、実root/build revision/version、delivery、candidate、cache状態を記録。DEV 5268、本番形式5269。DEVは音OFF、tabletはreduced motion。本番形式は既定の音設定。実機と実two-build更新は別。

- [core](core.log.txt): docs/lint/typecheck/515ファイル・4,576テスト/build/assets PASS。既存の期限警告4件とFast Refresh warning1件。
- [DEV](final-dev/report.json): 両幅の新規の実学習・初回の一手・通知から該当の記念へ直行・色と移動・有料種・同予約の再開。旧保存と資源豊富な演奏/土地は明示fixtureの別ケース。例外なし、入力SHA一致。
- [家](final-house/report.json): 両幅の直接入口/メニュー、閉じる/reload、読書前後の本人保存・7学習store不変、未準備の目標保存、別タブの実操作の反映、本人の記念と実学習3回答後の同予約再開。入力SHA一致。
- [本番形式](production/report.json): 初回設定から通常の実回答、購入/配置、家の本、実SW offline再起動、記念と所有/予約の保持。DB注入なし、app/dist/QAの入力SHA一致。
- [classic smoke](smoke/smoke-report.json): 31件PASS。

## 診断と中断

`dev`/`house`は初回サーバーでLife flagがなく旧Islandを開いた接続失敗。Growing/Life両flagを有効にした。`dev-accepted`/`house-accepted`は当時の共有作業全体の固定入力で、家はPASS、全体の学習再開はloading画面でtimeout（例外・console errorなし）。[共有入力のcore](attempts/shared-snapshot-core.log.txt)には別のmenuMiniaturesのcache回帰1件があり、今回の機能の合否へ読み替えない。`production-first`はスマホの実SW offlineまでPASS後、tablet初回のブラウザー撮影protocol error。実描画フレームを待ち、同じ撮影だけ一度再試行するQAにして新しい結果へ再実行した。撮影の再試行があれば最終reportのcaptureRetriesに残す。`candidate-dev`/`candidate-house`と[core](attempts/interrupted-core.log.txt)はユーザーの中断で終了し、完了判定に使用しない。最終の固定候補で必要な旅程を再実行した。失敗や部分記録を上書きしていない。

## 文書と評価の境界

UI・通知の行き先と提示優先度の変更。正本の導き仕様を先に更新した。保存形式、時計、費用、成長、学習の出題/採点/予約、ぽこもこの造形は変更不要。ADR・wiki memory・保存移行の追加は不要。

視覚の主従は作者の比較で改善。無説明理解・安全と再訪の利用者評価はHOLD。runtimeはここに記録したブラウザー旅程の範囲でGO。実機・更新・製品全体の最高UXの合格を推定しない。
