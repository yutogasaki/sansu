# Task: ぴったり連鎖の独立試作

- Date: 2026-09-06
- Owner: Codex
- Status: Complete (archived)
- Review By: 2026-09-13
- Related ADR / Runbooks: 既存保存・公開契約は変更しない

## Goal

5・10の合成／補数を使う新しい12盤面を操作できる形にし、観察へ渡す。

## In Scope

仕様整合、独立2D試作、全到達状態検査、左右比較、保存・再開・ログ、単一HTML出力、phone/tabletの実操作。

## Out of Scope

公開切替、学習SRS接続、元の未提供HTMLの再現、子どもの反応の代行評価。

## SSOT References

- [親仕様](../../product/01_app_spec.md)
- [試作仕様](../../product/27_gameplay_first_pittari_spec.md)

## Docs To Touch

- Must update: 憲法・親仕様・22の適用範囲、27、index、memory、done。
- Intentionally unchanged: 学習generator、DB、既存routing、PWA更新、公開flag。

## Plan

1. 対象範囲と既存モードの境界を正本へ反映。
2. 新規盤面と純粋engine、独立画面、専用保存・ログを実装。
3. 全盤面と実ブラウザの検査、HTML出力、証拠・未確認事項を記録。

## Definition of Done

- 12盤面の解・競合排除、比較と戻す、4列の複数手を検証。
- 実起動・reload・音なし・reduced motion・保存不能・ログを確認。
- Relevant docs updated and done log recorded.

## Verification

- Commands: verify:core、試作build、試作browser検証。
- Manual checks: 390×844、768×1024、ready→連鎖→戻す→次→終了・再開。

## Progress

- ユーザーは元データの再現ではなく、提案書から新しい12盤面を作ることを選択。
- 添付MDのみ確認。提供元のテスト結果は当方の検証へ継承しない。
- 新作12面・独立ページ・単一HTMLを実装し、verify:core、試作18テスト、e2e:pittariを通過。
- 配布HTMLのfile URL実操作・phone/tablet画面・録画と未確認事項を [監査](../../design/audits/2026-09-06-pittari/README.md) とdoneへ記録。
