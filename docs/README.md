# ドキュメント案内

## 目的

このファイルは、ワークスペース文書の入口です。
文書の肥大化、正本の重複、作業メモの散乱を防ぐために置いています。

## 読む順番

1. [../CONSTITUTION.md](../CONSTITUTION.md)
2. [01_app_spec.md](01_app_spec.md)
3. ドメイン別・画面別の子仕様
4. 検証ルール、`memory.md`、ADR、運用手順
5. 進行中タスク
6. 完了ログ

## よく使う文書

| File | 役割 | 正本 |
|---|---|---|
| [01_app_spec.md](01_app_spec.md) | 親仕様 | はい |
| [07_ui_design_guideline.md](07_ui_design_guideline.md) | デザイン原則 | はい |
| [glossary.md](glossary.md) | 用語集 | はい |
| [ownership_map.md](ownership_map.md) | 文書オーナーシップと正本の対応表 | はい |
| [memory.md](memory.md) | 継続して残すプロジェクト記憶 | はい |
| [verification_matrix.md](verification_matrix.md) | 変更種別ごとの必須確認 | はい |
| [tasks/active/README.md](tasks/active/README.md) | 進行中タスクの進め方 | はい |
| [runbooks/ai-agent-collaboration.md](runbooks/ai-agent-collaboration.md) | Claude/Codex併用時の運用ルール | はい |

## 定期参照の文書

| File | 役割 | 正本 |
|---|---|---|
| [10_design_refresh_status.md](10_design_refresh_status.md) | デザイン進捗と状態メモ | いいえ |
| [11_full_task_backlog.md](11_full_task_backlog.md) | 全体バックログ | いいえ |
| [12_ui_fix_tasklist.md](12_ui_fix_tasklist.md) | UI領域のタスクリスト | いいえ |
| [design_review_checklist.md](design_review_checklist.md) | UIレビュー項目 | はい |
| [risk_register.md](risk_register.md) | 横断リスクの記録 | はい |
| [archive_policy.md](archive_policy.md) | 文書の整理・分割ルール | はい |
| [runbooks/pwa-release.md](runbooks/pwa-release.md) | PWA更新の手順書 | はい |
| [runbooks/backlog-triage.md](runbooks/backlog-triage.md) | バックログ棚卸し手順 | はい |
| [runbooks/release-checklist.md](runbooks/release-checklist.md) | リリースチェックリスト | はい |
| [runbooks/schema-migration.md](runbooks/schema-migration.md) | ストレージ移行手順 | はい |

## 保管済みの文書

- 過去の実装計画
- 完了済みの履歴ログ
- アーカイブ済みタスク
- `docs/archive/` 配下の古い状態メモや補助ノート

## ワークスペース構成

- `docs/adr/`
  アーキテクチャやプロダクトの重要判断
- `docs/tasks/active/`
  進行中の作業メモだけを置く
- `docs/done/`
  完了した作業ログだけを置く
- `docs/runbooks/`
  運用手順
- `docs/archive/`
  よく使う文書から外した状態メモ・タスク・補助ノート

## スキル

現在のCodex向けrepo-local skillは [../.agents/skills](../.agents/skills) にあります。
旧ワークスペーススキルは [../.agent/skills](../.agent/skills) に残っています。
ここに置くのは再利用する作業手順であり、プロジェクトの正本ではありません。

## 更新ルール

- 挙動が変わったら仕様書を更新する
- どの文書を直すか迷ったら `ownership_map.md` を確認する
- 複数タスクをまたいで残す判断は `memory.md` に書く
- 再発見コストが高い判断は ADR に残す
- 文書や運用ルールを変えたら `npm run docs:check` を実行する
- 完了したタスク文脈は active に残さず `docs/done/` へ移す
- 古く膨らんだ文脈は `archive_policy.md` に従って整理する
