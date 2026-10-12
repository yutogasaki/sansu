# 共通床の原本法線・材質監査

2026-10-12。中央丘の細い筋と平面的な陰影について、原本 GLB から共通床までの描画属性を限定調査した。**原本のスムーズ法線は床抽出で落ち、runtime で再計算されている。色は保持されているが、terrain の roughness は 0.78 から共通床の 0.95 に変わっている。原本 terrain に texture map はない。** これは修正候補の根拠であり、見える筋の全原因を確定した結果ではない。

このディレクトリだけに監査資料を保存した。app・原本・床位置・indices・配置権・物理には変更を加えていない。ブラウザ、build、新規画像生成、Blender は実行していない。全島の美術合格、c4 のフル実行完了、子どもの独立観察の証拠ではない（N=0）。

## 実画面との対応

- c4 実画面：[全景](evidence/c4-desktop-mature-whole-day.png)／[p9 近景](evidence/c4-desktop-cove-close-day.png)。root が実行中の `/private/tmp/sansu-authored-cove-c4/full/` から無加工・同一 SHA で保存した。
- c2 実画面：[全景](../../2026-10-12-authored-cove-runtime/c2/shape/desktop-mature-whole-day.png)／[p9 近景](../../2026-10-12-authored-cove-runtime/c2/shape/desktop-cove-close-day.png)。
- 承認原本：[native05 whole-island-render](../../2026-10-10-island-final-3d/whole-island-render.png)。

c4 全景では中央の青緑の丘に広い面単位の明暗があり、その手前の草地斜面にも細く密な筋が見える。近景では上端に切れた斜面の筋が見え、手前の新しい shore は比較的均一に見える。c2 でも同じ傾向がある。承認図の露出した土・草面には、より滑らかな丸みと連続した階調がある。

ただし承認図は光源、影、描画器、視点、表示縮尺、樹冠による遮蔽も違う。画面の各ピクセルと特定の原本法線を対応づける投影比較や、法線だけを差し替えた A/B 描画は未実施。数値上の差を、そのまますべての筋の原因とはしない。草の別 mesh の量や小物の増設は今回の調査・対策に含めない。

## 1. 原本 NORMAL の欠落と再計算

[world 抽出](../../../../tools/build-authored-island-world.mjs)は原本 POSITION と上向きの実三角形 indices、材質から得た色を保存するが、NORMAL を保存しない。[共通床 renderer](../../../../src/components/island/growing/native/authoredGrowingGround.ts) は各 floor の頂点を独立した index のまま連結し、`computeVertexNormals()` で新たに法線を作る。[worldScene](../../../../src/components/island/growing/worldScene.ts) はこの共通床を使う。一方、同ファイルの coast skin は抽出済み source normals と原材質を明示的に読んでおり、扱いが異なる。

原本 terrain は active scene の root node 3112、node transform は identity。world への正の一様 scale 0.45 と平行移動は法線方向を変えない。[source 証拠](source/source-normal-materials.json)で、原本 POSITION と world 頂点が同じ index で完全対応することも検証した（world 抽出と同じ 1e-9 丸め後の最大誤差 0）。

Three 0.185.1 で base floor の法線を再計算し、原本 NORMAL と比較した。中央の計測範囲は world `x=6..10, z=-8..-5, y>0.3`。以下は見た目の点数ではなく、角度の数値差である。

| 対象 | 件数 | 平均 | 95 percentile | 最大 |
| --- | ---: | ---: | ---: | ---: |
| 中央 hill primitive 1 の原本法線対再計算 | 2,123 頂点 | 4.76° | 13.71° | 31.43° |
| terrain 材質境界・同座標の原本法線同士 | 578 組 | 0.00000033° | 0.00000121° | 0.00000171° |
| 同じ境界の再計算法線同士 | 578 組 | 9.88° | 29.32° | 163.43° |

最後の全域最大値は境界の極端値を含み、中央の筋を示す値ではない。中央の材質境界は 6 組で、再計算の差は平均 3.32°／最大 5.69°。原本は材質境界でも法線を連続させているため、材質ごとの index を独立に再計算する経路では、その原本のスムージングを再現できない。[最初の数値結果](raw/first-report.json)に全値を残した。

### 水切削後の頂点分割は別の段階

[authoredWaterWorld](../../../../src/domain/growingIsland/authoredWaterWorld.ts) の `append` は切削後の polygon ごとに頂点を追加する。同座標でも index が別になり、共通床の再計算では隣接 polygon と法線を共有しない。

