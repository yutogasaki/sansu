# CLAUDE.md

## Project Overview

子供向け算数・英語学習PWAアプリ。完全クライアントサイド、オフラインファースト設計。

**Tech Stack**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Dexie (IndexedDB)

## Setup

```bash
nvm use          # Node 22 (.nvmrc)
npm ci           # Install dependencies
npm run dev      # Start dev server
```

E2Eテストを実行する場合:
```bash
npx playwright install chromium
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | TypeScript + Vite本番ビルド |
| `npm run test:run` | Vitestテスト実行 |
| `npm run lint` | ESLintチェック |
| `npm run typecheck` | TypeScript型チェック |
| `npm run verify:core` | 全検証 (docs + lint + typecheck + test + build) |
| `npm run verify:release` | verify:core + e2eスモークテスト |
| `npm run e2e:smoke` | Playwrightスモークテスト |

## Project Structure

```
src/
├── components/   # UIコンポーネント
├── pages/        # ルートページ
├── hooks/        # カスタムReact Hooks
├── domain/       # ビジネスロジック
├── utils/        # ユーティリティ
├── db/           # Dexie (IndexedDB) セットアップ
├── assets/       # 画像等の静的アセット
├── App.tsx       # ルートコンポーネント
├── main.tsx      # エントリーポイント
└── pwa.ts        # PWA初期化
```

## Docs Structure（読み順）

1. `CONSTITUTION.md` — 最上位の原則。すべてに優先
2. `docs/01_app_spec.md` — 親仕様。プロダクト挙動の正本
3. `docs/02_*〜09_*` — 子仕様（算数・英語・画面・デザイン・バトル等）
4. `docs/verification_matrix.md` — 変更種別ごとの必須チェック一覧
5. `docs/ownership_map.md` — 「どこを直すか」迷ったらここ
6. `docs/memory.md` — プロジェクトの永続知識（チーム向け）
7. `docs/risk_register.md` — 横断的リスクと緩和策
8. `docs/runbooks/` — 運用手順（リリース・スキーマ変更・バックログ整理・PWA）
9. `docs/tasks/active/` — 進行中タスク
10. `docs/done/` — 完了ログ（履歴のみ、現行挙動の正本ではない）

## Slash Commands（`.claude/commands/`）

### Tier 1: アプリ固有（このアプリの核心を守る）

| コマンド | 用途 |
|----------|------|
| `/project:ux-tone` | 子供向けUI文言のトーン監査（禁止語検知、やさしい表現への修正案） |
| `/project:learning-check` | 学習アルゴリズムの正当性検証（SRS・進級・問題生成・セッション構成） |

### Tier 2: 開発ワークフロー

| コマンド | 用途 |
|----------|------|
| `/project:verify` | 変更後の検証実行と結果診断 |
| `/project:doc-sync` | コード変更に伴うdocs更新の要否判定 |
| `/project:review` | diff レビュー（汎用 + 子供トーン・学習ロジックのアプリ固有観点含む） |

### Tier 3: 状況別

| コマンド | 用途 |
|----------|------|
| `/project:design-review` | UIトーン・一貫性・A11yレビュー |
| `/project:release-check` | リリース前の品質・PWA・docs確認 |

### 推奨ワークフロー

コード変更後:
1. `/project:verify` — lint/typecheck/test/buildの実行と診断
2. `/project:doc-sync` — 仕様・memory・ADR・runbookの更新要否を判定
3. `/project:review` — リグレッションと過剰変更の検知（アプリ固有観点含む）

UI/コピー変更時は追加で:
4. `/project:ux-tone` — 子供向けトーン監査
5. `/project:design-review` — デザインレビュー

学習ロジック変更時は追加で:
4. `/project:learning-check` — アルゴリズム検証

リリース前:
6. `/project:release-check` — 最終ゲート

### Legacy Skills（`.agent/skills/`）

旧エージェント向けの10スキルが `.agent/skills/` に残存。主要7つは上記slash commandsに移植済み。
残り（`project-rule`, `commit-pr`, `spec-writer`, `backlog-triage`）は参照用として残置。

## Design References

UI変更時に参照すべきドキュメント:
- `docs/07_ui_design_guideline.md` — トーン・トークン・色・余白の正本
- `docs/design_review_checklist.md` — レビュー観点チェックリスト
- `docs/10_design_refresh_status.md` — 進捗状態（正本ではない）

原則: 穏やかで競争を煽らない。子供に安全、親に明確。

## Architecture Notes

- **オフラインファースト**: データはすべてIndexedDB (Dexie)に保存。外部API依存なし
- **PWA**: Workbox Service Workerによるキャッシュ戦略。フォントのランタイムキャッシュあり
- **デプロイ**: Vercel（静的サイト）
- **バージョン管理**: `__APP_VERSION__` グローバル変数、`/version.json` エンドポイント

## Principles

`CONSTITUTION.md` が最上位の原則。主要ポイント:
- Spec first (`docs/01_app_spec.md` が親仕様)
- 変更は一つの目的に絞る
- 検証は必須（`docs/verification_matrix.md` 参照）
- 子供にやさしく、親にわかりやすいUX
- 高リスク領域: ルーティング、ストレージ、テスト、PWA/更新フロー

## Memory の役割分担

| 場所 | 役割 | 対象 |
|------|------|------|
| `docs/memory.md` | プロジェクトの永続知識 | チーム全体（SSOT関係、検証基準、リスク領域） |
| `.claude/projects/` メモリ | Claude Codeとの対話最適化 | AI向け（ユーザー情報、フィードバック、対話スタイル） |

二重管理を避ける: プロジェクト知識は `docs/memory.md` に、Claude Code固有の学習は `.claude/projects/` メモリに。

## Context Pollution Prevention

- **CLAUDE.md はポインタに徹する** — 詳細はdocs/配下を参照させ、ここに複製しない
- **skills は手順、docs はルール** — doc-sync skillが乖離を検知する
- **status docs (10_*, 11_*, 12_*) は正本ではない** — `docs/ownership_map.md` 参照
- **done ログから現行挙動を読まない** — 正本側を確認する
- **archive_policy.md** に従い、肥大化したdocsはアーカイブする
