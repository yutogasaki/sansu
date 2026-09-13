# Lifeのオフライン保存と投影失敗からの復旧

## 見つかった問題と変更

実際の学習回答が保存された後、Life DBの書込みだけを失敗させると、画面に `QuotaExceededError` と内部メッセージがそのまま表示された。[修正前の画面](before/phone-projection-failed.png)。保存と再試行の実挙動は正しかったが、子ども向けの案内ではなかった。

`useIslandLife` のエラー表示だけを変換する。未知の読込/書込み例外は「しまの きろくを たしかめられなかったよ。もういちど ためしてね。」にする。commit済みだが完了応答を失った場合もあるため、保存内容が消えたとは断定しない。新しいreaderが必要な場合と、配置が競合した場合は、別の次の操作を案内する。例外本文や任意payloadを子ども向け画面へ転送しない。

既存のowner transaction、PWA hold、終端fact、重複排除、未確定intentのretry、保存版は変更していない。技術的な完了応答を失っても同じintentを再送して一度だけ購入する既存hookテストを維持した。

## 実画面で検査したこと

ローカルproduction build、`VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=false` / `VITE_BUILD_PLAY_ENABLED=false`。対象 `http://127.0.0.1:5303`。公開flag変更やデプロイではない。実画面は既存 `moon-garden-v1`、公開4品のcapability。DEV-onlyのC3/追加8品/魔法がproductionで動くことを証明する検査ではない。

全ケースは新品の隔離ブラウザcontext。profile・時計・credit・回答記録・購入actionをDBへ注入しない。実UIの初回設定、通常plannerの初回3問、実タッチ回答から始める。

1. 初回3問の正式完了から3credit/6しずくを得て、花を2しずくで購入する。
2. 実service workerの制御と、実際に読まれたhomeのJS/CSSが全てcacheにあることを確認。PWA hookは無効。
3. 通信を切ってreload、現物を移動・収納、再reload。購入/移動/収納actionとcredit、各migration checkpointを保持。収納済みの「おく」を実UIで確認する。学習7storeも変えない。
4. offlineで通常の次問を正式完了。その後だけ `SansuIslandLifeV1/worlds` の `IDBObjectStore.put` に明示的な故障を注入する。学習保存は完了しているが、Life側は元の3creditのままであることを確認する。
5. 画面のエラーと文言を確認し、故障を外して「もういちど」を実タップ。回答の再入力なしに4credit/6しずくへ進む。nativeの回答と同じ次問を保持。
6. offline reloadと再接続reloadを経ても同じ4creditで二重反映しない。所有actionと各checkpointも保持する。

これは実UIと実SWを使うが、実端末/子どもによる検証ではない。quota故障は検査で注入したもので、通常環境で自然にquotaを使い切ったという意味ではない。写真Blobや別profile、実two-build更新は今回の対象外。

## 証拠の区分

- 修正前UI1: 故障なしの両幅offline旅程PASS。source `468b00716a58793ca754a7f5b008871c2a0c61158b6f5b0e5b31908f0b8d8f2f`。この時点の検査scriptは[原文](before/normal-source.txt)。
- 修正前UI2: 同じsourceの故障注入・保持・再試行・二重反映防止は両幅PASS。ただし英語例外が表示されるUX不具合を発見した。[report](before/report.json)、[script](before/fault-source.txt)。技術的PASSを文言の合格へ置き換えない。
- 修正後の固定source、build version、各ファイルのhash、実target照合、coreと最終UIは下記へ記録する。新しい検査scriptはbuild manifestと実 `/version.json`、開始終了のapp sourceとdist全ファイルを照合する。

## 受入の範囲

- 視覚: C3 HOLDを維持。今回のmoon-garden画面をC3の美術更新として扱わない。キャラクター・世界描画は変更していない。
- 無文字理解/安全: Human N=0。技術例外を除去し、責める表現やデータ消失の断定を避けた著者確認。子どもが再試行を理解できるかは未確認。
- Runtime: 実SW offline、native回答の保持、Life投影の一度だけの反映、購入/配置/収納保存について限定受入。新Lifeの実two-build更新、v3全capabilityのproduction統合、全混合配置、固定10問10反復、実機iOSと全releaseは残る。

## 最終結果

固定source `d00da8603c1dcbb86f26180dd066a5133f5204e272d34a9d13a5c0f4c643d2c0`、親revision `cd0c951b09c1ccc0980397e8c3bb4d74120b2d86` に対象変更を加えた候補。[build manifest](build-source.json)。実build `development-local:c9da808e-5f37-42ab-bd35-c425178dc18f`。

- core2: docs/lint/typecheck、406 files /3940 tests、build、assets PASS。[log](core-output.txt)。precache98 files /10.88MiB、予算内。
- UI3: phone390×844 /tablet768×1024（reduced motion）とも実初回・実獲得・実SW offline・配置/収納・故障時保持・日本語の案内・再試行・再接続・二重反映なし PASS。[report](runtime/report.json)、[log](ui-output.txt)。native7storeとLifeのaction/credit/各checkpointの比較を保持する。
- 修正後の[失敗画面](runtime/phone-projection-failed.png)と[再接続後](runtime/phone-reconnected.png)。旧画面の例外本文を隠し、既存の再試行ボタンから同じ正式回答を反映した。通常の失敗なし旅程は修正前UI1、修正後UI3は明示故障を含む旅程として区別する。

今回の変更は表示メッセージの境界。既存classic smoke/PWAの以前の結果を今回の新sourceで再実行したものとは扱わず、全release判定は引き続き保留する。
