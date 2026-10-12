# 原所有幹を保つ森林冠3案 — 未実行の制作準備

2026-10-12。`sansu-art-direction-loop` に従う source 比較の準備。**Blender / scene 組立 / 重い geometry 検査 / render はまだ実行していない。編集可能な .blend と GLB は、下記 script を実行した時点で初めて生成される。** アプリ未接続、独立観察 N=0。採用案・予想得点はない。

正本の app、固定 c1 candidate、元 GLB/Blender、root docs に書込みはない。所有する制作範囲はこの tmp directory のみ。新規 gallery、土地、木、owner、配置権、地形変更は責任外。

## 根拠と移す形

確定 c1 shape-only の実2枚を参照する。同じ `authored-shoulder-c1:3fd164b9-6f32-4502-9ca5-dde6c5c1cbd7`、1280×900、DEV target `http://127.0.0.1:5358/prototypes/place-qa/authored.html?water=wide&cove=corner&shoulder=central&ground=source&reference=shoulder35`。全景 SHA `070ca145…`、肩近景 SHA `7ee7d70f…`。完全な路径・SHA・カメラ・app version は [study.json](study.json) に保存。shape-only の成功は、別途 OOM した全取得行程の成功ではない。

承認 benchmark は元 `docs/design/2026-10-10-island-final-3d/whole-island-render.png`。現在の実全景では、左4木は冠の間隔と個体の縦長さが強く、家と中庭を包む葉面に届かない。肩3木は前後差を増したが、左の裸斜面まで連続した森とは読めない。肩近景は l14 群の接合品質を証明する画像ではない。

| 移す | 移さない |
| --- | --- |
| 冠が前後・上下に重なる大きな面、最高大樹と中層の尺度差 | benchmark の別15軒配置、未所有の木数、自由 anchor |
| 元柳の垂れ葉、白樺の丸い葉塊、尖冠の異なる素材と形 | 一律の丸い primitive 冠、巨木の追加複製、全材料の平準化 |
| 家の背後を包む冠と、明るく抜ける幹下 | 家・水庭・花庭・入口を一枚の葉屋根で隠す構成 |
| 既存幹から実枝を経て冠へ届く連続 | 画像上だけの接合、浮いた葉、枝を歩行床と扱う変更 |

構図の制作文は「同じ4本の冠を広げる → 葉面が重なる → 家の背後に奥行きができる → 幹の間に入れる明るい空間が残る」。新しい gameplay の説明や通常取得契約を実装しない。

## 固定する source と所有

