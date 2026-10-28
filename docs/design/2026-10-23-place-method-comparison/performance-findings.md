# 拒否した地形操作でも止まる理由

2026-10-23 JST。ブラウザー操作はroot、こちらは読み取り監査とNode診断。製品source・保存データは変更していない。

## 観測と結論

実UIの [61の計測](evidence/61-H-rejected-edit-cadence.json) は、96区画のH＋linear＋stableで (4,4) を下げ、住人の足元保護により拒否された操作を含む。10秒中のrAF中央値16.7ms、p95 17.5msに対し、最大間隔は **1732.5ms**。タブはvisibleのままだった。これは常時低FPSの証拠ではなく、操作中の大きな一度の停止である。

rootの再計測では、同じ位置の下降を受理しUndoする操作の最大間隔は84.2msだった。コードとNode診断は、**最初の候補地形を同期で全構築し、拒否した候補もcacheに残るため次は速い**という説明を支持する。ブラウザー1.7秒の全時間をNodeだけで帰属したわけではない。

## 拒否までに行われる処理

1. `TrialIsland.ts` の試験hookは、async関数内で `applyIntent()` を同期呼出しする。`async` という宣言だけではこの計算中に描画を続けられない。
2. `applyTerrainCommand()` は候補stateを作り、`terrainFootingError(previous,next,actors)` を呼ぶ。
3. 足元判定の最初に、現stateと**変更候補の全world**を `editableIslandWorld()` で取得する。新しい高さrevisionはcache missとなる。
4. 96区画Hのdetail 12では24,073サンプルから地表を作り、約49,696枚の地表・水面三角形を処理する。`compileWorldDefinition()` で三角形の検証・索引を作り、通路を判定した後、同じ地形と新しいedgesで再度compileする。
5. その後に家・所有物・住人の足元を順に調べる。最後の住人保護で拒否しても、重い候補world構築はすでに終わっている。高さは保存されないが、world cacheには候補が残る。

`GrowingWorld` はreceiptだけの変更や値が等しいpropsを再利用する。今回のfixture拒否ではrecordのstateは変えずerrorだけを更新するため、拒否後の全描画layer再構築が必須という経路ではない。CPU側の候補生成だけで大きな停止を説明できるため、最初からGPUや描画負荷の問題と決めつけない。

## Nodeで分離した結果

実61の入力を既存 `newIsland` へ既知のfieldだけコピーし、ブラウザーと同じH / foundation / stable / linear変換を適用した。actor位置は診断用に (4,4) と明示したもので、ブラウザーの実actor telemetryではない。レンダラー・GPU・DBは使っていない。

| 操作 | CPU経過時間 | world構築 |
| --- | ---: | --- |
| 現在のworldを初構築 | 602.4ms | 1回 |
| 同じworldを再取得 | 0.21ms | 0回 |
| 初めての(4,4)下降、actor guardで拒否 | 515.9ms | 1回 |
| 同じ拒否を再試行 | 1.13 / 0.78ms | 0回 |
| 同じ候補をactor無しで受理 | 0.78ms | 0回 |
| 未計算の上昇候補をactor guardで拒否 | 520.8ms | 1回 |

最初の拒否515.9msのうち、mesh生成137.9ms、最初のcompile152.9ms、通路計算56.1ms、二度目のcompile166.9ms。三角形と索引の二度構築が約320msを占めた。入力全体は不変。実測とsource hashは [performance-probe.json](evidence/performance-probe.json)、再現は `node docs/design/2026-10-23-place-method-comparison/performance-probe.mjs`。

この診断は候補を固定したNode条件であり、ブラウザーquery判定の反復、GC、React、描画を含まない。約516msをブラウザー1732.5msと同一視しない。ただし、新規候補とcache hitの差は桁が異なり、idle測定や同一操作の反復だけでは見逃すことが分かった。

## 次に試す修正と、してはいけない短絡

最初は**地形の検証と索引を一度作った結果へ、通路graphだけを接続する**比較候補を試す。二度目のcompileが行っているedge検証・ID/所有権検証・不変性を省略せず、形状と索引を再利用する。実装と独立診断はterrain担当が行う。

