# 学習と保護者の動線を統一

2026-10-03。「まなぶ」を押すと練習へ入る。準備が整った区切りと記録から、同じレベルアップ確認へ進む。保護者は学習状況を先に見て、必要に応じて理解度の確認や範囲調整を開く。

現在の挙動の正本は[画面仕様06](../../product/06_screen_specs.md#2026-10-03-学習と保護者の動線を統一)と[学習進行29](../../product/29_learning_progression_spec.md)。この文書は実装・検証の履歴。

## 実画面

[スマホ接触シート](phone-contact-sheet.jpg) / [タブレット接触シート](tablet-contact-sheet.jpg) / [全経路の接触シート](contact-sheet.html) / [撮影の版・候補・SHA](captures.json)。元PNGをそのまま並べている。既存の紙・藍・ぽこもこの表現を維持し、生成画像は追加していない。

- 通常練習の前に空の選択画面を出さない。挑戦は任意の操作とし、押さなくても練習できる。
- 挑戦前に現在と次の単元、20問の条件を示す。クリア後は実際に保存したLv17を大きく示す。19/20ではLv16を保ち、対象の復習へ進む。
- 保護者画面の先頭に現在の算数・英語範囲と学習記録を置く。理解度の確認は折りたたみ、科目を選んでアプリか紙へ。時間制限はさらに任意で開く。「通常」バッジを除いた。
- 紙の問題snapshot、採点待ち、再印刷、点数入力、取消、既存履歴を保持する。資格・SRS・採点の閾値は変更していない。

## 対象と検証

基点はmain `aea3cd7dd076d9ae98fb1eae17d56e61612016ad`、実装候補は `learning-flow-20261003-r2`。本番用ビルドをローカル `http://127.0.0.1:5291` のpreviewで確認した。本番公開はしていない。

実versionは `learning-flow-20261003-r2:67974674-747e-454a-a030-681f2ca96527`。配信は `snap-root-v1`、Islandは `mystic-island-v1` / `mystic-island-shore-garden-v18`、Lifeは `living-fantasy-garden-v2`、学習は `pokomoko-pop-live-v8`。ビルド設定はIsland/Life/Fantasy/Growing ON、Nature Town OFF。Growing値はversion.jsonに独立表示されないため、ビルドコマンドと実ルートで対象を記録する。今回の画面候補は `learning-flow-v5` / `progress-level-up-v4` / `parent-learning-hub-v1`。

| 検証 | 結果 | 証拠・境界 |
|---|---|---|
| verify:core | 520ファイル・4,607テスト、docs/lint/typecheck/build/assets PASS | [最終ログ](logs/core.log)。既存FastRefresh警告1件などを保持 |
| classic smoke | 31/31 PASS | [ログ](logs/smoke.log)。別の隔離DEVサーバーで設定→保護者ガード→確認テストを含む |
| production UI | 390×844通常motion / 768×1024 reduced motion、8状態×2幅の16ケースPASS | [集計](verification.json)。準備なし・8/20・型不足・設定停止・準備済み・未クリア・英語・最高範囲 |
| 紙/アプリ整合 | 両幅14ケースと旧snapshot取消PASS | [レポート](print/report.json)、[ログ](logs/print.log)。20問の同一問題、再印刷、17/20採点、進度/通常記録/SRS不変、実A4 PDFを確認。実プリンター未確認 |

UIは隔離したnative IndexedDBの合成準備fixtureから、実際のFooter・記録・挑戦確認・Study・保護者を操作した。問題は実ドメインgeneratorで生成し、実UIの入力で20問回答している。自然な学習から資格を取得した観察ではない。アプリのruntime moduleの注入、問題の差し替え、回答writerの代行はしていない。

同じ通常予約の継続、挑戦1問後の中断/同じ予約への復帰、独力20/20後のLv16→17保存、19/20後のLv16維持と復習を両幅で確認した。クリア後の通常予約は実SW制御下でoffline reloadして同じIDに戻る。保護者は学習1回答後の記録更新、範囲調整からの戻り、設定への戻り、旧URLのガードを確認した。

最終UIの14合格ケースと、ハーネス修正後の未クリア2ケースを集計した。両runの全src・package/lock・vite.configとdist SHAが一致し、終了時の実ファイルとも照合した。[入力manifest](input-manifest.json)には実distと補助ハーネスのhashを保持する。印刷は対象10ファイルの開始/終了hashを照合した。[数え問題PDF](print/phone-count-questions.pdf)、[商と余りPDF](print/phone-remainder-questions.pdf)、[商と余りのプレビュー](print/phone-remainder-preview.png)を保持。全14ケースのPDF/PNGは `output/playwright/learning-flow-print-verified/` にある。全release契約や実two-build更新の認定ではない。

## 途中の失敗と修正

- r1の通常 `/learn` 転送では、学習leaseの解放/再取得が短時間で重なり学習が止まった。同じlive hostで直接学習を開くルートへ修正し、実再開を確認した。[診断](final/report.json)はFAILのまま残した。
- 保護者の範囲調整から戻ると旧保護者URLへ再転送する経路と、学習後に概要が更新されない経路を修正した。実UIでガード履歴と最新記録を照合した。
- [最初のr2 UIレポート](verified/report.json)は未クリア2件がFAIL。検査が練習側のスキップ名を使っていた。名前を直した[次のレポート](recovery-verified/report.json)も、回答説明の「次へ」を押さずFAIL。最小のハーネス修正後、[未クリア両幅](recovery-next-verified/report.json)がPASS。アプリの採点は変更していない。各driver snapshotとrawログを保持する。
- 印刷の初回は筆算ONの「あまり」をmulti-numberと想定した検査が失敗した。実凍結問題の筆算商/余りに合わせ、14ケースを最終版で再実行した。[初回ログ](logs/print-initial.log)を保持する。

## 独立した評価

- 見た目：作者は接触シートで、練習直行・現在/次の単元・進級後の数字・保護者の主従を確認した。ユーザーからの視覚評価は未実施。
- 理解と心理的安全：挑戦は任意、未クリアでも進度と正解記録を保つ文言にした。子どもの無説明理解・再訪意欲・実機音声は未観察。
- runtime：上表の対象経路・入力・保存・再開はPASS。自動検証を見た目や子どもの理解の認定へ置き換えない。本番公開・実iPhone・全PWA release gateは今回の範囲外。

親仕様01と子仕様06/29を更新。保存形式・学習アルゴリズム・運用手順は変えず、新ADRや汎用検証ルールの追加は不要。この検証はコミット前のローカル候補に対して実施した。
