# 家から店への接続試作

2026-09-09統合実施：[47](../../product/47_home_island_integration_spec.md)を採用し、公開範囲・成長方式・引継ぎ境界を整理。同じ家の外/室内/実写真/学習をDEVで接続し、成長表示直後の退出を検査した。[v7実画面と検証](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v7/README.md)は両幅の実経路、型/build、全3376テスト、smoke31項目が通過。本番移行、全メニューの新景観への統合、21通常＋3レアの全制作は継続課題。

依頼：最小構成を実装し、通常学習からテラスへの配達まで確認する。

仕様：[45](../../product/45_home_journey_preview_spec.md)。DEV限定。新しい通常学習予約から45問分までの追加進行を同じtransactionで保存する。既存の島・所持・旧予約を保持する。

実装：成長ドメイン、予約/完了接続、固定配置の3D模型、ホーム表示、通常plannerでのブラウザ検査を追加。現行アートとの混在と模型品質につき公開HOLD。

確認中：core、phone/tabletの実回答、保存再開。未完：キービジュアル相当の造形、厳密な接点/着座、既存保存の本番移行、正式な全runtime行程と子どもの確認。接続試作と依頼全体の完成を分ける。

接続試作の検査は完了：[実画面・検証記録](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v1/README.md)。本制作は未完了のためactiveを保持。

- Review By: 2026-09-16

## Docs To Touch

- 親仕様01と子仕様45：DEV接続と旧保存の境界。
- implementation-v1：実画面、source、検証結果と視覚HOLD。

## Verification

core通過後、描画の時刻境界と屋根修正をtypecheck/build/対象lintと実UIで確認。phone/tablet通常学習45問、再読込・再開、reduced motion、既存smoke/classic PWA更新通過。最終アートと公開全経路は未完了。

更新2：[素材・動作の実画面](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v2/README.md)。布の主人公、地形/影、連続する配達を実装。最終アートと接点は引き続きHOLD。

更新3：[家の近景と全景切替](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v3/README.md)。カメラ切替でCanvas・記録を維持。手先の荷物追従と座面位置を補正。最終アートと配達の遮蔽改善は未完了。

更新4：[読める配達](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v4/README.md)。配達者をテラス右側へ分離し、箱・視線・置く動作を近景で読めるよう改善。最終アートと独立した子どもの無言理解検査は未完了。

更新5：[触れそうな家](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v5/README.md)。同じ基本棟へ玄関ひさし、花箱、積み煙突、布の日よけ、階段を段階的に追加。基準画像の触感と奥行き、独立した子どもの確認は未完了。

更新6：[学習直後の成長演出](../../design/2026-09-09-pokomoko-growth-keyvisual/implementation-v6/README.md)。新たに越えた閾値の実物だけを短く弾ませ、45問目は配達箱を置く瞬間から表示。reduced motionと再訪時の非反復を実装。最終アートと独立した子どもの確認は未完了。
