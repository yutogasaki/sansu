# Mystic Island

## Goal

添付goal packに沿った島の暮らしと、子どもが問題を次々に解ける学習ループを実装し、実画面と保存・速度の証拠で検証する。

## SSOT

- [島の仕様](../../product/28_mystic_island_spec.md)
- [親仕様](../../product/01_app_spec.md)
- [検証方針](../../ai/verification_matrix.md)

## Plan

1. 既存planner/input/writerを使った専用の島保存・学習区間。
2. クリーンな3Dの島、配置、どうぶつ反応、学習中の光。
3. 一画面の連問と区切り、任意の報酬受取、PWA・routing。
4. domain/回帰/E2E/速度/実画面を検証し修正する。

## Verification

28仕様の全要件を実データと実画面で確認。未説明の利用者テストと公開昇格は未実施として別記。

- Review By: 2026-09-14

## Docs To Touch

- CONSTITUTION.md、親仕様、28島仕様、UI方針、13保存仕様、検証方針、index/ownership/memory。
- 実アプリの視覚監査・速度・保存結果を docs/design/ へ残す。

## Progress

- 2026-09-07: 添付全資料と既存実装を確認。設計を採用し、実装開始。既存の未コミット変更は保持。
- 2026-09-07: 専用v7保存と固定3/6問の区間、3Dの島・6家具・配置/回転/収納、2/4/6区間の成長を実装。通常問題の既存planner/input/writerを利用。
- 2026-09-07: 住民の海横断を橋と障害物回避の経路へ修正。密な50小物の描画433→169回、回答時の不要な影再計算を解消。
- 2026-09-07: 最終core 109ファイル/1,181テストPASS。既存smoke/PWA/Park回帰、島全入力・6区間成長・WebGL復旧・productionの更新保護と実offline回答/再開PASS。同一productionビルドの2サイズcontact sheetと実回答録画を保存。
- 2026-09-07: 固定10問の正式80lane完走。全12gate PASS、eligible/pass=true。phone/tabletの正解P95は194.0/194.2ms、Study比2.204/2.234。開始終了SHA一致とproduction重複411ファイルの一致を確認。最初のStudy timeoutは診断として分けて保全。

## Outcome

ローカル実装と必要な検証を完了。[最終実画面と検証](../../design/audits/2026-09-07-mystic-island/README.md)。revision `aa36adad7dcc-island-ff6a931ccb86`、確認先 `http://127.0.0.1:5298/#/island`。公開反映・独立した子どもの理解/再遊び観察・実機PWAインストールは未実施。元の作業ツリーの変更を保持し、commit/pushはしていない。
