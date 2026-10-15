# Sansu

Child-friendly math and English learning PWA.

Standard project portal: [portal/index.html](portal/index.html). Generate with
`npm run portal:build`, verify with `npm run portal:verify` (Node.js 24+).
The app's existing runtime requirements and build commands remain unchanged.
Source roles and retained specialist pages: [portal guide](docs/portal/README.md).

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
