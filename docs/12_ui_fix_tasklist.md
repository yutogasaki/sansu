# 12 UI改善タスクリスト（2026-02-19 更新）

## 目的
- `いきもの` 周辺改修後の保守性・品質・仕様整合性を上げる
- 画面挙動の回帰を防ぐ
- 今後の追加実装でファイル肥大化を再発させない

## 現状サマリ（今回確認）
- ファイル分割は実施済み
  - `src/pages/Home.tsx` は `567 -> 253` 行に縮小
  - `src/components/ikimono/Ikimono.tsx` は `362 -> 203` 行に縮小
  - `src/components/ikimono/hitokoto.ts` は `214 -> 83` 行に縮小
- 新規モジュール
  - `src/components/ikimono/sceneText.ts`
  - `src/components/ikimono/ikimonoMotion.ts`
  - `src/components/ikimono/hitokotoData.ts`
- `ikimono` unit test は追加済み（`lifecycle/hitokoto/sceneText`）

## 優先順位ルール
- `P0`: 直近でやるべき（回帰/仕様ズレ/保守コストのリスクが高い）
- `P1`: 次にやるべき（品質と運用効率を上げる）
- `P2`: 余力時（改善効果はあるが緊急性は低い）

---

## P0（最優先）

### 1. 仕様整合レビュー（ホーム画面といきもの）
- ステータス: `完了 (2026-02-19)`
- 背景:
  - `docs/08_home_ikimono_spec.md` ではホーム要素がかなり絞られているが、現実装は状態チップ・タグ・複数導線を持っている
  - 「仕様が古い」のか「実装が逸脱」なのかが不明
- 差分メモ（2026-02-19 抽出）:
  - `08` では「表示要素2つ（いきもの + はじめる）」を定義しているが、現実装は `TODAY NOTE`、auraタグ、復習ボタンを表示
  - `08` では「苦手・復習・テスト導線を置かない」とあるが、現実装には復習導線がある
  - `08` では「バウンド禁止寄り」のガイドがある一方、現実装の `ikimono` 反応には hop/bounce 系モーションを含む
- 対応:
  - 仕様優先順位を決定（現実装ベース）
  - `docs/08_home_ikimono_spec.md` を実装ベースで全面更新
- 完了条件:
  - 仕様書に最新UIを明記
  - 実装との差分が説明可能な状態

### 2. `ikimono` 文言・挙動のユニットテスト追加
- ステータス: `完了 (2026-02-19)`
- 背景:
  - `sceneText.ts` / `hitokoto.ts` / `lifecycle.ts` はロジックが増えたがテストがない
- 対応:
  - `sceneText`: stage選択、kanji/kana切替、event別分岐
  - `hitokoto`: 表記切替、時間帯分岐、返却文字列の妥当性
  - `lifecycle`: 境界日（3/7/14/22/28/30日）を固定日時で検証
- 完了条件:
  - 新規 test ファイル追加
  - 境界ケース込みでCI通過

### 3. `ikimonoMotion.ts` の型安全化（`any`排除）
- ステータス: `完了 (2026-02-19)`
- 背景:
  - 現在 `MotionControls.start` を `any` で受けている
  - 保守時に誤ったアニメーション定義を通しやすい
- 対応:
  - `framer-motion` の互換型で `start` 引数を明示
  - `playTapReaction` / `playIdleMotion` の型を厳密化
- 完了条件:
  - `any` を削除
  - `tsc --noEmit` でエラーなし

### 4. 文言表示のUI回帰防止（長文・長い名前）
- ステータス: `一部完了 (2026-02-19)`
- 実施済み:
  - `NameModal` に入力正規化（trim + 長さ上限）を追加
  - 名前/状態チップに最大幅トリミングを追加
- 未実施:
  - 画面幅別の可視ルール（行数制限）を仕様化
  - スナップショット系UIテスト追加
- 背景:
  - 重なりは解消済みだが、長文/長名で崩れる余地がある
- 対応:
  - 画面幅別の表示上限ルールを決める（例: 1〜2行clamp）
  - Story的なスナップショットケースを作成
  - `NameModal` 入力文字数上限の仕様を明確化
- 完了条件:
  - 最小幅端末で崩れない
  - 長文テストケースが残る

---

## P1（高）

### 5. 文言データ運用ルール策定（品質ガード）
- 背景:
  - `hitokotoData.ts` / `sceneText.ts` は今後さらに増える見込み
- 対応:
  - 禁止表現ルール（評価/強制/数値圧）を明文化
  - 文言追加時チェック項目（長さ、記号、漢字対応有無）を追加
- 完了条件:
  - `docs/08_home_ikimono_spec.md` に運用ルール追記
  - PRチェック観点に反映

### 6. `kanjiMode` と `uiTextMode` の責務整理
- 背景:
  - 現在、いきもの文言は `kanjiMode` 基準で切替
  - 既存の `easy/standard` との整合（期待挙動）が曖昧
- 対応:
  - 切替優先順位を仕様化（例: `easy`優先 or `kanji`優先）
  - Settings説明文を実挙動に合わせる
- 完了条件:
  - 設定画面文言と実挙動が一致
  - 仕様に優先順位が明記される

### 7. 未使用API/デッドコード整理
- 背景:
  - `getStageHitokoto` など未使用の可能性があるAPIが存在
- 対応:
  - 未使用exportを棚卸し
  - 使う予定がないものは削除、使うなら利用箇所を実装
- 完了条件:
  - 未使用警告ゼロ
  - 意図不明なAPIが残らない

### 8. いきもの表示のアクセシビリティ改善
- 背景:
  - 現在は主に視覚反応中心で、読み上げや操作説明が弱い
- 対応:
  - クリック可能領域の `aria-label` 付与
  - 状態文の読み上げ順を検証
- 完了条件:
  - 主要操作にアクセシブル名がある
  - 重要文言がスクリーンリーダーで追える

---

## P2（中）

### 9. 画像アセットの最適化
- 対応:
  - `ikimono` 画像の容量確認、必要なら圧縮・WebP化
  - 初回表示の体感改善（preload戦略）

### 10. 文言編集しやすさの改善
- 対応:
  - 文言データをカテゴリ別ファイルへ細分化（open/tap/egg/stage）
  - もしくはJSON化 + 型バリデーション

### 11. 見た目回帰の軽量E2E追加
- 対応:
  - `Home` の基本表示（stageタグ、名前、whisper）を smoke テスト化
  - `kanjiMode` ON/OFF の見た目差分を最低限検証

---

## 推奨着手順（実行順）
1. P0-4 UI回帰防止（残タスク）
2. P1-6 設定責務整理
3. P1-5 文言運用ルール
4. P1-7 / P1-8 の整理
5. P2 を順次

---

## 完了済み（2026-02-17〜2026-02-19）
- ホーム画面: いきもの文言の `easy/standard` 分岐（後続でモード責務再整理予定）
- ホーム画面: いきもの名と状態テキスト重なり解消
- 設定の `kanjiMode` を いきもの表示へ連動
- いきものの反応モーション・ひとことバリエーション増加
- ファイル分割（`sceneText.ts` / `ikimonoMotion.ts` / `hitokotoData.ts`）
- `ikimono` ロジックテスト追加:
  - `src/components/ikimono/lifecycle.test.ts`
  - `src/components/ikimono/hitokoto.test.ts`
  - `src/components/ikimono/sceneText.test.ts`
- `ikimonoMotion.ts` の `any` 排除（`useAnimationControls` 戻り型ベースで型付け）
- 検証:
  - `npx tsc -p tsconfig.app.json --noEmit` 通過
  - 対象ファイルESLint通過
