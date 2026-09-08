# 欲しい景色が学習へつながる島のきせかえ

- Date: 2026-09-08
- Review By: 2026-09-09
- Status: Complete

## Goal

これまでの調査をもとに、学習を妨げず学習意欲につながる、実景プレビュー・ほし・選択交換・きせかえ・目標とセット収集の体験を実装して検証する。実装した範囲だけへ目的を縮小せず、仕様35の受入項目まで通す。

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/28_mystic_island_spec.md
- docs/product/30_living_island_growth_spec.md
- docs/product/35_island_customization_spec.md
- docs/ai/verification_matrix.md
- docs/index.md and docs/ai/ownership_map.md
- docs/design/audits/2026-09-08-island-customization/
- Shared queue and completion records

## Scope

通常の入力・学習進行・自動成長・既存の並行変更を保持し、ポイント交換の任意導線と3テーマ/3飾り、保存/歴史/復旧を追加する。公開deployは含めない。

## Verification

仕様35の7受入項目。verify:core、smoke、classic/Island PWA、Island/living、正式fixed-ten、専用domainとphone/tablet実UI。固定buildと画面の証拠を保存し、作者評価と子どもの観察を区別する。

## Progress

- 2026-09-08: 現実装と最新仕様を再確認。保存・3D・導線を独立調査し、仕様35を実装前に採用。共有worktreeの既存差分を保持する。
- 2026-09-08: 3テーマ/3飾り・10ほし・実景プレビュー・目標/所持・互換保存を実装。横ずれ、CAS再試行、西土地の結晶クリアランスを修正。ユーザー訂正「学習阻害せず」を正本へ反映。
- 2026-09-08: V1の自然発生した比較遷移FAILを保持し、発見の背景保存中に比較が無効になる挙動を診断。背景保存中のreadonly往復だけを許可し、同一QAの旧版negative control FAIL/修正版両viewport PASSを確認した。
- 2026-09-08: 最終V2 `customization-20260908-86209d824907` を固定。core194ファイル/2,232テスト、専用4フロー/40画面、catalog14画面、保存通知遅延2ケース、production25区間×2、Island11、全入力23、音声8、smoke31、classic PWA4、Island PWA8と実offlineをPASS。
- 2026-09-08: 正式fixed-ten 80run/15gate/eligible PASS、追加操作0。正解後入力P95 phone194.0ms/tablet193.6ms。固定fixtureの自動操作であり子どもの速度ではない。最終app入力736ファイルと固定manifest、52実画面とV2 raw画像のSHA一致を確認した。
- 2026-09-08: [検証・失敗と修正・独立ゲート](../../design/audits/2026-09-08-island-customization/README.md)と[実画面](../../design/audits/2026-09-08-island-customization/review.html)を保存。仕様35の受入検証まで完了。作者評価と子どもN=0を分け、公開・commit・pushは実施していない。
