# 国語監査4件の修正・検証

2026-10-26。対象は[前回監査](../2026-10-26-kokugo-audit/findings.json)の KOKUGO-A01〜A04。ローカル確認画面は http://127.0.0.1:5289/#/kokugo 。公開・commit・pushは行っていない。

## 修正結果

|指摘|修正と確認|
|---|---|
|A01 お題変更後に別の下書きを上書き|非同期読込結果に作品IDを付け、一致する本文の読込後に編集・保存を許可。3お題の切替・別本文保存・再読込で保持を確認。|
|A02 熟語の読みを単漢字の音訓として出題|教材の実際の表記と接触履歴の同一性を分離。「桜色」「頭の上」は語句の穴埋めとして出題。全出題の音訓表示をデータと照合。|
|A03 H06のお手本直後を自力正答として記録|メニューで表示する川・花・空の字形接触を、表示前に一括保存。R/T/Sの9行で24時間共有。表示していない語や読みの接触は増やさず、直後の正答が支援ありになることを確認。途中失敗のrollbackと本人・予約の保存境界も検証。|
|A04 文脈に合わない別読みを正答にする|多義語を含む11場面に許容読みを明示。「何人来るか数える」では「なんにん」を使い、「なにじん」は自力正答にしない。文脈なしの語では既存の別読みを維持。|

新しく予約する漢字教材は `kokugo-kanji-3`。項目・作品・接触履歴のID、DB形式は維持した。既に予約済みの問題は出題文・許容読みを凍結したまま保持するため、修正内容は次の新規予約から適用する。過去の作品・学習事実の書換えは行わない。

## 対象版

- 修正元 `editorial-f80f926967d3` → `kokugo-fix-1087d7bd1ad6`。
- 入力hash `1087d7bd1ad6ae486af7c9f44daa512a26224f86c34c178c45f02df10635a602`、固定候補3,549入力。[入力一覧](inputs.json)・[整合検査](input-integrity.json)・[配信版](served-version.json)。共有作業場の国語関連64入力とも一致。
- 既存の国語確認版へ今回の修正だけを重ねた固定候補をbuild・検証・配信。並行中の島・ポータルの変更はアプリ候補へ混入させていない。合成プロフィールで検証し、実利用者のデータには操作していない。
- delivery `snap-root-v1`、visualLineage `pokko-field-v1`。今回の変更は教材・保存・接触判定であり、美術採用の変更はない。各画面の実行版・候補・幅はreportのmetadataに保持。

## 検証

各コマンド・結果・日時の詳細は[検証一覧](verification.json)、ログは `logs/`。以下は同じ固定候補に対する結果。

|確認|結果・証拠|
|---|---|
|build / tsc -b / assets|PASS。precache 173ファイル・9.30MiB、予算12MiB内。|
|lint|PASS、エラー0。国語外の既存warning 4件。|
|国語unit|6ファイル56件PASS。新規6件には読込のUI再現とは別に、出題・接触・rollback・凍結予約の回帰を含む。|
|全体unit|初回670ファイル・5,647件中5,646件PASS、学習進級の既存1件が15秒timeout。同じ入力・同じ制限で該当ファイル12件を再実行しPASS。修正前候補でも12件PASS。分割実行で全件を確認したが、初回全体を無失敗とは扱わない。[初回と再実行の対応](unit-suite.json)。|
|教材の機械校閲|[問題0件](materials.json)。1,026字・2,052語・2,052場面、graded 372件・活動15件・本6冊。人による専門校閲完了の判定ではない。|
|今回4件の実画面回帰|[320 / 390 / 768幅すべてPASS](regressions/report.json)。お題切替・保存・再読込、H06接触・直後判定、熟語出題、文脈別読み。スクリーンショットを同じフォルダに保存。|
|既存漢字旅程|[3幅PASS](kanji/report.json)。保存・音声12件・offlineを含む。|
|実2 buildのSW更新|[3幅PASS](update/report.json)。修正前から更新し、予約・作品・学習事実・報酬・別タブ本人削除・offlineを確認。|
|標準smoke|[31/32](smoke/smoke-report.json)。旧Exploreの物理入力が期待「10」に対し「1」。[対象再実行](smoke-retry/smoke-report.json)と[修正前候補の対象実行](smoke-baseline/smoke-report.json)はPASS。[修正前の同じ失敗記録](../2026-10-25-kokugo-kanji/diagnostics/smoke-final-details/smoke-report.json)もある。断続的失敗を残し、全体PASSに読み替えない。|
|docs / 旧索引|`npm run docs:check` と `node tools/generate-agent-index.mjs --check` はPASS。既存タスクの期日warningを保持。|
|portal / 統合入口|Node24.18.0で既存のflow evidence staleにより停止。対象は `docs/tasks/active/2026-09-27-living-fantasy-first-playable.md`。別作業の入力hashは書き換えていない。|

国語外のExplore入力の断続的失敗と、ポータルの証拠不整合は未解決。人の国語専門家による採用校閲、音声実聴、実機インストール、子どもの理解・定着・再訪、公開版は未確認。自動検査をこれらの合格には読み替えない。
