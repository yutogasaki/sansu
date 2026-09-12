# 旧島の美術を継承した暮らす島

2026-09-12、ユーザーの「前の良いところをうまく取り入れて実装」に基づく変更。[参照画像](reference.png)はユーザー提示の旧moon-garden実画面。採用契約は[仕様48](../../product/48_island_life_spec.md)。公開・pushは行っていない。

## 継承したもの

| 見た目・操作 | 実装 | 継承しないもの |
|---|---|---|
| 色瓦の家 | 旧島の実モデル、最新の暖色タイル材質、アーチの扉、ピンクの縁、窓と花箱を再利用。玄関を既存Life位置に合わせる | 旧家の成長状態・固定家具 |
| 紫の木と星 | 旧島の金色の曲がった幹・紫の樹冠・吊り星を再利用。配置可能セル外の背景に置く | 利用設備・所有数・報酬への追加 |
| ミントの草と青い海 | 旧島の草bump素材を再利用し、ミント・青・薄紫の海岸へ戻す | 旧島の配置座標・土地解放条件 |
| 敷石・砂浜・岩の層 | 平らな五角形の敷石、淡い紫の多面体岩、砂と崖の段差 | 家具と重なる装飾・新しい歩行障害 |
| 住人との近さ | v7の近景、直接つくる、実物見本、滑らかな歩行を保持 | 旧学習・通貨・保存契約への巻き戻し |

敷石は家からの既存セル内にだけ置き、そのセルに所有物があれば描かない。単体検証で所有物・cellを変更しないことを確認する。屋根専用の素材/テクスチャはシーン破棄時に解放し、共有の住人素材は破棄しない。

## 実画面と版

固定production targetは `http://127.0.0.1:5326`、Island/Life flags=true、DEV=false、DOM candidateは `island-life-moon-garden-v8`。[artifact.json](artifact.json)が固定ビルドのversionと全ファイルhashを記録する。共有dirty checkoutであり、HEADだけではこのbuildを識別できない。version.jsonの旧島candidateと新島のDOM candidateを混同しない。

参照画像は既に家具や住人がいる旧島、新画像は実学習から花を一つ置いた新島で、同じ所有状態の差分比較ではない。参照の所有物をコピーせず、色・素材・形を比較する。木は常設の景観として扱う。

## 判定の境界

- 視覚的魅力：実画面で黄色中心の屋根、紫の木、ミントの草、青い海、敷石が揃い、参照画像の特徴を新島へ戻した。数値採点や最終アート合格は認定しない。
- 無説明理解・安全：子どもの観察N=0、HOLD。作者の目視を独立した利用者の理解や再訪意欲に数えない。
- Runtime：記録した学習→配置→反応→保存→再開の限定検証を対象にする。正式80runのthroughput、旧島全経路、実機iOS、全アプリのrelease matrixは今回の合格主張に含めない。
- 全体の連続性：新島と通常学習・商品選択・配置・再開を確認。家の中や写真を含む全画面の監査とは分ける。

## 検証記録

- `npm run verify:core` PASS：lint/typecheck/build/assets/docs、348ファイル・3,652テスト。[ログ](core.log)
- `npm run e2e:smoke` PASS：31シナリオ。[ログ](smoke.log)
- 初回production検証は通知を撮影した後にクリックし、通知の有効時間を過ぎて停止。[初回ログ](production-first-failure.log)。修正版は通知を撮影前に押す。
- 次の2回は配置・残高・発見の通知まで到達したが、短時間のhop値を500ms間隔のDOM監査で確認できず停止。[2回目](production-second-failure.log)、[3回目](production-third-failure.log)。待機開始を配置前にしても解消しなかったため、検査の取り逃しと断定しない。短い発見ジャンプのruntime合格は保留し、後続の保存検査と分けた。
- [通知の診断画面](diagnostic-earned.png)、[配置後の診断画面](diagnostic-after-reaction.png)は失敗runの画面であり、全工程の成功証拠ではない。

実画面は[比較シート](contact-sheet.html)にまとめた。[QAソース](production-qa.mjs)は実行時ファイルを保存したもの。再実行時はリポジトリの `output/playwright/` へコピーし、`SANSU_ISLAND_PRODUCTION_URL` と新しい `SANSU_ISLAND_OUTPUT` を指定する（相対importの基準は実行時の場所）。

- 後続の限定production検証：phone 390×844 / tablet 768×1024 の2経路PASS。[結果](production-report.json)。実初回3問→6しずく→通知から商品選択→花を配置→好みの返答→育ち表示→native保存→再読込→実SW制御下でオフライン回答・再起動を確認。tabletはreduced-motion。短い発見ジャンプのassertionを外した限定経路であり、先の失敗を上書きする全項目PASSではない。
- 最後の `npm run docs:check` と `git diff --check` PASS。公開、commit、pushは行っていない。

## mainコミットの検証（2026-09-12）

ユーザーの「全部コミットメインプッシュ」により、島の改善・筆算短縮版・カメラ操作修正を含む全変更を統合対象とした。ステージ済みindexを別ディレクトリへexportし、`npm run verify:core` PASS（348ファイル・3,652テスト、docs/lint/typecheck/build/assets）。検査開始終了でindexのtree一致を確認した。前段の実画面・production検証は記載の固定dirty buildの記録として保持し、このexportでE2Eを再実行したとは扱わない。短い発見ジャンプと子どもの理解の保留は維持する。
