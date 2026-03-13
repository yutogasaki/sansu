# Workspace Glossary

## Purpose

This glossary defines workspace and documentation terms.
Application-domain terms such as `due`, `weak`, `strength`, and `nextReview` remain defined in [01_app_spec.md](01_app_spec.md#51-用語概念定義).

## Documentation Terms

| Term | Meaning | Notes |
|---|---|---|
| Constitution | The highest-priority principles for this repo | See [../CONSTITUTION.md](../CONSTITUTION.md) |
| SSOT | Single source of truth for a topic | Only one doc should hold final truth |
| Rule | Operational rule derived from the constitution | Lower priority than spec/constitution |
| Skill | Reusable workflow for repeated tasks | Lives under `/.agent/skills` |
| Task | Active execution context | Short-lived, current work only |
| Done | Historical completion record | Not current truth |
| Memory | Durable project memory | Long-lived facts and decisions only |
| ADR | Architecture Decision Record | For non-obvious decisions |
| Runbook | Operational procedure | Release, recovery, migration, etc. |
| Verification | Required checks before work is considered complete | See [verification_matrix.md](verification_matrix.md) |
| Ownership Map | Doc-to-topic map for deciding the right SSOT | See [ownership_map.md](ownership_map.md) |
| Archive Policy | Rules for splitting, trimming, or archiving stale context | See [archive_policy.md](archive_policy.md) |
| Risk Register | Durable list of cross-cutting risks and current mitigations | See [risk_register.md](risk_register.md) |
| Review By | Date for revisiting an active task before it goes stale | Used in active task files |
| Backlog Triage | Periodic cleanup and reprioritization of backlog/status docs | See [runbooks/backlog-triage.md](runbooks/backlog-triage.md) |

## Source Boundaries

- App behavior terms belong in the parent spec.
- Documentation/process terms belong here.
- If a term appears in both places, one must become a pointer instead of a duplicate definition.
