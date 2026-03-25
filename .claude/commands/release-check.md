# Release Check

リリース前の品質・PWA・docs・運用リスクをまとめて確認する。

## 参照順
1. `CONSTITUTION.md`
2. `docs/verification_matrix.md`
3. `docs/runbooks/release-checklist.md`
4. `docs/runbooks/pwa-release.md`（PWA関連なら必須）
5. 変更差分

## 最低確認コマンド
1. `npm run docs:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:run`
5. `npm run build`
6. `npm run e2e:smoke`（release-sensitiveフロー）

## 観点

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

## 出力フォーマット

```
## Release Check Report
### Summary
- Ready / Not Ready / Needs Follow-up

### Checks
- 実行したコマンド（結果つき）
- 手動確認した観点

### Risks
- 高リスク項目
- 未確認項目

### Required Follow-ups
- 直前にやること
- リリース後に監視すること
```
