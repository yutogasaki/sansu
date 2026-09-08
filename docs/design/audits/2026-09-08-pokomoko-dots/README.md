# ぽこもこの水玉背景 — 不採用になった平面模様の履歴

細かい点は「可愛さがない」、後続の大きなパステル版は「かわいすぎる、ファンタジーが欲しい」とユーザーが方向修正。最終採用/現在の背景承認の根拠として使用しない。[次の3方向](../2026-09-08-pokomoko-fantasy/review.html)で空間と素材を比較中。

[実画面の比較](review.html) · [26画面の識別](capture-manifest.json) · [往復検査](ui-report.json)

## 採用方向と実装

ユーザーの「紫というか、不思議な水玉バックグラウンドとか。草間彌生みたいな？」を受け、単色のラベンダーから白い布地と大小の水玉へ変更。濃い藍を中心に、少量の青・ピンクを混ぜ、丸の直径と間隔をずらす。ヘッダー、設定カード、問題と入力、ナビは無地のまま読む。くまとワッペン・名前は前回を継続。

36個の円を持つ1,828byteのSVGをCSSへ埋め込み、静止した装飾背景として反復。画像生成や外部作品の取り込みはない。追加の通信・DOM・hit layer・アニメーションなし。設定のリセットボタンには無地の面と文字の濃さを与え、背景の丸がラベルを横切らないようにした。

親01・UI07・島28・MASTERを先に同期。変更は共通CSS、背景の基底色とtheme metadata、リセットbutton class、候補識別のみ。学習ロジック・ルーティング・保存・3D・回答の意味色を変更せず、他作業の島と学習の変更を上書きしない。

## 実画面の対象

- 固定コピー `/tmp/sansu-pokomoko-world`、基準commit `463508f`、revision `pokomoko-dots-463508f-v1`。
- 実production preview `http://127.0.0.1:5374/`、`VITE_ISLAND_ENABLED=true` / BuildPlay false。共通候補 `pokomoko-dots-v1`。Island `mystic-island-living-v5` / learning `mystic-island-learning-v2` / resident `patchwork-otter-v1`。
- phone 390×844 touch・通常motion、tablet 768×1024 reduced motion。往復検査22画面＋空プロフィールの初回4画面。全26画面を同じ実versionで撮影。
- [固定入力810ファイル](source-manifest.json)と[担当8ファイルの統合一致](merged-source.json)を保存。前回のrevisionや他作業の共有workspace全体の認定と混ぜない。

## 別々の判定

| 観点 | 判定と限界 |
|---|---|
| 見た目 | 作者の実画面比較では、単色紫から水玉が広がる背景へ変化。模様の大小と黒に近い藍で、くまの水玉耳とつながる。ユーザーの最終採用・子どもの好みの実測ではない |
| 理解・安全 | 操作ラベル、カードと問題面、44pxナビ、戻る/保存を保持。水玉は動かず、キー・数量図形へ重ねない。独立した子ども観察はN=0 |
| Runtime | Productionのphone/tablet往復・保存・入力再開・横溢れ検査PASS。新規初回の名前と背景も確認。今回の背景変更に限定したローカル確認。前回の連続回答速度未達は解消/再認定していない |

## 検証

- lint/typecheck/build/assets PASS。lintは過去の生成済み `dist-island/` のみ除外し、app/QA sourceのルールは変更していない。PWA precache 10.23MiB / 12MiB。SVGはprecache対象CSS内に入る。
- 全194ファイル・2,232 unit/integration tests PASS（tests.log（`tests.log`））。既存assert/timeoutを保持し、並列数2で実行。この全件検査後、一覧比較で初回設定がdata-modeを持たず背景の適用外と判明し、共通CSSのセレクタを1つ追加。動作コードを変えず、v2でbuildと全26画面の検査を再実行した（この比較ページの画像はv1のまま）。その後、大きいパステル版もファンタジー不足としてユーザーが方向修正した。
- Production UIは初回、島、学習、設定の開閉、記録、通常練習への復帰、明示復習/テスト、他ゲーム、reloadを確認。実予約の問題・cursor・支援・報酬・ログを往復で照合しPASS。捨てられるnativeプロフィールfixtureを使い、実児童の参加とは区別。
- 最初の仮撮影では前回DEVの5370が終了しておりconnection refused。新しいproduction preview5374を起動して撮影。コードやassertの緩和は不要だった。
- 以前の[速度未達](../2026-09-08-pokomoko-world/throughput-report.json)は残存し、今回は固定10問を再実行していない。画面の模様変更を根拠に公開速度の合格を主張しない。

## 統合先の検査範囲

固定コピーのdocs/typecheckはPASS。共有workspaceの再検査では、別作業の `sharedJobController.ts` に未使用import2件とMesh/SpotLightの型比較1件があり、typecheckがFAIL（log（`integrated-typecheck.log`））。また同時に作成された `docs/tasks/active/2026-09-08-pwa-update.md` のReview By/Docs To Touch不足でdocs:checkがFAIL（log（`integrated-docs.log`））。担当外ファイルは上書きせず、この候補の合格と共有workspace全体の状態を分ける。

## 配布

ローカル実装・担当差分の統合まで。今回のcommit/push/deployは実施しない。実機iOS/Android、独立した子どもの無説明理解、公開先の確認は今回に含めない。
