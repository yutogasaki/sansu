# Editable worldの二重compileを一度にする比較

2026-10-22 21:47 UTC。製品sourceは変更せず、比較buildのtransformだけで検証した。ブラウザqueryは `compileTrial=single`、Nodeは `singleCompileTerrainTransform(...,{alwaysSingle:true})`。

## 変更の構造

従来はfloor/anchor/siteをcompileして実床queryを作り、そのqueryでedgesを求め、同じfloor全体とedgesを再びcompileしていた。

比較APIは `compileWorldDefinition(input, edgeBuilder?)`。optional callbackへ渡すのは、floor/siteをcompileした時点の `floors` / `floorAt` / `isWalkEdgeSupported` だけ。callbackのedgesをcloneした後、**従来と同じedge validationとgraph構築を実施してから**最終worldをfreezeして返す。

公開済みworldや凍結済みdefinitionへ後付けでedgesを書き込まない。neighbors/routeのclosureは、公開時には完成したgraphsを参照する。callbackへ渡すfloors/query objectもfreezeし、返されたedgesはcloneする。callbackが投げた場合はworldを公開しない。

`editableTerrainSegmentSupported` の引数型はtrial内で `Pick<IslandWorld,'floors'|'floorAt'>` に限定し、必要な情報だけで同じ処理を実行する。型castで空のrouteなどを偽装したpreview worldは作っていない。

## 同等性検証

入力4件：初期島、負の開口、実観測61の拡張島、既存bridgeを持つ初期島。全てactual H＋stable base＋linearの変換を通した。通常2compileとsingleを別Node processで比較した。

- definition、floors、anchorFloors、surfaces、sites、walkSites、boundsの各SHA256が完全一致。
- 7096点でfloorAt（指定floor含む）/sampleFloorAt/anchorFloorAt/anchorAt/owns/shoreApproachCells/logicalAt/siteAtの結果hash一致。
- 全siteのwalk/join/water neighborsと各隣接のisWalkEdgeSupported結果が一致。
- 全site/一部を閉じたsiteの2種類、3passage、選んだ複数始点から全終点への計19290経路が一致。
- 公開後の非空neighborsをassertし、graphを取りこぼしたclosureではないことを確認。
- callback一回、query/floorsのfreeze、返却edgesのclone、入力不変、重複edge/未知endpoint拒否、callback例外伝播を確認。

実commandのactor位置付き−1/+1は両方式で同じ拒否文を返し、元stateは不変。同じ−1の再試行も同じ結果。

## CPU測定

| 操作 | 従来 | single |
| --- | ---: | ---: |
| 初期world cold | 312ms | 240ms |
| 負開口world cold | 235ms | 208ms |
| 実観測61 world cold | 521ms | 481ms |
| bridge world cold | 213ms | 174ms |
| 新しい−1候補を作る拒否判定 | 509ms | 351ms |
| 新しい+1候補を作る拒否判定 | 472ms | 388ms |
| 同じ−1候補のcache再試行 | 2.08ms | 0.86ms |

単発のNode CPU診断で、ブラウザframe・GPU・DB・renderer再生成の時間ではない。最初のcoldはJIT/GCの影響もあるため、この表だけで一定率の高速化や体感待ち時間解消を断言しない。別のphase計測と実画面をroot側で確認する。

## 統合APIと検証状態

- `singleCompileWorldTransform(worldDefinitionSource)`：比較buildのworldDefinition.tsへ適用。
- `singleCompileTerrainTransform(actualTerrainSource, options)`：foundation→terrainMethod→stableBase→ramp等の最終terrain sourceの後へ適用。
- worldDefinition.tsもTypeScript検査overlayの変換対象へ追加する必要がある。
- 元source差替え箇所が一箇所一致しなければ明示エラー。

新規3コードファイルのESLintとNode同等性診断はPASS。型検査/実build/実UIはroot側で進行。元srcは無変更。単一compileを使わない比較queryでは従来の二重compile経路も保持する。

## 証拠

実行：`fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/single-compile-check.mjs`。

`evidence/single-compile-false.json` / `single-compile-true.json` / `single-compile-comparison.json` に全hash、入力版、UTC日時、件数、CPU時間を保存。

今回の同等性は明示した4fixtureとquery集合に対するもの。全authored world・全water carvingなどの全組合せを検証したという意味ではない。ただしcallbackを渡さない既存APIは従来処理を通り、edge validationを省略していない。
