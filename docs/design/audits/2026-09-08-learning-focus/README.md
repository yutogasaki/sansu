# 学習中の島の非表示とテンキー固定

2026-09-08の「学習のときは学習優先」「テンキーはスクロールしなくても良い」に対応したローカル実装。学習だけを独立した表示モードにし、ホームの島・素材・成長データを維持する。

- [実画面の一覧](review.html)
- [固定ビルドと検証集計](summary.json)
- 再実行: `SANSU_LEARNING_LAYOUT_URL=<URL> SANSU_LEARNING_LAYOUT_OUTPUT=<新しい出力先> node tools/e2e-island-learning-layout.mjs`。WebKitは `SANSU_LEARNING_LAYOUT_BROWSER=webkit`。

## 変更と範囲

`IslandLearningFocus.css`で学習中の島を非表示にし、画面高内のflex配置と内容ごとのscrollへ切り替える。既存のiPad横向きの左右配置を活かし、縦向きでは全テンキー・解答欄・支援操作の領域を先に確保する。ヒントを開いてもキー位置は変わらない。3Dは既存の可視性監視で描画を休止し、帰島後は同じruntimeを表示する。出題・採点・永続化・PWAの変更はこのタスクに含めない。

## 実画面の対象

- 固定production preview: `http://127.0.0.1:5389`。
- revision: `463508f-local-learning-focus`（共有作業ツリーのローカルビルド）。
- version: `463508f-local-learning-focus:27916efa-a7f9-4982-b9a2-4d4544e9d8c8`。
- Island enabled: true / delivery: `mystic-island-v1` / world: `mystic-island-living-v5` / learning: `mystic-island-learning-v2`。
- 新しい独立ブラウザcontext・service worker無効。公開先更新や実機PWA検証ではない。

## 検証

- Chromium・WebKitそれぞれ196状態、計392状態がPASS。1024×768、1024×640、1180×720、768×1024、820×1080、390×844、390×640。
- 通常数値、十のまとまりの図、分数、足し算筆算、2桁掛け算筆算、3桁割り算筆算、英語を開始問題にした通常の予約と実入力を使用。最初の問題を完了し、次問のヒント・お手本・続行と帰島・再開・再読込を検査。後続問題は実plannerが選び、開始問題と同じ教材とは限らない。
- キーを検査前にscroll into viewしない。各キーの画面内hitと44px以上、全数字と訂正・決定、問題内容のscroll前後・同じ問題のヒント前後でのテンキーの位置と大きさ、ページ全体の縦横溢れなしを確認。
- sound off、割り算開始ケースのreduced motion、touchと物理キー、回答保存・予約維持・帰島後の3D再表示を確認。
- 最終のdocs:check・lint・typecheck込みのbuild・assets:checkはPASS。全体単体/統合テストは検証時点の234ファイル・2,580件がPASS。写真hookの初回失敗と並行作業中の型エラーは原ログへ保存し、再検査で解消。lintは既存のcomponent-export警告のみ。
- 共通smokeは初回30/31件PASS。開発serverのHTML再読込/HMRと重なり旧探索の1024×768で失敗した。対象再実行ではそのケースを含む4/5件がPASSし、別の1080×1920でready待ちが失敗。各検査の合算をcleanな全体PASSとせず、共通smokeはPARTIALとして残す。固定ビルド上の今回の392状態は両ブラウザとも全件PASS。

詳細ログと全画面は `output/playwright/learning-focus/`。画面の検証を、全release/PWA/throughputの承認や公開済みの証拠にしない。

## 別々の判定

- 視覚: 今回の学習優先レイアウトは作者の実画面確認でPASS。島の造形やアートの新承認は行っていない。
- 理解・安全: 問題・全キー・支援の操作と、音なし/reduced motionでの状態表示を作者が確認。子どもの無説明理解・継続意欲・実機iPadでの観察は未実施。
- runtime: 今回のレイアウト・操作・再開はPASS。共通smokeの不安定さとrelease検証の範囲外を上記で区別する。
