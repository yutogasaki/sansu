# Nature Town NT-4：実2ビルド更新

2026-09-19。実装整合は **PASS**。390×844と768×1024（動き抑制）で実施。アプリのコード変更なし。検証scriptと記録は未コミット。

## 対象と再現条件

- 実行URL: `http://127.0.0.1:54304/#/nature-town`（実行時だけ起動するローカル配信）。Chromium 145.0.7632.6。
- ソース: `11d0d25954e35239a02bf5762437ded1742fba66`、tree `304eba0082db777eb5bab11ae8c7555f3ff1ec23` の隔離コピー。
- flag: `VITE_ISLAND_ENABLED=true`、`VITE_NATURE_TOWN_ENABLED=true`。Nature Town候補 `nature-town-living-s1`。version.json内のisland候補は別モードのメタデータ。
- 旧版: `nt3-index-20260918:49487bd0-d20d-4d36-ae22-8e26ff6605df`。
- 新版: `nt4-new-20260919:772afd78-8f2c-46d2-a93f-9a0a252ada3f`。
- 同一ソースから独立にコンパイル。JS bundleとSWが異なる2つのdistを同じoriginで切替。versionファイルの書換えで更新を偽装していない。全配信ファイルのhashが実行前後で一致。
- [実行スクリプト](../../../tools/e2e-nature-town-two-build.mjs)は `SANSU_TOWN_OLD_DIR`、`SANSU_TOWN_NEW_DIR`、`SANSU_TOWN_SOURCE_ROOT`、`SANSU_TOWN_OUTPUT` で対象を指定。source rootは両buildと同じソースを使う。

## 確認した経路

使い捨てプロフィールだけを準備し、家・畑・水路は実操作で配置。通常学習6区間で単位を受け取り、水路と台車を購入。7区間目を1問解いた途中で通信を切り、新版へ切替・再接続した。実SW更新と版検出後も学習中は旧版に留まり、全保存が一致。町に戻ると更新reloadが1回だけ起きた。

配置・個体ID・在庫・住人を含む町の全payload、6件の単位受領記録、取得権利、ネイティブDBの全storeを照合。新版をオフライン再起動し、同じ途中学習を再開・1問進め、再度オフライン再起動して保存されたrevisionを確認した。世界・単位・時刻・更新イベントの注入なし。

390幅は世界が完全一致。768幅は再起動後、停止ボタンを押すまでに通常の1tickが進んだ。差分を無視せず、同じ隔離ソースの `stepWorld` を保存前世界に適用し、町の全payloadが正確に一致することを確認。各再起動の許容は最大2tick、学習保護中は0tick。両幅で更新reloadは1回、途中学習revisionは1→2。

初回の768幅は単純なbyte一致で失敗したが、差分は上記1tickの正確な遷移であり、ネイティブDB全storeは一致。検査側の比較を修正して再実行し両幅PASS。アプリの不具合修正ではない。

[詳細結果・配信ファイルhash](runtime-report.json)、[スクリプトと画像のhash](sha256.json)。

## 重要経路の画像一覧

| 段階 | 390幅 | 768幅 |
|---|---|---|
| 旧版・配置と道具取得後 | [画像](390-old-town.png) | [画像](768-old-town.png) |
| 学習中の更新保留 | [画像](390-protected-learning.png) | [画像](768-protected-learning.png) |
| 新版の町 | [画像](390-new-town.png) | [画像](768-new-town.png) |
| オフライン学習継続・再起動後 | [画像](390-offline-resumed.png) | [画像](768-offline-resumed.png) |

## 独立した判定と残件

- 見た目の魅力: **HOLD**。最終美術・全身受渡し演技は未完了。この更新検査では美術の合格を主張しない。
- 無文字理解・安全: **未評価**。参加者0人。
- 実装整合: **NT-4 PASS**。異なるソース版のschema移行、本番配信、実機iOSは今回の対象外。
- 受入表は44/47のまま。NT-4は47項目とは別の納品条件。
- RNG-02の固定30／60fpsは未確認。MacのChromiumでは `enableBeginFrameControl` が未対応と[公式プロトコル](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Target.pdl)に記載され、ローカルprobeも終了した。対応する別実行環境が必要。通常RAFの計測値で代用しない。

次はNT-5の人口・地区数を増やした負荷診断。実機iOSと参加者評価はそれぞれ端末・参加者が必要。
