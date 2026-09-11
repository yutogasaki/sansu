# ぽこもこの庭・機能試作 v1

[実画面の比較と一周](review.html) / [全経路のコンタクトシート](contact-sheet.jpg) / [採用した試作仕様48](../../../product/48_island_life_spec.md)

## 実装した範囲

通常学習の完了→しずく→花・ベンチ・ブランコ・灯りの購入/配置、東西どちらかへの土地拡張、無料移設/収納/明示撤去を接続。花の時間成長と地区認識を分離し、再配置なしで花壇/花畑に変わる。ぽこもこだけ目的地を指定でき、住人の好み・混み具合・距離で利用先が変わる。ひかりは自動取得し、ぽこもこ/品物の色に使う。

初回閾値未達でも基礎速度で育つ。学習量・いぶきの回復・独力/SRSを分ける。筆算の途中行を完了扱いしない。家内と既存の写真/展示は旧画面を残した比較用のDEV接続。

## 動かす

リポジトリで `npm run dev:island-life`。通常の開発用URLは `http://127.0.0.1:5223/`。今回の検査に使った固定コピーは `http://127.0.0.1:5224/`。

新しい島は独立した `SansuIslandLifePreviewV1` に保存され、試作登録以降の通常学習だけを取り込む。過去の学習をまとめて通貨にせず、旧島の所有品/通貨を移行しない。新しい島では、通常学習が従来どおり旧側にも記録される。DEV時間送りはこの島の時計だけを進める。

## 対象と証拠

- 実画面：DEV、`VITE_ISLAND_ENABLED=true`、`VITE_ISLAND_LIFE_PREVIEW=true`。候補 `island-life-choices-v1`。
- 元HEAD：`70ad92c15a976ae9be2c9513cd4825ea961e4dc0` ＋共有作業ツリーの未コミット内容。今回だけのcommitを検証したという意味ではない。
- 固定場所：`/tmp/sansu-island-life-final-v1`。入力1,081ファイルを[manifest](source.json)に記録。開始時と終了時、固定コピーと共有作業ツリーの該当入力が一致。
- 入力hash：`9886de25a42656bf302b1352f0e0fdd2a62204eed67c99fd0916f20a43b46daa`。
- 390×844通常motion、768×1024 reduced motion。[ブラウザ結果](report.json)、[検証集約](verification.json)。各6区間を通常UIで解き、11品を実購入・配置。ゲーム操作中の既存7store不変、同じ予約への復帰、再読込で残高保持を確認。
- 成長は明示DEVの6時間送り。実際の翌日再訪、学習意欲、正常速度の経済バランスの証拠ではない。

## 検証

| 検査 | 結果と範囲 |
|---|---|
| `npm run verify:core` | PASS。323 files / 3,455 tests。うち新規domain/storage/通常writer連携15件。[ログ](core.txt) |
| lint | エラー0、既存IslandMilestoneのfast-refresh警告1。ビルドは既存大容量chunk警告あり |
| `npm run e2e:smoke` | 31シナリオPASS。[ログ](smoke.txt) |
| `npm run e2e:pwa-update` | classicの4シナリオPASS。[ログ](pwa.txt)。次期島のSW配信の証拠ではない |
| `node tools/e2e-island-life.mjs` | 新しい島の2サイズPASS。通常学習、配置/拡張、成熟、住人指定、外観、収納/再配置、撤去取消/確定、同予約再開。編集を繰り返しても同一canvasを保持し、描画失敗文とpageerrorがないことを確認 |
| production guard | 島と試作flagを両方trueにしてproduction build。実初回設定→学習→戻るでも次期画面/DBを作らない。[結果](production-guard.json) |
| `npm run e2e:island` | FAIL。試作OFFの既存進行画面でhomeボタンが対象操作を覆い、click timeout。[ログ](existing-island-failure.txt) |
| `npm run e2e:island-pwa` | FAIL。productionの旧メニュー「ほかの あそび」が見つからず停止。[ログ](existing-island-pwa-failure.txt) |
| `npm run benchmark:island-fixed-ten` | FAIL。試作OFFのStudy側Q5で入力が空というassertionに不一致。正式80runを完遂しておらず性能合格は出さない。[ログ](throughput-failure.txt) |

最後の3件は公開前の修正/再検査対象として残す。次期島の一周が通ったことを、全アプリのリリース合格に置き換えない。

## 別々の判定

- **実装の一周：PASS（DEVの今回の範囲）**。通常学習writerは変更せず、独立DBで新しいループを動かした。
- **視覚：HOLD**。参照キービジュアルに比べ、海/植生の密度、家と住人の質感、活動の読みやすさが不足。現状の住人は利用先まで歩いて小さく動く段階で、乗る/座るなどの豊かな活動アニメーションは未実装。資産を再利用した機能試作で、アート承認ではない。
- **無説明理解・安全/再訪意欲：未検証、子どもN=0**。保存・二重付与・成長を失わない境界の自動検査はあり。子どもの理解や日をまたいだ意欲は未観察。
- **公開：HOLD**。上の回帰3件、正式throughput、アート、下記移行/経済条件が残る。

## 次に詰めること

閾値と問題ごとの負担、価格とひかりの使い道、達成後の減衰、地区判定と配置の自由度を実プレイで調整する。土地は東西どちらか1回、花は3段階、ブランコ等は固定外観、レアはなし。初版の範囲を越える大物5段階/小物3段階の全種類、レア、小島、他人の島は後続。

本番導入前に報酬版と旧ほし/所有品の移行、既存の家内/写真との一貫性、試作DBの破棄/バックアップ/プロフィール削除、時計巻戻し後の学習反映、複数端末、履歴圧縮・長期負荷を設計する。今回の留守中計算は1回7日分の上限で、完全な時計改変対策は提供しない。

## 先に見つけた問題

最初の画面検査では編集ごとのWebGL生成により景色が出なくなった。rendererを同じ画面内で再利用し、歩行経路を購入後にも再検査して解消。初期診断は `/tmp/island-life-browser-01/`。次の診断では開発中の更新がcanvas同一性検査へ干渉したため、固定コピーで再検査した（`/tmp/island-life-browser-02/`）。正式throughputの最初の起動ではmanifestのhashキー形式が合わず測定前に停止し、形式を合わせた次の実行で上記Study Q5の不一致を記録した。これらを最終PASSの証拠へ混ぜていない。
