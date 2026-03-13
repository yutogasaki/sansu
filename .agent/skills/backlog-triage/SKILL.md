---
name: Backlog Triage (sansu)
description: backlog と status 文書を整理して、active task / done / archive / spec の境界を保つ。
---

# Backlog Triage (sansu) - Workspace Skill

このスキルは「backlog 整理して」「status 文書が重い」「active task に切りたい」のような依頼で使う。

## 1) ゴール

- backlog と status 文書の肥大化を防ぐ
- active / done / archive / SSOT の境界を保つ
- 次にやることが一目で分かる状態を作る

## 2) 参照順

1. `CONSTITUTION.md`
2. `docs/ownership_map.md`
3. `docs/archive_policy.md`
4. `docs/runbooks/backlog-triage.md`
5. 対象 backlog / status doc

## 3) 判定フロー

### A. 項目の種類を決める

- 今やる active task
- 先送りの backlog
- 完了済みの done
- もう熱くない archive
- 本当は spec / memory / runbook に移すべき内容

### B. 整理する

- active は `docs/tasks/active/` に切り出す
- 完了済みは `docs/done/` に寄せる
- 古い進捗は `docs/archive/` を検討する
- SSOT っぽい内容は正しい doc を更新する

### C. 鮮度を上げる

- `更新日` を更新する
- `次回棚卸し目安` を入れる
- 直近優先度を 3〜5 件に圧縮する

## 4) 出力フォーマット

## Backlog Triage Report

### Summary
- Current doc health:
- Main stale areas:

### Moves
- to active:
- to done:
- to archive:
- to SSOT:

### Updated Priorities
- now:
- next:
- later:

### Verification
- 実施した確認

## 5) 禁止

- backlog 文書に実装日報を積み続けない
- done を current truth として扱わない
- status 文書だけ更新して spec 変更を放置しない
