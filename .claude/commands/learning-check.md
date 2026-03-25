# Learning Logic Check

学習アルゴリズムの正当性を検証する。SRS、進級関数、問題生成、セッション構成、テストトリガーが仕様通りに動作しているか確認する。

## 参照順
1. `docs/01_app_spec.md` — 学習ロジックの親仕様
2. `docs/02_math_skills.md` — 算数スキル定義と進級基準
3. `docs/04_math_problems.md` — 問題タイプと視覚足場
4. 変更差分（`git diff`）または指定ファイル

## 検証対象と主要ファイル

### A. SRS（間隔反復）
- `src/domain/algorithms/srs.ts` / `.test.ts`
- 強度スケーリング: 正解→+1 (max 5)、不正解→-1 (min 1)
- 次回復習: 学習日境界（wall-clock timeではない）でのスケジュール
- Wilson下限スコア: 習得度の保守的推定

### B. 進級関数（数感覚・四則演算）
- `src/domain/math/numberSenseProgress.ts` / `.test.ts` — 29+スキルの段階的難易度
- `src/domain/math/additionProgress.ts` / `.test.ts`
- `src/domain/math/subtractionProgress.ts` / `.test.ts`
- `src/domain/math/comparisonProgress.ts` / `.test.ts`
- `src/domain/math/sequenceProgress.ts` / `.test.ts`
- 確認: `selectXxxPattern(practiceCount)` が単調増加的に難しくなるか、範囲を逸脱しないか

### C. 問題生成器
- `src/domain/math/generators/` 配下
- 視覚タイプ（5-frame, 10-frame, number-card等）が練習回数に応じて正しく遷移するか
- 子供の進度に対して不適切な難易度の問題が出ないか

### D. セッション・ブロック構成
- `src/hooks/blockGenerators.ts` / `.test.ts`
- `src/hooks/useStudySession.logic.ts` / `.test.ts`
- ブロックサイズ: periodic-test=20, check-event=20, weak-review=10, normal=10
- 復習優先順: due > weak > maintenance > new
- ファミリー多様性: 同じスキルファミリーの連続を避ける

### E. テストトリガー
- `src/domain/test/trigger.ts` / `.test.ts`
- pre-levelup: 完了率 ≥90% (math) / ≥85% (vocab)
- slow: レベル滞留日数超過
- struggle: 1日120回超 + 正答率 <50%
- クールダウン: 前回テストから約7日

## 検証手順

1. `git diff --stat` で学習ロジック関連ファイルの変更を特定
2. 該当するテストを個別実行:
   - `npx vitest run src/domain/algorithms/srs.test.ts`
   - `npx vitest run src/domain/math/`
   - `npx vitest run src/hooks/blockGenerators.test.ts`
   - `npx vitest run src/hooks/useStudySession.logic.test.ts`
   - `npx vitest run src/domain/test/trigger.test.ts`
3. 変更内容をレビュー:
   - 進級関数の出力範囲が仕様通りか
   - 新しいスキル/レベル追加時に既存の進級パスが壊れていないか
   - SRSパラメータの変更が学習体験に与える影響

## 出力フォーマット

```
## Learning Logic Report
### Summary
- テスト結果: PASS / FAIL
- ロジック整合: OK / 要確認

### Tests Run
- コマンドと結果一覧

### Logic Review
1. 確認した変更
   - 影響範囲:
   - 仕様との整合:
   - リスク:

### Recommendations
- テスト追加が必要な箇所
- 仕様確認が必要な点
```

## 禁止
- テストが通っているだけで「問題なし」と断定しない（カバレッジ外の変更を見逃さない）
- 進級関数のパラメータを仕様確認なしに変更しない
- SRSの閾値変更は学習体験への影響を必ず記述する