現在のworld cacheは8件のFIFOで、hit時の順序更新はない。容量を増やすだけでは、子どもが初めて触る位置の停止は解決しない。拒否した候補のcache利用はすでに効いている。actor保護を外す、支持検査を間引く、描画だけ先に変える、といった高速化は行わない。

一度compileでも停止が残る場合は、変更近傍の地形・索引・通路だけを更新できる責任分割か、状態revisionを確認する非同期計算が必要になる。選択時に同じ重い処理を先回り実行するだけなら、停止を別の操作へ移した可能性があるため合格にしない。

## ブラウザーで対応を取るための観測

`TrialCadence.tsx` に、計測開始からの同じms時刻軸で次を追加した。状態や操作結果は変更しない。

- capture listenerによるクリック時刻と対象のtag / id / 短いlabel。入力値は取得しない。
- PerformanceObserverが対応する場合のlongtask開始・終了・duration。未対応は明記。
- 50msを超えたrAF間隔の開始・終了。各記録は40件まで、総数は別に保持。

hidden / unmount / 完了でlistenerとobserverを解除し、React更新は開始・終了時のみ。同時刻に重なっただけでは原因を断定しない。新しい未計算候補と、同じ候補の再試行を分け、UIの拒否/受理・地形不変/変更と照合する。平均値だけで操作の快適さを判定しない。

追加した観測は、読み取りmockでクリック・longtask・rAFの記録と完了時cleanupを確認。`tsc --noEmit` で `src/vite-env.d.ts` と `TrialCadence.tsx` を対象に型検査も通過した。これはアプリ全体の検証ではない。

### 一度compileにまとめてもブラウザー停止は残った

[70のブラウザー計測](evidence/70-H-single-cold-edit-cadence.json) は v12 / single-compile-v1、06:50:08〜18 JST、visible の10秒。開始566.0msに「じめんを さげる」をクリックし、longtask が565.9〜2252.9ms（1687ms）、対応するrAF間隔が1684.4msだった。中央値16.7ms、p95 18.1msだけを見るとこの停止を見逃す。singlecompile はこの実操作の停止を解消していない。

[71の single off 対照](evidence/71-H-double-cold-edit-cadence.json) は同v12 / shore fixture / 同じ `(4,4)` の0→-1受理編集。longtaskは1841ms、最大rAF間隔1832.6msだった。singleの70との差はそれぞれ154ms、148.2ms。**各1回の比較では小さな改善に留まり、1.7秒級の停止は解消していない。** 一般的な性能改善率を保証する比較ではない。

70/71の結果stateは、land、terrain（raw heights＋Undo/Redo）、plots、landmarks、keepsakes、villagers、characterが一致した。最後のUndo記録から戻した操作前のraw heightsも実69と一致。照合と入力hashは [single-browser-pair-check.json](evidence/single-browser-pair-check.json)。saved stateの一致は、瞬間的な住人の位置・GC・ブラウザー内部状態まで同じだったという証明ではない。

この記録はクリックを含む長い処理を示すが、関数別の内訳を持たない。Nodeの計算削減率をブラウザーへ転記せず、地形生成・安全判定・scene再構築の読み取り時間計測を待つ。受理編集で必要な画面更新と、61の拒否編集とは区別する。

## 線形斜面だけを detail 6 にする診断

`coarse-linear-transform.mjs` は `meshTrial=coarse`、F/H、`rampTrial=linear` が全て揃うときだけ detail 12→6 にする。土地・所有物・半セル経路点を間引かず、描画・支持・経路検証は同じ粗い実メッシュを参照する。**今回の統合候補から棄却。** 床・水域が変わるため、同値の性能改善としては扱わない。

`node docs/design/2026-10-23-place-method-comparison/coarse-linear-check.mjs` で、実UI入力60、16手後の湾入力69、各入力の `(4,4)` を -4 / +12 にした合成極値を計6組比較した。極値だけは履歴を空にした診断入力であり、通常操作で取得した状態ではない。原入力は不変。結果は `evidence/coarse-linear-check.json`。

