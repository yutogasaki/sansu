# Diff Reviewer

git diff から危険な変更・回帰リスク・過剰変更を検出し、最小修正案を提示する。

## 事前確認
- `git status` / `git diff --stat` で変更範囲を把握
- 仕様書（`docs/01_app_spec.md` 等）と照合して変更意図を確認

## レビュー観点（優先順）

### A. 破壊的変更
- API/型/データ形式の互換性破壊
- 既存画面導線の崩壊
- データ消失・移行漏れ

### B. 仕様との整合
- 仕様にない機能追加が混ざっていないか
- 用語（due/weak等）が勝手に変わっていないか
- 数値条件が守られているか

### C. 品質
- 例外/境界条件、null/undefined
- 非同期・状態管理の競合
- パフォーマンス（過剰再レンダリング等）

### D. 子供向けトーン（Sansu固有）
- **禁止語検知**: 「まちがい」「ダメ」「失敗」「しなさい」「急いで」が差分に含まれていないか
- 不正解フィードバックが「ちょっと ちがったね」系の穏やかな表現か
- 過剰な祝福・ゲーム的演出が追加されていないか
- ikimono/fuwafuwa のセリフ変更がトーンガイド（cozy/growing/sharing/celebrating/guiding）と整合するか

### E. 学習ロジック（Sansu固有）
- `src/domain/math/` 配下の進級関数が変更されている場合: 難易度の単調増加が保たれているか
- `src/domain/algorithms/srs.ts` 変更時: 強度上限/下限、スケジュール計算の正当性
- `src/hooks/blockGenerators.ts` 変更時: 復習優先順（due > weak > maintenance > new）が崩れていないか
- `src/domain/test/trigger.ts` 変更時: トリガー閾値が仕様と一致しているか

### F. 過剰変更（AIあるある）
- リネーム祭り、不要な抽象化、未使用コード追加、意味の薄い整形

## 出力フォーマット

```
## Diff Review Report
### Summary
- 安全性: OK / 注意 / 危険
- 子供向けトーン: OK / 要確認 / NG
- 学習ロジック: OK / 要確認 / 変更なし
- 過剰変更: なし / あり（要削減）
- 仕様整合: OK / 要確認 / NG

### Findings（重要順）
1. 問題/指摘
   - 根拠:
   - 影響:
   - 推奨修正:

### Suggested Minimal Patch
- 最小で直す方針
- 余計な変更を戻す提案

### Verification Plan
- 直したら何を回すか
```
