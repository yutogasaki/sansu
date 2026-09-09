# 島のチュートリアル検証

## 対象

[仕様46](../../../product/46_island_tutorial_spec.md)。自動案内4種と任意7項目のあそびかた。今回の変更は案内・新規プロフィールの任意フラグ・案内用localStorageで、学習／成長transactionには追加しない。

## 検証範囲

- 専用ハーネス: `node tools/e2e-island-tutorial.mjs`。空DBから実初回設定、実3問、自動継続、帰島、成長／眺め案内、実カメラ操作、着せ替え／遊び、見直し、同予約復帰を390×844・768×1024で検査する。末尾の旧プロフィールだけは明示native fixture。productionでSW制御がある場合は実offline/reload/見直し/同予約復帰も確認する。
- 単体: `src/domain/island/tutorialState.test.ts`。案内の優先、既存プロフィールと学習の除外、プロフィール分離、単調イベント、保存拒否時のメモリ継続、削除の分離。
- 今回の初回案内はプロフィール追加時の明示フラグで識別する。過去の利用状況から推測しない。

## 最初の失敗と修正

- 初回のハーネスが存在しない「拡大」というボタン名を使った。実UIの「しまを おおきく」へ修正した。元の失敗は `output/playwright/tutorial-1788951996665`。
- 遊びの結果文が別画面の案内まで抑止した。抑止を遊び画面内に限定し、見直し開始時は既存の遊び選択を解除する。
- 帰島直後の発見保存で表示が退き、その訪問の案内が消費済みになった。背景保存中は同じ案内を保留し、保存後に戻す。退出・学習・背景化では終了する。修正前の実状態は `output/playwright/tutorial-1788952469680/390-failure-state.json`（成長は保存済み、案内shownだけが残る）。

## 判定

全体の受入はPARTIAL。作者の実操作は子どもの理解や継続意欲の証拠ではない。共有作業ディレクトリでは別のチャレンジ／DB更新が並行しており、全体チェックの版と結果をこの変更の単独結果と混同しない。

## 実行記録

- 関連42テスト（案内の単調保存5、hookの中断／保留／見直し6、ナビ11、初回設定20）はPASS。hookは既存の制御可能なReact hookテスト方式による診断で、実ブラウザの代用とはしない。
- 最初のDEV実操作は390/768の両幅で初回設定→実3問→成長→カメラ→見直し→同予約復帰がPASS（`output/playwright/tutorial-1788952060939/report.json`）。その後の案内中断修正前の結果であり、最新版の全経路PASSへ転用しない。
- 島有効Vite production buildはPASS。別ディレクトリのclassic productionで `e2e:pwa-update` の4ケースはPASS。
- 全体テスト初回は3330件PASS／6件FAIL。並行追加のDB v9と旧期待値・削除用mock／transactionの不整合。二回目coreは型検査までPASS、全テスト中に共有ソース更新と多数の並列実行が継続したため、約12分でこの実行のみ停止した。全体PASSではない。
- smokeは探索のroot tangleの文言待ち、島ハーネスは成長後album待ち、島PWAは旧プロフィールhome待ちでFAIL。今回の案内の原因と断定せず、共有ディレクトリの未解決結果として残す。
- 固定10問は固定source manifest必須で実行前に停止。変更が続く共有ソースを凍結済みと偽らず、未測定とする。
- 最新productionの初回経路は、並行追加された学習leaseで、単一の新規プロフィールでも「ほかの がめんの まなびを とじてから」と表示され、学習予約前に停止した（`output/playwright/tutorial-1788952686488/390-failure.png`）。チュートリアルはまだ表示されていない。初回学習・offline・固定10問の最終受入は保留。
- 最終docsチェック時は別タスク `docs/tasks/active/2026-09-09-english-listening.md` のReview By欠落でFAIL。今回の仕様・監査リンクとは区別する。

## 再検証の入口

通常学習のleaseと共有ソースが安定した後、`SANSU_TUTORIAL_URL` に固定productionを指定して `node tools/e2e-island-tutorial.mjs` を実行する。専用ハーネスには、実初回と旧プロフィールfixture、背景保存の自然発生、プレビュー／遊び、別タブの無関係なstorage通知、同予約と学習ログ不変、SW制御時のoffline検証が含まれる。

学習経路から独立した画面確認は `node tools/e2e-island-tutorial-ui.mjs`。明示プロフィールfixtureを使い、成長・回答を捏造せず、7項目の見直しと自動3案内を確認する。これも初回学習の合格には転用しない。


## 最終の静的確認と画面

型チェック、今回のファイルのlint、島有効production bundle、同bundleへのasset checkerはPASS。asset checkerは固定出力を別ディレクトリのdistへリンクして実行し、別タスクのdistとは混同しない。precacheは94ファイル・10.50MiB／12MiB。

別タスクのReview Byが補完された後の `docs:check` はPASS（既存の期限警告のみ）。直前のFAIL記録は上記に保持する。

[実画面の比較](contact-sheet.html)は最新DEVで、音off・reduced motion・明示プロフィールfixtureの画面。視覚は作者確認で案内／操作／まなぶの共存を確認、子どもの無文字理解・意欲は未評価（Human N=0）、runtimeの全体受入は上記の理由で保留。強い視覚評価で未検証の学習経路を補わない。

最終UI診断は両幅でPASS（`output/playwright/tutorial-ui-1788953156612/report.json`、[記録](ui-report.json)）。明示プロフィールから自動3案内、実カメラ操作・きせかえプレビュー、7項目すべての見直しと戻り、横溢れなし、回答ログ0・成長0の保持を確認した。報告JSON内の全PNGは元outputディレクトリにあり、上の比較には代表4画面を保存した。

最終の案内専用11テストもPASS。新しいhookの中断修正を含む。関連の初回設定・ナビを合わせた42件のPASSと、全体受入PARTIALを区別する。

## main反映前の分離検証

共有作業ツリーからチュートリアル分だけを取り出し、`1f65ef5` を基点とする独立作業ツリーで検証した。関連41テスト、型チェック、変更したUI/チュートリアルのlint、書き出したコミット対象のdocs検査、Island本番buildとassets検査はPASS。41件は他作業のchallengeテストを含まない。PWA precacheは94ファイル、10.46 MiB。以下の画面証拠と先行のE2E結果は共有作業ツリーで取得したもので、分離したコミットのE2E合格を意味しない。mainのカメラ修正 `c437e49` を取り込んだ後にも関連テストと型チェックを再実行する。全体受入は引き続きPARTIAL。
