# iPad横向きの問題画面

- Review By: 2026-09-15

## Goal

iPad横向きで問題・解答欄・全テンキー・支援操作を画面内に収める。

## Scope / SSOT

- 島の学習レイアウト。既存の未コミット変更を保持する。
- 親仕様01の3.1と島仕様28の問題優先・全テンキー同時表示に従う。
- 出題・採点・保存・PWA・3D素材は変更しない。

## Plan

1. 現行の1024×768とブラウザUI分を引いた横画面で再現する。
2. 横幅を使う問題/入力配置にし、iPadの高さで収まるようにする。
3. 通常・図解・分数・筆算・英語・ヒントと縦画面を実ブラウザで確認する。

## Verification

- docs:check / lint / typecheck / test:run / build
- Playwrightによる縦のはみ出し、全入力キーの可視性、回答・支援・回転の確認

## Docs To Touch

- `docs/product/28_mystic_island_spec.md`: 横向きの配置と全入力操作の同時表示。
- このタスクと完了記録: 検証したブラウザ・viewport・制約。

## Progress

- 幅700px以上の固定252px/214pxの島と縦積みの問題・250pxテンキーが横向きでも適用されることを確認。
- 横幅900px以上のlandscapeで問題／支援と入力を左右配置。進捗・回答表示・下部操作を残して問題の高さを伸縮。
- 並行作業で学習中の島非表示と筆算方式切替が追加されたため、両方を保って統合。不要になった島の高さ調整は除いた。
- 最終固定productionでChromium/WebKit合計20ケースPASS。234ファイル2,580テスト（並列2）、docs/lint/typecheck/build/asset budgetもPASS。
- 詳細は `docs/design/audits/2026-09-08-ipad-landscape/README.md`。実機iPad・公開先の反映は未実施。
