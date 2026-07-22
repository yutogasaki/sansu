# Task: Research Library Pop Return

- Date: 2026-07-19
- Owner: Codex `/root/gameplay_gap_audit`
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: None

## Goal

- 現行 `ReturnSummary` を「今回完成した1冊の調査ページ → 1つの物理レバー」へ再構成し、`不可思議な図鑑 70 : 遊びたくなるポップさ 30` の画風契約を390×844の帰還ループへ実装する。

## In Scope

- exploration用semantic color / paper / physical-action tokens
- `ResearchLibraryScene`、`ResearchBookStage`、`ResearchClueStampRail`、`ResearchRouteLever`
- `DiscoveryPageArt` の `reveal / book / thumbnail` variant
- 現行 `researchPage`、`replayTeaser`、`onRestart` だけを使う帰還構成
- 390×844で主CTAをabove-foldへ置き、56px以上の物理レバーとして表示
- DOMの順序を「本 → 主操作 → 補助情報」とし、既存標本、次の気配、退出操作を下へ維持
- reduced motion、200%文字拡大、ARIA、キーボードフォーカスの維持
- incomplete / completed / reduced-motionの実機相当スクリーンショット

## Out of Scope

- Persistence、Dexie、DB、reducer、`Explore.tsx` の変更
- 複数ページ棚、収集率、永続的なNEW表示、前回比較
- 同じ `onRestart` へつながる押下可能な2分岐
- 調査ページ進捗や発見の永続化を暗示するUI
- 新しいルート選択契約、学習ロジック、SRSへの接続

## SSOT References

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/07_ui_design_guideline.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`
- `design-system/MASTER.md`

## Docs To Touch

- Must update: `docs/product/12_screen_flow_spec.md`、`design-system/MASTER.md`、本active task、完了時のdone log
- Intentionally unchanged: `docs/product/13_data_storage_migration_spec.md`、Persistence active task、reducer、`Explore.tsx`、DB/PWA仕様

## Plan

1. 帰還Research Libraryの一時データ境界とabove-fold契約を画面仕様へ追加する。
2. semantic tokensと4つの再利用コンポーネント、`DiscoveryPageArt` variantを実装する。
3. `ReturnSummary` を新構成へ接続し、既存標本・teaser・exitを補助情報として保持する。
4. 対象テスト、型、lint、docs、build、E2E 14件と390×844の3状態を検証する。

## Definition of Done

- 実在する今回の調査ページ1冊だけが帰還画面の主役になる。
- 主CTAはamber系の物理レバーで56px以上、390×844で下端620px以内を目標にする。
- fakeな複数ページ、収集率、押せる2分岐、永続進捗表示がない。
- 操作ラベルと状態はDOM/ARIAで成立し、SVGへ焼き込まれない。
- reduced motionと200%文字拡大でも主操作へ到達できる。
- 既存標本、次の探検の気配、退出操作が主操作より後に残る。
- Relevant docs updated or explicitly declared unchanged.
- Done log entry created if the task ships.

## Verification

- Commands: 対象Vitest、`npm run docs:check`、`npm run typecheck`、`npm run lint`、`npm run test:run`、`npm run build`、`npm run e2e:smoke`
- Manual checks: 390×844 incomplete / completed / reduced-motion、200%文字拡大、主CTA寸法とviewport内位置、キーボードフォーカス、sound-offでの理解

## Progress

### Now

- Research Library帰還縦切り、実動線スクリーンショット、200%レイアウト監査、共有verificationを完了した。

### Next

- `未完成 → 算数操作 → 世界反応 → 観察線画` を同一構図でつなぐ次の専用遭遇sliceを、別taskとしてspec-firstで切る。

### Decision Notes

- 複数ページのLibrary一覧は発見feature永続化後に別縦切りで実装する。
- キーフレームの分岐は景色として扱い、実際の行き先選択は再出発後の既存path choiceへ任せる。
- 公式ゲーム比較のP0を受け、装飾ルートは押せそうなカードから低彩度の洞窟アーチへ変え、live companionを76pxへ拡大した。
- 意味を持つscene copyは12px以上、主CTAは実測60px・下端564pxとした。
- `action → world reaction → observation drawing` の強化はReturnSummaryの一時データ境界を越えるため、次の専用遭遇sliceへ残す。

### Risks

- 390×844で本を大きく見せながら主CTAを620px以内へ置くため、統計・標本・退出はbelow-foldへ送る。
- 共有CSS変更が探索中画面へ波及しないよう、新tokensはResearch Libraryから段階導入する。

### Verification Evidence

- Discovery-page target tests: 6/6 pass
- `npm run docs:check`: pass（既存の期限切れwarningのみ）
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run test:run`: pass（56 files / 537 tests）
- `npm run build`: pass（PWA / asset budgetを含む）
- `npm run e2e:smoke`: pass（18/18 scenarios、Research Library layout assertionsを含む）
- Actual 390×844: book 117–393px、primary action 504–564px / 60px、live companion 76px、route-stage button 1件、meaningful copy最小12px
- 200% layout equivalent: bookとprimary actionは非重複、horizontal overflowなし、primary action 56px以上
- Captures: `docs/design/research-library-2026-07-19/implementation-{incomplete,completed,reduced-motion}-390x844.png`

## Outcome

- 帰還画面を汎用サマリー先頭から、今回の実在する調査本1冊と1つの物理レバーが主役のResearch Libraryへ変更した。
- discovery artを`reveal / book / thumbnail` variantへ分け、実データ由来の3 clue stampsを再利用可能なcomponentとして接続した。
- 70:30の切り紙フィールドノートtokensを定義し、発見物・amber lever・76px companionへ視線を集めた。
- 未訪問routeは非操作の洞窟遠景へ留め、fake shelves、collection percentage、二重route action、永続化を誤解させる表示を追加しなかった。
- 実動線とisolated layoutの両方を`docs/design/research-library-2026-07-19`へ保存し、リモート環境でも監査できる状態にした。
