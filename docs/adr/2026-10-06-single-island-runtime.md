# 島のruntimeを育つ島へ一本化

- Date: 2026-10-06
- Status: Accepted
- Related spec: [01](../product/01_app_spec.md), [52](../product/52_growing_island_game_spec.md), [統合方針](../product/island-nature-integration.md)
- Related task: [現在のタスク](../../.agents/tasks/TASKS.md)

## Context

ユーザーの「マージして不要なの消したい」に基づく。既にGrowingが本番の本体だが、旧flagでLife・Nature Town・Home Journeyへ切り替えられ、複数の島を並行開発しているように見える状態だった。

## Decision

ホームはGrowing、家・本・学習は既存の共通入口とする。旧Life、Nature Town、Home Journeyを別の現行ホームとして起動するUIと起動コマンドを撤去する。旧Nature Town URLは通常ホームへ転送し、古いflagが残っても試作を復活させない。

## Consequences

- Growingの規則・保存・所有・住人・学習は変更しない。
- Life DBからGrowingへの検証済み移行、旧学習予約、旧所有・履歴の閲覧、プロフィール削除とPWA保存保護を維持する。
- Nature Town DBを削除・自動合算しない。未採用の機能を無条件にGrowingへ移植しない。
- 旧画面と共用していたぽこもこのモデル、家renderer、自然の純粋ロジックと移行検査は、使われている限り維持する。
- 旧Explore/classicの直接URLと検証は今回の整理の対象外。

## Alternatives Considered

- 旧画面の名前だけを変えて保持する: 起動分岐と保守負担が残るため採用しない。
- 旧DB・計算・モデルまで丸ごと削除する: 保存移行、家、元のキャラクターと共用するため採用しない。

## Verification

core、classic smoke、Growing本番形式の初回・学習・配置・家/本・保存/offline・本人切替、旧保存からの移行回帰を確認する。旧flagが設定されても単一ホームと旧URL転送を実画面で確認する。公開・実機・子どもの再訪は別に記録する。
