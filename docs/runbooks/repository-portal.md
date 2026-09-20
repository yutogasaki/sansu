# リポジトリHTMLポータル

## Purpose

タスク・リポジトリの概要・ドキュメントをブラウザで確認するためのローカル閲覧用ページ。
アプリの機能・学習・保存・配布仕様は変更しないため、プロダクト仕様の変更は不要。

## 入口

- [リポジトリ概要](../../.agents/index.html)
- [現在のタスク](../../.agents/tasks/index.html)
- [ドキュメント索引](../index.html)

HTMLはファイルを直接ブラウザで開ける。サーバーや外部通信は不要。
タスクは「詳細を読む」で元のMarkdown本文を確認できる。各カードのタイトルは正本へのリンク。
ページ内検索でタイトル・パス・説明を絞り込める。タスクは詳細本文も検索対象。

## 更新

正本のMarkdownを編集したら、リポジトリのルートで実行する。

```bash
npm run agent:index
npm run agent:index:check
npm run docs:check
```

生成HTMLを直接編集しない。生成器は `tools/generate-agent-index.mjs`。
更新漏れチェックは元の文書から再計算したHTMLと比較し、不一致なら失敗する。

## Source of truth

実行中の一覧は `.agents/tasks/TASKS.md`、詳細はそこから参照する `docs/tasks/active/*.md`。
保留は `.agents/tasks/BLOCKED.md`、計画は `docs/tasks/backlog.md`、完了履歴の入口は `.agents/tasks/DONE.md`。
履歴や古い詳細ファイルの存在から現在のタスク状態を推測しない。
HTMLは生成時点のスナップショットであり、公開・検証完了の判定には使わない。
