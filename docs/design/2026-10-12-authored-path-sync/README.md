# 道の表示を住人の実際の通行判定に揃える

2026-10-12。固定候補 `authored-path-c4` は **core 611 files／5,307 tests・lint・型・build PASS**。住人が実モデルで木・花・殻を避けた後の歩行集合と、各所有物への安全な接近候補を、そのまま道の描画に渡す変更です。実画面は18/20画面で3600秒上限に達して終了。取得・成長・編集・desktop回転・phoneを通過し、tablet途中で停止、classicは未実行です。[原結果](runtime-report.json.gz)。美術HOLD・独立観察N=0・通常配布のnative flag falseを維持しています。

以前は、住人が衝突判定で拒否する道筋でも、描画側が未制限の地図から道を作る余地がありました。今回は同じ確定状態を共有します。移動・収納・復元で同期し、予告中の未来の配置や利用履歴だけの更新は確定した道へ混ぜません。場所固有の入口は保持し、別の近い地面へ置き換えません。道幅・曲がり方は変更しておらず、中心線が通れることを舗装全幅の実通行保証とは扱いません。

- [変更差分](change.patch)：コード6ファイルと世界契約1ファイル。c3からの差分で、既存の未コミット変更を含むHEAD差分ではありません。
- [core生ログ](core/execution.log.txt)と[報告gzip](core/report.json.gz)：6,461 source＋6依存の前後一致、終了コード0。lintは既存の警告3件を残してエラー0。PWA 145ファイル／8.50 MiB、Explore 27ファイル／2.97 MiBで予算内。
- [準備と対象SHA](readiness.json)、[入力一覧gzip](closure/inputs.json.gz)、[保存証拠](archive-proof.json)：原byteと展開byteを照合。変更した7ファイルは保存時のmainと固定候補で同一です。

実rigと実障害物を使う `placePathsSync.test.ts` では、拒否辺の除去、安全な代替接近、場所入口の保持、HOMEの遮断、移動・収納・復元、古いstate/layoutの拒否、予告・receipt更新、破棄と従来のgeometryを確認しました。全画面で描かれた辺を直接計測する機構はまだなく、辺集合の厳密一致はこの対象テストの証拠です。

実画面は固定候補のDEV `http://127.0.0.1:5361` を対象にします。起動時の[server記録](server-identity.json)はPID・cwd・明示flag・HTTP応答を確認したもので、DOM identityは実画面driverで別に照合します。classicは別のflag-off serverを使います。通常の本人保存への切替、自然な成熟、独立した理解、実機性能、全8回帰の再実行はこの結果に含めません。

仕様は [世界契約](../../product/island-world-contract.md) の道と通行集合の共有へ反映済みです。保存・学習・配布の仕様変更はありません。coreは固定候補の結果で、後から加えた証拠文書を含むmain全体の再検証や公開の証拠ではありません。

保存後にmainの世界契約へ大樹の上階・実階段の制作契約を追記しました。これは次の制作の仕様で、固定c4のapp入力とcore証拠は変更していません。mainの `npm run docs:check` と `git diff --check` は2026-10-12 08:00 UTC前後にPASS（既存のReview By期限警告あり）。
