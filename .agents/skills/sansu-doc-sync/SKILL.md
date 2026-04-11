---
name: sansu-doc-sync
description: Decide whether a Sansu code or process change requires updates to specs, memory, runbooks, ADRs, or task docs. Use after implementation or when asking whether docs must change.
---

# Sansu Doc Sync

## Read First

1. `CONSTITUTION.md`
2. `docs/ownership_map.md`
3. `docs/01_app_spec.md`
4. `docs/verification_matrix.md`
5. `docs/memory.md`
6. The relevant diff

## Decision Flow

1. Classify the change:
   - Spec change
   - UI or tone change
   - Verification or process change
   - Data or migration change
   - Internal refactor only
2. Update the actual source-of-truth first
3. Check whether the decision is durable enough for `docs/memory.md` or an ADR
4. Check whether any runbook or verification rule changed

## Output Format

## Doc Sync Report

### Summary
- Change type:
- SSOT update needed: Yes / No

### Required Updates
- file: reason

### Optional Updates
- file: reason

### No-Change Justification
- file: reason

## Rules

- Never update a status doc instead of the real SSOT
- Never store temporary task notes in `docs/memory.md`
- Never use done logs as present-tense behavior truth
