# 英語の任意短文リスニング

## Review By

- Review By: 2026-09-16

## Docs To Touch

- `docs/product/03_english_skills.md`、親仕様01、単元対応33、`docs/index.md`。

## Verification

- docs:check、lint、typecheck、test:run、build、smoke、短文のphone/tablet実画面。

- 目的: 英文・日本語文・絵を見ながら短文を任意再生し、回答なしで通常学習へ戻れるようにする。
- 正本: [英語仕様03・第7節](../../product/03_english_skills.md#7-短い文章を聞く)。Study通常学習とIsland学習へ接続。
- 変更範囲: 10短文、既存の教材図と端末音声、セッション内の任意入口。学習予約や保存スキーマを変更しない。
- 検証: 短文選定のunit、全core、phone/tabletの実回答と再生・停止・失敗・続行・保存不変。端末音声の実音、実iOSとHuman理解は別判定。
- 進行: 完了。[実画面と検証記録](../../design/audits/2026-09-09-english-listening/README.md)へ移管。全体検証の初回失敗と限定再実行PASSを区別して記録した。
