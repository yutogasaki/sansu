# 4品から12品への実PWA更新

## 対象

既存のLife two-build検査は4品版同士だった。`SANSU_LIFE_DISCOVERY_UPGRADE=1` を加え、旧版の実購入と学習途中の予約を、追加8品のある本番用ビルドへ引き継ぐ経路を検査する。今回の変更はハーネスと証拠文書のみ。公開設定・アプリコード・キャラは変更しない。

| build | source | version |
| --- | --- | --- |
| old cd0c951、4品 | `468b00716a58793ca754a7f5b008871c2a0c61158b6f5b0e5b31908f0b8d8f2f` | `development-local:7b223511-2862-47f4-a1fa-645850f2453f` |
| new 5537d38の入力、12品 | `f03b6f45255db23a342d71341251614fb476d0f9003c19e7971bd999c879c25f` | `development-local:b052a594-0f36-4889-a344-ba1bc19ae34b` |

両buildはIsland/Life=true、Life preview/BuildPlay=false。newのみDiscovery=true。oldは既存の固定配信物 `/tmp/sansu-life-two-build-old`、newは `/tmp/sansu-open-catalog-production-dist` を再利用。versionを書き換えて作った疑似更新ではない。両方のdist全ファイルを開始終了で照合し、異なるentry JSを実際に開く。

oldのmanifestは[前回](../2026-09-14-island-life-two-build/old-build-source.json)、newの元manifestと全体テストは[UI変更時](../2026-09-14-open-catalog/README.md)。このハーネス用new manifestは同じSHA・versionを保ち、絶対パスを配信root相対へ正規化したもの。元manifestのrevisionは未コミットビルド時の親8a9ec86であり、アプリ入力が5537d38に一致する。

## 操作と比較

隔離したブラウザで実初回設定、3問、花2しずく購入、次の通常連問を1問進める。更新前は4credit・花1個・6しずく・予約cursor 1。profile・購入・時計・credit・回答をDBへ注入しない。

1. 旧版のカタログが4品であることを確認する。
2. 学習途中で異なる実buildを同じoriginから配信し、実workerを更新。学習中は更新しない。
3. 島へ戻るcheckpointで自動reloadが1回だけ発生する。
4. 全native 21ストア、Lifeのowner・保存版・credits・actions・各checkpointを比較する。
5. 新版の12品を確認し、苗を4しずくで実購入する。旧actions prefixとcredits、native全体はそのまま。新しい購入receiptが1件だけ加わる。
6. 新版でoffline reloadし、花と苗の2品・残高2・同じ未回答の次問を確認する。

中断モードでは、newのversionを検出した後もworkerだけoldへ固定して切断する。5秒後も勝手なreloadやcache削除がなく、offline reloadで本物の旧bundleと同じ次問が開くことを確認する。固定を解除して再接続した後に上記の更新を完了する。

## 判定の範囲

正常経路は[report](normal/report.json)、中断経路は[report](interrupted/report.json)の両幅でPASS。390×844は通常motion、768×1024はreduced motion。全4ケースで更新marker付き自動reload1回、ページ例外0。手動offline reloadはこの回数へ含めない。[実画面の並び](contact-sheet.png)は中断後の旧版再開・新版の島・追加品購入・offline同じ次問を両幅で示す。

初回中断runのphone-new-catalogは横スクロール途中を撮っているため、静止した商品ページの証拠として使わない。通し検証時の正確なハーネスは `executed-harness.txt` に保持。最終ハーネスへ、3ページ目とスクロール枠の左右端が一致するまでの同期DOM待機を追加した。更新・購入・保存の判定は変更していない。撮影待機は同じ本番用buildの別contextで両幅を診断し、その画面を通しrunへ差し替えない。

空の写真storeから写真Blob保持は証明しない。保存版13同士のcapability更新であり、旧v1経済の実移行、存在が未確認のv2既得権や未受取贈与、実機iOS、全12品の自然利用をまとめて合格にしない。

視覚は従来のmoon-gardenで、C3の視覚合格の証拠ではない。独立した無文字理解・安全の観察者は0人。アプリ入力は前回core411ファイル/3958テストを通過したものと同じ。
