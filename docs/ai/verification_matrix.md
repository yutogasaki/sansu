# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.
GitHub Actions should mirror the same baseline for `docs:check` and `verify:core`.

## Current Commands

| Command | Purpose |
|---|---|
| `npm run docs:check` | Docs/process link and structure checks |
| `npm run lint` | Static linting |
| `npm run typecheck` | Fast TypeScript verification |
| `npm run test:run` | Unit/integration tests |
| `npm run assets:check` | PWA precache・探索画像の容量と制作物混入を検査 |
| `npm run build` | TypeScript build + production build + `assets:check` |
| `npm run e2e:smoke` | Smoke E2E for critical flows |
| `npm run e2e:print` | 実Settingsで紙テスト作成・再印刷・採点・取消とA4 PDFの意味／改ページを390×844・768×1024で検査。DEVを5199で起動。`SANSU_PRINT_BASE_URL`で変更可能 |
| `npm run e2e:learning-progress` | 旧英語プロフィールの次レベル練習開始と、当日停止／生成エラー時の復習導線を実Studyで検査。DEVを5199で起動。`SANSU_LEARNING_PROGRESS_BASE_URL`で変更可能 |
| `npm run e2e:pwa-update` | Production-preview regression for protected-route and same-route update checkpoints |
| `npm run e2e:park` | Flag有効のDEVで制作・配置・再演・再開・プロフィール分離とphone/tabletの入力を検査 |
| `npm run e2e:park-pwa` | Flag有効のproduction previewで遊園地の更新checkpoint・保存hold・旧run優先を検査 |
| `npm run e2e:island` | 島の通常planner入力・報酬保留・配置・住民経路・成長・表示復旧をDEVで検査 |
| `node tools/e2e-island-3d.mjs` | 島productionのdrag/取消/接触/局所反応/描画資源を検査。`SANSU_ISLAND_PRODUCTION_URL`で固定build、出力先はscriptの3D専用環境変数を指定 |
| `node tools/e2e-island-learning.mjs` | 島の全入力・意味保持・連打・支援再開・表示復旧を検査。`SANSU_ISLAND_PRODUCTION_URL`指定時は同一buildの6形式×phone/tabletと候補IDを照合 |
| `node tools/e2e-island-recovery.mjs` | 島productionの誤答訂正・bridge・元skillの独力再確認と、英語Due巡回をphone/tabletの実UIと保存記録で検査 |
| `node tools/e2e-island-play.mjs` | 島productionの自由遊び・3住民の参加・通路復旧・学習再開をphone/tabletで検査。自由遊び前後の全DBテーブル不変も照合 |
| `npm run e2e:island-pwa` | 島有効production previewの更新checkpoint・保存hold・実SW offlineを検査 |
| `npm run benchmark:island-fixed-ten` | Study / Islandを固定10問、phone/tablet各10反復で比較。6問区切りの受取保留操作を含む |
| `npm run benchmark:fixed-ten` | Study / Exploreの固定10問throughput、回復、中断、game-only receipt整合を比較 |
| `npm run verify:core` | Docs check + full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E + production PWA checkpoint E2E |

## Matrix

| Change Type | Required Checks | Manual Checks | Notes |
|---|---|---|---|
| Docs only | `npm run docs:check` | Read-through for role/tone sanity | No app build required unless behavior text changed |
| Copy or content only | `npm run lint`, `npm run build` | Affected screen wording | Check tone for child/parent UX |
| Shared UI component | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Desktop + mobile layout sanity | Prefer screenshot or visual notes |
| Page-level UI/state | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Main flow through affected screen | Include modal, loading, error, empty state |
| Learning/domain logic | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Targeted scenario walkthrough | Add/update tests when logic changes |
| Exploration pure domain | `npm run docs:check`, `npm run lint`, `npm run typecheck`, targeted reducer/generator tests, `npm run test:run`, `npm run build` | Fixed-seed run, incorrect-answer penalty, voluntary return, energy depletion | Ensure energy never goes below zero and every run can end |
| Exploration page/routing | `npm run verify:core`, `npm run e2e:smoke` | Complete and replay one run on phone-width and tablet-width layouts; check reduced motion | Existing `/study`, `/battle`, onboarding, and private-route behavior must remain reachable |
| Mystic Island domain/page/storage | `npm run verify:core`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:island`, `npm run e2e:island-pwa`, `npm run benchmark:island-fixed-ten` | 390×844と768×1024で起動・連問・受取保留・配置/回転/収納・住民反応・再開。音off、reduced motion、実SW offlineも確認 | `dev:island` は5198。島有効production previewは5298。視覚・無文字理解/安全・runtimeは別判定 |
| Build-and-play domain/page/storage | `npm run verify:core`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:park`, `npm run e2e:park-pwa` | 390×844と768×1024で初回再演→制作→支援/再開→配置変更→次制作を確認。視覚的魅力・無文字理解・実装整合を別々に記録 | DEVはflag有効で5187、production previewはflag有効で5287を先に起動。接続先は各scriptの環境変数で変更可能。PWA hook検証と実機インストール検証を区別する |
| Image-led UI / encounter | `npm run verify:core`, `npm run e2e:smoke`, `npm run assets:check`, `npm run benchmark:fixed-ten` | On the actual app target, compare 390×844 and 768×1024 runtime screenshots beside the approved benchmark; capture launch through the next destination; verify full TenKey, fixed-question throughput, sound off, reduced motion, and cold-cache/PWA update | Fixed-tenはreportの `evidence.eligible = true` かつ `pass = true` とversioned監査への集計転記を必須とし、10反復未満をdiagnostic、通常planner真正性を別検証とする。Record build revision, delivery flag, rendered candidate ID, and cache state. Report visual magnetism, silent comprehension/safety, and runtime integrity separately; mixed legacy/HOLD visual lineage is a HOLD |
| Storage/schema/profile data | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Existing profile load/save | Write ADR or migration note if needed |
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run assets:check`, `npm run e2e:smoke`, `npm run e2e:pwa-update` | Real two-build install/update/reload path; iOS relaunch | Review host cache behavior, precache size, persistence-before-checkpoint, and production-asset boundaries too |
| Release candidate | All of the above | Critical path smoke on target devices | Include iOS/Android/PWA notes if relevant |

## Review Prompts

- Did the change touch a high-risk area from `memory.md`?
- Does `ownership_map.md` imply a doc or ADR update?
- Did the spec need updating?
- Is there a missing regression test?
- Is there a host/deploy side effect?
- Does `risk_register.md` need a new note or updated mitigation?

## Escalation Rule

If a task spans more than one change type, use the stricter row.

## Shortcut Commands

- 既存 `e2e:pwa-update` はclassicの初回導線を検査するため、Island/BuildPlay flagを無効にしたbuildを使う。別buildは `SANSU_PWA_PREVIEW_DIR` で指定でき、省略時は `dist`。島とParkの更新検査は各flagを有効にした対応buildで実行し、配布用の固定artifactと回帰用のflag構成を混同しない。

- Use `npm run docs:check` for docs/process-only changes.
- Use `npm run verify:core` when a change touches code across multiple layers.
  It already includes `npm run docs:check`.
- Use `npm run verify:release` for release-sensitive changes.
