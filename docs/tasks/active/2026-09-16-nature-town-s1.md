# Nature Town S1 残作業

2026-09-16。添付v0.2を採用した独立試作の次段階。

- 現在の実装と実測：[実装説明](../../product/nature-town/IMPLEMENTATION.md)
- 仕様の47項目：[受入対応表](../../product/nature-town/acceptance-status.json)
- 最初のコア・操作・通常学習往復・別保存・offlineはローカル実装済み。旧世界と学習は保持。
- 残る主作業：本来の世界美術と実物の受渡し、住人の直接詳細、連続ブラシ、全受入シナリオと大規模負荷、新モードのtwo-build更新、実機・対象年齢の観察。
- 目視魅力と無文字理解のHOLDを、技術検査のPASSで解除しない。公開・旧世界の移行は未実施。

- Review By: 2026-09-23

## Docs To Touch

- `docs/product/nature-town/IMPLEMENTATION.md`
- `docs/product/nature-town/acceptance-status.json`

## Verification

`npm run verify:core`、`npm run e2e:smoke`、専用E2Eのphone/tabletと実SW offline。未検証の受入条件は同名のシナリオで確認し、手動観察は別に記録する。
