# 原所有幹を保つ森林冠3案 — 実3D source 比較

2026-10-12。`sansu-art-direction-loop` に従い、固定 c1 の同じ context による **3つの編集可能な .blend / GLB と source 全景3枚を生成済み**。全 actor 幅・独立幾何監査・実アプリ接続は未実施。独立観察 N=0。root が承認 benchmark・c1 actual・3案を比較し、**b1 を次の粗形の出発点としたが、3案とも HOLD**。採用案・runtime 得点はない。

正本の app、固定 c1 candidate、元 GLB/Blender、root docs に書込みはない。この bundle は tmp で制作し、root の明示許可で docs/design/2026-10-12-authored-forest-crowns/ に exact copy した。新規 gallery、土地、木、owner、配置権、地形変更は責任外。

## 出力と初回失敗

| 候補 | 全景 | 編集可能 source | manifests |
| --- | --- | --- | --- |
| b1 低く広い三段冠 | [PNG](variants/forest-crown-b1-low-wide-v0/source-whole.png) | [Blender](variants/forest-crown-b1-low-wide-v0/study.blend) / [全景GLB](variants/forest-crown-b1-low-wide-v0/study.glb) / [4所有木GLB](variants/forest-crown-b1-low-wide-v0/owned-tree-components.glb) | [source](variants/forest-crown-b1-low-wide-v0/manifest.json) / [render](variants/forest-crown-b1-low-wide-v0/render-manifest.json) |
| b2 斜め上がる冠 | [PNG](variants/forest-crown-b2-rising-v0/source-whole.png) | [Blender](variants/forest-crown-b2-rising-v0/study.blend) / [全景GLB](variants/forest-crown-b2-rising-v0/study.glb) / [4所有木GLB](variants/forest-crown-b2-rising-v0/owned-tree-components.glb) | [source](variants/forest-crown-b2-rising-v0/manifest.json) / [render](variants/forest-crown-b2-rising-v0/render-manifest.json) |
| b3 開いた三日月冠 | [PNG](variants/forest-crown-b3-open-crescent-v0/source-whole.png) | [Blender](variants/forest-crown-b3-open-crescent-v0/study.blend) / [全景GLB](variants/forest-crown-b3-open-crescent-v0/study.glb) / [4所有木GLB](variants/forest-crown-b3-open-crescent-v0/owned-tree-components.glb) | [source](variants/forest-crown-b3-open-crescent-v0/manifest.json) / [render](variants/forest-crown-b3-open-crescent-v0/render-manifest.json) |

初回抽出は元 whole GLB 全sceneの対象外 image/texture で Node `self is not defined` に停止。出力0、Blender未起動の [原ログ・script・失敗](history/extraction-attempt-01/first-failure.json) を保持した。親の指示で [source-subset.mjs](source-subset.mjs) を追加し、必要nodeと祖先への到達可能性だけを絞る attempt02 とした。今回の115必要nodeは元からscene rootで祖先0、world matrix前後完全一致。元BIN chunk・accessors・meshes・materials・buffers・images・texturesの値は不変で、使用材のtexture参照は0。[subset proof](extraction-attempt02/source-subset-proof.json) と [抽出manifest](extraction-attempt02/manifest.json) に記録。

3案とも固定23nodeの変形前後digest・source parameters一致。変更105nodeの最大移動は b1 .695m / b2 .519m / b3 .583m。最高大樹5.0775mに対し、候補の最高は3.6218 / 3.7494 / 3.6408m。柳の5lobeは全案で元幹の実表面を内包したため、新しい木質接合枝は0。既存接触を残し、不要な枝を加えなかった。これは局所ray/内外判定であり、全断面接触・actor guard 合格ではない。

全景は1280×925・Cycles CPU16 samples・AgX。同じ c1 projection のcanvas比率を使用。各4.50–4.59秒、3枚の画像処理は02:50:38 UTC頃に終了。全案に**静的export固有の黒い道の点**があるが c1 actualには無く、冠の変更ではない。材や道を修正して比較画像だけをきれいにする操作はしていない。住人なし/Blender光・海・透過/ripple line差も残る。source構図の比較に限定し、人物親しみ・生活感・runtimeを評価しない。

