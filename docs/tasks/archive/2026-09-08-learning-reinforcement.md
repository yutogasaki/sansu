# 学習強化の実装

- Review By: 2026-09-15
- 状態: ローカル実装・必須検証完了。
- 目的: [仕様34](../../product/34_learning_reinforcement_spec.md)の独力正答、再学習、実時間復習、Lv11確認、英語復習予算を実装する。

## Docs To Touch

親仕様01、仕様29/31/34、docs/index、ownership、memory、verification matrix、月次done。

## 実装

- 文脈の一致する全問の独力正解をraw正答と別に集計し、算数の導入・進行、英語の未正解語優先・coverageへ使用。訂正・支援・筆算の途中正解・unknownを昇格用の独力証拠へ足さない。
- SRSは回答時点から1/3/7/14/30×24時間。卒業statusと再学習を分け、卒業後の失敗や期限到来を通常Dueへ戻す。同日訂正で再学習を解除せず、24時間後の全問独力成功から最大strength2で再確認する。
- Lv11の19スキルを7単元と必要な型で評価。過去の遅延成功、現在の期限、再確認を分け、新規予約と新しい進行条件へ反映。同概念を別の表現で直前練習した場合も接触として扱う。
- 英語Due滞留時は区間の最大半分まで復習枠を増やし、mainを残して+1を抑える。短い区間のprefix、重複回避、英語だけの復習率、島のDue巡回を保持。
- Exploreは新予約の独力/訂正識別と保存済みgate・試行番号を照合。Studyは新予約時に筆算/暗算の実表示を確定し、既定の筆算でも正しい独力証拠を保存。表示後の方法変更はunknownとする。
- 算数118/英語1,184の保存ID・保護者範囲・既存の主レベルと解放を維持。保存済み問題を差し替えず、旧ログから独力実績を推定せず、一括移行・降格をしない。

## 固定ソースと範囲

- HEAD: `9300ea0b5e965a4ca4d6679fc3cf85ba9ec10aa5`。
- 最終学習候補: `58932f239a0d160e6cc7db587432a8f4a9ba3d1d50acb5653ccd796cc29e4015`、779入力。manifestは `output/learning-reinforcement/final/build-source.json`。
- build revision: `9300ea0b5e965a4ca4d6679fc3cf85ba9ec10aa5-learning-58932f239a0d`。
- 固定ディレクトリ: `/tmp/sansu-learning-reinforcement-verification-v3`。先にcoreを通過した共有状態に、この担当のStudy修正を全て加えた固定コピー。後から進行している別担当のIsland拡張v5を認定範囲へ含めない。共有workspaceの既存差分を保持する。
- classic: Island=false / Park=false / classic-v1。Park: Park=true。Island: Island=true / Park=false / snap-root-v1、実候補 `mystic-island-living-v4` / 学習 `mystic-island-learning-v2`。
- 初期候補 `b7f592b4…` はStudy自動筆算修正前。中間候補 `d876bdc4…` は別担当の進行中の拡張移行を含みtypecheck失敗。原ログを保持し、最終候補の成功へ混ぜない。

## Verification

| 対象 | 結果・証拠 |
| --- | --- |
| core | PASS: 183ファイル、2,141テスト、docs/lint/typecheck/build/assets。`final/core.log` |
| classic/Park/Island build | PASS: `final/build-checks.json`、各buildログ |
| classic smoke / PWA | PASS: 31 / 4ケース。`final/smoke.log`、`classic-pwa.log` |
| Park / Park PWA | PASS: 通常6ケース、PWA3ケース。`final/park.log`、`park-pwa.log` |
| Study実画面 | PASS: phone/tablet、筆算ON/OFF、add/sub、訂正、表示後の方法切替、14ケース。`final/qa-v2/report.json` |
| 単元レポート | PASS: catalog問題0、合成7シナリオ。`final/unit-report/`。実学習者データではない |
| Island通常 / PWA | PASS: 成長25区間×phone/tabletは初回の固定版で確認済み。成長以外10ケースの再検証とPWA7・実SW offlineを通過。`final/island-exclusive/`、`island-pwa/`、各ログ |
| 固定10問80run | PASS: 80run・15gate、`evidence.eligible=true` / `pass=true`。`final/throughput-02.json`、`throughput-02-processes.json`。30秒連続静穏後に開始、5秒間隔の監視で競合0 |
| 学習実装の共有状態との照合 | PASS: 191ファイル中190一致、説明済みQA-v2 runnerだけ相違。学習実装の欠落・未説明差分0。`final/learning-source-audit.json` |
| 固定ソース最終照合 | PASS: 779入力の変更0。`final/source-final-check.json` |
| 共有workspace core | PASS: 188ファイル、2,188テスト、docs/lint/typecheck/build/assets。`final/workspace-core.log`。後続の他担当差分も含む現在の統合状態で実行。固定版の画面/速度証拠とは範囲を分ける |
| 終了docs / diff | タスクのarchive・月次done・共有queue/indexを同期し、docs:check / git diff --checkを確認 |

