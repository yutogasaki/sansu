# 筆算の入力・訂正の手数を減らす

- Review By: 2026-09-15
- Status: Complete (2026-09-08; local implementation)

## Goal

数字の連続入力で桁・段を進め、誤答時は正しい数字を残して必要なマスだけ直す。ユーザーが採用した操作改善であり、筆算を省く回答方式は追加しない。

## Scope / SSOT

親仕様01、教材02、多桁筆算06。Studyと共有Island/Park入力、筆算時のTenKey、段の待ち時間。保存契約・採点・支援記録・予約Problemは維持する。

## Plan

1. 訂正・空欄への自動移動・決定表示を仕様化する。
2. 共通の筆算入力補助を実装し、保存済み誤答に限って部分訂正を始める。
3. 数字連続入力、訂正、保存失敗、支援、phone/tablet表示を固定buildで検証する。

## Verification

docs:check、lint、typecheck、test:run、build、smoke。Island/Parkの該当ページ回帰、PWA更新、固定10問と筆算専用の実ブラウザ検証。視覚・無音での操作理解・runtimeを分けて記録する。

## Progress

- 桁/段の自動確定は既存。Studyの800ms後全消去、Island/Parkの回答receipt後再マウントで全消去、Islandの180ms入力ガードを確認。
- 作業開始時点の対象ファイルをrepo外へ保管。他タスクの変更は維持する。
- Study/Island/Parkで誤答後の正しい数字を保持し、空欄だけを自動移動する。Backspaceは直前の入力だけを戻す。筆算中の左右キー・自動確定Enterを空き領域にして数字位置を保持した。
- Studyの800ms誤答待機とIslandの途中段180ms待機を除去。保存済みreceiptで訂正を開始し、支援中の下書き・保存失敗時の原稿と手動再送を保持した。Parkのヒント・横向きタブレットでもキーを固定した。
- 固定コピーでdocs/lint/typecheck、239ファイル2,632テスト、3build、PWA・Park回帰、自動入力24ケースがPASS。smokeはtabletの既存探索timeout後、該当5viewport再試行がPASS。最後のPark配置CSS変更を含む最終buildで筆算6ケースと固定10問80 run/15 gateを確認した。
- [実画面・build識別・検証範囲](../../design/audits/2026-09-08-written-input/README.md)。広域Island E2Eは学習中に非表示の3D舞台内要素を待つ既存検査で停止し、全体完走は未確認。原失敗を保持し、全体公開の承認として扱わない。
- レビュー: 仕様・子ども向け文言は整合、採点・支援記録・SRS・保存schemaの変更なし。本人が入力した正しい値だけを保持し、期待値からの自動入力は行わない。見た目・無音理解・runtimeの判定と限界は監査記録に分けた。

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/02_math_skills.md
- docs/product/06_screen_specs.md
- docs/ai/verification_matrix.md（筆算専用の実画面検証コマンド）

上記SSOTを更新済み。データ契約の変更がないためmigration/runbookの変更は不要。仕様に操作の根拠を置き、恒久memoryへの重複記載は行わない。公開・commit・pushは実施していない。