## 全景比較の判定

b1 の低く広い冠は屋根状の葉量を増した。一方、3案とも輪郭差が小さく、左群は個体または雲形の面が並んだように見え、層のある森林内部には達していない。最高大樹との大小差だけでは、家と中庭の背後を包む連続した森の面を作れなかった。接合・固定検査の数値をこの美術上の不足の埋合せにしない。

次段階は b1 を足場に、同じ4所有木の上・中・下の冠を非対称に重ね、2つの異なる外周の入口を残す構成を調べる。新しい木や自由 anchor を足さず、必要な接合は元幹に連続する実枝で扱う。.85m は作者が初回に設けた移動上限であり製品の不変条件ではない。次段階の値は再検討できるが、浮遊、幹・根・owner 変化、最高主景の置換は許容しない。実行・runtime 接続は別の許可を待つ。

準備当初の7ファイルは [history/preparation](history/preparation/readiness-manifest.json) と同じ SHA で復元保存し、完了後・root 比較前の README / manifest も [history/completed-before-root-review](history/completed-before-root-review/README.md) に保持した。

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
2. [extract-context.mjs](extract-context.mjs) — attempt02実行済み。**固定 c1** の `authoredWorldFrame→sceneLayout→buildObjectLayer` と ground を静的に使用。左4個体の材batch済 tree を一度だけ外し、元GLBの役割別原本128 nodeを同じ tree world matrix/pivot で別GLBへ出した。その他の context は不変。[正確な owner matrix/pivot](extraction-attempt02/bindings.json) を保存。
3. [build-variants.py](build-variants.py) — 実行済み。3つの editable `.blend`、whole `.glb`、owner-only `.glb`、manifest を生成。既存出力があれば止まる。
4. [render-whole.py](render-whole.py) — 実行済み。3枚の全景だけ。確定 c1 のカメラ matrix/projection から UI を除く同じ crop を使用。1280px幅・Cycles CPU16 samples。近景・追加視点・重い actor-band 検査は未実施。

親が c2 core 終了後に許可した連続枠で順次実行した。下記は実commands。既存出力を保護しているため、そのまま再実行して上書きはできない。追加実行には新attemptの明示が必要。

```sh
SANSU_FOREST_RUN_APPROVED=1 node /private/tmp/sansu-authored-forest-crown-study/extract-context.mjs
SANSU_FOREST_RUN_APPROVED=1 /Applications/Blender.app/Contents/MacOS/Blender -b --python /private/tmp/sansu-authored-forest-crown-study/build-variants.py
SANSU_FOREST_RENDER_APPROVED=1 /Applications/Blender.app/Contents/MacOS/Blender -b --python /private/tmp/sansu-authored-forest-crown-study/render-whole.py
```

stdout/stderr は [初回抽出](execution-extract.log.txt)、[抽出attempt02](execution-extract-attempt02.log.txt)、[生成](execution-build.log.txt)、[全景render](execution-render.log.txt) に保存。抽出attempt02は約20秒、生成約16秒、3全景renderは合計約15秒で終了。browser/coreと同時実行していない。これらの短い制作時間を製品performanceの証拠にはしない。

## 実行後にも残る HOLD

- 承認 benchmark と c1 actual の beside 比較を経て、b1 を次の粗形の出発点とした。3案とも HOLD。森林の層と入口の読み取りが不足しており、3案を app に採用しない。
- 変形後の実枝/葉も実 guard へ入れ、l14を含む全 owner 接近・家入口・全 actor 幅・P02/P04・肩根元を後で照合する。既存 c1の通過結果を転用しない。
- 変形部と固定部の source/GLB parity、接合の閉体/全断面接触、NORMAL/PBR、所有 boundary、他31 owner/floor固定を独立確認する。今は未実施。
- この source context に住人 rig は含めない。Blender光/海/透過と ripple line は actual app と異なる。source画像だけから生活感や runtime 採用を加点しない。
- runtime adapter は未作成。採用後も元 owner・形・年齢・配置・source identity に一致する場合だけ冠差分を使い、移動/収納/youngで差分を外す契約が必要。root の実app接続前にこの source を app成果として扱わない。
