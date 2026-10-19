# 島の見やすさとメニュー描画の改善

2026-10-19。ChatGPTのv3レビューに対する利用者の「改善して」を受けたローカルUI変更。くふう・愛着を支え、既存の柱は弱めない。追加agentなし、30分を上限とする一成果物。公開・push・commitは行わない。

## 変更

- メニューの見出し・閉じる操作と、項目のスクロールを分離する。320pxで黒い矩形が出た構造を取り除き、末尾へ進んでも退出できるようにする。
- スマホ縦画面の初期カメラを6%近づける。既存の全景の余白内に留め、「ながめ」から近景（1.65倍）・全景へ切り替えられる。近景と全景ではpanを戻し、回転・既存の対象focusは維持する。
- 選択した「そだつ場所」は従来から実際の名前を表示していた。これを活かし、未成熟時には既存の現在の配置ヒントを表示する。「木を よせて ベンチを おいてみよう」等の具体的な行動と目標をつなぐ。

価格・成長・所有・学習・保存・5タブの規則は維持する。目標の名称変更や新しいゲーム機能は追加しない。

[変更後の画面一覧](index.html) · [実画面の対象・検査結果](runtime.json) · [runtime入力のSHA](app-sources.json)

## 描画の切り分け

[以前の320pxの黒帯](../menu-320-diagnostic.png)を、初回案内を終えたDEV保存で再現した。メニューを隠すと消えた。shadow/transform/isolationだけの除去、stickyだけの除去では残った。見出しを外に置き、項目だけを内部スクロールする構造へ変えると、この再現では消えた。canvasのhit検査だけではrenderer側の欠陥を証明できず、GPUドライバー内部の原因を確定したとは扱わない。

## 検証と範囲

実アプリ `http://127.0.0.1:5198/#/island`。DEVの使い捨て保存、sound off、tabletはreduced motion。実取得・自然な成長・子どもの独立理解の証拠ではない。

- 関連unit：HomeTools、Menu、Camera、Miniaturesの4 files / 20 tests PASS。
- lint：0 errors / 既存4 warnings。Node 22.23.3でtypecheck PASS。
- build/assets：PASS（precache 8.54 MiB / 12 MiB）。docsと現行入口guard PASS。文書索引・portalの最終再生成もPASS（1723 files）。
- 320×568・390×844・768×1024・568×320：近景/全景、回転、Escapeからのfocus復帰、メニュー末尾の到達・見出し位置の保持、目標選択→ホームの具体ヒントをPASS。メニュー上方の純黒画素は各幅0で、実画面も比較した。
- 390幅の現行ナビハーネス：明示住人の模型、補助5機能の往復、5タブの単一選択、家→学習、全TenKeyと同じ未回答予約への再開、学習store不変をPASS。
- 全体suite：ホスト上の別の全体検査と競合して進行が遅くなり、この作業のprocess groupだけを08:41に停止。ログでは141ファイル分の結果が出ていたが、全体は未完。学習progressionと航海の2件のtimeoutを記録し、Node 22・1workerでその2ファイル22件を個別再実行してPASS。全体合格へ読み替えない。

ローカルの診断・検証は `output/playwright/island-review-fix/`。最初の20秒のDEV起動待ちtimeoutと、描画フレーム更新前のカメラassert失敗を保持する。後者は検査側で投影行列の更新を待つ形へ修正し、製品側を変更して通してはいない。shellにnvmはなく、既存依存を利用。Node 24.18.0でbuild・lint・全体suite、fnmのNode 22.23.3で型と最終画面検査を実行した。

実機GPU/音声・PWA更新・子どもの操作理解や再訪は未評価。情報整理・描画の診断と、最高の美術／無説明理解／配布の合格を分ける。全面的な美術制作は再開していない。

## 対象版と判定

Revision `development-local`、version `development-local:81e5cc79-86f9-470d-af7e-4e3acbe7de50`、delivery `mystic-island-v1`、世界 `mystic-island-shore-garden-v18`、ホーム `island-direct-play-v2`。Island=true / NatureTown=false / DEV modules / SW controlled=false。テストを除く全runtime srcは画面検査の前後とナビ検査で一致し、aggregate SHA256は `3b68666450111929c17488b1388bf2f090a2027f7f8eafbf3964ed5550f0dc09`。途中の別作業による `voyages.test.ts` の変更はruntime入力と区別する。

UIの描画と対象操作はローカル確認済み。情報の階層・focus・文字と操作の到達性は改善し、動きや音への依存は増やしていない。新しい失敗/学習ルールは追加していない。美術の最高評価や子どもの理解は採点せず、独立観察と配布の判定はHOLD。通常の保存形式・routing・PWAの切替は行わず、公開判定は別のままにする。

全幅の検証は、最初に通過した320幅と、スクロール後の実hit確認を加えた390/768/568幅の2報告を統合している。初回失敗の画面・入力・結果はローカルに保持した。今回のローカルUI反映は完了、全体suite・実機・子どもの確認・公開は未完。
