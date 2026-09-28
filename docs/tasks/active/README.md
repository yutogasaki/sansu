# Active Tasks

## Purpose

現在の実行中の正本は[共有キュー](../../../.agents/tasks/TASKS.md)。2026-09-29に4担当へ集約した。既存リンクを保つため、v3・家DEV試作・横断索引・旧探索の確認待ちは参照資料として残す。各冒頭の状態を優先し、ファイル数を実行件数に数えない。
If a task is done, move the outcome to `docs/done/` and remove the active file.
Track the shared queue entry separately in `.agents/tasks/TASKS.md`.

## Rules

- One file per active task
- One primary purpose per file
- Link the governing spec and verification plan
- Include a `Review By` date so stale tasks get revisited
- Record which docs/ADR/runbooks must change or are intentionally unchanged
- Keep the file short
- Close, trim, or archive stale tasks according to [../../archive_policy.md](/docs/ai/archive_policy.md)

## Naming

- `YYYY-MM-DD-short-task-name.md`

## Template

Start from [TEMPLATE.md](TEMPLATE.md).
