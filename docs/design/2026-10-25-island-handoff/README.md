# Claude Opusへ渡す島制作の情報地図

2026-10-25。利用者の依頼による引き継ぎ資料。既存の調査・ポータル・制作原本・試作を探す入口であり、新しい採用仕様や外部サイトの再調査ではない。外部URLの内容は過去の調査記録に基づく。現時点での到達可否は再確認していない。

## そのまま渡す追加指示

前の引き継ぎ指示に加えて、この情報地図を使ってください。ベンチマークした作品、作者の説明、実操作、再現実験、ポータル掲載資料、相談記録まで引き継ぎます。既存の結論を盲信せず、証拠を使って自分で作戦を立ててください。

最初に製品目標・最新の比較・採用美術原本を確認し、必要な調査へ掘り下げてください。すべての履歴を順番に読んだり、資料の整理だけで終わったりしないでください。以前の指示にあるv28は2026-10-24の中断時点です。現在は段丘輪郭の比較資料が追加されています。まず現在の差分と記録を照合してください。

目標は、子どもがゲーム中に地形と所有物を変え、美しい景色と住人の暮らしが追従し、保存して続きを遊べることです。参考作品の規則や固定模型でこの目標を置き換えないでください。新しい方式を採用する際には、失う操作や保存互換の問題も判断に含めてください。

## 最初に読む入口

| 資料 | 役割 |
|---|---|
| [親タスク](../../tasks/active/2026-09-27-living-fantasy-first-playable.md) | 現在地。日付付き履歴と現在の目標を区別する |
| [島の制作戦略](../../product/island-construction-strategy.md) | 自由編集・完成の条件 |
| [島の美術戦略](../../product/island-art-strategy.md) | 見た目、参考作品の役割、季節などの観察範囲 |
| [段丘輪郭方式の比較](../2026-10-24-terrace-method-lab/README.md)／[画面](../2026-10-24-terrace-method-lab/index.html) | 前の引き継ぎ後に追加された方式T/Gの比較。資料はTを推奨しているが、本体統合済み・全島合格とは扱わない |
| [採用美術の3D原本](../2026-10-10-island-final-3d/README.md)／[ビューア](../2026-10-10-island-final-3d/index.html)／[制作スクリプト](../2026-10-10-island-final-3d/build-scene.py) | native05を実物・制作方法から理解する。汎用規格名ではない |
| [素材制作計画](../2026-10-24-island-material-plan/README.md)／[画面](../2026-10-24-island-material-plan/index.html) | 地形以外の部品・制作計画の参照。記載を実装済みと混同しない |

## ポータルに載せた情報を探す

- 統合ポータル（生成後のローカルページ：`../../../portal/index.html`）、全文検索（生成後のローカルページ：`../../../portal/search.html`）。検索語は「Little Habitats」「native05」「制作方式」「段丘」「水庭」「接地」「ベンチマーク」。生成ポータルの更新時点により、新しい資料はまだ検索に出ないことがある。この地図から正本へ直接進める。
- [共有作業の入口](../../../.agents/index.html)、[文書ポータル](../../index.html)、[文書地図](../../index.md)、[分野別地図](../../maps/index.md)。
- ポータルの入力・生成境界は [運用説明](../../portal/README.md)。`portal/`の生成HTMLを正本として編集しない。
- 過去に使った表示URLは `http://127.0.0.1:5281/` 以下。サーバーが停止している場合は、同じ相対パスのローカルファイルを読む。別ポートの試作はビルド・flagを確認し、古いタブを最新実装と取り違えない。

## 主なベンチマークと確認範囲

