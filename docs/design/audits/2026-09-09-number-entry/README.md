# Ordinary number entry — 2026-09-09

SSOT: [画面仕様](../../../product/06_screen_specs.md)。整数/分数の小数点キー削除、複数欄の上限桁で自動移動、短い入力の「つぎ」/スラッシュ移動、小数計算の具体的ヒント。

- [Island入力12ケース](input-report.json): nativeプロフィールfixture、実planner、phone幅のtap、tablet幅のkeyboard。誤答・ヒント・下書き・訂正・正解・保存・reload。分数は上限桁で次欄へ移動し、空欄のBackspaceで直前の欄へ戻ることを追加確認。
- [Study分数2ケース](study-report.json): review routeの実生成問題。連続入力、自動移動、Backspace、C、スラッシュ、決定から次問へ進むことを確認。
- [分数の実画面](fraction.png) / [小数ヒントの実画面](decimal-hint.png)。390×844 / 768×1024、共有作業ツリーのVite（http://127.0.0.1:5694）。固定production・配布版・実機iPad・子どもの理解の認定ではない。
- 数字キーの位置を維持し、不要な小数点は空所、「右へ」を「つぎ」にする。短い数の入力終了を正解値・タイマーから推測しない。最後の決定は維持する。既入力の次欄へ勝手に移って上書きしない。
- 小数点の可否は課題系列で決め、現在の正解から決めない。小数課題・10倍/10分の1・割合の系列は小数入力可能。全生成器を各50回検査して、小数の正解が入力不能にならないことを確認。
- 先行診断で「ヒント後の正解を独立した正解logと扱う」という検査側の誤期待があり、assisted-correct receiptと誤答log保持へ訂正済み。今回の採点・保存ロジックは変更していない。

視覚: 全キーを収め、ヒントと入力を読める。理解/安全: 自動移動は上限桁でのみ起き、短い欄は明示区切りを使う。Runtime: 上記14ケースと単体検査。PWA/全成長・実機操作・学習効果は今回対象外。

## Verification

- Docs/lint/typecheck/build/assets: PASS（既存IslandMilestoneのexport warning 1件）。共有作業ツリーの検査で、他タスクの変更を含む。
- 最終全体実行: 3,300 tests中3,299 PASS、学習進行1件が15秒timeout。同ファイルを単独再実行し12 tests PASS（対象ケース6.76秒）。全体実行を無条件PASSとは記録しない。
- 変更箇所のfocused55件、フォーム7件、生成器の小数入力可能性4件PASS。Island12/Study分数2の実操作PASS。
- 途中実行では旧キー/ヒント期待が残った版の失敗を検出。期待の同期と、小数点を外した数の余分な先頭0・整数同士で「0けたへ小数点を戻す」となるヒントを修正して確認した。
- 今回はローカル実装。commit/pushなし。

## Main commit candidate

- main dd69308から今回の17ファイルだけを抽出。docs/lint/typecheck/build/assets PASS。全体3,408件中3,404件PASS、経験保存/成長保存/学習進行の4件が時間切れ。該当3ファイルを1 workerで再実行して35件PASS（制限時間は変更せず）。
- 同候補のIsland有効production build（5696）で [入力12件](commit-input-report.json) と [Study分数2件](commit-study-report.json) PASS。先行DEV実行では開始画面の15秒待ちが2回timeout。実画面を確認し、productionで初期待ちを30秒にした別実行として記録する。
- 検証後にmainへ入ったカメラ操作・ホーム仕様を保持して統合する。今回の入力のコードに競合なし。main commit/pushはユーザーの明示指示による。

- 最終統合親 `ac303c5bbe4af53b4e95d5d7cf756218bd54a95a`（ホーム成長previewを含む）で関連66 tests、typecheck/build/assets PASS。camera統合時の関連73件もPASS。

- プッシュ競合で追加された54fa4fcのナビ変更を保持して再統合。型検査、Footer/入力の54 tests PASS。入力実装の差分は変更なし。
