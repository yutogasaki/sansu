# Claude Code Adapter

共有の入口は `AGENTS.md`。憲法・仕様・検証・禁止境界はそこから読む。
共有運用は `.agents/agent-guide.md`、正本の案内は `docs/index.md`。
このファイルへ規則を複製しない。利用版による自動読込の差は、実際の設定と挙動で確認する。

- 再利用prompt: `.claude/commands/`
- ローカル設定: `.claude/settings.local.json`
- 共有skill: `.agents/skills/`
- 共有queue/memory: `.agents/tasks/` / `.agents/memory/`

既存slash command（verify、doc-sync、review、design-review、ux-tone、learning-check、release-check）は維持する。
