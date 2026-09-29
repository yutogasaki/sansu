# 学習の現在地と次の目標

2026-09-29。ローカル実装。公開操作は行っていない。

[実画面の一覧](index.html) · [画面仕様](../../product/06_screen_specs.md#学習進捗の見える化2026-09-29) · [固定ビルド情報](build-summary.json) · [実行結果](runtime-report.json)

## 変更

- 記録先頭の科目別「つぎへの道」に現在/次の内容、解放・昇格の各条件を表示。古い20回答の量だけのバーを撤去。
- 算数の非復習30回答/直近20回答の独力85%、英語の独力70%語数、Lv11の7単元coverageを現行の証拠に合わせる。算数の判定は既存boolean関数と表示で同じ集計を共有し、閾値を変えない。
- 保護者が止めた次範囲、最高レベル、旧独力記録欠損を区別。過去の独力成功日時と現在の復習予定を別に示す。
- 学習に内容と段階の一行を追加。保存済みの解放/昇格に限り5秒の通知。初回/再読込で再通知せず、音を使わず、入力を遮らない。ヒント使用中を独力と呼ばない。
- 任意の「しあげチャレンジ」は既存の20問テストへ科目付きで接続。保存済みの自動テストがあれば、その範囲を案内。レベルアップの必須条件にはしない。
- 保存schema、SRS、出題順、報酬、既存の結果履歴は維持。記録集計は学習overlay中に読まず、戻ったときに更新する。

## 検証と対象

共有作業コピーの `verify:core` は484 files / 4,293 tests、docs/lint/typecheck/build/assets PASS。最後の通知文言・ヒント表示・overlay中の読込抑制後も、対象lintと固定ソースのtypecheck/build/assetsを確認した。既存の別作業（解答フォーム/共通UI等）が同時進行中のため、単独commitの検証とは区別する。固定入力のhashとGit基点はビルド情報を参照。

進捗と昇格の対象28 tests PASS。独力証拠なしの旧回答、量だけ達成、Lv11 coverage、支援/復習/スキップ/別本人の除外、英語の語数、親設定、最高レベル、初回や別教科/別本人の通知を検査。

本番用の固定ビルド（Island/Life有効）で390×844・768×1024の記録→通常学習→実回答による解放→記録へ戻る→科目付き20問テストの入力画面を検査。音OFF、tabletはreduced motion、テンキーの全ボタンがviewport内、pageerror 0。解放直前の19回答窓は使い捨てfixtureであり、初回19回答の実獲得を証明しない。画像に本番ユーザーの保存データは含まれない。

DEV最初の検査では候補IDがmain/sectionの2要素に一致し失敗。検査側の対象をsectionへ限定して再実行。テスト遷移の画像待機も、URLだけではなく実際のStudy問題DOMが出るまで待つよう修正した。固定ビルドを作る際の参照素材のコピー漏れは補完してbuildを再実行。初回失敗ログを上書きしていない。

## 体験の判定

- 見た目：実画像で内容・条件の階層と入力領域の維持を確認。独立した美術採用や新しいキャラクター評価は実施していない。
- 理解・安全：誤答で過去の達成を消さず、日数/残り問数による昇格を約束せず、色や音だけに依存しない。子どもの無説明理解・再遊び意欲は未観察。
- 実装：上記の自動検証と実ブラウザ検証の範囲で確認。実機iOS、実参加者の動機づけ効果、公開版確認は別。

## ローカル検証の置き場所

固定アプリ入力は `/tmp/sansu-progress-root` が示すシステム一時ディレクトリの `build-source.json`。本番画面の元画像/詳細は `output/playwright/progress-visibility-production/`、初期DEV検査は `output/playwright/progress-visibility/` と `output/playwright/progress-visibility-v2/`。これら一時ファイルを配布物とはしない。

### 回帰検査の補足

- `e2e:smoke` PASS。記録から20問テストを最後まで進めて結果から記録へ戻る既存旅程も通過。
- classic専用ビルドの `e2e:pwa-update` PASS。初回・保護中のrouter・同一routeのcheckpoint・SW制御下のversion driftを確認。
- Life無効の旧島回帰はphone47区間/tablet49区間の実学習、4地区成熟、履歴/再演/保存、WebGL喪失と復帰、初回学習がPASS。その後phone-keyboardの正解後P95が841.5msで650ms上限を超え、全体runはFAIL。変更せず同シナリオを単独実行すると正解後217.3ms（21 samples）、誤答後202.6msでPASS。初回FAILを削除せず、原因を断定しない。
- `e2e:island-pwa` は既存の期待候補名 `mystic-island-learning-v2` と実際の `pokomoko-pop-live-v8` の不一致で停止。隔離コピーだけ期待名を更新した診断も、開始直後の保護sessionで更新reloadを検出して停止（`island-fresh-checkpoint-session`）。製品のPWA/routeコードは変更せず、追加検査は未通過として残す。本変更が原因かどうかを断定するbaseline比較は実施していない。

旧島の元reportは `output/playwright/progress-legacy-island/report.json`、単独再検査は `output/playwright/progress-legacy-keyboard/report.json`。PWAの元reportは `output/playwright/progress-island-pwa/report.json`、隔離した候補名補正診断は `output/playwright/progress-island-pwa-current/report.json`。本番用Lifeの進捗旅程の証拠と混同しない。


### 固定問題の反復比較

[速度比較の要約](throughput-summary.json)。同じ固定入力でphone/tablet×通常/誤答×Study/Island×10反復の80 runs。`evidence.eligible=true`・`pass=true`、全15 gates PASS。正解後P95は両幅202.3ms、誤答後201.5/201.9ms、区間境界202.2/202.4ms。通常時の回答数/分はStudy比2.348/2.343。追加操作0、入力残留0、browser error 0、開始終了のsource一致を確認。

固定fixtureの自動キーボード検査であり、通常planner真正性は別の実回答旅程、実参加者の理解・速さ・意欲は別の観察とする。元reportは `output/playwright/progress-throughput/report.json`。この成功を旧島の最初の長時間runの841.5ms超過やPWA追加検査の未通過の取り消しには使わない。


英語のDEV実画面でも「0 / 42語」の進捗と科目付き確認テストへの遷移、保存されたvocabテストを確認した。[英語の記録画面](english-record.png)。独立した進捗読込障害のUI検査は、試みたquery差し替えで期待したalertを再現できず未確認。これをエラー/再試行のブラウザPASSとして数えない。製品側は失敗時の案内と再読込ボタンを実装している。


## 2026-09-29 追加確認

[追加検証の要約](followup-summary.json) · [本番の読込エラー](live-390-read-error.png) · [再試行後](live-768-read-recovered.png)。製品コードは変更せず、検査コードと証拠を補完した。学習進捗のcommit `ede295fe` が公開先のversion.jsonに一致することを確認。公開ブラウザの使い捨てプロフィールで390/768幅の記録→実回答→解放→科目付きテストを通過した。実ユーザーの保存は操作していない。

旧島PWA検査の期待画面名を現在の `pokomoko-pop-live-v8` へ更新。学習開始はrouteのmodeだけではなく入力準備完了まで待ち、予約・checkpointの非同期処理が終わってから保護中の更新を投入する。これにより8つの保護フロー、実SWのoffline回答・自動成長・再起動がPASS。アプリ更新処理の不具合とは確認されなかった。対象は前回の固定legacyビルドであり、Life本番版の検査とは分ける。

実commit `44d5c4eb` と `ede295fe` をそれぞれ隔離exportし、公開と同じIsland/Life/Discovery/Fantasy=true、Life preview/NatureTown=falseでbuild。異なる実SWへ更新する通常ケースと、SWを旧版に固定→更新検知後切断→offline再開→再接続するケースが両幅でPASS。実初回設定・学習・花購入・途中回答から開始し、全native store・Life所有・次の問題を保持。保護中のreloadなし、checkpointで1回reload、新版でoffline再開を確認。ビルドのrevisionラベルは診断用だが、入力は上記commitのexport、dist全hashは実行前後で一致した。実機iOSの証明ではない。

進捗の読み込みエラーは、起動/プロフィール取得が済んだ後、学習から記録へ戻る際の `memoryVocab` 単独readonly transactionを明示的に失敗させた。「読みこめなかったよ」→実再試行ボタン→最新進捗の復帰を両幅で確認。以前のquery差替えはページ再読込やDexieのtransaction束縛で有効にならず、広い障害注入はプロフィール取得まで失敗させたため、成功証拠には数えない。今回の検査は全DB障害や初回ロード障害の保証ではない。

### 人が確認する残りの範囲

- 実iPhone/Android：ホーム画面から起動し、記録→学習→記録→しあげを操作。文字・入力・戻る操作を確認し、機種/OSと公開versionを記録する。
- 子どもの利用観察：説明前に「いま何を練習している？」「次は何ができそう？」を聞く。答えを誘導せず、迷った箇所と自分から続けたかを記録する。
- テストを必須や不合格の判定と受け取っていないか確認する。1回の観察から学習効果や動機づけ効果を断定しない。

これらの参加者・実機はこの作業環境にはなく、未実施。ブラウザでの技術確認と混同しない。
