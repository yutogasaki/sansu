# 配置と成熟で島の岸が育つ — 本体候補 c8

2026-10-12。固定候補 `growth-terrain-c8`。同じ成熟した木2本から、岸沿いの丘肩・海向きの岬・別位置の丘肩を作る。[source と3形](../2026-10-12-growth-terrain-source/README.md)の三角形を、共有する world／配置予告／本体 renderer へ接続した。通常配布への切替ではない。

## 現在の判定

- **今回の実UI旅程: PASS／全体 runtime: PARTIAL**。固定 core は619 files／5,349 tests、文書・lint・型・build・asset budget がPASS。岸の明示取得→通常苗購入2回→診断18時間→同じ2本の三配置・収納／復元→回転・phone/tabletまで完了。本人保存、自然利用、全島歩行や実機性能の合格ではない。
- **美術: HOLD**。[承認native05と9実画面の比較](runtime-contact-sheet.html)で、成長による形差は読める。一方、垂直な岸壁と材境界が追加丘を別の台座に見せ、岸・丘・森の一体感が原本に届かない。作者判断であり、旅程PASSで補わない。
- **独立理解／安全: 未検証、N=0**。作者の操作・自動検証を代用にしない。

## 固定した対象

本体共有 renderer を使うDEV `/prototypes/place-qa/authored.html?art=whole&terrain=grove`。build `growth-terrain-c8`、地形asset候補 `native05-growth-terrain-rough-v1`。9 captureの実host `visualCandidate` は **`native05-growth-assembly-v1+source-shading-v1`**、`groundShading=source`、appVersionは `growth-terrain-c8:364d600a-2b2c-4446-be58-4b7391114ecb`。ブラウザのserverはIsland/native artをtrueで起動し、coreの通常buildはIsland=true／native art=false。本人の土地購入・保存・学習への切替はしていない。

固定候補は `/private/tmp/sansu-growth-terrain-c8/candidate`。25,612入力の開始／終了SHAが一致した。[core原記録](c8/core/report.json.gz)、[実行ログ](c8/core/execution.log.txt)、[archive照合](c8/core/archive-proof.json)を保持した。[c7](../2026-10-12-district-assembly/README.md)からの104変更ファイルは [source差分](c8/core/source-delta-from-c7.tar.gz)。この差分単独で全repoを復元できるとは扱わない。

## 変わるものと守るもの

既存の木の成熟時計・接続関係・配置から形と発生位置を決める。取得済みの6配置点・元床・入口・所有物・成熟・価格は変えず、追加地形に配置権を付けない。成長によって bounds が広がっても、確定した取得地形と同じ表示原点を使う。木を分離・収納すると低い岸へ戻り、同じ2本を戻すと同じ地形を再構成する。

別の地形と重なる場合は元の土地を保持し、拒否理由を残す。今後育つ最大範囲を地区取得時から予約する機構は未実装。複数地区の取得で後の成長を阻害しないことは、まだ完成条件を満たしていない。

## 住人の限定検証

coreの固定後に、実sourceと本体の `GrowingLife.sync/tick` を使う追加テストを1件作成した。小さなHOME付き診断土台へ実地区を接続し、実木の障害物を含めて住人1体が新床まで歩く。通常の木の収納後、消えた経路を破棄して既存床へ退避し、同じ住人・所有物を保つところまでPASS。位置・経路を直接書き換えていない。通常のランダムな行先選択だけを固定した診断で、自然利用や全島の全住人到達の証拠ではない。この1件は上記coreの5,349件には含めない。

初回は障害物数のテスト側カウンタ選択を誤った。実forest rootは生成されていたため、対応する `obstructionRootCount` に修正し、初回ログを保持した。本体の変更はない。[追加テストと入力照合](c8/life-probe/report.json)では、使用する既存のsrc／prototype／native kit計1,627入力がc8と一致。[テストsource](c8/life-probe/authoredGrowthTerrainLife.test.ts.txt)、初回・再実行ログも同directoryに保持した。

## 実UI旅程の終端記録