| 作品・研究 | 外部入口 | 何を見るか／過去の確認範囲 |
|---|---|---|
| Little Habitats | [公開版](https://wavedash.com/games/little-habitats)／[公開庭へのコメント](https://wavedash.com/games/little-habitats/comments) | 造成、接続、植物・動物、季節・発見。実操作済み。内部コードは取得できておらず、正確な方式は未確定 |
| Townscaper | [公式ブラウザデモ](https://oskarstalberg.com/Townscaper/) | 足場追加→家追加→家除去→足場除去を実操作。接続造形を観察。保存・住人・性能の検証ではない |
| Tiny Glade | [公式掲載](https://store.steampowered.com/app/2198150/Tiny_Glade/)／[開発者インタビュー](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games) | 地形・道・建物の関係、生成器、Undo。公開資料調査。調査記録上、実ゲーム操作なし |
| Foundation | [Building Asset Processor](https://polymorph.games/foundation/modding/building-asset-processor)／[建築段階](https://polymorph.games/foundation/modding/construction-steps) | 部品に入口・経路・成長段階を持たせる契約。公式資料を読解。実ゲーム操作なし |
| TownBuilder | [公開コード](https://github.com/eliemichel/TownBuilder) | 接続部品の研究入口。当時はREADMEとライセンス確認、実行なし |
| MesoGen | [研究ページ](https://eliemichel.github.io/MesoGen/) | 接続を設計する制作工程。研究概要確認。製品への導入実測なし |
| irregular_grid | [確認したcommit](https://github.com/sketchpunklabs/irregular_grid/tree/40014e3030b0b79cb2806ef7d32eb6700fe16a26) | 格子と変形の公開実装を部分読解。実行・導入なし |
| Organic grid | [作者の解説](https://andersource.dev/2020/11/06/organic-grid.html) | 不規則格子生成の別実装。Townscaperの厳密な内部実装と扱わない |
| SimCity 2013 | [公式マニュアル](https://akamai.cdn.ea.com/eadownloads/u/f/manuals/GAME-SIMCITY/SimCity_2013.pdf) | 配置と周囲の条件が景色を育てる原理の補助参照。Sansuへ経済ルールを移す意味ではない |

## X調査：「50プロンプト」の元情報も含む

既存調査はx-readを使用。作者と関連返信を限定して読んだもので、X全体の網羅調査ではない。検索語・投稿日時・確認範囲は [Little Habitats調査全文](../2026-10-21-little-habitats-research/index.html) と [監査の出典台帳](../2026-10-22-benchmark-method-audit/sources.json) を参照。

- Danny、2026-09-27：[100以上の素材と50回以上のプロンプトという説明](https://x.com/DannyLimanseta/status/2104122809484214376)。作者の自己申告であり、完全な制作ログは未取得。
- Danny、2026-09-27：[初期指示の紹介](https://x.com/DannyLimanseta/status/2104126569409347705)。記憶からの再構成で、50回分のプロンプト集ではない。
- Oskar、2019-10-29：[378モジュール](https://x.com/OskSta/status/1189109278361165825)、[不足ケースを補う制作](https://x.com/OskSta/status/1189122653048717312)、[接続解決](https://x.com/OskSta/status/1189154686210891777)。Sansuに378部品必要という根拠にはしない。
- Oskar、2021-10-13：[dual gridの説明](https://x.com/OskSta/status/1448248658865049605)。
- Anastasia、2022-05-28：[Undo/Redo](https://x.com/anastasiaopara/status/1530473522224582656)。

追加調査が必要なら、上記の既存証拠で答えられない問いを先に定める。本人説明・自分の実観察・内部方式の推定を分ける。

## 調査・再現実験・失敗を読む順

| 資料 | 得られる情報 |
|---|---|
| [調査監査](../2026-10-22-benchmark-method-audit/README.md)／[図解](../2026-10-22-benchmark-method-audit/index.html) | 調査全体の強弱、一次資料、実操作画像、独立再現の反例、方式比較条件 |
| [Little Habitats実操作](../2026-10-21-little-habitats-research/README.md) | 造成・訪問・季節・X・相談。音や内部コードなど未確認事項も記録 |
| [形状観察](../2026-10-22-little-habitats-geometry-probe/README.md) | 単独・隣接・L・2×2・対角配置の観察 |
| [輪郭仮説の反復](../2026-10-22-contour-hypothesis-loop/README.md) | 角丸合成H1の反例、距離場合成H2。H2が実作品の方式だと確定したわけではない |
| [制作方法調査](../2026-10-22-making-methods/README.md)／[画面](../2026-10-22-making-methods/index.html) | dual grid、変形、公開コード、参照一覧、過去のA/B計画 |
| [場所方式の試作](../2026-10-22-place-strategy-trial/README.md) | 道の着色案の棄却と支持条件の検証 |
| [本体接続](../2026-10-22-editable-main-island/README.md) | 独立試作と通常ゲームをつなぐ境界 |
| [地形・場所の方式比較](../2026-10-23-place-method-comparison/README.md) | 先行する方式比較 |
| [場所単位の編集](../2026-10-23-place-brush-trial/README.md) | 編集、接地、保存境界、後続証拠の入口 |
| [二つの島](../2026-10-23-place-brush-trial/two-island-review.html)／[記録](../2026-10-23-place-brush-trial/two-island-verification.md) | 二湾・高台・家具・Undo/Redo・試作専用保存と限界 |
| [成熟した場所](../2026-10-23-place-brush-trial/mature-review.html) | 同じ17所有者の二配置と住人利用。通常成長の証拠ではない |
| [床との接続](../2026-10-23-place-brush-trial/connection-review.html) | 白い格子と回廊入口の部分改善、残る全島美術の課題 |
| [v28の比較契約](../2026-10-23-place-brush-trial/method-bake-review.md) | 水庭の部品試作。初回見本は平面的で未達、実画面の往復比較前に中断 |

H2の反例は [監査実測](../2026-10-22-benchmark-method-audit/results.json)。材質の入力順依存、滑らかさと穴の消失、床があっても歩けない段差を区別する。テスト成功は方式全体の合格ではない。

## チャッピーとの相談

- [土地拡張案を比較](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7-hokomoko/c/6ad7354d-f4f4-83e8-a296-b462d76d7d72)：Little Habitats調査と制作方法の相談。要約は上記各README。
- [制作戦略再設計](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7-hokomoko/c/6ad97a75-aff4-83e8-9a26-9424ac213a0d)：監査後の相談。[初回抜粋](../2026-10-22-benchmark-method-audit/consultation-1.txt)、[再相談](../2026-10-22-benchmark-method-audit/consultation-2.txt)。当時の公開資料中心の相談を内部コードの独立監査と呼ばない。
- 10/24の追加相談：[二構成](../2026-10-23-place-brush-trial/evidence/chappy-two-layout-strategy-2026-10-24.txt)、[二湾](../2026-10-23-place-brush-trial/evidence/chappy-two-bay-strategy-2026-10-24.txt)、[接続](../2026-10-23-place-brush-trial/evidence/chappy-connectivity-strategy-2026-10-24.txt)、[契約修正](../2026-10-23-place-brush-trial/evidence/chappy-contract-correction-2026-10-24.txt)。文章の相談で、画像・コードを直接検査した合格ではない。

## 引き継ぎ時に取り違えないこと

1. ポータルに載っていること、相談で賛成されたこと、テストが通ったことは、それぞれ美術や製品完成の合格とは別。
2. 旧資料の「未確認」は当時の状態。後続の証拠が埋めた範囲を確認する。逆に、後続の小さな合格を全島へ広げない。
3. 段丘比較の「Tへ切り替える」は資料の判断。現在の本体統合、保存互換、操作の制限、性能は最新コードと実画面から検証する。
4. 既存の未commit変更を保持する。島以外の作業を巻き込まない。今回の資料作成はcommit・push・外部送信の実行ではない。
