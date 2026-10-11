# 原本の海岸と地形側面

`native05-authored-world-m0-v2` の地形に、原本の海岸・段差の側面を重ねるための skin。抽出条件と SHA は [skin-manifest.json](./skin-manifest.json) が正本です。美術判定は **HOLD**。歩ける deck は未実装で、この成果物だけでは完成像の達成を示しません。

## 抽出範囲

[原本 whole-island.glb](../2026-10-10-island-final-3d/whole-island.glb) の `Coast / continuous layered shore` は全三角形を抽出します。次の 7 形状は、上向きでない側面だけを抽出します。

- `Grove / rounded living terrace`
- `Garden / rounded flower terrace`
- `Village / shared sunny court`
- `Grove / sheltered open room`
- `Flowers / open sky gathering court`
- `Harbor / shared waterfront court`
- `Water town / shared frontage court`

合計 8 形状・10 primitive・5,520 三角形。原本の階層 transform、頂点、法線、三角形、材質色・roughness・metalness を保持します。上向きの床は共通の地形評価側が描くため、側面の skin に重複させません。所有物、水路、植物、住人、配置権を追加するものではありません。

## 原本と変換・成果物

論理座標への変換は [world-manifest.json](../2026-10-11-authored-world-foundation/world-manifest.json) と同じです。原本の階層 transform 適用後に `scale = 0.45`、`origin = { x: 5.65, y: -0.36450000000000005, z: -1.03 }` を適用します。

| 対象 | bytes | SHA-256 |
| --- | ---: | --- |
| 原本 GLB | — | `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` |
| 展開した JSON | 482,547 | `6fafdeb53191bae654aa45e261e506f2a9df2657e1d748c6426f56f149093793` |
| [native05-coast.json.gz](./native05-coast.json.gz) | 151,151 | `758f2a5fbd29bb3a5b30f5694e236f2ee7a0c1ae638780ea9366b16f35416d8f` |

リポジトリのルートで再生成し、DEV の配信先へコピーします。

```bash
node tools/build-authored-island-skin.mjs
cp docs/design/2026-10-11-authored-coast-skin/native05-coast.json.gz prototypes/place-qa/native05-coast.json.gz
```

[抽出スクリプト](../../../tools/build-authored-island-skin.mjs) は原本 SHA を検証し、gzip と manifest を生成します。

## authored runtime への接続

[authored runtime の記録](../2026-10-11-authored-island-runtime/README.md) で全体の検証と残課題を扱います。[authoredGrowingAssets.ts](../../../src/components/island/growing/native/authoredGrowingAssets.ts) は DEV の配信先から読み、gzip/raw の bytes と SHA、world ID、原本 SHA を検証します。`GrowingWorld → createWorldScene → buildAuthoredGrowingGround` で通常と共通の renderer に渡します。

[authoredGrowingGround.ts](../../../src/components/island/growing/native/authoredGrowingGround.ts) の skin は表示専用です。配置の pointer target は compiled world の床だけで、歩行・配置・所有・水の判定は world definition に従います。海岸の形から植えられる場所や通れる deck を推定しません。通常の本番島や既存プロフィールにこの sample world の権限を足しません。
