# 初期の足元を拡張フラグから切り離す基面

2026-10-22 21:32 UTC。比較候補 `fixed-core-base-v1`。製品sourceと既存F2/Hは変更していない。`baseTrial=stable` を明示した試験だけで使う。

## 対象の問題と方式

元の `baseTerrainHeightAt` は未拡張時にはどの座標でも0だが、最初の取得後にglobal bankを有効にする。初期セル中心0..5/z0..4は0のままでも、ownerの外側footprintはこの矩形の外へ出る。p1のようにx=0にある家は、外半セルのbaseが持ち上がり、同じ配置・同じ保存高さでも足が埋まる。

候補はbaseを取得状態・owner配置に依存しない関数にする。初期セル中心の矩形を外半セルまで広げた `[-.5,5.5] × [-.5,4.5]` は常にbase=0。その外は矩形からの距離1cellのsmoothstep collarで、既存の座標依存global bankへ接続する。距離1以上は元のglobal bankと同値。初期島だけの高さ編集を禁止する方式ではなく、保存offsetは従来通りbaseの後に加算される。

`stableBaseTerrainTransform` は共有provider `placeTerrain.ts` に適用し、描画・旧world・editable floorが同じbaseを見る。`stableBaseWorldTransform` はworld revisionへ候補名を加える。source差替えは一箇所一致を要求する。Nodeは `{alwaysStable:true}` を明示し、ブラウザ以外で隠れたquery依存を作らない。

Fの外周A/F混合、coarse triangle切替、現在桟橋位置に依存するfoundation maskは、この比較では変えていない。以前の固定cardinal候補やramp候補とも混ぜていない。

## 有効だった点

コマンド：`fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/stable-base-check.mjs`。

同じzero-height入力で初期→東西南取得後を比較すると、初期所有footprint全域のbase/実floorの最大変化が **0.166114769m→0** になった。F/Hとも同じ結果。測定は0.1間隔、外半セルを含む。

通常 `terrain-edit +1` の中心は0.18m上がり、Undoでheightsが元に戻り、Redoで編集後terrainと完全一致した。編集入力の意味は凍結していない。

拡張fixture v2のp1・flower・benchの論理支持は全てtrueを維持。flower/benchの中心高さ0.54mも同じ。実native meshの足元は別担当が独立測定する。

初期zero-height島では、比較サンプルで所有矩形外の新dryは0。これは0.1gridでの診断であり、あらゆる編集入力の外側輪郭同値を保証するものではない。baseの近似最大勾配は0.681534594（調べた座標範囲x−4..9、z−3..9、0.1grid/微分幅.001）。Hの物理座標での全勾配保証ではない。

## 残った不成立

拡張fixture v2では到達可能点数307→306、`(-1,4.5)` が失われた。床が水になるのではなく、候補がこの地点のbaseを0.283662529→0.141831265へ下げるため。

| 地点 | 元floor | 候補floor |
| --- | --- | --- |
| `(-1,4.5)` | 0.463662529 | 0.321831265 |
| 西隣 `(-1.5,4.5)` | 0.523984306 | 0.523984306 |

この地点は元から他3方向がcorridor不成立で、西だけが通行できた。collarの下げ幅と編集段丘の合成で西もslope判定falseになる。基面単体の勾配が穏やかでも、既存編集を重ねた実床の通行を保証できない例である。

観測保存33からの通常東→西→南取得では、F/Hの既存境界補間切替が残るため、旧dry喪失は候補でも12/6/7点、旧到達点 `5,2.5` / `0,3.5` の喪失が残った。基面固定を取得全体の完成と呼ばない。

## 判定

初期ownerを持ち上げていたbaseの初回有効化を取り除く点は成立した。既存の任意拡張島へ無変更で移行可能、全経路維持、全面美術合格という判定はしない。実meshの接地を確認し、追加の候補と組み合わせる場合も単独結果と分ける。

## 証拠と検証

- `evidence/stable-base-F-false.json` / `stable-base-F-true.json`
- `evidence/stable-base-H-false.json` / `stable-base-H-true.json`
- `evidence/stable-base-comparison.json`

各JSONに入力/source SHA256、UTC日時。入力は観測保存33と `expanded-fixture-v2.json`。通常取得診断だけは明示的に試験残高10000へ変更。経済進行の証拠ではない。

新規field/transform/check4ファイルのESLintはexit 0。追加probe後のcheck.tsも再検査してexit 0。全体typecheck・UI採用はroot担当。

独立担当の `evidence/ramp-plane-check-pair2.json` で、expandedv2から通常moveした花 `(2,5)` / bench `(1,6)`、rampなしF/Hのp1実native near-ground頂点はminGap +0.039999988m、maxGap +0.054m、欠床0。元のF −0.080104m / H −0.082117mの埋まりは解消した。全owner論理支持と両actorのgarden/bench実receiptも成立。

一方、移動先flower rimには候補F −0.0057886m / H −0.0057968mの微小な埋まりを導入した（元は約+0.0041m）。Fのv2利用経路では尾の最大約3.8cm埋まりも独立診断に残る。p1の修正を、全owner/actorの完全接地合格へ拡大しない。
