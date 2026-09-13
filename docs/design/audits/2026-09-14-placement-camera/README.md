# 配置中のカメラと歩行経路

2026-09-14。写真で報告された、配置中の拡大縮小不可と「通り道」の不明瞭さを改善。仕様は [48](../../../product/48_island_life_spec.md)。

## 変更

配置中もタップによるセル選択と、drag/pinch/回転を分離して使える。カメラボタンを配置中に常設し、残高の下へ置く。位置選択やworld更新でgestureを取り消さない。歩けなくなる対象の家具名と、配置前の経路を点で示す。点を地面より上へ出し、全景で読みやすい大きさにする。固定の道路や新たな配置制約は導入しない。

## 検証の境界

対象は `http://127.0.0.1:15437/`、`cfb67f6` を基にした作業差分、DEV + `VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true`。家庭内productionへの配布は未実施。新規隔離browser contextで検査し、実機iOSとSW更新は未検証。

- `npm run verify:core`: 411ファイル・3,962テスト、docs/lint/typecheck/build/assetsが成功。
- 最終の点サイズ・toolbar位置修正後: 配置とカメラの14テスト、対象eslint、build/assetsが成功。
- `npm run e2e:smoke`: 成功。既存導線の回帰確認で、新島の配置検証とは分ける。
- `tools/e2e-island-placement-camera.mjs`: 実初回設定・通常学習で獲得し、390×844と768×1024 reduced motionで配置を確認。DB注入や時間送りなし。拡大、pinch、drag、回転、gesture後の選択保持、拡大後の投影セルtap、reset、実購入、他家具の入口を塞ぐ配置拒否を検査する。

再実行は `SANSU_ISLAND_LIFE_URL` と新規 `SANSU_ISLAND_LIFE_OUTPUT` を指定する。最終実画面と実行結果は `output/placement-20260914-final/`。過去のr1/r2は既存ハーネスの古い学習入口参照による失敗、r3はtoolbar位置修正前として区別する。

## 独立した判定

- 見た目: 既存の世界美術を継承。スマホの残高とtoolbarの重なりを実画面で修正。ユーザー写真の旧worldと現在DEVのC3 worldは別の美術であり、同一候補の全面art parityとは認定しない。
- 理解・安全: 家具名・点・選択可能なマス・無効ボタンを併用。子どもの無説明理解は未観察（Human N=0）。
- runtime: 配置操作の限定検証。学習writer、経路判定、所有保存の仕様は変更しない。実機ピンチと公開後確認は別途必要。
