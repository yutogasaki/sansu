# 中央肩 C — 次の主制作候補の数値実現性

**現行アプリ未変更、数値床での source/physics 診断 PASS。閉じた土盛り GLB/Blender・本体実画面美術は未検証。** 選択案は `south-west-v3`。元73権利を保持した上で2点を明示診断地区へ加え、既存の空き権利1点と合わせて通常コマンドで3苗を置く、仮の取得・成熟 fixture である。本人保存・通常の土地取得/価格・全島完成・M2合格を示さない。

元32 owner records、元73地点の anchor と全支持域を保持する。増分は2診断権利と3苗で **75権利 / 35 owners**。3苗は各20 drops、計60（9230→9170）、通常の `advanceNature` 18時間で mature。新規土地2点の価格や購入は実装していない。元最高大樹の実描画 bounds は baseline と一致し、原本GLB SHAは `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` のまま。

| owner | cell (world x,z) | treeForm / native source | 支持中心 y | 根拠 |
|---|---|---|---:|---|
| l33 | (6,-7) | spread / willow | 1.207569681 | 既存73内、未占有・通常配置可、元床不変 |
| l34 | (7,-6) | branch / birch | 1.585 | 新しい診断支持面、通常配置可 |
| l35 | (8,-6) | spire / spire | 1.615 | 新しい診断支持面、通常配置可 |

新2点の元床は footprint 全域で y=.740–1.912 / .759–1.938 と急で、元のままでは支持不可。v3では中心を北案の1.8–1.9に固定せず、元中心1.629/1.635に近い1.585/1.615とした。足元の全三角形はそれぞれ y=1.4332–1.7368 / 1.4632–1.7668、中心から最大差.1518。これは検証済みの一組であり、任意の高さ区間すべての合格を意味しない。

## 制作への確定手渡し

[最小 handoff](selected-v3-handoff.json.gz) は236,426 bytes、SHA `a5e947cf22a7a2ad02272902f5836da464f0f89630001eea4be95583103efdb8`。[抽出script](extract-handoff.py)は原結果の境界、新床vertices/indices、材質lineage、sites/edges、height関数原文、3 ownerの実matrix、断面をコピーするだけで、形を計算し直さない。[manifest](selected-v3-handoff-manifest.json)に入力SHAを持つ。元material0/1の三角形に一意に対応し、0=1722 / 1=4893、対応原三角形外の最大丸めsliverは5.26e-16。[原材質検査](raw/south-west-v3/material-provenance.json)を保存する。

同じ35 ownersのoffline構築は [assembly-extract.mjs](raw/south-west-v3/assembly-extract.mjs) の `sceneLayout` → `buildObjectLayer` を使う。state/world/frame-plansは同じrawフォルダにある。`layer.root.updateMatrixWorld`後、診断用root rename前を採る。P02最高大樹、8軒、cove、flower、waterを現fixtureから再構成し、原本の別構図15軒は流用しない。正確なclip後の保持床はfinal worldの `native05-inlet-core` にあるmaterial0/1 floorを読む。追加edgesだけでは既存refの移転・再検証を含まないため、完全なnavはfinal worldが正本。

木の見える接地は別の未解決事項である。[実source幹の最低4頂点と床の差](raw/south-west-v3/root-contact-floor.json)は l33=+1.1–8.3mm、l34=+27.9–44.6mm、l35=+33.9–51.6mm。現行の floor+.04 / kit pivot / owner transformを保持した結果で、最低頂点だけの診断である。底面全域の支持証明ではない。今後、同owner派生sourceとして連続する短い閉じた根元を造形する場合、その新geometryのguard・境界は別監査とし、本書の数値支持・経路PASSを遡及適用しない。

土盛りの底・側面・厚みはこの診断で未確定。原本を保持した別source候補で両材の旧topをclipし、exact新topと保持床境界を接続する。単に元の高い丘へtopを重ねると旧面が貫通する。閉じた土壌の底厚はsource制作で決めて記録する。

