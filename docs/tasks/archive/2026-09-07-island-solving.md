# 島で問題を解く体験

## Goal

問題を解いている間の世界観と楽しい反応を整え、既存の連問速度・問題の意味・入力・保存を保つ。

## SSOT

- [28 島仕様](../../product/28_mystic_island_spec.md) の Solving inside the island
- [親仕様](../../product/01_app_spec.md)
- [検証方針](../../ai/verification_matrix.md)

## Plan

1. 現行画面・入力形式・反応のbaselineを確認。
2. 島の作業台・学習物・入力feedbackと3Dの短い受取反応を接続。
3. 全入力・正誤・支援・再開・速度・同一buildの実画面を検証し修正。

## Verification

全入力の意味保持、ordinary追加0tap、正解650ms/誤答550ms以内、194msの既存baselineとの速度比較。core/関連E2E/PWA/offline/phone/tablet/reduced motion/実画面。

- Completed: 2026-09-07 (local implementation)

## Docs To Touch

28仕様・必要なUI方針・実画面監査・完了ログ。

## Progress

- 2026-09-07: 新goalを確認。前回の実装と保存資料を現行作業ツリーで検査。旧serverは停止済みで、新しい5198を起動し実ブラウザで正常表示を確認。既存の未コミット変更を保持。
- 2026-09-07: 島の作業台、共有入力の再利用、学習物のSVG、保存receiptに基づく反応を実装。筆算の途中段と一問完了を区別するunit testは5件PASS。未検証を含む要件一覧を[学習面の監査](../../design/audits/2026-09-07-island-learning/README.md)へ整理し、実画面・全入力検証を継続。

- 2026-09-07: ローカル実装完了。作業台・50種の同一対象glyph・短い住民反応・固定feedback行・予約全体で安定したcompact stageを実装。C後の先頭復帰を島だけ修正した。
- 2026-09-07: verify:core（112 files / 1229 tests）、smoke、classic PWA 4、Island PWA 4＋実SW offline、focused production 21、Park 9、旧島11すべてPASS。phone/tabletの実全ループ、127学習画像と16 critical-path画像、実回答動画を固定buildから保存した。
- 2026-09-07: 正式固定10問80レーン/10反復PASS。正解P95 194.2/195.4ms、誤答193.4/193.6ms、追加0操作、次問入力混入0。最終build 554ソースの現在値一致、benchmark共通424一致。
- 2026-09-07: 学習・速度の読み取り監査と、旧島画面を並べた視覚監査で重大な未完条件なし。Codex内の5298で実際のrevision/versionも一致。独立した子ども・実機観察と公開昇格は未実施で、ローカル作者確認と区別した。

## Outcome

[実装・検証・速度の監査](../../design/audits/2026-09-07-island-learning/README.md) と [実画面/録画](../../design/audits/2026-09-07-island-learning/contact-sheet.html)。公開・commit・pushなし。保存schema/planner/writer/SRSの契約変更はなく、追加ADR/memory更新は不要。製品仕様28とverification matrixを同期した。
