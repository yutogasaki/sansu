# 算数の自動採点とEnter案内

対象はStudyと共通解答フォーム（Island/Park）。教材全体で1桁が保証される12種類と筆算の段完了を自動採点し、可変桁・小数・分数・複数欄は手動確定を残す。正解一致・正解桁数・停止時間を使わない。

## 実画面と対象

- [主要経路のコンタクトシート](contact-sheet.html)：島→入力前→確定操作→次問、タブレット、再送、Study。
- [最終レポート](report.json)：phone/tablet 24ケースすべてPASS。空の専用プロフィールとMemoryのfixtureから実planner/input/writerを通す。
- [ビルド](version.json)：`auto-answer-local-20260908-r3:0d7a808c-0c5e-44e4-b73e-10f17a9c631b`。ローカルproduction preview `http://127.0.0.1:5316`。Island/BuildPlay flag有効、delivery `mystic-island-v1`、世界 `mystic-island-living-v5`、学習 `mystic-island-learning-v2`。公開デプロイではない。
- [固定したビルド入力](build-inputs.json)と[実行した検査](verified-runner.txt)を保持。元作業ツリーの並行変更を避けて別ディレクトリからビルドし、対象8ファイルの実行前後hashと最終作業ツリーを照合した。ブラウザーは各ケース新規context、SW block。実PWA更新/offlineの証拠ではない。

## 分けて判定する項目

- 見た目：作者による確認。Enterが必要なときだけ黄色の面・二重枠を表示し、自動採点時は薄い非操作状態。入力前後のキー位置は不変。周囲の光は1.2秒×2回、キー本体は点滅しない。reduced motionは静止表示。世界の魅力の再評価は行っていない。
- 無説明理解・安全：子どもの観察は未実施。説明文を増やさず、文字/音/動きがなくても同じ位置のチェックキーと枠が残る。入力停止で採点せず、正誤で確定条件を変えない。
- Runtime：24ケースPASS。自動正答/誤答、途中段、桁可変の手動確定、小数点途中、分数、同一イベント内連打/repeat、実native transaction abortと下書き再送、Studyの実保存を確認。手動確定後は同一起動・再起動後とも動く案内を停止する。既存の途中誤答ログと全問完了の学習証拠を区別した。

## 検証と限界

- `docs:check`、全体lint、typecheck、production build/assets checkはPASS。
- 全体テストは並行実行時に別作業中のヒント文言不一致とタイムアウトが発生。文言修正後、`npx vitest run --maxWorkers=2 --minWorkers=1`で221ファイル/2,463件PASS。
- その後の端末への案内記憶を含め、今回の入力/表示/記憶に関する8テストを再実行してPASS。保存拒否でも解答を止めず、専用キー以外を書き換えない。
- 既存E2Eの共通入力ヘルパーとParkのヘルパーを、最後の数字が自動確定操作になる契約へ更新。全release/PWA/fixed-tenの再測定はしていない。
- 仮説は、1桁と筆算で不要な確定操作を減らし、手動確定が必要な場面だけ目で分かることで連問を続けやすくすること。子どもの理解・再遊び意欲や学習効果は未評価。

初回の実画面で島のCSSによるEnter強調の上書きを検出し、共通キーの優先順位を修正。失敗したQA出力は`output/playwright/auto-answer-01`〜`07`に保持し、この最終画像へ混ぜていない。