上記の `final/` は `output/learning-reinforcement/final/` を指す。

## 検証で判明したこと

- Studyの既定の自動筆算では生成時のsymbol文脈と実入力が食い違い、全問正解もunknownだった。新規予約へ実表示を保存する最小修正を追加した。親の筆算OFF、訂正、表示後の切替、旧予約・テストの互換性を確認した。
- Study E2Eの初回はphoneで非表示のdesktopボタンを選び失敗。アプリを変えずvisibleな実操作へQAを修正した。実行QAは `final/qa-v2/e2e-learning-reinforcement.mjs`、SHA-256 `d9b0426f864dbc6b13e6d2073836a64726820ab7350d98792b2a95037dc5f529`。固定appとQA改訂をreport内で分け、14/14通過。最初の失敗reportも保持した。
- Island初回はphone/tablet各25区間、WebGL喪失/復帰、初回設定、phone-keyboardを通過し、phone-touchのcorrect-to-input P95が1,406.9msで650ms基準を超過。失敗時の個別標本が保存されず原因を断定できない。`final/island.log`を保持する。
- 直後の再試行は他スレッドのsmoke/island-livingの同時実行を検出して自分のbrowserだけ停止。`island-retry-interruption.json`へ記録し、速度の結論に使わない。負荷のない開始を待った再試行を別成果物へ保存した。

- 同じ固定app/QAで成長以外の10ケースを再検証し、全件PASS。phone-touchのcorrect P95は237.9ms、wrongは185.6ms。`SANSU_ISLAND_SKIP_GROWTH=1`は既に同版で通過した成長25区間×2の重複を省く既存のQA機能。実行途中に別担当のthroughputが始まったため、競合記録を保存し、この診断時間を独占した正式速度証拠とは扱わない。初回の原因は未確定で、appや650/550msの閾値を変更していない。

- 最初の固定10問は開始後に別担当のVitestを検出し、自分のbrowserだけ停止。`throughput-01.json`、`throughput-processes.json`、`throughput-01-interruption.json`を未完の診断として保持。連続30秒の静穏を確認した再実行を別の`throughput-02`成果物へ保存し、80run・15gateと監視の両方を通過した。

## 固定10問の集計

| P95 / 比較 | phone | tablet |
| --- | --- | --- |
| 正解後の次入力 | 195.0ms | 195.0ms |
| 誤答後の再入力 | 195.1ms | 193.7ms |
| 区間境界 | 193.7ms | 194.3ms |
| 島 / Studyの全問正解throughput比 | 2.327 | 2.238 |

各viewportで正解200標本、誤答20標本、境界20標本。問題間の追加操作0、空入力への切替、保存receipt、同じ実build/candidate、開始終了source一致を確認。自動キーボードによる固定問題のUI処理時間で、子どもの解答速度・実機・通常plannerの出題真正性の評価とは分ける。通常plannerはStudy14ケースと通常Island/Parkの別証拠で確認する。OS全体の負荷を制御した実験ではなく、別のnode E2E/build/testとbusyなheadless browserを監視して重複がなかった範囲の記録。

## レビューと限界

SRS、単元/進行、英語、実表示の担当レビューを実施し、見つかったExploreとStudyの文脈欠損を修正した。新しい前提単元の一括関門や既存レベルの降格は追加していない。新しい列・indexが不要なoptional fieldなのでschema移行は不要。仕様と運用資料を同期し、子ども向けの難易度・失敗を責める表示は追加していない。

3別問、24時間、1/3/7/14/30日、昇格の30回答・17/20は製品の設計値であり、最適値の実証ではない。旧ログの証拠不足では再確認が増える可能性があり、家庭での助言は判別しない。後日の正答率・復習負担・再遊びへの効果、Safari/iOS実機は未評価。commit/push/deployは実施していない。

終了時の警告は既存の過去Review By、IslandMilestoneのfast-refresh export、build chunk size。エラーは0。固定版の原失敗・中断と最終成功はそれぞれ残し、`output/learning-reinforcement/final/verification-summary.json`に範囲別の採用証拠を整理した。
