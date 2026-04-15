# Verify Runner

変更後の検証を実行し、失敗時は原因切り分けと次アクションをレポートする。

## 手順

1. `git status` と `git diff --stat` で変更範囲を把握
2. `docs/ai/verification_matrix.md` を参照し、変更種別に応じた必須チェックを特定
3. 以下を優先順に実行:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:run`
   - `npm run build`
   - 必要に応じて `npm run e2e:smoke`
4. 結果をレポート

## 出力フォーマット

```
## Verify Report
### Summary
- 結果: PASS / FAIL / PARTIAL
- 変更範囲:

### Commands
- 実行したコマンド一覧（成功/失敗つき）

### Findings
- エラー内容の要約（最重要から）
- 影響範囲（推定）

### Next Actions
- 最短で直す手順
```

## 失敗時のルール
- 1つだけ直して再実行（同時に複数いじらない）
- type/lint → build → test の順に直す
- ログは最初のエラーから見る（連鎖エラーに釣られない）
