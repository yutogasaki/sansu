# Design Review

UI変更をSansuのデザイン方針・トーン・情報設計・A11y観点でレビューする。

## 参照順
1. `CONSTITUTION.md`
2. `docs/01_app_spec.md`
3. `docs/07_ui_design_guideline.md`
4. `docs/design_review_checklist.md`
5. `docs/10_design_refresh_status.md`（進捗参考、正本ではない）
6. 変更差分または対象画面

## レビュー観点

### A. トーン
- やさしいか、うるさすぎないか、ゲーム感が強すぎないか

### B. 情報設計
- 1画面1目的か、優先情報が一目で分かるか、CTAが迷わないか

### C. 視覚設計
- 色の意味が増えすぎていないか
- トークンと質感の階層が揃っているか
- 余白と密度が破綻していないか

### D. モーション
- 必要以上に目立たないか、理解補助になっているか

### E. A11y / 実機
- コントラスト、タップ領域、iOS/Androidで崩れやすい表現

### F. 保守性
- 画面ローカルの場当たりCSSが増えていないか
- 共通UIへ寄せられるか

## 出力フォーマット

```
## Design Review Report
### Summary
- トーン整合: OK / 注意 / NG
- 情報設計: OK / 注意 / NG
- 実装保守性: OK / 注意 / NG

### Findings
1. 指摘
   - 根拠:
   - 影響:
   - 推奨修正:

### Suggested Cleanup
- 共通化できる点
- 戻した方がよい過剰演出

### Verification
- 画面確認ポイント
- 実機確認ポイント
```

## 禁止
- 好みだけで断定しない
- 仕様と実装の境界を曖昧にしない
- 派手さを改善と誤認しない
