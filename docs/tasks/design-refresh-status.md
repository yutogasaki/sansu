# デザイン刷新 実施状況と今後対応（2026-03-17）

役割:
- この文書はデザイン刷新の進捗・状態台帳である
- デザイン原則の正本は `docs/product/07_ui_design_guideline.md`
- 進行中タスクは `docs/tasks/active/` で管理する

## 0. 目的

本ドキュメントは、今回のデザイン見直しで

- 何を実施したか
- 何が未完了か
- 次に何をどの順序で進めるべきか

を網羅的に整理した作業台帳である。

更新日: 2026-03-17
次回棚卸し目安: 2026-05-15

---

## 1. 今回の実施内容（完了）

### 1.1 全体トーン・デザイントークンの再設計

対象: `src/index.css`

- 背景を単層グラデーションから多層グラデーションへ更新
- 微細テクスチャ（ノイズ風）を追加
- 低速の環境グロー演出（`app-shell-glow`）を追加
- ガラス調サーフェス用ユーティリティを追加
  - `app-glass`
  - `app-glass-strong`
- 共通トークンを追加
  - `--app-surface`
  - `--app-surface-strong`
  - `--app-border`
  - `--app-border-soft`
  - `--app-shadow`
  - `--app-glow`

### 1.2 共通UIコンポーネントの刷新