- 入力60の冷生成は528→264ms、69は520→242ms。両者とも元の二重compileであり、singlecompile削減とは独立の比較。Node CPU時間であってブラウザの停止時間ではない。
- 所有権・anchor・site数・所有物支持判定は一致。walk/join/waterの連結成分と、各ケース4個の編集受理/拒否も一致した。
- しかし床は同値でない。全ケースで `(2.75,1.75)` の高さ差が最大5.83cm。歩行辺は2本増える。入力69は0.05格子47,241点のうち1点が水から乾地に変わり、-4極値では乾地が消える2点もある。これは所有権・連結性の一致だけでは捉えられない。
- 線形化したのはoffsetである。固定物の周囲を守る `foundationEditWeight` は .66〜1.0 の範囲で非線形に変化し、基面・外縁にも非線形成分がある。したがって「線形だからdetail 6で全床同値」という仮定は成立しない。粗密候補は接地・水際・見た目の別監査が必要。

この短い診断は新しい美術案の合格、連続衝突判定、住人の自然利用、実機性能の合格を示さない。経路点を消す軽量化や安全検証の省略はしていない。

## 72の関数別CPU実測と、動的queryの呼出し回数

[72の実ブラウザーCPU区間](evidence/72-H-single-cold-cpu.json) は single compile の受理編集を1回記録した。cold world は1回、compileは1回、cache hitは7回、未完了span・保存上限によるdropは0。入れ子のinclusive時間は加算しない。

| 計測区間 | inclusive | self / 内訳 |
| --- | ---: | --- |
| applyIntent | 1655.3ms | world以外 2.0ms |
| editableIslandWorld cold | 1653.2ms | compile以外 1364.9ms |
| compileWorldDefinition / derived edges | 288.3ms | edge生成callbackを含む |
| GrowingWorld.rebuild（別root） | 57.9ms | layout以外 13.2ms |
| worldScene.layout | 44.6ms | rebuildの子区間 |

cold worldは計測開始後569.4msに始まり、compileは1934.3msまで始まらなかった。したがってcold world時間の約82.6%はcompile前のサンプル・三角形等の生成側にある。今回の大きな同期停止の主因をscene再構築に求める説明は、この内訳には合わない。ただしGPU実行、ブラウザーのstyle/layout/paint、計測root外のrender計算、非同期保存は対象外であり、「描画全般が軽い」とは結論しない。72のobserver JSONは旧フィールド名 `filteredCacheHits` を持つ版で、後の `filteredFastTerrainCalls` 版とは表示フィールドが異なる。主要5区間の計測範囲は同じ。

これを受け、実69の状態、同じ `(4,4)` の0→−1、旧worldをwarm済みにしてから、ブラウザーと同じ動的query枝を使う一時Node bundleで**呼出し回数だけ**を独立測定した。結果と入力・実行bundle hash、制約は [hotpath-call-count.json](evidence/hotpath-call-count.json)。再現は `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/evidence/hotpath-call-count.mjs`。

| 対象 | 1編集あたりの呼出し回数 |
| --- | ---: |
| window.location.search の読み取り | 632,097 |
| new URLSearchParams | 632,097 |
| terrainTrial query | 504,026 |
| rampTrial query | 64,035 |
| baseTrial query | 64,035 |
| compileTrial query | 1 |
| rawHeight | 64,030 |
| physical | 74,039 |
| landscapePoint | 504,021 |

96区画・detail 12の格子sampleは24,073点。そのうち外周13,200点はcoarse補間の四隅を毎回評価するため、初期格子だけでrawHeightは63,673回になる。半セル経路候補の357回を合わせて64,030回。さらにwet bank三角形の各頂点を重複して物理投影し、外周のXとZそれぞれで四隅のlandscapePointを呼ぶため、物理投影の反復が増える。

診断上の座標重複はrawHeightが64,030回に対して約11,785座標、physicalが74,039回に対して約25,257座標、landscapePointが504,021回に対して約14,576座標。ただしunique集計は `toFixed(9)` を用いており、**未丸めdoubleを使う厳密memoで必ずこの件数まで減るという証拠ではない**。

