# パッチワークの住民 — まんまるしっぽ

[実画面と参考の比較](review.html) · [実UI記録](ui-report.json) · [app入力](build-source.json) · [配布manifest](version.json)

## 変更

カワウソ1体へ、クリームと青に分かれた顔、色と柄の違う布、織り目・縫い目、つやのある目と鼻を実装した。ユーザーの「しっぽへん」「まんまるしっぽで」に合わせ、尾は無地クリーム色の小さな球体に変更した。ウサギとキツネは既存造形を保つ。

顔・胴体・腕・足が同じ布の組合せを保って動く。布の色と凹凸は共有する2枚のatlasから生成し、再演でtextureを増やさず、scene破棄時に解放する。新しいラスター画像やモデルを配布・ダウンロードしない。住民ID・人数・登場条件、問題、学習進行、保存schemaを変更しない。

正本は[仕様28](../../../product/28_mystic_island_spec.md#patchwork-residents)。ユーザーの[参考画像](../../references/2026-09-08-patchwork-residents/README.md)と既存moon-gardenを基準にした、ネイティブ3Dの住民の具体化。別の画風を生成・選択する作業ではない。

## 対象と証拠

- Production preview: `http://127.0.0.1:5318/`
- Build revision: `patchwork-20260908-2732124deadc`
- Delivery: `mystic-island-v1` / `VITE_ISLAND_ENABLED=true`
- 島: `mystic-island-living-v4` / `moon-garden`
- 学習面: `mystic-island-learning-v2`
- 住民: `patchwork-otter-v1`。version manifestと、実リグから取得したstage/canvasの`data-resident-candidate`を照合。
- 390×844の通常motion/touchと768×1024のreduced motionで、空DBから実設定・実回答し、19画面を取得。保存済みの予約や住民の姿勢をQAで作り替えていない。
- 固定作業コピー: `/tmp/sansu-patchwork-20260908`。完全なapp/QA入力archiveは同コピーの`output/playwright/patchwork-final2/app-inputs.tar.gz`。app入力と後述の修正済みQA closureは別に開始/終了を照合した。
- ベースは検証済み`9300ea0-subjects-880a65a8d2ec`。最初に共有workspaceからコピーした時点では並行中の章拡張の型が揃っていなかったため、既知の固定ベースへ住民変更だけを重ねた。共有workspaceのv5章拡張は保持し、住民のファイルとcandidate識別だけを統合した。固定v4の検証をv5全体の検証とは扱わない。

## 実画面の確認

立つ・歩く・ベンチに座る・学習へ戻る・再読込・WebGL復旧で同じ布の模様を確認。学習中はカワウソとウサギの全身が画角に収まり、全テンキーを保持する。全景では大きな色分け、学習近景では縫い目が見える。元の参考写真ほど細かな繊維を全景で描き込むことは目標にせず、草・木・水との材質の差と顔の読みやすさを優先した。

`rig-study.png`は同じ実リグを独立したカメラで大きく見せた造形確認で、アプリの画面ではない。立つ・着座・後ろ姿を同じモデルから描画した。実アプリの証拠は`screens/`の19画面と`ui-report.json`。

| Gate | 判定と限界 |
|---|---|
| 視覚的魅力 | 作者が参考と実画面を比較。布の切り替え・縫い目・小さな球形の尾を確認。既存2種との共存を維持。原画の写真品質との同一性や、独立した最終アート承認は主張しない |
| 無説明理解・安全 | touch、通常/reduced motion、顔・手足・着座、失敗後の再入力を確認。独立した子どもの観察はN=0、無説明理解と再遊びの公開判定はHOLD |
| Runtime | core、住民専用19画面、通常Island 11ケース、classic smoke31/PWA4、Islandの更新/実offlineがPASS。固定10問80 runの数値15 gateもPASS。負荷重複あり、独占実行の正式速度認定はHOLD。固定v4の証拠であり、共有v5全体や公開先の認定ではない |

## 検証

- `verify:core`: 183ファイル・2,131テスト、docs/lint/typecheck/build/assets PASS。PWAは9.71MiB / 12MiB。
- 住民専用UI: 2 viewport・19画面PASS。初回設定→誤答/訂正→追加操作なしの第2区間→実獲得したベンチへの歩行/着座→再演→着座したまま学習→実回答→同じ予約のreload→明示的WebGL喪失/復旧。
- 座面・手元・足の接点、UVのbatch後の保持、他2種の非適用、素材の共有と破棄は既存38＋新規3テストで確認。通常再演でtexture/geometry数不変。代表的な自由遊びでは84 draw calls / 95,748 triangles / 7 textures。GPUの実機性能値ではない。
- Island PWA: 保護された7経路と実Service Workerのoffline reload・回答・再開PASS。
- 通常Island: 11シナリオ・113画面PASS。両viewportで実UIの25区間、4地区の成熟、7物の保持、発見・履歴・再演、WebGL復旧と各入力形式を確認。[report](island-report.json)。
- Classic smoke: 31ケースPASS。Classic PWA: 実Service Workerの旧→新version driftを含む4ケースPASS。[smokeログ](smoke.log)・[PWAログ](classic-pwa.log)。
- 共有workspaceへの統合後、typecheck、関連64テスト、担当ファイルのlintとdiff確認PASS。[関連テスト](merged-tests.log)。住民造形・素材・資源管理・画角テストの5ファイルは固定検証コピーと[SHA-256一致](merged-source.json)。
- 固定10問: 2 viewport×2 lane×2 scenario×10反復、80 run/15 gateの数値基準PASS。正解後入力P95はphone/tablet 195.0/195.1ms、誤答後再入力193.3/194.0ms、区切り215.5/195.0ms。普通の問題間の追加操作0、入力混入0。自動キーボード・reduced motionの測定で、子どもの学習速度を表さない。[生report](throughput-report.json)。
- 速度測定先は同じ固定app入力のDEV `http://127.0.0.1:5320/`。production入力との共通ソース不一致0、712測定入力の開始/終了hash一致。revisionは上記と同じで、DEV version末尾は`89ddae8b-7abe-47cd-b5fe-1c1ce7c3f2bf`。実画面のproduction versionとの違いを保持する。
- 実行前半に別作業の `tools/e2e-island.mjs` 等を検出した。[負荷監視記録](throughput-concurrency.json)は`exclusive=false`。raw reportの`eligible=true/pass=true`は反復数・数値条件・入力固定を示すが、独占実行の正式な公開速度認定には用いない。

## 最初の失敗と修正

1. 黄色と黒の縞の尖った尾はユーザーから「しっぽへん」。短い無地の尾を経て、「まんまるしっぽで」に従い、XYZ同径の球体を最終形にした。却下した尾を最終画面へ混ぜていない。
2. 短い尾で2つの旧画角テストが失敗。診断では768pxのテストが`viewportWidth`を渡さず390pxとして人物間隔を採点していた。実幅では十分な間隔があるのに、53px対60pxの誤った比較で視点を反転していた。テストに実viewport幅を渡し、既存の向き・全身・間隔のassertを保持して全検証を再実行した。runtimeの画角ロジックは変更していない。
3. 住民専用QAの初回はreload後にホームの開始ボタンを待って失敗。実アプリは学習へ正常に復帰済みだった。QAを現在の復帰契約へ合わせ、同じproduction buildの両viewportを最初から再確認した。app入力を固定したまま、修正QAは別hashで追跡した。

元の[画角失敗](core-initial-framing-fail.log)、[幅の診断](framing-diagnostic.log)、[UI待機失敗](ui-initial-wait-fail.log)を保持。最初の固定archiveも`output/playwright/patchwork-final/`に残す。

## 配布範囲

共有workspaceへ実装を統合し、上記ローカルproduction previewで確認する。公開デプロイ・commit・pushは行っていない。子どもの独立観察とiOS/Android実機、公開先の旧→新PWA更新は未評価。
