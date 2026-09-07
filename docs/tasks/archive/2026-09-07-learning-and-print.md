# Learning algorithms and printable tests

## Objective

学習アルゴリズムとテストをプリントアウトする機能など、学習まわりを改善する。

## Source of truth

- `docs/product/01_app_spec.md` sections 5–7
- `docs/product/06_screen_specs.md` sections 4–5
- `docs/ai/verification_matrix.md`

- Review By: 2026-09-14

## Docs To Touch

- `docs/product/01_app_spec.md`
- `docs/product/06_screen_specs.md`
- `docs/product/13_data_storage_migration_spec.md`
- `docs/ai/verification_matrix.md`

## Verification

`npm run verify:core`, smoke, PWA update and real Settings mobile/tablet print flow. Inspect rendered A4 question/answer sheets. Domain regression covers natural English promotion, preparation scope/skip stop, graduated math selection and atomic paper persistence.

## Plan

1. Audit learning/SRS/planner progression against the parent spec; fix evidenced learning gaps with regression tests.
2. Add faithful A4 test preview and browser print/PDF, separate answers, persistent reprint, cancellation and safe scoring.
3. Verify domain cases, real mobile/tablet settings flow and printed pages, core checks and smoke/PWA regressions as needed.

## Boundaries

Existing dirty worktree includes Island and Park work. Preserve it. This task does not change game presentation or release flags.

## Completed

- 英語の解放済み次レベルを通常10問へ最大3問混ぜ、未挑戦を優先。新たな解放時は練習も有効化し、旧プロフィールは設定で明示的に開始できる。親が選んだ範囲を暗黙に変えない。
- 算数の通常枠は未卒業スキルを優先し、全範囲卒業済みでは同じ範囲の定着練習を許可。準備復習は待機テストのレベルを守り、苦手・記憶の弱さ・出題回数を優先し、当日3回スキップの停止を守る。空と生成失敗を別画面にした。
- 昇級直前の学習状態で自動テスト対象を判定し、昇級後プロフィールを巻き戻さず旧レベルのテストを作る。
- 図・数直線・筆算・分数・英語の選択肢を保つA4プレビューを追加。問題／解答／両方、印刷・PDF保存、同一20問の再印刷、採点待ちの取消を実装。
- 用紙の完全snapshotをoptionalな既存プロフィール項目として保存。作成・採点・取消と関連設定は最新プロフィールを用いるatomic更新とし、二重採点・別プロフィール・新しい自動テスト待ち・並行した学習結果を保護する。旧用紙は採点・取消のみ対応。

## Verification results

- 固定sourceコピーで `verify:core` PASS：125ファイル／1,384テスト、docs、lint、typecheck、build、asset budget。`e2e:smoke` 31ケース、`e2e:pwa-update` 4ケースPASS。
- `e2e:print` 14ケースPASS。390×844と768×1024、算数Lv.0/2/7/11/17/22と英語Lv.1。22 PDF・139ページで20問の順序、解答分離、図、書き込み欄の改ページと背景除外を検査。reload後の同一問題、印刷取消、旧用紙、二重採点も確認。
- `e2e:learning-progress` 6ケースPASS。旧英語の練習再開→通常Studyの実回答と保存、当日停止→記録へ戻る、IndexedDB読込失敗→再試行→本来の算数への回答を両サイズで確認。
- 最終担当source22ファイルは全体検証コピーとSHA-256一致。両追加E2Eも開始・終了時source一致。別担当の最終レビューで重大な残件なし。
- 全体ログと固定sourceは `output/playwright/learning-verification/`、実画面・PDF・report・reviewは `output/playwright/learning-print/` と `output/playwright/learning-progress/` に保存。
- 共有DEVのHMR中に発生した初回smoke/PWAの待機失敗は固定sourceの単独実行で再発せず。学習E2E初回は10問後も次blockへ続く仕様に合わせて待機条件を訂正し、実装や判定を緩めず再検証した。

## Delivery limits

ローカル変更として完了。Chromiumの実画面と印刷PDFを検証し、OSの印刷ダイアログ・実プリンター・Safari実機は未検証。公開デプロイは行っていない。既存のIsland・筆算の並行変更を保持した。