## 再現できる形と入口

[原スクリプト](raw/south-west-v3/candidate-probe.mjs)と[原結果](raw/south-west-v3/candidate-proof.json)が正本。曲線境界は(7.55,-6)を中心、x半径1.5、北z半径1.1、南z半径1.3の48分割輪郭を `x+z>=-.04` で切ったもの。南端は-4.7で、既存花壇原面の北端-4.660936813に入らない。旧73 footprint と曲線領域の交差面積はすべて0。

内部支持平面は `y=1.60-.30*(z+6)+.03*(x-7.5)`。矩形 x=6.54..8.46, z=-6.46..-5.54 内ではこの平面を使い、その外は境界距離と矩形距離の比を cubic smoothstep に通して元地形へ戻す。これを実source三角形の切断・細分頂点に適用する。勾配.30はこの造形例の値であり、runtimeの新しい許容閾値ではない。高い北丘の全体を平坦化しない。

`Island / continuous sculpted mature terrain:0` と `:1` は z≈-5.52で接するため、両方を同じ境界・高さ関数で置換する。一方だけでは入口側が未変形の床へ落ちる。v3の置換面積5.47291095948、全曲線領域のgap=0、旧床との重複6.37e-17、境界1073点の高さ誤差最大4.44e-15。4つの退化clip fanはworld compilerの面積下限で除外し、合計面積7.11e-15を記録した。原ログと[床の原検査](raw/south-west-v3/geometry-summary.json)を保持する。

歩行芯は x=6..9,z=-5.25。13点/12辺が実sourceメッシュのguardで open/reached/clear。実actor半径.24406937059140585＋余裕.04の全幅床支持は、未被覆面積2.37e-17。新規walk-only refsは17、追加walk edgesは35、通常join/water edgeは1。既存walk edgesも変更床に対して再検証する。可視幅.70–.80の通路、足運び、斜面の見え方はまだ造形・実画面確認していない。

実到達点は [entry-routes.json](raw/south-west-v3/entry-routes.json)。birchには(7.25,-5.25)/(7.5,-5.25)の2点、spireには7点、willowには既存西側の4点が残る。直線的な真南の登りだけを入口としない。x7断面では足元前端z=-5.54,y1.447から前帯z=-5.25,y.959へ、水平.29に対し高低差.488がある。閉じたsource制作ではこの落差を見えるbankと斜めの入口として扱い、必要なら支持中心を下げる案を別候補として検証する。現在の値を美術的な最適解や新しい傾斜基準にしない。

## 保持された関係と物理判定

P02:p3、P02:p4、P03:l20、P04:p6、P05:l17は既存メンバーとgrownを保持。新林のベンチl26までのwalk距離2.75に対し既存P03は1.5なので、通常の最寄り割当でP03を守る。joinを削除したり、既存ベンチを専属化したりしていない。新P01はベンチ未取得のseededだが、新3苗自体はmature。

実source木・花・殻の三角形を対象に、既存actorの実source motion envelopeを使った診断で p3/p4=9/5、P04のp6/p7/p9=2/7/6、新l33/l34/l35=4/2/7の到達接近を確認。家とのAABB重複は0。樹冠のXZ投影はwillow/birchが.061103、birch/spireが.100597重なる。巨大化せず同じnative .45寸法で層をつくれるが、投影重なりを3D葉交差や美術合格と扱わない。

**既存l14のguard接近0は別auditで既知**であり、baselineから変わらない。[別audit](../l14-approach-audit/README.md)を参照。現runtimeはgrove rootを障害物索引へ一般化していないため、診断だけで実木rootを対象名へ追加している。本体にこの物理guardが統合済みとは言わない。actor envelopeはc1実取得reportの117 meshes/99868 indexed vertices/.45 rigから採り、原reportを [inputs](inputs/actor-c1-report.json) に保持。新しい実アプリcaptureをこの作業では起動していない。