既存の frozen v4 作者入力 `wetPatched` を使う限定診断では、hill primitive 1 に使われる index は 51,875、1e-7 単位で同座標をまとめた位置数は 24,422、差は 27,453 だった。これは丘全域の数であり、中央斜面すべてが平坦化されたという意味ではない。上記の中央範囲には同座標の複数 index が 6 群あり、群内の再計算法線差は平均 5.00°、最大 13.14°。

この入力は [v4 の作者監査入力](../../2026-10-12-authored-cove-entrance/author-audit-v4/independent-floor-input.json)であり、**c4 の実画面と同時刻に採取した world frame ではない**。clip の実装と同座標別 index の存在を示す証拠として扱う。最初の診断は world 座標を Float32 化して計算しており、renderer の中心への平行移動後の Float32 丸めまで一致させた GPU 法線キャプチャでもない。

## 2. 原材質は色を保持、粗さを変更。texture 欠落はない

| 原本 terrain material | world 色 | 原本 roughness | 共通床 roughness |
| --- | --- | ---: | ---: |
| ground / fresh soft meadow | `#a4cb87` | 0.7799999713897705 | 0.95 |
| hill / silvery meadow | `#91bba9` | 0.7799999713897705 | 0.95 |
| harbor / light seaside meadow | `#b1c98c` | 0.7799999713897705 | 0.95 |

GLB の raw `baseColorFactor` は linear RGB であり、上表は Three の変換後の sRGB 表記。抽出済み world 色と一致する。metallic は source・共通床とも 0。source の `doubleSided: true` に対し共通床は既定の FrontSide で、これも raw 証拠に区別して保存したが、上向き地表の筋の原因とは評価しない。

対象 3 primitive は POSITION／NORMAL を持ち、COLOR_0 はない。3 材質の JSON に baseColor、normal、roughness、occlusion 等の texture 参照はない。[原本の材質作成](../../2026-10-10-island-final-3d/build-scene.py)も標準の色と粗さを設定し、mesh を smooth にしている。したがって、今回の terrain を「本来あった草 texture が落ちた」とは説明できない。粗さの変更は材質の応答を変えるが、これだけ戻して法線の不連続を解消できるとは言わない。

## 次の実装候補（未実施）

1. 床位置・indices・権利・衝突を保持したまま、原本のスムージングを保持する法線を読む。元頂点には source NORMAL、切削で生じた頂点には原本三角形上の補間法線を使う方向を検討する。全頂点の無条件 weld や bank を含む一括平滑化で、意図された硬い境界まで丸めない。
2. 同じ terrain の原材質を読み、少なくとも粗さ 0.78 と既存色を対応させる。共通床には deck／court 等も混在するため、全床を一律に変更しない。その後の実画面で、同じ camera・光・形状を固定した比較を行う。

この順序は大きな塊の地形や所有地区を作り替える提案ではない。全島 mass の課題は別に残る。

## 保存した証拠と再現範囲

- [raw first probe](raw/first-probe.mjs)、[first report](raw/first-report.json)、[first execution](raw/first-execution.log.txt) は `/private/tmp/sansu-floor-normal-audit*` から byte-identical に保存。first probe は同じ report を最後に追記更新するため、log は初期 report と最後の `CARVED_NORMAL_BREAKS` 行で構成される。
- [repeat report](raw/repeat-report.json)／[repeat log](raw/repeat-execution.log.txt) は許可された読み取り診断の再実行。first とそれぞれ SHA が一致した。元 probe は当時の絶対 repo パスと tmp 出力パスを保持している。
- [capture-source-evidence.mjs](capture-source-evidence.mjs)／[capture log](raw/source-capture.log.txt) は raw NORMAL と material の保存用。`source/terrain-{0,1,2}-normal.f32le.gz` は NORMAL 順の little-endian Float32 xyz を gzip したもの。正規化・補間・再計算はしていない。[source-normal-materials.json](source/source-normal-materials.json) に元 accessor／bufferView／primitive／material の raw 値、byte 数、展開前後 SHA、先頭 3 法線を保存した。
- [input-manifest.json](input-manifest.json) に 21 入力の前後 SHA、17 件の c4 固定 candidate 対応（全件同一）、実行コマンド、Node／Three version、画像と raw の copy map を保存した。21 入力の前後一致は今回の source 保存と数値再実行を覆う。最初の tmp probe に遡って未計測の入力固定を主張しない。

source GLB SHA: `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。

source 保存の再実行例（出力先は未作成の新規ディレクトリ）：

```sh
node docs/design/2026-10-12-authored-whole-massing/floor-normal-audit/capture-source-evidence.mjs --output /private/tmp/sansu-floor-source-recheck
```

監査資料内の相対リンク、JSON、保存された法線バイナリ／copy map の SHA を限定確認した。全 docs check、core、build、runtime 再実行はこの監査の対象外。
