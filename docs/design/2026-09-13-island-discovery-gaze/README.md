# ベンチから花・ブランコへの視線

[仕様50](../../product/50_mysterious_island_discovery_spec.md)のR1/R3を実景へ接続。着座した住人が現在の配置で近い花へ顔を向け、ブランコが近い場合は遊具/利用中の住人へ向く。対象を離すと同じ席の通常休憩へ戻り、戻すと再現する。

## 対象

- URL `http://127.0.0.1:5223`、flags `VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV`。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb` ＋未commit変更。Candidate `island-life-discovery-a-gaze-v1`。
- source開始/終了hashは[report](report.json)。fresh Chromium context、音off、phone390×844/tablet768×1024（reduced motion）。production/SW cacheの証拠ではない。
- 明示的DEVの2所有個体・6credit fixtureを使用し、実学習での取得とはしない。その後の移設/復元/学習復帰は実UI操作。

## 実画面と検証

[参考画像とcritical path](contact-sheet.html)。頭の元材質・中立位置、島・家・地面・住人の大きさを維持。顔の向きを変え、座席接点を動かさない。

- 対象10tests PASS。3住人それぞれの芽への顔向き、実世界のhead forwardと対象方向の内積、距離外での解除、同じ座面、R3利用者あり/なし、着座前/終了後の除外、既存歩行/揺れ/接地を検査。
- 最初はEuler XYZで横向き時に下向きの回転が効かないことを発見。関係中だけYXZ順にし、単なる角度値から実際の方向ベクトルの回帰へ補強。初回画面 `/tmp/sansu-v3-gaze-runtime-1` は診断履歴として保持。
- 最終実UIは花/ブランコ×phone/tablet。近い→遠い→戻すの同一着座住人と座席gap、M2 Journal未発行、個体数/残高、学習7store不変、学習への復帰を照合。
- ログ `/tmp/sansu-v3-gaze-runtime-2.log`、`/tmp/sansu-v3-gaze-core.log`。

## 非補償ゲートと残り

- 視覚: 作者による実画面の方向差分確認。全体美術の新規承認ではない。
- 無説明理解/安全: Human N=0。小さい通常画角で本人が関係を理解できるかは未評価。
- Runtime: 単体/DEV範囲の証拠。production/PWA/offline/throughputを含むrelease全体は未判定。

今回のR1/R3は描画の接続。可視1秒の事実収集、通常利用の現在観察、当時の関係の再演へはまだ接続していないので、この関係を表示履歴へ保存しない。集まりの表示記録、配置undo、24h成長/有限ひかり/土地checkpoint、B追加8品・他ルールも継続中。

最終実UIの4ケース全てPASS。source開始/終了hash `0f63355040d53823b72712fc5892fa8f2e1564b74a3cc318066ddc18cf032b1d` が一致。全体verify:core PASS: 357 files / 3698 tests、docs/lint/typecheck/build/assets。既存docs期限/Fast Refresh/build chunk size警告を保持。
