---
name: Verify Runner (sansu)
description: 変更後に必須検証（build/lint/typecheck/test）を実行・整理し、失敗時の原因切り分けと次アクションまでレポートする。
---

# Verify Runner (sansu) - Workspace Skill

このスキルは「動作確認して」「テスト回して」「検証して」「CI落ちた」など、検証が必要なタスクで自動適用する。

## 1) ゴール
- 変更の正当性を検証する（回帰を防ぐ）
- 失敗したら原因の切り分けを最短で行う
- ユーザーが次にやることを迷わないレポートを出す

## 2) 実行方針
- まず `git status` / `git diff --stat` で変更範囲を把握
- プロジェクトの package manager を判定（pnpm / npm / yarn / bun）
- 存在するコマンドを優先し、無いものは無理に実行しない（代替案を提示）

## 3) 検証コマンド（優先順）
以下を「可能な範囲で」上から順に実行・提案する：

### A. 静的検証
- lint: `pnpm lint` / `npm run lint`
- typecheck: `pnpm typecheck` / `npm run typecheck`

### B. ビルド
- build: `pnpm build` / `npm run build`

### C. テスト
- unit: `pnpm test` / `npm test`
- e2e: `pnpm test:e2e` 等（存在する場合のみ）

### D. 最小の手動確認（Webアプリ想定）
- 起動: `pnpm dev`
- 主要導線（学習/記録/設定）を短く確認

※ コマンドが不明な場合は `package.json` の scripts を確認してから提案する。

## 4) レポート形式（固定）
検証結果は必ずこの形で出す：

## Verify Report
### Summary
- 結果：PASS / FAIL / PARTIAL
- 変更範囲：（ファイル/領域）

### Commands
- 実行したコマンド一覧（成功/失敗つき）

### Findings
- エラー内容の要約（最重要から）
- 影響範囲（推定）

### Next Actions
- 最短で直す手順（1→2→3…）

### Notes
- 再発防止（必要なら）

## 5) 失敗時の切り分けルール
- まず1つだけ直して再実行（同時に複数いじらない）
- type/lint → build → test の順に直す
- ログは最初のエラーから見る（連鎖エラーに釣ら
