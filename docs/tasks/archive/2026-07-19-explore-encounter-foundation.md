# Task: 探索遭遇の量産基盤を作る

- Date: 2026-07-19
- Owner: Codex
- Status: Complete
- Review By: 2026-07-26
- Related ADR / Runbooks: なし

## Goal

- `ひかりの橋` を単発分岐から型付き遭遇レジストリへ移し、2件目を `Explore.tsx` の条件分岐追加なしで実装できる状態にする
- 演出都合でプロフィールから遠い演算へ切り替えず、プロフィール近傍の問題に対応できる場合だけ専用遭遇を使う

## In Scope

- 遭遇ID、対応演算、表示フェーズ、演出時間の純粋なdomain契約
- 問題計画に遭遇IDを含めるskill-first解決
- 共通遭遇ステージと数値入力制御
- `ひかりの橋` の移行
- domain/unit/E2E回帰

## Out of Scope

- SRS・回答ログ・Dexieへの書き込み
- ホーム主導線の置換
- 本格グリッド、物理橋、通貨・装備
- 第2遭遇の完成アートとゲームバランス

## SSOT References

- `CONSTITUTION.md`
- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`

## Docs To Touch

- Must update: `docs/product/10_exploration_game_spec.md`, `docs/product/11_learning_integration_spec.md`, `docs/product/14_ui_world_motion_spec.md`, `docs/product/15_mvp_rollout_verification_spec.md`
- Intentionally unchanged: `docs/product/13_data_storage_migration_spec.md`（保存境界は変更しない）

## Plan

1. 遭遇契約と決定的なresolverを追加する
2. 問題生成を `problem + encounterId` の計画へ拡張する
3. 共通表示・入力境界へ既存ひかりの橋を移す
4. profile-near、fallback、誤答支援、reduced motionを検証する

## Definition of Done

- ひかりの橋が対応するプロフィール近傍問題で従来どおり遊べる
- 対応演算が近傍にない場合は通常問題へ安全に戻り、遠い足し算を出さない
- 新しい遭遇rendererを登録しても `Explore.tsx` に遭遇名の分岐を追加しなくてよい
- 390×844、768×1024、reduced motionで既存フローが通る
- Relevant docs updated or explicitly declared unchanged
- Done log entry created if the task ships

## Verification

- Commands: `npm run verify:core`, `npm run e2e:smoke`
- Manual checks: ひかりの橋の未入力、誤答、持続ヒント、正解、相棒渡河、通常問題fallback

## Progress

### Now

- 型付き遭遇registry、`problem + encounterId` resolver、共通入力、共通phase、共通没入UIへの移行を完了
- profile距離2以内、明示Bridgeスキル限定、通常表示fallbackを自動テストで確認済み
- `Explore.tsx` は遭遇名を知らず、renderer登録だけで2件目を追加できる状態

### Next

- E4で掛け算・等分などの第3遭遇候補をプレイテストしてから追加する

### Decision Notes

- 外部ステートマシン依存は追加せず、型付きレジストリと純粋selectorに留める
- 遭遇の見た目より学習側のプロフィール近傍選択を優先する

### Risks

- bridge planと専用遭遇を同一概念として扱うと、対応不能レベルで不自然な画面切替が起きる
- `Explore.tsx` の回答タイマーを一度に広く変更すると既存の発見・救助順序を壊しやすい
