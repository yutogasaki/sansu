# 配置と成熟で島の岸が育つ — 本体候補 c8

2026-10-12。固定候補 `growth-terrain-c8`。同じ成熟した木2本から、岸沿いの丘肩・海向きの岬・別位置の丘肩を作る。[source と3形](../2026-10-12-growth-terrain-source/README.md)の三角形を、共有する world／配置予告／本体 renderer へ接続した。通常配布への切替ではない。

## 現在の判定

- **runtime: PARTIAL**。固定 core は619 files／5,349 tests、文書・lint・型・build・asset budget がPASS。実UIで岸の取得→苗2本の配置→診断18時間による丘肩まで通過。同じ2本の三配置・収納／復元は実行中。
- **美術: HOLD**。地形単体の差は読めるが、材色の継ぎ目と均一な岸壁が残る。本体全景での判定は未完。
- **独立理解／安全: 未検証、N=0**。作者の操作・自動検証を代用にしない。

## 固定した対象

本体共有 renderer を使うDEV `/prototypes/place-qa/authored.html?art=whole&terrain=grove`。build `growth-terrain-c8`、地形候補 `native05-growth-terrain-rough-v1`、全島候補 `native05-whole-rough-v1`。ブラウザのserverはIsland/native artをtrueで起動し、coreの通常buildはIsland=true／native art=false。本人の土地購入・保存・学習への切替はしていない。

固定候補は `/private/tmp/sansu-growth-terrain-c8/candidate`。25,612入力の開始／終了SHAが一致した。[core原記録](c8/core/report.json.gz)、[実行ログ](c8/core/execution.log.txt)、[archive照合](c8/core/archive-proof.json)を保持した。[c7](../2026-10-12-district-assembly/README.md)からの104変更ファイルは [source差分](c8/core/source-delta-from-c7.tar.gz)。この差分単独で全repoを復元できるとは扱わない。

## 変わるものと守るもの

既存の木の成熟時計・接続関係・配置から形と発生位置を決める。取得済みの6配置点・元床・入口・所有物・成熟・価格は変えず、追加地形に配置権を付けない。成長によって bounds が広がっても、確定した取得地形と同じ表示原点を使う。木を分離・収納すると低い岸へ戻り、同じ2本を戻すと同じ地形を再構成する。

別の地形と重なる場合は元の土地を保持し、拒否理由を残す。今後育つ最大範囲を地区取得時から予約する機構は未実装。複数地区の取得で後の成長を阻害しないことは、まだ完成条件を満たしていない。

## 住人の限定検証

coreの固定後に、実sourceと本体の `GrowingLife.sync/tick` を使う追加テストを1件作成した。小さなHOME付き診断土台へ実地区を接続し、実木の障害物を含めて住人1体が新床まで歩く。通常の木の収納後、消えた経路を破棄して既存床へ退避し、同じ住人・所有物を保つところまでPASS。位置・経路を直接書き換えていない。通常のランダムな行先選択だけを固定した診断で、自然利用や全島の全住人到達の証拠ではない。この1件は上記coreの5,349件には含めない。

初回は障害物数のテスト側カウンタ選択を誤った。実forest rootは生成されていたため、対応する `obstructionRootCount` に修正し、初回ログを保持した。本体の変更はない。[追加テストと入力照合](c8/life-probe/report.json)では、使用する既存のsrc／prototype／native kit計1,627入力がc8と一致。[テストsource](c8/life-probe/authoredGrowthTerrainLife.test.ts.txt)、初回・再実行ログも同directoryに保持した。

## 残る確認

途中までの[低岸](c8/partial-01/low-shore.png)・[苗2本](c8/partial-01/young.png)・[成熟した丘肩](c8/partial-01/parallel.png)を保存した。[途中記録](c8/partial-01/archive-proof.json)は実行中で、旅程全体のPASSではない。成熟による輪郭と高さの変化は読めるが、盛り上がりが別の塊に見え、材色・岸壁・合流部の造形はHOLD。採用原本にある土と森の一体感には届かない。

このheadless検証は [SwiftShaderによるソフトウェアWebGL](c8/partial-01/browser-environment.json) を使用している。phase時間には実処理・描画・操作待ち・撮影を含み、その値を実機操作性能に読み替えない。操作性能の合格は引き続き未達。

残りは同じ2本の三配置・収納／復元・回転／小画面。通常取得・本人保存・自然時間・offline・更新、16／32軒以上、実機性能、全島の美術採用は未完。既知のgallery入口による全島の通行障害も残る。包括ゴールとM1を完了とは扱わない。
