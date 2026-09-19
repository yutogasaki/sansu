# 庭小屋のLifeWorld接続

2026-09-19。生成済みの庭小屋を、開発flag `VITE_ISLAND_RUNTIME_ASSETS=true` の配置済みoriginal色設備へ接続。候補は `island-life-runtime-assets-v2`。追加Meshy処理・課金なし。

[スマホ幅の実画面](390-overview.png)・[タブレット幅の実画面](768-overview.png)・[起動から学習復帰までのcontact sheet](contact-sheet.jpg)・[検証report](report.json)

## 表示と利用位置

近景11,401三角形・1,983,432 bytes、遠景4,055三角形・226,284 bytes。既存と同じ24/32pxの距離切替と共有材質を使用。GLBを再生成・上書きせず、表示時に高さ1.56、幅1.92、奥行1.52へ合わせる。

生成物の扉は中央にある。住人が使うセルは従来の設備基点から `(0,2)` のままとし、中央扉の段から従来の入口へつながる低い前庭を付けた。建物・前庭は2×2占有範囲内。前庭は12三角形で、再構築・画面終了時にgeometry/materialを解放する。住人は前で道具を持って利用し、閉じた扉を通り抜けない。

購入・価格・保存・経路・施設から植物への道具運搬は変更なし。original以外の色と配置ゴーストは従来形状。読込失敗時も従来形状を残す。花壇と街灯はラボ候補のまま。本番flagは既定off。

## 検証対象

対象URL: `http://127.0.0.1:5250/`。`npm run dev:island-runtime-assets` で起動するDEVアプリ。ソース版と候補は検証reportのSHA・実DOM診断で照合する。本番公開・実機性能・自然な獲得の証拠とはしない。

隔離したPlaywrightブラウザーに100件の合成学習creditを入れ、実際のcommandLifeで購入する。ベンチで待つ住人をUIで小屋に呼び、歩行と道具利用を確認する。利用者の保存領域へfixtureを書き込まない。

- focused: runtime資源管理・占有範囲・前庭の接続・LOD・施設運搬/関係の17 tests PASS。
- `npm run verify:core`: 431 files / 4,064 tests PASS。docs、lint、typecheck、build、asset budget PASS。
- `npm run e2e:smoke`: 31 checks PASS。
- 最終ブラウザー結果: PASS。390×844・768×1024 reduced motion、実UIの歩行→道具利用、全景、reload、GLB本体遮断時の従来表示、保存したactions/credits一致、学習入力への復帰。page error 0。

先行ハーネスの修正: 読込中の `loading` 文字列をJSONとして読まない、ViteのGLB URLを返すJavaScriptは遮断せずGLB本体のみ障害注入する、既に到着している住人へ同じ行先を指定して歩行を待たない。失敗証拠は `output/playwright/hut-runtime/`、`hut-runtime-v2/`、`hut-runtime-v3/` に保持。アプリ動作とテスト前提の誤りを区別する。

## 判定の範囲

視覚: 接地と既存パレットへの整合を確認する開発候補。近接視点では従来カメラのcropが残るため全景も確認する。

無説明理解・安全: 利用者観察なし（N=0）。閉じた扉の通過や身体の拘束は導入していない。

runtime: この変更は主島のLifeWorldへの接続。独立した観察・保存場面のrendererへの生成素材展開と、本番配信の承認は含まない。既存の施設運搬機能はテストで保持を確認するが、新素材での運搬全行程の実画面確認とは区別する。