対象: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Modal.tsx`, `src/components/ui/Badge.tsx`, `src/components/ui/ProgressBar.tsx`, `src/components/ui/Spinner.tsx`

- Button
  - 押下時フィードバックを強化（沈み込み/スケール）
  - primaryの質感を調整（ハイライト・シャドウ）
  - secondary/ghostのトーンを調整
- Card
  - defaultを共通ガラス調（`app-glass`）へ統一
  - flatを薄サーフェス+軽ブラーに変更
- Modal
  - 背景/コンテナ/フッターを共通トークンへ寄せた
  - `aria-modal` / `aria-labelledby` と最上位レイヤー判定を追加
- Badge
  - 情報チップを `app-pill` ベースへ統一
  - primary / success / warning を低彩度のまま見分けやすく調整
- ProgressBar / Spinner
  - 状態表示系UIを共通の面表現とアクセントトーンへ統一
- 関連モーダル面
  - `src/components/gate/ArithmeticGateModal.tsx`
  - `src/components/domain/PaperTestScoreModal.tsx`
  - 設定系で見える one-off modal も共通トーンへ寄せた

### 1.3 レイアウト骨格の刷新

対象: `src/components/Layout.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`

- Layout
  - 画面全体の背景グローを共通化
  - コンテンツレイヤーの重なり順を整理
- Header
  - 半透明+ブラー+軽シャドウのフローティング化
- Footer
  - ドック風の浮遊ナビへ変更
  - アクティブ状態を背景付きで明確化
  - 中央FABの質感と押下感を再調整

### 1.4 ホーム画面の体験強化

対象: `src/pages/Home.tsx`

- ステータスカードを再構成
  - 成長段階ラベル（`stageText`）を追加
  - 今日のメモ表示（当時の表記: `TODAY NOTE`）で情報の文脈を明確化
- `scene.aura` をタグ表示にして感情的なフックを追加
- いきもの表示カードを共通ガラス調に統一
- ひとこと表示（`whisper`）の可読性を調整
- 開始導線の領域にコンテナを持たせ、主要導線の一体感を向上

### 1.5 デザイン文書・レビュー導線の整備

- `docs/product/07_ui_design_guideline.md` を現実装に合わせて更新
- `docs/product/design_review_checklist.md` を追加
- `docs/ai/ownership_map.md` と `docs/ai/archive_policy.md` を追加し、状態文書と正本の境界を整理

### 1.6 学習・バトル面のトーン統一

対象:
- `src/pages/StudyLayout.tsx`
- `src/pages/Battle.tsx`
- `src/components/domain/TenKey.tsx`
- `src/components/domain/ChoiceGroup.tsx`
- `src/components/domain/MultiNumberInput.tsx`
- `src/components/domain/HissanCell.tsx`
- `src/components/battle/*`

- Study
  - トップバー、タイマー、スキップ導線、問題カード、入力プレビュー、操作エリアを共通トーンへ寄せた
  - 正解/不正解/スキップの overlay を強いベタ塗りからガラス調の静かな表現へ変更
  - 入力系部品を `app-pill` / `app-glass` ベースに更新
- Battle
  - setup / arena / top bar / result / countdown / orientation gate を同じ質感へ統一
  - 2人分の入力面をガラス調パネルに寄せ、スコアや待機状態をチップ表現へ整理
  - つなひき / ボス協力の上部バーを共通サーフェス上で見やすく調整

### 1.7 補助画面のトーン統一

対象:
- `src/pages/Stats.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Onboarding.tsx`
- `src/components/Header.tsx`

- Stats
  - セクションチップ、サマリー、カレンダー、分析カードを共通トーンへ寄せた
  - 進捗表示を共有 `ProgressBar` に統一し、旧来の強いベタ色を整理した
- Settings
  - プロフィール面、設定カード、保護者向け領域、危険操作を共通サーフェスに再編
  - リネーム / 削除導線を shared state UI と同じ質感へ合わせた
- Onboarding
  - welcome / 入力 / 選択 / 完了面を同じパネル言語に揃えた
  - 初回体験用に軽い背景グローとアクセントを足しつつ、可読性優先を維持した
- Header
  - 戻るボタンを `app-pill` ベースへ揃え、補助画面の共通導線の浮きを減らした

---

## 2. 動作確認結果（完了）

- 実行コマンド:
  - `node tools/check-docs.mjs`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
  - `npm run e2e:smoke`
- 結果: 成功（docs check / Lint / TypeScript / Vitest / Vite build / smoke 完了）
- 備考:
  - チャンクサイズ警告あり（既知、今回のデザイン差分起因ではない）

---

## 3. 未対応・今後やるべき内容（網羅）

以下は今回未着手、または部分対応のため今後対応が必要な項目。

### 3.1 残る画面トーンの棚卸し（中優先）

1. 補助画面の残整理
   - `src/pages/CurriculumSettings.tsx`
   - `src/pages/parents/ParentsPage.tsx`
   - `src/pages/DevMode.tsx`
   - 共通ヘッダーに乗ったことで大きなズレは減ったが、ページ単位の旧トーン棚卸しは残る
2. one-off surface の残整理
   - 共有トーンから外れている局所的なカード / 補助面を削減
   - ページ内ベタ色面の再定義が必要

### 3.2 コンポーネント単位の統一（中優先）

1. 各ドメインカード（`src/components/domain/*`）
   - 共通カード基盤の利用徹底（重複スタイル縮小）

### 3.3 デザインシステム整備（中優先）

1. `tailwind.config.js` にトークンを正式移植
   - 直接色指定の削減
   - semantic color（surface/accent/muted 等）の再定義
2. カラー・シャドウ・半径・ブラーの段階定義
   - 例: elevation 1/2/3、glass weak/strong
3. アニメーションの標準化
   - duration/easingを定数化
   - 過度な動きの抑制ルールを追記

### 3.4 品質確認（高優先）

1. 実機確認（iOS Safari / Android Chrome）
  - `backdrop-filter` の視認性
  - 低スペック端末でのパフォーマンス
2. アクセシビリティ確認
   - 文字コントラスト
   - フォーカス視認性
   - タップターゲット
3. 回帰確認
   - モーダル重なり順
   - fixed footer と safe-area の干渉
   - landscape表示時の崩れ

4. E2E / smoke の拡張
   - 現行 Home 開始導線への追従は完了
   - 最低限の smoke は復旧したので、今後は core flow 断面を増やす

### 3.5 パフォーマンス最適化（低〜中優先）

1. CSS肥大化の定点観測
2. 大きいJSチャンクの分割（`vite` 警告対応）
3. 不要なカスタムクラスの棚卸し

---

## 4. 推奨実施順（次スプリント）

1. 実機・A11y・回帰テスト
2. core flow の回帰カバレッジ拡張
3. 学習ルール / 設定責務 / 永続化方針の文書化
4. 残る補助画面のトーン棚卸し
5. パフォーマンス調整（必要時）

---

## 5. 完了判定条件

- 主要画面（ホーム / 学習 / きろく / せってい / 初回設定）で色・質感ルールが統一されている
- 共通UI（Button/Card/Modal/Badge/Progress系）がトークン駆動になっている
- `npm run build` が成功する
- 主要端末（iOS/Android）で視認性・操作性に問題がない
