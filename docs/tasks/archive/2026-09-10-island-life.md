# Next island life prototype

ユーザー：次期仕様と補足２点を踏まえて実装。対象は仕様48のDEV試作。共有作業の変更を保持する。

- 仕様と仮設定の採用
- 独立したゲーム状態と通常学習の保存済み事実の接続
- 配置/移設/収納/撤去/拡張、個体と地区、時間といぶき
- 自律住人とぽこもこの目的地、ひかりと外観
- 検査、実画面、引継ぎ

DEV試作の実装範囲は完了。本番移行・旧通貨変換・オンラインは対象外。公開判定はHOLD。

- Review By: 2026-09-17

## Docs To Touch

CONSTITUTION、親01、仕様48、docs/index、実画面の証拠。

## Verification

資料検査、型検査、lint、domain/storage tests、build、smoke、通常学習からのphone/tablet実画面。

## 結果

core 3,455 tests、smoke31、classic PWA4、通常学習から新島2幅の一周とproduction guardがPASS。既存島/島PWA/Study固定10問の回帰3件は未通過。[固定入力・実画面・失敗と残件](../../design/2026-09-10-island-life/runtime-v1/README.md)へ引き継ぐ。子どもN=0、アートHOLD。commit/push/公開は行っていない。
