# Lifeの実two-build更新と学習checkpoint

## 対象と結果

既存classicのtwo-build検査は `SansuDatabase` だけを読み、新Lifeの所有DBを比較していなかった。Life有効の異なる2つの実production buildを同じlocalhost originから切り替え、学習中の更新保護とLifeの所有保持を確認する専用ハーネスを追加した。今回のアプリコード変更はない。

| build | app source | 実version |
| --- | --- | --- |
| old: commit cd0c951 | `468b00716a58793ca754a7f5b008871c2a0c61158b6f5b0e5b31908f0b8d8f2f` | `development-local:7b223511-2862-47f4-a1fa-645850f2453f` |
| new: commit 3781179のアプリ入力 | `d00da8603c1dcbb86f26180dd066a5133f5204e272d34a9d13a5c0f4c643d2c0` | `development-local:c9da808e-5f37-42ab-bd35-c425178dc18f` |

[old manifest](old-build-source.json)、[new manifest](../2026-09-14-island-life-storage/build-source.json)。newは前段階の固定buildそのもので、再コピーしたversion.jsonを第2buildとはしていない。oldはその前のcommitから別にproduction buildした。実JS entry名も異なる。開始終了に両dist全ファイルのSHA-256とversionを照合する。new manifestの親revisionは未コミットで構築した時のcd0c951で、app sourceは後の3781179の入力に一致する。

両buildともIsland/Life有効、Life preview/BuildPlay無効。現行4品・`moon-garden-v1`・保存版13。DEVのC3/魔法/追加8品、旧v2からv3への保存版移行の証拠ではない。公開設定やデプロイは変更していない。

## 実操作と更新

新品の隔離contextで、実初回設定→初回3問→6しずく→花購入→次の連問を1問進める→島へ戻って追加の2しずくを反映→同じ予約へ戻る。profile/credit/時計/購入/回答記録をDBへ注入しない。更新直前は4credit、購入1件、通常予約のcursor 1。

- **通常の実SW更新: 両幅PASS。** 390×844と768×1024で、通信切替後にnew版のversion応答を確認し、実registrationの `update()` でworkerも照会する。アプリ更新イベントの注入やworker mockは使わない。学習中5秒以上は旧bundleと同じ保存内容のまま。閉じて島へ戻るcheckpointで一度だけ新bundleへ再読込する。[report](normal/report.json)、[log](normal-output.txt)。
- **古いworker＋検出後切断: 両幅PASS。** サーバはnew版のアプリを配信しつつ、SW/workboxファイルだけold版へ固定する。version応答と実worker照会の後に切断し、復旧タイマーより長い5秒を待つ。自動再読込なし、cache名を保持。offline reloadで実old bundleを開き、同じ次問へ戻れる。worker固定を外して再接続し、再度学習中は待ち、島へのcheckpointで一度だけnewへ更新する。[report](interrupted/report.json)、[log](interrupted-output.txt)。
- **新buildでoffline再起動: 全4ケースPASS。** 更新後に再び切断・reload。実new bundleが開き、同じ未回答の次問へ戻る。購入品1個、4credit、6しずくを保持し、追加回答/重複報酬はない。

21個のnative store全体を比較し、Life DBはowner・保存版・作成時刻・action・credit・各migration checkpoint・診断時計intentを比較する。Lifeの表示時計と通常refresh revisionは進むため、全フィールド不変とは言わない。写真storeは今回空であり、写真Blob bytesや既存家族の全データの検証へ拡張しない。ブラウザエラー0。手動reloadと、更新marker付き自動reload1回を区別する。実URL・要求したファイル・配信root・更新markerをreportに保持する。

## 画面と受入範囲

- [旧版の連問](normal/phone-protected-old.png)、[検出後も同じ連問](normal/phone-update-deferred.png)、[更新後の島](normal/phone-new-world.png)、[新buildのoffline次問](normal/phone-offline-same-question.png)。
- [古いworkerのまま通信切断から復帰](interrupted/phone-disconnected-old.png)。
- 視覚はC3 HOLDを維持。今回のmoon-garden検査を世界美術の更新やC3受入として扱わない。キャラクターと美術を変えていない。
- 無文字理解/安全はHuman N=0。更新のために子どもの回答を止めないことは実動作で確認したが、利用者理解は未確認。
- Runtimeはこの2build・保存版13・現行4品・両幅の対象旅程でPASS。旧v2既得権/未受取贈与の実更新、新v3全capabilityのproduction統合、実機iOS、所有最大数/混合配置、10反復throughput、自然X3と全releaseは引き続き未完。

old buildのbuild/assetsは今回PASS。new app sourceのcore406 files /3940 testsは[前段階](../2026-09-14-island-life-storage/README.md)でPASSした同じ入力。今回の追加はハーネスと証拠文書で、eslintとコミット予定indexのdocs検査を行う。既存classicのtwo-buildハーネスは別契約として変更していない。
