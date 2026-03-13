---
name: Release Check (sansu)
description: リリース前や配信まわりの変更時に、品質・PWA・文書更新・運用リスクをまとめて確認する。
---

# Release Check (sansu) - Workspace Skill

このスキルは「リリース前チェックして」「配信まわり大丈夫？」「本番前の確認をしたい」のような依頼で使う。

## 1) ゴール
- リリース直前の見落としを減らす
- PWA・配信・ドキュメント更新の抜けを防ぐ
- ユーザー影響とロールバック観点を残す

## 2) 参照順
1. `CONSTITUTION.md`
2. `docs/verification_matrix.md`
3. `docs/runbooks/release-checklist.md`
4. `docs/runbooks/pwa-release.md`（PWA関連なら必須）
5. 変更差分

## 3) 最低確認
- docs:check
- lint
- typecheck
- test
- build
- release-sensitive flows の smoke

## 4) 観点
### A. 品質
- 静的検証が通っているか
- 回帰テストの不足はないか

### B. UX
- 子ども/保護者向けトーンが崩れていないか
- 主要導線に違和感がないか

### C. 運用
- PWA更新やキャッシュに影響しないか
- データ移行や既存プロフィールに影響しないか
- ロールバック時の手掛かりがあるか

### D. 文書
- spec/memory/ADR/runbook 更新漏れがないか

## 5) 出力フォーマット
## Release Check Report
### Summary
- Ready / Not Ready / Needs Follow-up

### Checks
- 実行したコマンド
- 手動確認した観点

### Risks
- 高リスク項目
- 未確認項目

### Required Follow-ups
- 直前にやること
- リリース後に監視すること
