---
name: Doc Sync (sansu)
description: 実装差分や運用変更から、更新すべき spec・memory・ADR・runbook を判定して docs 更新漏れを減らす。
---

# Doc Sync (sansu) - Workspace Skill

このスキルは「docs も更新必要？」「仕様同期して」「SSOT 漏れない？」のような依頼で使う。

## 1) ゴール

- 実装変更後の docs 更新漏れを減らす
- どの doc が本当の更新先かを早く決める
- memory / ADR / runbook へ昇格すべき判断を見逃さない

## 2) 参照順

1. `CONSTITUTION.md`
2. `docs/ownership_map.md`
3. `docs/01_app_spec.md`
4. `docs/verification_matrix.md`
5. `docs/memory.md`
6. 対象差分または対象ファイル

## 3) 判定フロー

### A. 変更タイプを決める

- 仕様変更
- UI/トーン変更
- 検証/運用変更
- データ/移行変更
- 純粋な内部整理

### B. 更新先を決める

- SSOT が変わるなら、まずその doc を更新する
- status だけ変わるなら status doc だけ更新する
- 高コストで再発しそうな判断は `memory` か `ADR` を検討する
- 手順変更なら `runbook` を更新する

### C. 追加確認

- `risk_register.md` の緩和策に影響するか
- `verification_matrix.md` の要求に影響するか
- `done` に残すべき完了事実があるか

## 4) 出力フォーマット

## Doc Sync Report

### Summary
- Change type:
- SSOT update needed: Yes / No

### Required Updates
- file:
  - reason:

### Optional Updates
- file:
  - reason:

### No-Change Justification
- file:
  - reason:

### Verification Note
- 実行した確認

## 5) 禁止

- status doc だけ更新して SSOT を放置しない
- memory に一時メモを入れない
- done log を現行仕様の根拠にしない
