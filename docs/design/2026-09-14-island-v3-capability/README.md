# 12品を本番構成で検証するcapability

追加8品と表示版がDEV previewに結びついていたため、production buildでは4品しか選べなかった。`VITE_ISLAND_LIFE_ENABLED=true` に加え `VITE_ISLAND_LIFE_DISCOVERY_ENABLED=true` を明示すると12品と既存のv3反応を使用する。世界美術の試作条件は独立させ、productionの背景はmoon-gardenのまま。既定フラグや外部配信設定を変更したものではない。

## 変更と既得物の保護

- カタログと現在表示の機能版を `src/domain/islandLife/capabilities.ts` にまとめる。DEV previewは従来どおり。価格・SRS・学習writer・保存schema・既存キャラは変更しない。
- productionの新規購入はcommit時にもcapabilityを確認する。同一receiptの再送を先に解決し、フラグ変更後も重複購入しない。
- フラグを戻しても所有品を削除しない。追加品を既に持つ場合はその表示機能を保持し、収納もできる。これは単体検査で確認した範囲で、実two-build rollback全体の受入ではない。
- 6ページの44pxボタンが説明/ページ数を圧迫したため、5ページ以上では2行に分ける。4品の2ページ表示はそのまま。

## 対象と結果

親revision `1d37eb6dabbfe179f4c085c5b1cb34114fee82a9`＋この差分。最終app source `4e4cd2700b5abb889ba5514f385620b1a62cf06376ca01bf098aee3b70d17277`。本番相当の固定buildは `development-local:65eb259f-ca55-4f7b-ab84-e19ee288154a`、実target `http://127.0.0.1:5306`。[source/dist manifest](runtime/build-source.json)。新規の隔離browserで操作し、利用者DBや外部本番への配信は行わない。

- [最終core](runtime/core-output.txt): docs/lint/typecheck・411ファイル/3,958テスト・build/assets PASS。既存期限/Browserslist/fast-refresh警告あり。既定buildのprecache10.89 MiB。
- [12品production build](runtime/build-output.txt): Island=true、Life=true、Discovery=true、Life preview=false、BuildPlay=false。precache98件・10.88 MiB。
- [最終実操作](runtime/report.json): phone390×844/通常motion、tablet768×1024/reduced motionでPASS。初回設定から実際の3問を入力し6しずくを獲得、12品を6ページで表示、苗を4しずくで購入する。全6ボタンの44pxと横方向の収まり、説明/ページ数の1行表示を実DOMで検査した。
- 実service workerに制御された状態からoffline reload、苗を移動・収納、同じ所有/学習予約を保持して再読込、次の問題へ回答する。Lifeのputだけを明示的に失敗させてもnative回答は保持する。エラー面の再試行後に2しずくを1回だけ反映し、offline/再接続後も所有・actions・credits・学習正本を維持した。
- preview DBやDEVの時間送りを使わない。プロフィール・時計・credit・回答のDB注入なし。障害注入は、実offline回答後のLife DB put失敗のみ。初回設定と回答操作は自動化しており、子どもの参加・独力理解の証拠ではない。
- [導線シート](contact-sheet.png)。page exception 0件。全21ルールのproduction再検査、実二build更新、実機速度、音の測定、独立した理解/意欲、C3の仕上げの合格には拡張しない。

[初回の通常offline旅程](before/report.json)も両幅PASSしたが、phoneの6ページ案内が縦に折れる見た目の不具合を発見した。旧source `5e0ff3acd4a7195efeba046f4ab48e29c2cf9d1badae11e332fed2d5338486d3`、build `development-local:99bf5562-1eb7-4ef8-9f6b-621aad8a908f`、5305。初回coreとbuild、修正前CSSも同じbefore領域へ残す。最終sourceへの変更はこのCSSで、最終UIには配置と文字の収まりの検査を追加した。通常旅程の技術PASSを、修正前のUI品質の合格に読み替えない。

## 続ける受入

次は4品構成から12品構成への実two-build更新と既得データの保持を優先する。個々のDEVルール旅程、価格/移行の単体検査、今回のproduction旅程を別の証拠として突き合わせる。世界美術の追加試作は保留し、元仕様の未完項目を減らす。

技術の上記限定範囲はPASS。C3視覚、無文字理解/安全は今回の判定対象外で、以前のHOLD・Human N=0を解消していない。全体完成/公開認定は未宣言。
