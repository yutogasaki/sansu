# 遠景の方式比較 — 制作を保留して機能受入へ戻る

基底revision `d8fb93cdad5faf385d23db9a7e2f18774f33b480`。C3の枝越しの距離と静かな背景を対象にした。[比較前の契約](transfer.md)。キャラ・家・学習・所有・歩行・配置を変更する作業ではない。

## 不採用の簡易立体

- v1: [cove](rejected-v1/cove/report.json)、[archipelago](rejected-v1/archipelago/report.json)、[mist](rejected-v1/mist/report.json)。phoneでは葉の外へ隠れ、tabletでは遠景が大きな丸い塊になる。平行投影では距離だけで小さくならない。source `e77649bf6ddc91fe304809a284b595d0d34e75f778d4f8fcb5624fc8d6609b8b`。
- v2: [cove](rejected-v2/cove/report.json)、[archipelago](rejected-v2/archipelago/report.json)、[mist](rejected-v2/mist/report.json)。小さな尺度へ変更し、カメラのpan範囲から除外。見える位置になったが平たい記号のように見え、不採用。
- 再現用の[source v1](rejected-v1-source.zip)と[source v2](rejected-v2-source.zip)は基底revisionへ重ねる変更ファイル。v1はv2から差分を戻して再構成し、元reportのapp hashと一致を確認した。アプリには統合しない。

両幅のreport.passは撮影・候補属性・ソース固定の限定検査であり、見た目や全導線の合格ではない。

## 描画方式を変えた遠景の絵

built-in imagegenでキャラや家を含まない遠景を新規生成した。[生成元とSHA-256](painted/provenance.json)、[生成方針](painted/prompts.md)。C3自体を配信素材へ流用していない。画像は生成時のbytesのまま保存。

- [湾](painted/cove.png): 暖かな崖と木の層が豊かだが、主役になる強さがある。
- [島々](painted/archipelago.png): 近遠の島を描き分けるが細部が多い。
- [朝靄](painted/mist.png): 彩度とコントラストが抑えられ、遠景としては検討しやすい。

[C3と枝越しの実画面](painted-comparison.png)。[湾](painted-runtime/cove/report.json)、[島々](painted-runtime/archipelago/report.json)、[朝靄](painted-runtime/mist/report.json)を5255/5256/5257で両幅撮影した。各build/candidate/flag/source/素材hashはreportに記録。元のQA profile・活動割当・論理時刻を保持し、realAtだけ撮影時へ接続。自然取得や利用者の画面ではない。

[試作source](painted-runtime-source.zip)は遠景専用planeに元画像を載せ、読込前は非表示、従来の海を残す比較用実装。typecheckと両幅の撮影のみ。取得失敗・破棄後完了・全景/配置/旧memory/学習/PWAの受入は未実施なので、アプリへ統合しない。

簡易立体より距離と岩の陰は読み取れるが、海との接続と手前の世界との画質差が残る。朝靄も**HOLD**。全世界の新しいruntimeスコアは付けない。無文字理解/安全は **Human N=0、HOLD**。Runtimeは限定撮影のみで、全受入は **HOLD**。

## 作業を区切る判断

ユーザーから完了時期・進捗率の確認を受けた。小刻みな美術試作を続けて全体完了が遅れているため、この段階で遠景制作を保留し、公開構成の12品・移行/PWA・仕様受入の不足を優先する。上記prototypeのapp/tools変更はこの作業が所有するファイルだけ基底revisionへ戻した。比較用serverも停止。mainのアプリは検証済みvaultのまま。素材と記録の保存を、本番への遠景反映とは報告しない。
