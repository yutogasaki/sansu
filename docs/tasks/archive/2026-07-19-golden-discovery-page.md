# Task: Golden Discovery Page 縦切り

- Date: 2026-07-19
- Owner: Codex + sub-agents
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: `docs/runbooks/pwa-release.md`（配信資産を変更する場合）

## Goal

- 「算数で世界を変える → 性質を発見する → 次の手掛かりが1件だけ残る → 大発見で1ページの物語になる」を、1つの発見ページで遊べる縦切りとして成立させる。

## In Scope

- 安定IDを持つ発見ページ・特徴・連鎖の純粋ドメイン
- 1ページ分のカタログと、1ラン内で見える3つの手掛かり＋1つの大発見
- 発見画面を手描きの探検ノートへ再設計
- 画像生成による画風基準と、生成画像を本番へ直貼りしない制作契約
- スマホ縦・タブレット・reduced motion・sound offの確認

## Out of Scope

- Dexie保存とschema migration
- SRS / Due / weakへの書き込み
- ホーム主導線の置換
- 発見コンテンツの大量生産

## SSOT References

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`

## Docs To Touch

- Must update: `01`, `10`, `12`, `14`, `15` の発見ループと画風・検証契約
- Intentionally unchanged: `13_data_storage_migration_spec.md`（今回はメモリ内のみ）、`11_learning_integration_spec.md`（学習書き込みは行わない）

## Plan

1. 画風の基準画像を2案生成し、色・線・素材・画面密度を固定する。
2. 発見ページの純粋ドメインとテストを追加する。
3. 既存探索へ探検ノート型の手掛かり表示を統合する。
4. 実画面を撮影してデザインレビューし、1回以上修正する。
5. 必須検証を通し、次の学習接続・保存ループを切る。

## Definition of Done

- 次の未発見手掛かりが常に0件または1件で、重複発見しない
- 3つの手掛かりの次に大発見が開き、同じ物語として読める
- 発見直後に「何が変わったか」と「次に何を見たいか」が一画面で分かる
- 通常時は静かで、大発見だけ短く強いピークになる
- 重要状態は画像・色・音・モーションだけに依存しない
- 生成コンセプトは制作領域に置き、本番precacheへ混ぜない
- Relevant docs updated or explicitly declared unchanged
- Done log entry created if the task ships

## Verification

- Commands: `npm run docs:check`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, 必要に応じて `npm run e2e:smoke`
- Manual checks: 390×844、768×1024、1024×768、reduced motion、sound off、通常発見、大発見、再挑戦

## Progress

### Now

- 画風基準2案、純粋ドメイン、通常発見、大発見、帰還統合、可変ページアートregistry、PWA資産ガードを実装した。
- 独立レビュー後、通常発見を明示続行へ変更し、本文を12〜14px以上へ拡大、大発見の複数花・地面光路、帰還直後の再探索CTA、背後UIの`inert`を追加した。
- 390×844で4発見の通し操作を再確認し、通常発見3段階・大発見・帰還のP1画像を制作記録へ保存した。
- docs、lint、typecheck、507テスト、build、asset budget、E2E smoke 14シナリオが合格した。

### Next

- `Explore Attempt Identity` と探索保存receiptを先に成立させ、その後に3つの発見ページと研究拠点へ拡張する。

### Decision Notes

- 既存ゲームのキャラクター・UI・固有表現は模倣しない。好奇心、連鎖発見、空白ページ、1件ヒントという抽象原則だけを使う。
- 生成画像は方向決めに使い、本番画面は再利用可能なDOM / CSS / SVGと承認済み小型資産で組む。
- `found` と `mastered` は別概念。今回の発見表示は習熟認定に使わない。

### Risks

- 既存worktreeに大きな未コミット変更があるため、対象外ファイルを整理・巻き戻し・stageしない。
- 発見演出が長いと問題テンポを壊す。通常の特徴発見は短く、大発見だけ明示続行にする。
