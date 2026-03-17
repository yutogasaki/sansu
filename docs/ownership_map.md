# 文書オーナーシップマップ

## 目的

このファイルは、主要な話題ごとの正本を対応付けるための案内です。
同じ内容が複数文書に見えるとき、実際にどこを直すべきかをここで判断します。

## 使い方

1. 変更した話題を見つける
2. まず正本を更新する
3. 補助文書は、参照先の案内や状態メモが必要なときだけ更新する

## 対応表

| 話題 | 正本 | 補助文書 | 更新するタイミング |
|---|---|---|---|
| プロダクトの挙動と約束 | [01_app_spec.md](01_app_spec.md) | `docs/` 配下の子仕様 | ユーザー向け挙動、ルール、画面の役割が変わるとき |
| 画面・ドメイン固有の詳細挙動 | `docs/` 配下の画面仕様またはドメイン仕様 | [01_app_spec.md](01_app_spec.md) | 画面フローやドメインルールの詳細が変わるとき |
| デザイン原則・トーン・トークン | [07_ui_design_guideline.md](07_ui_design_guideline.md) | [design_review_checklist.md](design_review_checklist.md), [10_design_refresh_status.md](10_design_refresh_status.md) | 共通の見た目ルールやトーン指針が変わるとき |
| デザイン適用の進捗 | [10_design_refresh_status.md](10_design_refresh_status.md) | [07_ui_design_guideline.md](07_ui_design_guideline.md) | 進捗、残作業、状態メモが変わるとき |
| 進行中タスクの文脈 | [tasks/active/README.md](tasks/active/README.md) と `docs/tasks/active/*.md` | [verification_matrix.md](verification_matrix.md) | 作業が現在進行中のとき |
| 完了済み作業の履歴 | `docs/done/YYYY-MM.md` | 進行中タスク文書、関連仕様 | 作業が終わり、履歴として残すとき |
| 複数タスクをまたぐ記憶 | [memory.md](memory.md) | [risk_register.md](risk_register.md), [glossary.md](glossary.md) | 判断や事実を長く残したいとき |
| 検証方針 | [verification_matrix.md](verification_matrix.md) | 運用手順、タスク文書 | 必須確認やレビュー基準が変わるとき |
| リリース・保守手順 | `docs/runbooks/` 配下の各ファイル | [verification_matrix.md](verification_matrix.md) | 運用手順やリリース上の注意点が変わるとき |
| 再発見コストの高い設計判断 | `docs/adr/` 配下の各ファイル | 仕様、運用手順、`memory.md` | 重要な設計判断を残すとき |
| 全体バックログ | [11_full_task_backlog.md](11_full_task_backlog.md) | [12_ui_fix_tasklist.md](12_ui_fix_tasklist.md) | 優先アイデアや保留項目が変わるとき |
| ワークスペース用語 | [glossary.md](glossary.md) | アプリ用語は [01_app_spec.md](01_app_spec.md) | 文書運用や用語の定義が変わるとき |

## 迷ったときのルール

- 1つのファイルに状態メモとルールが混ざっていたら、ルール文書を正本にして状態文書は参照先だけ残す
- タスクメモが長期知識になり始めたら、残すべき部分を `memory.md` か ADR に移す
- 完了ログから現行挙動を読み取っている状態なら、正本側を更新する
