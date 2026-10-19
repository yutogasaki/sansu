# 正本・旧パスと生成元の地図

2026-10-15、H-018の段階移行。役割を揃え、既存正本は移動しない。

| 役割 | 正本・入口 | 生成表示・検証 |
| --- | --- | --- |
| 目的・優先順位 | [憲法](../../CONSTITUTION.md)、[親仕様](../product/01_app_spec.md) | 仕様本文をポータルへ置換しない |
| 戦略 | [島構築](../product/island-construction-strategy.md)、[美術](../product/island-art-strategy.md) | [日付付き観測](../strategy/current-state-2026-10-15.md) |
| 製品・学習地図 | [仕様書の地図](../product/README.md)、[正本の所有関係](../ai/ownership_map.md) | `.agents/map.html` ← `tools/generate-agent-index.mjs` |
| 島の体験・育成の関係 | [完全マップ](../product/island-system/README.md) | 全品の旧台帳、採用したv0.4と実装後の関係をたどる。規則の正本は52、保存は13 |
| 判断 | `docs/adr/`、[確認待ち](../../.agents/tasks/BLOCKED.md) | 重要決定は既存ADR、未確認を採用済みにしない |
| タスク | [共有キュー](../../.agents/tasks/TASKS.md)、[後続候補](../tasks/backlog.md)、[読み方](../tasks/README.md) | 詳細は `docs/tasks/active/`、履歴は `docs/done/` |
| 品質証拠 | [検証matrix](../ai/verification_matrix.md)、既存 `docs/design/` | H-018限定の `qa/evidence/h-018/`。対象版・hash・日時・範囲を記録 |
| AI | [AGENTS](../../AGENTS.md)、[共有ガイド](../../.agents/agent-guide.md)、[Claude adapter](../../CLAUDE.md) | `.agents/skills/` は共有、`.claude/` は固有adapter |
| 共通入口 | [ポータル契約](../portal/README.md)、`docs/portal/metadata.json` | `scripts/standard-portal.mjs` → `docs/portal/project.json` → `portal/` |

既存 `tools/` は移動せず、新adapterと固定vendorだけを `scripts/` に追加した。旧URL・生成コマンドとの対応とWebP回避はポータル契約を参照する。
