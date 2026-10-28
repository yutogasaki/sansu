# 配置から景色を作る方式の比較

2026-10-22。**実験完了／製品採用・完成美術は未達**。[構築方針](../../product/island-construction-strategy.md)の目標を維持する。一角は方式の検証であり、完成目標の縮小ではない。

[実画面の比較](index.html) · [チャッピーとの3往復](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7-hokomoko/c/6ad97a75-aff4-83e8-9a26-9424ac213a0d)

## 戦略と結果

通常ゲーム本体の地形・所有・保存・歩行を使い、実際に岸を掘ってから同じ地形・カメラで比較した。試験用Vite変換を本体へ適用し、製品のsrc/publicはこの実験で変更していない。独立viewerや所有物付与、DB注入は使わない。

| 仮説 | 実施・観察 | 判断 |
| --- | --- | --- |
| 高さ・斜面に合わせた材質で地形を読める | 草・土／岩・砂を実床の頂点色で比較。丘の高さが読み取りやすい | 補助候補。場所の魅力の成立ではない |
| 家からベンチへの実経路を庭に広げる | ベンチ1,3→3,3→1,3で経路も変化。収納・水上・切断経路を除外 | **不採用**。薄い道の着色に見え、暮らしの差を生まない |
| 固定足場を守りながら周囲を編集できる | 固定床から編集高さへ滑らかにつなぐ物理地形を試作 | **有望・未採用**。初期30地点の一段掘削が13→24地点で可能 |

13→24は人物なし・初期所有物ありの明示fixture。任意配置すべての成功率ではない。固定家／入口／桟橋の直下4地点、所有物の足元2地点は保護。人物がいる通常ゲームでは追加の拒否が起こり得る。

## 実操作と検証

- 390×844、同じカメラ・地形・所有配置でbaseline/material/gardenを撮影。04/05/06の状態JSONで一致を確認。住人は自然に動く。
- 元の通常ゲームで5,1と5,2を各3段掘り、入り江を作った。庭候補でベンチを移して戻した。家0,1、ベンチ1,3、しずく8を維持。
- foundation候補では従来拒否された桟橋横5,3を3段掘り、undo／redo／保存再読込を実操作。終了前に5,3の編集を戻し、旧床で有効な状態を保持。
- 4地点×3段の物理変更、固定支持7,056サンプルの高さ不変、人物足場消失の拒否、undo復元を検査。固定中心への無効な編集も拒否。
- focused ESLint、明示fixtureのロジック検査、通常アプリの比較production buildはPASS。新候補の全repo回帰・橋・拡張・旧履歴・offline更新・性能・実機は未検証。以前の本体5,570テスト合格はこの候補へ流用しない。

初回の庭テストでは「高台のベンチは到達不能」とした前提が誤りだった。実worldでは到達できるため、水上と実際に切断した接続graphへ反例を修正した。foundation初版は固定中心でも入力を受理して高さを変えない問題があり、拒否を追加してから24地点と測定した。修正前の28地点は成果に数えない。

## 次の制作単位

**海を見る庭の立体断面**。本人が掘ったくぼみ、残した高台、海へ開く方向、乾いた足場、実際に置いたベンチを一つの構図として扱う。固定足場と地形の接合候補を基盤に、美術で設計した断面を同じ実床へ適合する。

1. 同じ所有物で平地・入り江・背後の高台の3状態を通常操作から作り、全景と近景の輪郭を比較する。
2. ベンチを移すと足場・背後の地形・海への見通しが変わり、住人が実経路から到達して座れるか確認する。
3. 分離・再接続・戻す・undo／redo・再読込まで確認し、固定座標だけの成功を除外する。
4. 平地でも入り江でも同じ縁取りが出る、着色だけで変化を説明する、架空の床や未所有の壁を足す場合は失敗。小物を追加せず断面と接続方式を再設計する。

一角が通った後、木陰・水庭・集落へ展開し、同じ所有物の三つの全島、成長と拡張まで検証する。子どもの無説明理解・再訪、全島美術、配布は別の未完条件として保持する。

## 再現と証拠

Node22.23.3。check.tsをesbuildでNode用にbundleして実行すると元方式を検査する。check-foundation.mjsは同じfixtureに物理地形変換を適用し、元の結果と区別して保存する。Vite設定は期待する本体接続が変わると停止する。

```sh
fnm exec --using=22.23.3 node_modules/.bin/esbuild docs/design/2026-10-22-place-strategy-trial/check.ts --bundle --platform=node --format=esm --outfile=/private/tmp/sansu-place-strategy-check.mjs
fnm exec --using=22.23.3 node /private/tmp/sansu-place-strategy-check.mjs
fnm exec --using=22.23.3 node docs/design/2026-10-22-place-strategy-trial/check-foundation.mjs
SANSU_FOUNDATION_TRIAL=true SANSU_BUILD_REVISION=place-foundation-trial-v1 VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true fnm exec --using=22.23.3 node_modules/.bin/vite build --config docs/design/2026-10-22-place-strategy-trial/vite.config.ts
```

出力先は /private/tmp/sansu-place-strategy-build。比較queryは groundTrial=baseline|material|garden、入口は通常の /#/island。foundationなしのbuildでは環境変数SANSU_FOUNDATION_TRIALを指定しない。

入力hashは[manifest](evidence/input-hashes.json)、候補識別は[材質](evidence/material-build-version.json)と[接合](evidence/foundation-version.json)。元13地点は[logic](evidence/logic.json)、候補24地点は[foundation logic](evidence/foundation-logic.json)、支持は[支持検査](evidence/foundation-support.json)。[build記録](evidence/foundation-build.txt)・[検査記録](evidence/foundation-check.txt)・[再読込](evidence/10-foundation-reload.json)を保持する。

チャッピーは初回に通常ゲームと採用native05の2画像を閲覧。後続2回は現行コード照合とCodexの実験要約への検討で、新候補画像・動画・実機の独立監査ではない。[回答記録](evidence/chappy-conversation.txt)を保持。薄い庭の着色は実験で棄却し、名称だけを変えて継続しない。
