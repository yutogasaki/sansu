# 11 全体タスク台帳（進捗・未着手・次アクション）

更新日: 2026-02-16

## 0. 目的

この台帳は、デザインだけでなく機能・アルゴリズム・品質・運用を含めて、

- どこまで終わっているか
- 何が未着手か
- 次にどの大物をやるべきか

を一元管理するための最新ステータスである。

---

## 1. 進捗サマリ（領域別）

- UI/UX刷新: `75%`（主要画面は概ね反映、共通部品と一部ページが残）
- 機能実装: `80%`（v1主要フローは実装済み、将来機能は未着手）
- アルゴリズム: `70%`（主要ロジックは稼働、筆算は結果入力型からの深化が残）
- テスト/品質: `70%`（ユニット増強済み、E2Eはスモーク中心）
- 運用/仕様整備: `55%`（同期・マイグレーション・調整運用の文書化が不足）

---

## 2. 実施済み（完了）

### 2.1 デザイン・UI

- トークン/背景/ガラス調の基盤を再設計（`src/index.css`）
- 共通UI更新（`Button`/`Card`/`Layout`/`Header`/`Footer`）
- Home刷新（情報導線・情緒演出・CTA整理）
- 横展開:
  - `src/pages/StudyLayout.tsx`
  - `src/pages/Stats.tsx`
  - `src/pages/Settings.tsx`
  - `src/pages/Onboarding.tsx`

詳細: `docs/10_design_refresh_status.md`

### 2.2 機能・アルゴリズム

- 定期テスト紙採点の入力値を正規化（`correctCount` を `0..20`）
  - `src/domain/test/paperTest.ts`
- 筆算エンジンに `×` / `÷` の結果入力型グリッドを追加
  - `src/domain/math/hissanEngine.ts`
- `useStudySession` の完了判定ロジックを分離して純粋関数化
  - `src/hooks/useStudySession.logic.ts`
  - `src/hooks/useStudySession.ts`
- 型・コメント整合の修正
  - `src/domain/types.ts`
  - `src/utils/audio.ts`

### 2.3 テスト・検証

- 追加ユニットテスト:
  - `src/domain/test/trigger.test.ts`
  - `src/domain/battle/engine.test.ts`
  - `src/domain/test/paperTest.test.ts`
  - `src/domain/math/hissanEngine.test.ts`
  - `src/hooks/blockGenerators.test.ts`
  - `src/hooks/useStudySession.logic.test.ts`
- E2Eスモーク拡張（5シナリオ）
  - `tools/e2e-smoke.mjs`
- ビルド成功確認
  - `npm run build`

---

## 3. 進行中（着手済み・未完了）

### 3.1 デザイン統一の最終段

- `Study` / `Battle` のトーン一貫性を最終調整中
- 状態系UI（`Modal` / `Badge` / `ProgressBar` / `Spinner`）の統一が未完
- `docs/07_ui_design_guideline.md` への反映が未完

### 3.2 品質強化の最終段

- `useStudySession.ts` 本体（UI経由の統合挙動）の回帰テスト拡張が未完
- E2Eがスモーク中心で、主要導線の回帰網羅（オンボード→学習→テスト→設定）は未完

---

## 4. 未着手（今後やること）

## 4.1 大物A: 仕様由来の将来機能（機能拡張）

対象: `docs/01_app_spec.md`「9. 今後の検討事項」

- 音声読み上げ（英単語発音確認）
- 例文表示
- 算数の単位換算
- 算数の時間計算
- クラウド同期（V2以降）

## 4.2 大物B: 学習アルゴリズム運用の実務化

- 定期テストトリガー閾値の運用ドキュメント化
  - 対象: `src/domain/test/trigger.ts`
- 係数調整の運用ループ定義（ログ観察/閾値見直しの手順）

## 4.3 大物C: データ運用・移行ポリシー整備

- 同期なし方針（v1）と `syncMeta` 保持理由（v2想定）を仕様に明文化
  - 対象: `docs/01_app_spec.md`, `src/domain/types.ts`
- `schemaVersion` 更新時の移行手順（マイグレーション規約）を文書化

## 4.4 大物D: デザインシステム完成

- `tailwind.config.js` へのトークン移植とセマンティック命名の整理
- 画面別トーン（通常/バトル/オンボーディング）のルール化
- 実機A11y/表示検証（iOS Safari, Android Chrome）

---

## 5. 次の未着手の大物（優先提案）

最優先は **「大物A: 仕様由来の将来機能の要件化」**。

理由:
- 仕様書上の宿題が明確に残っている
- 実装に入る前に、対象学年・難易度・UI導線の定義が必要
- 要件が固まると、機能実装・テスト設計・画面設計を並列化しやすい

---

## 6. 直近の実行順（提案）

1. `docs/07_ui_design_guideline.md` を現実装に合わせて更新
2. 状態系UI（`Modal` / `Badge` / `ProgressBar` / `Spinner`）をトークン準拠で統一
3. `useStudySession.ts` 統合回帰テストを追加
4. E2Eを「オンボード→学習→テスト→設定」まで拡張
5. 将来機能（読み上げ/例文/単位換算/時間計算/同期）の要件定義ドキュメントを起票

---

## 7. ソース

- 仕様書: `docs/01_app_spec.md`, `docs/06_screen_specs.md`, `docs/07_ui_design_guideline.md`, `docs/08_home_ikimono_spec.md`, `docs/09_battle_spec.md`
- 実装: `src/` 全域（UI/Hook/Domain）
- 検証: `tools/e2e-smoke.mjs`, `npm run build`, 追加テスト群
- 計画: `implementation_plan.md`, `implementation_plan_v2.md`