## 座標・組み込み契約

全数値は glTF/Three.js の Y-up。native05原GLBの地形は `world=source*.45+(5.65,-.3645,-1.03)`、したがって逆は `source=(world-origin)/.45`。Blender座標へ手動変換する場合は glTF(x,y,z)→Blender(x,-z,y)。既にworldへ焼いた床へ再び.45をかけない。rendererだけが xから `layout.center`、zから2を引く。

3木は地形原本の原点ではなく各kit partのpivotを使う。`assembly-extract.json` の実 `authoredMatrixWorld` はpivot減算済みkit geometryに適用する。未加工の元partへは、元node matrixWorldを焼き、記録されたsourceOriginを引いてから同matrixを適用する。元物件の位置・大樹を動かさない。

将来world合成は water後・places/cove前の純粋合成が候補。既存anchorFloorsと73 refsを保持し、元walk-only site (7,-6)/(8,-6)だけを追加地区へ移す（同logical cellの重複siteは禁止）。新地区はlogicalOrigin/worldOriginとも0、turn0。raw newDistrictは既にこの規約。床はworld側で一度だけ描き、同じtopをGLBでも重ねない。現在の数値診断は新床1 materialへまとめているが、source制作では元material0 `#a4cb87` / material1 `#91bba9` の境界・材質を明示して引き継ぐ。美術上の材質統合はまだ採用していない。

## 失敗の保存と再実行

| 原記録 | 分類 | 得られた制約 |
|---|---|---|
| `sections.json.gz` / `constraints.json` | 元3点案 | (7,-7)は狭い境界と.28支持帯を同時に満たす穏やかな移行が困難。仮の勾配をruntime基準にしない |
| raw直下 `candidate-proof.json` | 北2点 v1 | 8の全足元で.306895超過、前帯がhomeから孤立。9点だけでは峰を見落とす |
| `v2/` | 北2点 v2 | 地面/実mesh経路は成立しても、新P01がl26を距離1.0対P03の1.5で奪い、P03をseededにするため不採用 |
| `south-logical/` | 2組の論理前検査 | 南西・南東ともplace保持。支持は明示仮定。南西はベンチ距離余裕1.25、南東は.25で南西を選択 |
| `south-west/` | 南西 v1・診断合成不足 | material1だけを変形し、南端約1.217面積が未置換。新birch接近0。最初の退化fan errorログも保存 |
| `south-west-v2/` | 南西 v2 | material0/1両面でgap解消、しかし前移行が急で新birch接近0 |
| `south-west-v3/` | 選択案 | 前移行をsmoothstep、南半径1.3へ。元73支持/32records・既存place・新3木の物理接近を同時に保持 |

[archive-manifest.json](archive-manifest.json)はraw全99件の元SHA・保存SHA・圧縮/重複対応を持つ。大きい断面/葉三角形JSONは可逆gzip、同一葉dataは一箇所に保存。fullworld複製は選択v3だけを残し、前4世界は生成script・原report・省略world SHAを保存した。rawを要約に置き換えていない。

```bash
python3 docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/replay.py
python3 docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/replay.py --run --case final --output /private/tmp/sansu-central-shoulder-replay-new --python /private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python
```

既定はSHA照合のみ。実行時は空の/tmpへrawを復元し、そのコピー内のrepo/tmp pathだけを置換する。canonical input SHAが違えば中断する。Node v24、repoのthree/esbuild、Python Shapely2.0.7/GEOS3.11.4を使用。browser/build/coreは起動しない。docs-onlyとして `npm run docs:check` を実施し、runtime/原本sourceは編集しない。

確認: `replay.py` による canonical inputs / 全99 raw mappingのSHA照合 PASS。`npm run docs:check` PASS（既存taskのReview By期限警告のみ）。[検査log](docs-check.log.txt)。この保存作業はapp/sourceに書き込まず、browser/build/coreを起動していない。
