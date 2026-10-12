# 中央肩 SW v3 — editable source handoff

**M1 の明示診断 source。支持・入口付きの一増分であり、全島美術採用は HOLD。** 通常の土地取得・価格・本人保存・`expand` は実装していない。元 73 権利 / 32 owners を保ち、診断として新しい 2 地点を定義し、通常 3 苗の所有記録を加えた 75 権利 / 35 owners の固定状態を使用する。3 木だけで全島を完成扱いにしない。

候補 ID は `native05-central-shoulder-sw-v3-source-v1`、最終 GLB export revision は **`normal-v2`**。構造入力は [selected SW v3](../2026-10-12-authored-whole-massing/central-shoulder-feasibility/README.md)、制作目的は [next-production](../2026-10-12-authored-whole-massing/next-production.md)。元の 15 軒 scene を現在の実全景へ見立てていない。固定 c4 の同じ `buildObjectLayer` と手渡された 35-owner state/world を offline で構築した。

## 正本と凍結

| artifact | 用途 | SHA256 |
|---|---|---|
| [geometry-profile.json.gz](geometry-profile.json.gz) | exact world top / normal / 材質帰属 / 根元 | `7b4772489932b225d7b31ced5bd53c6835a47e8e63c71eeb43d7b59af1523d3b` |
| [components normal v2](central-shoulder-components-normal-v2.glb) | 閉じた土壌 + owner 別根元 3 点 | `c79e2cd7a228b24ff526e6d78913f6a07880e35dec1532d4c278dd7cbf10411e` |
| [whole source normal v2](central-shoulder-source-normal-v2.glb) | 35-owner の静的比較用全景 | `cd86121c32072053960e927866f9442b7168e281df9d8c46cf9807ce691b2ff9` |
| [editable Blender](central-shoulder-source.blend) | 編集可能な mesh / 材質 / camera | `7a7ff0dfe34e2fb68a4c53f7b9c824cc3e20f62e0dccd64d86b45a1ca5781905` |

