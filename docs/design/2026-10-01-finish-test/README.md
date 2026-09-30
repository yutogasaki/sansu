# しあげの実画面確認（旧17/20基準）

この記録は満点への変更前の診断。現在のクリア条件は20/20であり、以下の19/20クリア画像を現行仕様の合格証拠にしない。

[画面の一覧](index.html) · [設計判断](../../adr/2026-10-01-finish-test-progression.md)

## 対象と結果

DEV `http://127.0.0.1:5238`、島flagあり、Lifeあり、候補 `finish-path-v1`。revision/sourceHash/配布ID/画面幅は `evidence.json`。独立した診断プロフィールに受験資格を設定し、実UIから20問を提出した。写真の元プロフィールは読み書きしていない。

- 19/20でLv16のクリアと保存済みLv17への進級を照合。
- 16/20で未クリアの保存、レベル維持、新しい問題集合での再挑戦を照合。
- 途中で開き直すと同じ問題集合と初回答を保持し、次の問題から再開。
- phone/tablet、音off、reduced motion、テンキー全数字と物理キーの入力を確認。

## 独立した判定

- 見た目: 作者が実画面を確認。既存の布/縫い目/相棒を使い、現在と次の2地点、青い主操作、クリア印で節目を示す。
- 無音の理解/安全: 文言・形・reduced motionを確認。未クリアで取得物/レベルを減らさず練習/再挑戦へつなぐ。子どもの無説明理解・意欲は未観察。
- 実装整合: 全4388テスト、対象UI22テスト、typecheck/lint/build/assets/docs、classic smokeとclassic PWA updateを確認。旧島全体E2Eは現行rendererと旧fixtureの前提で停止（raw logは `/tmp/sansu-finish-island*.log`）。fixed-tenと島PWA全体のrelease gateは未認定。

本番配布・実機Safari・新旧2build間の全保存検証を実施したとは扱わない。撮影はDEVでSW制御なし。classic PWAの合格を、この島のoffline確認へ流用しない。
