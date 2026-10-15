# Sansu AI Entry

子どもが自分から戻りたくなる、算数・英語と育つ島のPWA。
製品固有の憲法・仕様・検証条件を共通標準より優先する。

## 正本と読む順

1. `CONSTITUTION.md` → `docs/product/01_app_spec.md`（親仕様）
2. `.agents/agent-guide.md`（共有運用）→ `docs/index.md`（文書地図）
3. `.agents/tasks/TASKS.md`（実行キュー）、`.agents/tasks/BLOCKED.md`（確認待ち）、`docs/tasks/backlog.md`（後続候補）
4. `.agents/memory/durable.md`（運用メモ）、`docs/wiki/memory.md`（製品の長期判断）
5. `docs/ai/verification_matrix.md`（変更別の必須検証）

UIは `docs/product/07_ui_design_guideline.md`、`docs/product/design_review_checklist.md`、`design-system/MASTER.md`。
島の仕様は憲法§5から選ぶ。旧Exploreだけの作業は仕様10・11・12・14・15を読む。
画像からの制作は `.agents/skills/sansu-art-direction-loop/SKILL.md` を先に使う。
実画面と採用benchmarkを比較し、美術・無説明理解/安全・runtimeを別判定する。
画像主導の配布証拠にはapp対象・revision・delivery flag・candidate ID・主要旅程のcontact sheetが必要。

## 変更境界

- `src/`・`public/` は製品、`docs/` は仕様・判断・手順、`.agents/` は共有運用・タスク・スキル。
- `.claude/` はClaudeの薄いadapter。`.codex/` は必要なときだけ作る。
- `portal/` は共通builderの生成物。入力は `docs/portal/`、固有処理は `scripts/`。
- 既存正本は移動せず、役割と旧パスを `docs/index.md`・`docs/maps/index.md` から案内する。
- 一変更一目的、仕様先行。保存・routing・テスト・PWA更新は高リスク。子どもを責める表現を使わない。
- 既存の未commit変更は保持し、他の仕事の変更を取り込まない。完了ログを現在の仕様にしない。

## 検証と完了

`nvm use`、`npm ci`、`npm run dev`。アプリの変更は検証matrixに従う。
基本は `npm run docs:check`、`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`。
配布に関わる変更は `npm run e2e:smoke`、必要に応じ `npm run verify:release`。
入口は `npm run agent:index:check`、標準ポータルは `npm run portal:verify`。
証拠は対象版/入力hash・日時・コマンド・期待/実結果・未確認範囲を持つ。
変更・検証・残課題を報告して閉じる。自動検証を子どもの理解・再訪や公開版の合格へ読み替えない。

共通契約は `scripts/vendor/hub-standard/1.0.0/REPO_STANDARD.md` の固定版。
正本はhubの `common-ai/REPO_STANDARD.md`。lockのhub commitとSHAを検査し、更新は別変更で扱う。
旧 `_common-ai` への共有ガイド内の参照は互換履歴であり、共通標準の更新先はhub。
公開・デプロイ・DB移行・外部送信・pushは人の明示承認が必要。ローカルcommitも依頼された範囲に限る。