元 GLB SHA `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。原 GLB/Blender は read-only。kit の source pivot を使用し、役割ごとの AABB へ recenter しない。

| owner | cell | species / 年齢倍率 | 固定役割 | 比較する役割 |
| --- | --- | --- | --- | --- |
| l14 | (2,-4) | willow / big 1.3 × .45 | 幹1・根4・樹皮筋3 | lobes5・垂れ茎14・葉70 |
| l15 | (2,-3) | birch / big 1.3 × .45 | 幹1・樹皮模様6 | 木質枝3＋葉冠3 |
| l28 | (1,-4) | spire / mature 1 × .45 | 幹1 | 4tier（上下位置と中心軸を保持） |
| l29 | (4,-3) | birch / mature 1 × .45 | 幹1・樹皮模様6 | 木質枝3＋葉冠3 |

128 role node 中23は固定、105を変形する。幹/根/樹皮の local vertex・index・custom normal と owner/world matrix の変形前後 digest を比較する。これは Blender import 後の固定性検査であり、raw source→Blender→GLB の完全な export parity を先に主張するものではない。

肩 l33/l34/l35 とその実根元、compact 大樹 l10–l13、他31 owner、全床/色/法線・家・花・水・cove は同じ c1 objectLayer/ground から構築した context を保持する。既存の細い owner 間枝も c1 context として固定し、新しい nav/support として扱わない。最高大樹の形と最大高さを変えない。

## 3案の初期パラメータ

**すべて比較用仮値。支持・接合・通路・美術の採用値ではない。** `stretch` は上部のみの倍率、yaw は上部の度数、shift は authored world m。owner root と元幹は動かさない。

| 案 | l14 stretch / yaw / shift | l15 stretch / yaw / shift | l28 stretch | l29 stretch / yaw / shift |
| --- | --- | --- | --- | --- |
| b1 低く広い三段冠 | 1.38/.94/1.18; 0°; 0/0/0 | 1.35/.88/1.15; -12°; .12/0/.04 | 1.10/1/1.10 | 1.40/.90/1.12; 18°; -.10/0/-.02 |
| b2 斜め上がる冠 | 1.16/1.04/1.34; 12°; -.08/.08/-.08 | 1.20/1.06/1.34; -8°; 0/.13/-.10 | 1.05/1/1.12 | 1.45/.82/1.05; 10°; -.15/-.08/-.06 |
| b3 開いた三日月冠 | 1.28/.98/1.12; -10°; -.16/0/-.12 | 1.32/1/1.08; 18°; -.14/.06/.06 | 1.12/1/1.05 | 1.42/.94/1.15; -14°; .10/-.02/-.08 |

b1 を第一比較候補とし、b2 は段差と奥行き、b3 は囲まれ感と開口を比較する。どの案も左群から肩へ支持のない枝を渡さない。変形は .85m/vertex まで、最高主景より少なくとも .25m 低いことを生成時に停止条件とする。これらは悪い粗形を無条件に出さないための上限で、actor clearance の代用品ではない。

## 接合と法線

白樺の3枝と3葉冠は同じ連続変形場を使い、元 branch-root 高さの固定帯を残す。枝だけを動かして冠を置き去りにしない。元幹・樹皮模様は変えない。元生成 script の branch anchor と実幹接合は別なので、実行後に元接合の連続も確認が必要。

柳の冠89 node は同じ変形場へ通し、元 tip core を固定する。独立 main-bough が原GLBにないため、5つの既存 lobe ごとに、実幹表面から実 lobe へ届く短い閉じた木質枝を生成する。幹表面が既に lobe 内部なら余計な枝を足さない。原 trunk/lobe の BVH ray と2方向の内外判定が合わなければ生成を止め、最初の失敗を保存する。新枝は同じ l14 owner・元幹材・元 tip 半径に由来する taper で、旧幹を削らず接触する別の閉体。端点の ray 接触は全断面支持や干渉の合格ではない。

上部の NORMAL は元 split normal へ変形場の Jacobian 逆転置を適用する。全島一括 weld や法線の一括再計算をしない。原材料は GLTFLoader で保持する。根元や他 owner の材質を調整して粗形の弱さを隠さない。

## 実行の分離

1. [prepare-study.py](prepare-study.py) — 実行済み。metadata/SHA/parameter の準備のみ。15入力の前後 SHA 一致、GLB頂点 decode・domain compile・Blender・render なし。
2. [extract-context.mjs](extract-context.mjs) — 未実行。**固定 c1** の `authoredWorldFrame→sceneLayout→buildObjectLayer` と ground を静的に使用する。左4個体の材batch済 tree を一度だけ外し、元GLBの役割別原本128 nodeを同じ tree world matrix/pivot で別GLBへ出す。その他の context は不変。frame/owner transforms の数値はここで取得し、未測定の高さを捏造しない。
3. [build-variants.py](build-variants.py) — 未実行。3つの editable `.blend`、whole `.glb`、owner-only `.glb`、manifest を新規生成。画像は作らない。既存出力があれば止める。
4. [render-whole.py](render-whole.py) — 未実行。3枚の全景だけ。確定 c1 のカメラ matrix/projection から UI を除く同じ crop を使う。1280px幅・Cycles CPU16 samples。近景・追加視点・重い actor-band 検査は次の枠。

親が core 終了後の連続枠を明示してから、順次実行する。環境変数は誤起動防止であり、先に設定して自動待機させない。

```sh
SANSU_FOREST_RUN_APPROVED=1 node /private/tmp/sansu-authored-forest-crown-study/extract-context.mjs
SANSU_FOREST_RUN_APPROVED=1 /Applications/Blender.app/Contents/MacOS/Blender -b --python /private/tmp/sansu-authored-forest-crown-study/build-variants.py
SANSU_FOREST_RENDER_APPROVED=1 /Applications/Blender.app/Contents/MacOS/Blender -b --python /private/tmp/sansu-authored-forest-crown-study/render-whole.py
```

各コマンドの stdout/stderr は新規 `.log.txt` へ保存する。所要未測定。暫定目安は抽出1分以内、生成1–3分、3全景2–6分。最初の出力時刻で見直し、browser/coreと重ねない。

## 実行後にも残る HOLD

- 3案の全景を承認 benchmark と c1 beside 比較してから方向を選ぶ。画像がない段階の得点は付けない。
- 変形後の実枝/葉も実 guard へ入れ、l14を含む全 owner 接近・家入口・全 actor 幅・P02/P04・肩根元を後で照合する。既存 c1の通過結果を転用しない。
- 変形部と固定部の source/GLB parity、接合の閉体/全断面接触、NORMAL/PBR、所有 boundary、他31 owner/floor固定を独立確認する。今は未実施。
- この source context に住人 rig は含めない。Blender光/海/透過と ripple line は actual app と異なる。source画像だけから生活感や runtime 採用を加点しない。
- runtime adapter は未作成。採用後も元 owner・形・年齢・配置・source identity に一致する場合だけ冠差分を使い、移動/収納/youngで差分を外す契約が必要。root の実app接続前にこの source を app成果として扱わない。