2026-10-12 10:42:08–11:01:54 UTC、実targetは `http://127.0.0.1:5365/prototypes/place-qa/authored.html?art=whole&terrain=grove`。[終端report](c8/runtime/report.json.gz)は `pass=true`、`sourceFixed=true`、`errors=[]`、実行exit 0。8段階と9 captureが保存された。`errors` はdriverが登録したpageerror記録であり、全console／networkエラーの検査とは呼ばない。25,612入力のcore終了・旅程開始・終了のSHA辞書が一致した。

取得地区は `diagnostic-district-1`、`native05-growing-shore-v1`、原点(16,-4)、turn 0。実grantは親 `east-entry` に接続した。画面selectの表示だけから別のportを推定しない。既存35 ownerの参照場面から、20しずくの苗を2回購入してl36/l37を追加した（9170→9130しずく、35→37 owner）。成熟は診断ボタンで自然時計252→270時間へ明示的に進めた結果で、18時間の自然経過を観察したものではない。

| 配置 | 同じl36/l37のlocal cell | 実world cell | 成長結果 |
| --- | --- | --- | --- |
| parallel | (2,-1), (2,0) | (18,-5), (18,-4) | 丘肩、south socket |
| seaward | (1,-1), (2,-1) | (17,-5), (18,-5) | 岬、south socket |
| shifted | (2,0), (2,1) | (18,-4), (18,-3) | 丘肩、north socket |

再配置は既存UIで同じ2本を収納し、空いた元所有セルへ置き直した。収納中の成長assembly 0、復帰後の指定shape／socket／owner IDsをdriverが確認した。最後にparallelへ戻り、host／renderer共通world revisionも最初のparallelと同じ `authored-world:5c44b5968b0966f6` に戻った。**成熟した2地形形状と同じ2本の3配置（socketは2位置）の確認であり、3つの完成した全島形状の達成ではない。**

[撮影条件・実host・camera・各stateの小さな抽出](c8/runtime/summary.json)、[実行ログ](c8/runtime/runtime-execution.log.txt)、[実行時刻／exit](c8/runtime/runtime-execution.json)、[launch source](c8/runtime/runtime-launch.py.txt)、[実driver source](c8/runtime/e2e-authored-growth-terrain.mjs.txt)を保存した。[archive照合](c8/runtime/archive-proof.json)は原本before／afterと保存内容（gzipは復号内容）のSHA一致を記録。reportはmtime 0のgzip、実行sourceは`.txt`で保管し、テストやscript探索へ混ぜていない。

captureはdesktop 1440×1000、phone 390×844、tablet 768×1024 CSS px。全画面reduced-motion指定。PNGはcanvasへスクロールした後のviewportスクリーンショットを無加工で保存し、比較ページでは縮小表示のみ行う。地形のboundsによる自動全景fit、回転、viewport変更でカメラが異なるため、同一カメラのpixel差分や原本との等寸比較として扱わない。

旧[途中記録](c8/partial-01/archive-proof.json)と3画面は当時の部分証拠として保持し、終端記録へ書き換えていない。更新前のREADMEも[原byteのまま保存](c8/runtime/README-before-terminal.md.txt)した。

## 未完の範囲

[SwiftShaderによるソフトウェアWebGL](c8/runtime/browser-environment.json)を用いたheadless検証である。phase時間には実処理・描画・操作待ち・撮影を含み、実機操作性能には読み替えない。SW／offline／更新はこのdriverでは未測定。

通常の土地購入・本人保存・自然時間・住人の自然利用、16／32軒以上、複数地区の成長範囲予約、実機性能、全島の美術採用は未完。既知のgallery入口による全島の通行障害も残る。[限定迂回診断](../2026-10-12-authored-whole-rough/gallery-detour-probe/README.md)では2点3辺のgraph接続と実障害物回避は成立したが、実rabbitの足が斜面へ0.0787埋まりFAILで、本体／assetへ採用していない。今回の旅程はこの障害の解決を証明しない。包括ゴールとM1を完了とは扱わない。