既存Node診断は `alwaysH` / `alwaysStable` / `alwaysLinear` を指定し、これらのquery再解析を省いていた。これはNodeとブラウザーの差を説明する強い候補だが、件数だけでは1364.9msの全てをquery処理へ帰属できない。起動時query固定候補の同build・同入力・未計算編集のブラウザー対照を待って因果を判定する。queryを固定した後にも基面・補間・三角形・投影の重複計算は残る。安全検査の省略やメッシュ粗密化とは分けて扱う。

## 74/75 同じv15でquery固定の効果を比較

[74/75照合](evidence/frozen-browser-pair-check.json) は、build-versionのUUIDまで同じv15、shore memory fixture、通常の `(4,4)` 0→−1受理編集を各1回比較した。候補差は `frozen-query-v1` の有無だけ。build DOMは全項目一致し、land・terrain全体（Undo/Redo含む）・所有物・住人・character・drops・town・派生placesも一致した。一方、事前の自然利用で `placeProgress` の時刻・garden/bench対象が8葉異なるため、**全stateや瞬間的なactor位置まで同一とはしない**。

| 計測区間 | query固定74 | 動的query75 |
| --- | ---: | ---: |
| cold world | 432.6ms | 1600.1ms |
| cold world self（compile以外） | 144.1ms | 1312.2ms |
| compile（edge生成callbackを含む） | 288.5ms | 287.9ms |
| applyIntent | 434.9ms | 1601.8ms |
| scene rebuild（別root） | 57.3ms | 67.1ms |
| 対応longtask | 496ms | 1672ms |
| 最大rAF間隔 | 500.4ms | 1666.7ms |

いずれもvisibleの10秒、cold compile・action・sceneは各1回、失敗・drop・未完了は0。入れ子のworld/compile/actionを合算しない。別rootのactionとsceneだけの合計は492.2ms対1668.9ms。この操作ではquery固定によりcompile前の処理が約1168ms短くなり、compileはほぼ変わらなかった。632,097回のquery読み取り診断と合わせ、**大きなprecompile差をquery解析が作っていた**という説明を強く支持する。ただし各1回、順序・GC・熱状態等を統制しておらず、一般的な改善率を保証しない。残る約500msの停止は、滑らかな直接編集の合格ではない。

操作前の独立state captureはない。両方の最終Undoから戻したraw heightsは実69および実hookが読むshore fixtureに一致し、残る履歴63件はそのfixtureの末尾63件と一致した。実69とは製作順が異なるため履歴全体の一致は主張しない。ブラウザーのGPU/描画mesh hashは未取得。幾何入力・派生placesの一致と、別の [frozen-query-check.json](evidence/frozen-query-check.json) のNode world/floor/site/query同値検査を区別する。

## 通常保存へ戻った53/76の確認

[ordinary-restoration-check.json](evidence/ordinary-restoration-check.json) では、通常島のland・全terrain/Undo/Redo・所有物・住人・character・drops=8・town・派生placesが53と76で一致した。96区画の診断fixtureがこれらの通常保存内容を置き換えた形跡はない。`useHistory` は33件の配列が完全一致し、milestones/shownも一致した。

違いは `placeProgress.uses.P05.pokomoko` のtargetIdとatの2葉だけ（garden→bench）。変更前後の代表recordは両方とも既存の同じuseHistory内にある。したがって「53以降に新しい履歴が追加された」という旧推定を撤回する。`recordPlaceUse` は既存receiptを代表値に再選択できるが、今回のcaptureだけで発生時点や原因は確定できない。保存内容全体のbit一致、全セーブ互換性、offline保存の証明へ広げない。

## 残るcompileの読み取り監査（未実装）

74/75ではcompileが約288msで変わらない。ここには三角形の複製・検証・論理/物理索引の構築、site照合、edge生成callback、そのedgeの最終検証、freezeが含まれる。現観測はこの内部を分割していないため、どれが最大かは未確定。BFSのroute実行は関数を定義するだけでcompile時には呼ばれておらず、route探索を主因に挙げる根拠はない。

