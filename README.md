# Sansu

Child-friendly math and English learning PWA.

作業入口は[元ポータル](.agents/index.html)です。
[統合ポータルの生成・開き方](docs/portal/README.md#生成と正本)。生成後は `portal/index.html` から開きます。ポータルは確認中です。全件の受入が完了するまで元の入口を維持します。

Generate the integrated portal with
`npm run portal:build`, verify with `npm run portal:verify` (Node.js 24+).
The app's existing runtime requirements and build commands remain unchanged.
Source roles and retained specialist pages: [portal guide](docs/portal/README.md).

hubは横断状況と、このリポのポータルへの直接入口を持ちます。
本文・画像・操作をhubの別の現行ポータルへ複製・同期する運用は行いません。
未受入の元画面、判断・検証の履歴、必要な復旧資源は保持します。
hubローカルサーバーの起動中は、[確認中の統合版を直接開けます](http://127.0.0.1:47860/repos/sansu/portal/index.html)。
旧資料にあるhubコピー・画像変換・同期の手順は、移行前の記録として扱います。

## Start Here

- Product and project documentation: [docs/index.md](/Users/yutogasaki/Projects/sansu/docs/index.md)
- Codex entry point: [AGENTS.md](/Users/yutogasaki/Projects/sansu/AGENTS.md)
- Claude Code entry point: [CLAUDE.md](/Users/yutogasaki/Projects/sansu/CLAUDE.md)

## Local Setup

```bash
nvm use
npm ci
npm run dev
```

## Core Checks

- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run e2e:smoke`
