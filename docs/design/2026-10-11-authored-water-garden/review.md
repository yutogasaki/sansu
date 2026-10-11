# 水庭のレビューと初回失敗

**美術HOLD、独立理解・安全N=0、runtime PARTIAL。** 美術採点は2026-10-11、candidate `native05-authored-water-garden-v2`、build b6、1280×900の実全景と近景を見た作者の事前審査。独立利用者の評価や採用判定ではない。

| 六軸 | 点/10 | 見えている差 |
|---|---:|---|
| 入りたくなる世界 | 6 | 入り江・段丘・大樹はあるが、森と集落が薄い |
| キャラクターへの愛着 | 7 | identityは保つが、家に対して人物が大きく風景を圧迫する |
| 素材の触感 | 6 | 水・紫岸・木橋は分かれるが、地面と植物の面が均一 |
| 構図と奥行き | 5 | 大樹と水庭に主景はあるが、中央の空白と近景focusが弱い |
| 色の楽しさと焦点 | 7 | 多色の冠・屋根・水面が見える。地区ごとの大きな色面は不足 |
| 出来事と見返り | 4 | 歩く住人はいるが、場所固有の利用が全景からまだ読めない |

35/60、全六軸8以上・採用基準以上へ未到達。全島の継続性・silhouette等の最終審査も未完。例外0や5,164 testsはこの判定を上げない。

## 実装の初回FAIL

- [b2実島の水面高さFAIL](review/water-height-first-failure.log.txt)：池の口でも流れが下降し、水面が不連続になった。池/合流の実交差区間では高さを一致させ、外側だけ下降する。b3実島819点がPASS。岸の口も同じXYZでclipする。
- [b4 integration FAIL](review/focused-first-failure.log.txt)：広い実floorのindexをJS引数へspreadし、RangeError。rendererで一個ずつindexを追加して修正。geometry・所有・支持を減らして回避していない。
- [b5 anchor rayのFAIL](review/anchor-hit-first-failure.log.txt)：owner anchorが原本板の隙間にあり、下の実水面が同じownerを返すことを橋art hitと誤認したharness。三枚の実source板の中心を検査し、world deck＋0.003の高さ・同じownerを確認する。owner anchorも実water/bridgeの同IDと旧模型hit0を維持。[修正後integration 4/4](review/integration-final.log.txt)。

## 計算を変えずに軽くした範囲

[b3→b4](review/native-b3-b4-comparison.json)でworld定義/state/art planが全量一致。Node compose 78,710→7,478ms、岸の5回検索70,508→1,375ms。instrumented Nodeのnested diagnosticで、合計の内訳を単純加算しない。実browserの12〜13秒previewは未達。

[独立software review](review/shore-independent-review.md)は旧oracleとの36ケースを照合し、順序・EPS・tiny hole・別地区水域・高い床・cache identityを保持。[raw result](review/shore-independent-review.json)。全足幅を中心probeだけへ戻したり、walk graphの別identityを共有したりしない。

診断 `.mjs.txt` は当時の絶対pathを含む保存資料で、汎用CLIではない。新fixture/toolは既存出力を上書きしない。新writer/自然取得/本人authored保存/PWA/実機/独立観察は今回のPASSに含めない。
