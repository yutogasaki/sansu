# v0.4の育成規則を採用する

- Date: 2026-10-19

- Status: Accepted for implementation; verification in progress.

- Related spec: [52](../product/52_growing_island_game_spec.md), [13](../product/13_data_storage_migration_spec.md), [v0.4 rules](../product/island-system/growth-rules.md)

- Related task: [Island implementation](../tasks/active/2026-09-27-living-fantasy-first-playable.md)

## Context

2026-10-19。利用者の「では、網羅的に実装していって」により、[共同仕様v0.4](../product/island-system/growth-proposal.md)を実装対象として採用する。柱は配置のくふうと実際の暮らしを強め、所有と履歴を保持する。Lvごとの商品解放、旧店/広場の追加購入、好みを家成長へ使う攻略は弱まる。このトレードオフを明示した候補への実装依頼を承認根拠とする。

## Decision

新規の購入種は家/畑、記念のふしぎ種は島別W1〜W4。木/花/水と直接遊具を残し、wild/play/market/festival/planter/bakeryの追加購入を終了する。旧個体・種・元価格・機能と継続商品の旧解放を保持する。家は所属住人/到達/段階開始から24/48/96町h、通常購入は初期A/初入居B、土地4/5のLv条件を除く。

自然は所有する成熟木/開花花/旧wildから広がり、同じ境界を再抽選しない。場所は少量から接続/成熟し、有限の安全な部品で形を作る。未検証の巨大形は通常形へ戻す。学習・価格・供給容量・船の契約を変更しない。

保存はrecord5、独立したcultivated系tableへ切り替えて旧writerから隔離する。旧元snapshotを残し、旧Wの根拠不足はpendingとする。保護者による対象枠1回の例外復元は現物重複の可能性を認め、返金0/島外移送なし/由来保持/原子的receiptで再発行を防ぐ。archive・写真・贈り物にも同じ隔離を適用する。

## Alternatives Considered

Changing only visibility leaves duplicate mechanics. Destructive item conversion would lose ownership and supply.

## Consequences

Retired kinds remain usable property; their additional purchase opportunities end. Learning, clocks and prices stay intact.

## Verification

採用は実装方針の決定。実保存の回帰、実SW更新/復旧、部品安全、美術と子どもの理解/再訪の合格、公開を意味しない。