[scene manifest](scene-manifest.json) に元 GLB / Blend / benchmark、入力、脚本、材質、座標契約を集約。[root manifest](root-continuations-manifest.json) は本体の条件付き attachment 用。原本 3 ファイルは制作前後 byte 同一。元 GLB SHA は `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。

Blender の custom split normal 書出しは、肩上面で raw profile と最大 L2 `0.0045255` の差を生んだ。最初の失敗ログと旧 GLB は残した。v2 は **肩上面の 2 NORMAL accessor だけ**を raw profile から復元し、単位法線差は `4.3841e-8`。JSON chunk / POSITION / indices / material / node / owner transform は旧版と同一。[byte 証明](normal-export-v2.json) と [export parity](export-parity.json) を参照。editable Blend は量子化差を持ったままであり、配布 v2 と法線まで byte 同一とはしない。

## 本体 adapter の座標と描画境界

- Profile / components / full source の位置は **authored world、Y-up**。component node は identity。描画時は親に `T(-layout.center, 0, -2)` のみを適用する。`.45` を再適用しない。
- この固定 context の `layout.center = 7.0026560305`。固定数を本体へ焼き込まず、同じ composed frame から scene layout を作る。元 objectLayer の renderer 座標を source に戻した親は `T(7.0026560305, 0, 2)`。
- 元 terrain の source→world は `.45 * source + (5.65, -.3645, -1.03)`。木は source node matrix を bake した geometry から **木ごとの pivot** を引き、handoff の column-major `authoredMatrixWorld` を適用している。地形 pivot と混同しない。
- 完全な world / state / plan は [入力 world](input/candidate-world.json.gz)、[state](input/candidate-state.json)、[frame plans](input/candidate-frame-plans.json)。floor world ID は `native05-authored-world-m0-v2`、この入力の revision は `authored-cove:69d3a6068481cb90`。newEdges だけを使うと付け替えた既存辺が欠けるため、全 world を正本にする。
- 閉じた soil は 15,184 面。top 6,615 面、bottom 6,615 面、side 1,954 面。元 terrain **`:0` と `:1` の両方を clip**した保持床 54 枚と接続する。旧 top に重ねて新 top を描く構成ではない。
- `soil.topOriginalPositions / topOriginalIndices` は handoff の raw 14,959 頂点と面を保持。editable mesh は Float32 同位置だけを共有し 3,797 top 頂点にする。最大座標差 `4.76735e-7 m` は GLB serialization の差として明記する。
- 本体で 2 floor に分ける場合、`newFloorAttributes.normals` を raw 頂点 index に対応させ、`triangleMaterialIndices` の 0/1 で indices だけを分ける。材0=1,722面、材1=4,893面。法線配列を共有して材境界で分割しない。PBR は `newFloorAttributes.materials` の元値（roughness `.7799999713897705`）を使う。テクスチャを省略した代用品ではなく、元の該当 terrain 材に texture はない。
- 2 floor が描画を担当する場合は **GLB soil の top primitives 0/1 を同時描画しない**。必要な閉体の side/bottom は primitive 2。full source GLB 全体を本体背景として追加しない。site の floor 参照は実支持する材側へ対応し直し、三角形 union と支持・全辺・owner が不変であることを確認する。

境界 NORMAL は原本三角形の barycentric 補間、内側は新しい実 top 面の面積加重平均。境界から `.16 m` で smoothstep 接続し、材0/1をまたいで同じ normal を持つ。元の法線を変形した内側へそのまま貼っていない。床全体の位置を一括 weld して陰影を合わせてもいない。

## 3 木と根元

既存空き `(6,-7)` の willow と新診断 `(7,-6)` の birch / `(8,-6)` の spire を、元 kit の実 mesh、原 scale `.45`、実 owner matrix のまま 1 回ずつ置く。新地点の支持中心は H `1.585` / `1.615 m`。[等縮尺の実寸断面](dimensioned-sections.svg) は実三角形と x=7/8 平面の交線を表示する。[raw 断面](dimensioned-sections.json) は smooth な説明曲線ではない。

原 kit の draw offset により、最下端頂点は床から willow 約 1–8 mm、birch 28–45 mm、spire 34–52 mm 離れていた。初稿差は [元 handoff](input/selected-v3-handoff.json.gz) の `rootContactLimits` に保持。木や床を下げず、各幹の実下 cap 8 面 / 10 点輪郭から閉じた短い根元を派生した。各 20 頂点 / 36 面、下端は輪郭を 4% だけ広げ、全 footprint の実床最小値より 6 mm 下に埋める。原樹皮材を保持し、円柱台座や草で隠していない。

**owner ID 一致だけで表示しない。** [root manifest](root-continuations-manifest.json) の kit source ID/SHA、part 名、source pivot、成熟形/scale、cell、full owner matrix、接する physical floor revision がこの監査済み形と一致する場合だけ表示する。移動 preview・移動確定・収納・若い姿・source/floor revision 変更時は取り外す。他の位置で使う場合は接地を再計算する。新 owner / 権利を増やさず、木の境界に帰属する差分 mesh として扱う。元 kit と根元はどちらも 1 回描画する。

root geometry は既に world に bake 済み。本体で owner matrix をもう一度掛けない。実干渉索引には根元 108 面を原木と一緒に含める。支持や通行権を根元から発生させない。

## 確認した範囲

[作者検査](export-parity.json) と [独立 source 監査](independent-source-audit/README.md) は別出力。土壌と 3 根元は実 GLB の全辺が 2 面接続、signed volume 正。新上面は handoff の Float32 triangle multiset に完全一致、材帰属違い 0、原幹 cap は各 8 面一致。保持 54 floor / 35 owners / 原最高大樹を維持した。

独立 guard は根元の実 108 面を追加して l33/l34/l35 接近 **4/2/7**、P02 p3/p4 **9/5**、P04 p6/p7/p9 **2/7/6**を保持。前帯の actor 半径+.04=`.2840693706 m` 全幅を確認した。既知の l14 接近 0 は追加前後とも 0。本体の木 guard がこの時点で統合済みという意味ではない。

double world と Float32 GLB の境界比較には面積約 `4.5e-7 m²` の微小差がある。厳密な gap 0 と報告しない。閉体の全埋没面 self-intersection / 原島全体との volume Boolean は未実施。技術結果を美術点へ加えない。

## Source 比較と既知の限界

[whole](source-whole.png) / [rotated](source-rotated.png) / [close](source-close.png)、[render manifest](source-render-manifest.json)、[横並び比較](comparison.html)、[6軸の批評](art-review.md)。1280×960 / Cycles CPU / 24 samples、3枚の実描画は約36秒。原本・凍結sourceは前後 SHA 同一。

| 対象 | TRANSFER | DO NOT TRANSFER |
|---|---|---|
| [承認 native05](../2026-10-10-island-final-3d/whole-island-render.png) | 最高大樹、木陰の面、草/土/樹皮の差、海側への抜け | 別の15軒配置、未所有の背景木、人物の流用 |
| [c4 実全景](../2026-10-12-authored-cove-runtime/c4/full/desktop-mature-whole-day.png) | 現32 ownersの実位置、既存家/水庭/花庭/低いcoveの関係 | source画像を実appと称すること、runtimeの生活感を無人sourceへ加点すること |
| 数値 handoff | 実支持・入口・地区境界、元原木の成熟形 | 美観のため無断で床/木を動かすこと、小物追加で密度不足を隠すこと |

住人や life 初期 pose はこの static context に含まれない。水面 ripple の 3 line primitives は Blender 往復で消える。本体は既存 water renderer を保持する。照明・camera・ocean・transmission guard は app と同一ではない。海面 plane は render セッション内だけの非支持背景で、床を追加しない。

whole/rotated の既存道に出た黒い点列は c4 実画像にはない。[限定診断](source-path-diagnostic.json) は 171 dark-pixel rays がすべて `growing-reachable-paths / Material_60` に当たることを確認。元道の上向き joint disc / 下向き strip の同面重なりと、glTF に保存されない runtime polygonOffset が疑われる。PBR は淡色を維持している。原因を分離した比較 render は未実施であり、断定しない。肩や根元の幾何を変えて修正していない。

## 再現コマンドと履歴

geometry 用 Python は既存 `/private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python`（NumPy / Shapely2.0.7）。Blender は `/Applications/Blender.app/Contents/MacOS/Blender`、5.2.1 LTS / `9e2066aef7ef`。context 再構築は [export-source-context.mjs](export-source-context.mjs) の固定 c4 checkout と input SHA を必要とする。Node v24 / Three0.185.1。c4 checkout がない場合は別 app code に差し替えず、凍結済み `source-context.glb` から後半を再現する。

```sh
node docs/design/2026-10-12-authored-central-shoulder/export-source-context.mjs
node docs/design/2026-10-12-authored-central-shoulder/extract-trunk-bases.mjs
/private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python docs/design/2026-10-12-authored-central-shoulder/build-geometry-profile.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python docs/design/2026-10-12-authored-central-shoulder/assemble-source.py
python3 docs/design/2026-10-12-authored-central-shoulder/restore-profile-normals.py
/private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python docs/design/2026-10-12-authored-central-shoulder/audit-export.py
/private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python docs/design/2026-10-12-authored-central-shoulder/export-sections.py
```

`restore-profile-normals.py` が editable Blend の export から **exact raw normals を再書出す必須最終工程**。凍結ファイルに上書きせず、新しい作業 copy で再現する。render は同時 browser 回帰を止めた状態で `render-source.py` を実行し、既存画像がある場合は明示的に別履歴へ保存してから進める。

[history](history/) に最初の geometry script 失敗、owner親欠落の全景、法線差、render node-name 失敗を保持。[execution](execution/) は初めから durable な `.log.txt` 形式で保存し、gitignored `.log` だけにはしない。`assembly-qa.json` は初回全景 SHA、`context-reexport-qa.json` は親保持版 SHA、`normal-export-v2.json` は最終 v2 SHA を示す。旧結果を最新に書き換えない。

[最終 scoped 検査](verification.json) は正本 SHA / 原本3ファイル / raw上面位置・indices / 法線配列数 / 1280×960の3画像 / ローカルリンク / Python構文を確認。2つのNode抽出scriptも `node --check` を通過した。全体docscheck・本体build・browserはこのsource制作では実行していない。

本体表示・preview/commit・移動/収納/若い姿・取得/本人保存・独立児童観察は未実施。**N=0**。美術 HOLD / source構造検査 / 本体未検証を別々に扱う。
