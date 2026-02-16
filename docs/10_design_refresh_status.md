# 10 デザイン刷新 実施状況と今後対応（2026-02-16）

## 0. 目的

本ドキュメントは、今回のデザイン見直しで

- 何を実施したか
- 何が未完了か
- 次に何をどの順序で進めるべきか

を網羅的に整理した作業台帳である。

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

対象: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`

- Button
  - 押下時フィードバックを強化（沈み込み/スケール）
  - primaryの質感を調整（ハイライト・シャドウ）
  - secondary/ghostのトーンを調整
- Card
  - defaultを共通ガラス調（`app-glass`）へ統一
  - flatを薄サーフェス+軽ブラーに変更

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

### 1.4 Home画面の体験強化

対象: `src/pages/Home.tsx`

- ステータスカードを再構成
  - 成長段階ラベル（`stageText`）を追加
  - `TODAY NOTE` 表示で情報の文脈を明確化
- `scene.aura` をタグ表示にして感情的なフックを追加
- いきもの表示カードを共通ガラス調に統一
- Whisper表示の可読性を調整
- CTA領域にコンテナを持たせ、主要導線の一体感を向上

---

## 2. 動作確認結果（完了）

- 実行コマンド: `npm run build`
- 結果: 成功（TypeScriptビルド + Viteビルド完了）
- 備考: チャンクサイズ警告あり（既知、今回のデザイン差分起因ではない）

---

## 3. 未対応・今後やるべき内容（網羅）

以下は今回未着手、または部分対応のため今後対応が必要な項目。

### 3.1 画面トーンの全体統一（高優先）

1. `src/pages/Stats.tsx`
   - 旧トーン（`bg-slate-*`）が多く、新トーンと混在
   - セクションチップ・サマリーカード・分析カードの色階層を再定義
2. `src/pages/Settings.tsx`
   - 設定カード群が旧UIパターン主体
   - セグメントUI・トグル・保護者向け領域を新トーンへ統合
3. `src/pages/Onboarding.tsx`
   - 初期画面と遷移カードに旧カラーが残存
   - 初回体験を現行トーンへ寄せる必要
4. `src/pages/Study.tsx`, `src/pages/StudyLayout.tsx`
   - 日常利用の中心画面。Homeとのトーン差を解消する必要あり
5. `src/pages/Battle.tsx` と配下コンポーネント
   - バトル専用トーン方針（通常UIと分離するか統合するか）を明文化して反映

### 3.2 コンポーネント単位の統一（高優先）

1. `src/components/ui/Modal.tsx`
   - 背景/コンテナ/フッターの表現統一
2. `src/components/ui/Badge.tsx`
   - 色定義を新トークンに寄せる
3. `src/components/ui/ProgressBar.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/ui/Spinner.tsx`
   - 状態表示系UIの質感統一
4. 各ドメインカード（`src/components/domain/*`）
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

### 3.4 ガイドライン文書との整合（中優先）

対象: `docs/07_ui_design_guideline.md`

- 現ガイドラインは「影・グラデーションを抑制」寄り
- 今回実装は「控えめな質感表現」を導入
- 方針差分を明文化し、以下を更新する必要あり
  - 許容するシャドウの強度
  - 許容するグラデーション面積
  - モーション許容範囲
  - 画面別トーン（通常/バトル/オンボーディング）

### 3.5 品質確認（中優先）

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

### 3.6 パフォーマンス最適化（低〜中優先）

1. CSS肥大化の定点観測
2. 大きいJSチャンクの分割（`vite` 警告対応）
3. 不要なカスタムクラスの棚卸し

---

## 4. 推奨実施順（次スプリント）

1. `Stats` / `Settings` / `Onboarding` のトーン統一
2. `Modal` / `Badge` / 状態系UIの共通化
3. Study系画面の統一（使用頻度が最も高いため）
4. ガイドライン更新（`docs/07_ui_design_guideline.md`）
5. 実機・A11y・回帰テスト
6. パフォーマンス調整（必要時）

---

## 5. 完了判定条件（Definition of Done）

- 主要画面（Home/Study/Stats/Settings/Onboarding）で色・質感ルールが統一されている
- 共通UI（Button/Card/Modal/Badge/Progress系）がトークン駆動になっている
- `docs/07_ui_design_guideline.md` が実装実態と一致している
- `npm run build` が成功する
- 主要端末（iOS/Android）で視認性・操作性に問題がない

