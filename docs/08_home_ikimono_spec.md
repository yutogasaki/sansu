# 08 ホーム画面・いきもの仕様（実装ベース）

> 最終更新: 2026-02-19  
> 本書は **現行実装を正** とする。旧版との差異がある場合は本書を優先する。  
> 関連: [01_app_spec.md](01_app_spec.md), [06_screen_specs.md](06_screen_specs.md), [07_ui_design_guideline.md](07_ui_design_guideline.md)

---

## 0. 方針
- ホームは「学習開始前の入口」だが、情報量は最小固定ではなく、`いきもの` の状態把握に必要な要素を表示する。
- `いきもの` は評価者ではなく伴走者として扱う。
- 文言・動きは単調さを避けるためにランダム性を持つ。

---

## 1. ホーム画面構成（現行）

### 1.1 表示要素
- `EventModal`（条件成立時）
- 状態カード
  - stageバッジ（`stageText`）
  - `TODAY NOTE`
  - `scene.nowLine`, `scene.moodLine`
- auraタグ群（3つ）
- いきものカード
  - `Ikimono` 本体
  - 名前チップ（ある場合）
  - 状態チップ（`scene.whisper`）
- 固定CTA
  - 主ボタン: 「この子と進む」 (`/study`)
  - 副ボタン: 「復習」 (`/study?session=review&force_review=1`)

### 1.2 禁止しない要素（旧仕様から変更）
- 復習導線
- stage/雰囲気の軽量表示（タグ・短文）

---

## 2. イベント表示仕様

### 2.1 優先順位
1. `periodic_test`
2. `level_up`
3. `paper_test_remind`
4. `checkEventCondition` による通常イベント

### 2.2 表示ルール
- `periodic_test`, `level_up`, `paper_test_remind` は pending 中は優先表示
- その他イベントは日付キー (`toLocaleDateKey`) で 1日1回制御

### 2.3 遷移
- `periodic_test` -> `/study?session=periodic-test`
- `paper_test_remind` -> `PaperTestScoreModal`
- それ以外 -> `/study?session=check-event`

---

## 3. いきものライフサイクル

### 3.1 段階
- `egg` (0-3日未満)
- `hatching` (3-7日未満)
- `small` (7-14日未満)
- `medium` (14-22日未満)
- `adult` (22-28日未満)
- `fading` (28-30日未満, opacity 1.0 -> 0.0)
- `gone` (30日以上)

### 3.2 ストレージ
- key: `sansu_ikimono_state`
- 構造:
```ts
{
  profileId: string;
  birthDate: string;
  generation: number;
  name?: string;
}
```

### 3.3 世代交代
- `gone` 検出時:
  - 既存個体を `sansu_ikimono_gallery` に保存
  - `generation + 1` で新規個体を自動生成

---

## 4. 文言仕様

### 4.1 生成モジュール
- `src/components/ikimono/sceneText.ts`
  - `getSceneText(profileId, dayKey, weakCount, currentEventType, useKanjiText)`
  - `stageText`
- `src/components/ikimono/hitokoto.ts`
  - 起動時・タップ時・卵専用のひとこと

### 4.2 文字モード
- `kanjiMode = true` のとき、`いきもの` 文言は漢字系を使用
- `kanjiMode = false` のとき、かな系を使用
- 対象:
  - stageバッジ
  - `scene.nowLine` / `scene.moodLine` / `scene.whisper`
  - ひとこと吹き出し

### 4.3 文言ポリシー
- 許可:
  - 状態描写
  - 雰囲気描写
  - 軽い呼びかけ
- 禁止:
  - 点数/回数など評価の直接提示
  - 強制的な命令口調

---

## 5. モーション仕様

### 5.1 実装モジュール
- `src/components/ikimono/ikimonoMotion.ts`

### 5.2 待機モーション
- stageごとの sway 値（`rotate`, `y`, `duration`）を定義
- 4パターンをランダム切替
- 約 4.5-7.0 秒間隔で再生（反応中は停止）

### 5.3 タップ反応
- 反応種:
  - `hitokoto`, `bounce`, `spin`, `wiggle`, `nod`, `tilt`, `hop`, `shimmy`, `squash`, `floaty`, `pulse`
- `egg` は `wiggle/shimmy/bounce/squash/hop` 比率高め
- 反応中の再タップは無視

---

## 6. レイアウト耐性（回帰防止）
- 名前入力:
  - `NameModal` は最大8文字
  - `trim + maxLength` で保存前正規化
- 表示:
  - 名前チップ: `max-w-[11rem] + truncate`
  - 状態チップ: `max-w-[16rem] + truncate`
- 目的:
  - 名前と状態の重なり防止
  - 狭幅端末での崩れ抑制

---

## 7. ファイル構成（現行）
- `src/pages/Home.tsx` ホーム統合
- `src/components/ikimono/Ikimono.tsx` いきもの本体
- `src/components/ikimono/lifecycle.ts` ライフサイクル
- `src/components/ikimono/sceneText.ts` 状態文生成
- `src/components/ikimono/hitokoto.ts` ひとこと生成
- `src/components/ikimono/hitokotoData.ts` 文言データ
- `src/components/ikimono/ikimonoMotion.ts` モーション定義
- `src/components/ikimono/IkimonoSvg.tsx` 画像表示
- `src/components/ikimono/NameModal.tsx` 命名モーダル

---

## 8. テスト要件（現行）
- 追加済み:
  - `src/components/ikimono/lifecycle.test.ts`
  - `src/components/ikimono/hitokoto.test.ts`
  - `src/components/ikimono/sceneText.test.ts`
- 継続課題:
  - UI表示回帰（長文/狭幅）のテスト強化