ソース上で確実な反復は、`editableTerrainWorld.ts` の `addEdge` が `geometry.isWalkEdgeSupported(a,b)` を呼び、single-compile callback終了後に `worldDefinition.ts` の明示edge検証が同じ向き・同じgeometryへ `walkEdgeError(a,b)` を再実行すること。通常の半セル/1セル辺は9位置×横3点の27床sampleを1判定で行う。受理edge1本につき、最終検証の27sampleが完全に重なる。別の `editableTerrainSegmentSupported` は横幅.18・勾配とbridge lipを検査するため、この27sample検査と同じものではなく削除できない。

次の単独候補は、**compile1回の内部だけで、有向の端点ペアに対するwalkEdgeErrorの結果（理由文字列またはundefined）を記憶し、edgeBuilderと最終edge検証が共有する**こと。外部入力edgeのID・所有権・allows・重複の検査はそのまま残す。未検証edgeは必ず計算する。向きや座標を丸めて同一視せず、undefined成功もMap.has等で明示する。immutableな内部sites/geometryを使うこの区間に限定し、公開floorAtのmutableな戻り値をcacheへ流用しない。

これは検証済みの安全条件を再利用する案であり、メッシュ/通路/支持条件を緩める案ではない。ただし削減msは未測定で、約288ms全体を消せる保証はない。実装するなら、通常/湿地/bridge/不正入力で出力worldと失敗理由の一致を比較し、同じブラウザー操作で確認する必要がある。本監査ではruntime・計測コードを変更していない。

## 79/80 同じv17で通路検査の再利用を比較

[edge-browser-pair-check.json](evidence/edge-browser-pair-check.json) は、単一compile・query固定・sample memoを両側で有効にし、`edgeTrial=memo` だけを切り替えた各1回の実ブラウザー比較。build-version UUIDまで同じv17。今回は操作前stateも取得しており、前後ともland・全terrain/Undo/Redo・所有物・住人・character・drops・town・派生placesが一致した。両側とも `(4,4)` 0→−1だけを変更し、Undoに1件追加して64件へ制限、Redo空という遷移が一致する。カメラの両行列・選択セル・terrain revisionも一致。80だけCSS class属性も採取しているが、共通data属性の相違は候補suffixだけだった。

| 計測区間 | edge memo ON79 | OFF80 | OFF−ON |
| --- | ---: | ---: | ---: |
| cold world | 344.9ms | 355.3ms | 10.4ms |
| compile / edge生成・検証 | 277.8ms | 283.6ms | 5.8ms |
| world self | 67.1ms | 71.7ms | 4.6ms |
| applyIntent | 346.5ms | 356.6ms | 10.1ms |
| scene rebuild（別root） | 57.3ms | 85.4ms | 28.1ms |
| scene layout（rebuildの子） | 44.9ms | 66.5ms | 21.6ms |
| 対応longtask | 407ms | 445ms | 38ms |
| 最大rAF間隔 | 400.7ms | 433.4ms | 32.7ms |

80の66.5msをscene全体と読むのは誤りで、これはlayout子区間。actionと別rootのrebuildの合計は403.8ms対442.0msであり、inclusiveな子区間は加算しない。action開始は対応クリックからON1.0ms/OFF0.2msで、両側cold/compile/action/rebuild各1回、失敗・未完了・dropなし、visibleの10秒だった。

通路検査の再利用でcompileは5.8ms短くなったが、**今回の1組だけでは安定した改善率を確定しない**。rAF差32.7msの全てをedge memoへ帰属できず、別rootのscene差28.1msも含まれる。自然利用の履歴件数・対象・時刻・代表revisionは条件間で異なり、瞬間的なactor姿勢・GC・熱状態も統制していない。操作中のplaceProgressはそれぞれ不変。Nodeの4fixture/不正入力/経路同値検査と合わせ、同値な小規模候補としての根拠はあるが、compile全体や約400msの停止を解消したという判定にはならない。今回の性能候補追加はここで凍結し、編集・Undo/Redo・住人利用の最終確認へ進む。
