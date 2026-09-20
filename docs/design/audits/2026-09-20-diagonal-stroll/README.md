# 斜め散歩と保存場面の再演 — 2026-09-20

## 今回の範囲

現行 main `788db3f` の保存版17へ斜め散歩を統合した候補。旧作業ブランチの一括移植ではない。保存版18の切替記録は本人・時刻・旧action prefixを固定し、旧時刻の再生と途中の利用を保持する。新たな散歩だけを安全な斜め経路へ短縮し、家具利用の距離・報酬・学習は変えない。キャラクターの形・配色・速度も変更していない。

通過済み経路を住民の予約から解放する。家・家具・島の縁と他住民の予約点を避け、移動時間は実距離から算出する。小数時刻でイベント処理が止まらないよう終了時刻を切り上げる。

観察・思い出が島全体を覆う間は、背後の3D描画を休止する。論理時計・保存は継続し、閉じると現在時刻へ戻る。隠れた演出を表示実績には数えない。

## 検証と対象

- `verify:core`: 437 files / 4,080 tests PASS。docs/lint/typecheck/build/assets PASS。既存の期限・Fast Refresh・chunk警告あり。
- classic smoke: 31 PASS。Life全体の受入や実機試験の代用ではない。
- 焦点検査: diagonal migration / walking space / repository、16 tests PASS。24時間送りは683ms。
- [歩行manifest](walking/manifest.json): 両幅90秒、3住民の位置変化・保存版18・reload保持・native学習不変を確認。明示的なpreview本人/credit/花fixtureであり実獲得ではない。
- [保存再演report](replay/report.json): 元のR5/R6を実UIで両幅再演。背後のpose更新0、閉じた後の再開、元の保存scene/native学習を保持。旧owner fixtureの実時間基点だけを現在へ合わせた診断である。
- 歩行のsourceは `a6994954fa61ac05d74a19f79ecc956f0bfde4e6aa524887c2606da555ed3fc6`。その後、同じgeometry判定を直接呼ぶ性能修正を加えた最終sourceは `6d9e3cd3e7ca71ecd66e7c7f802995c3f6c09c255f82e75ca14aa37549a03bdb`。前段のUI証拠を最終sourceの撮影と呼ばない。
- 本番構成はIsland/Life/Discovery=true、Life preview/BuildPlay=false。[build manifest](build-manifest.json)と[旧版manifest](old-build-manifest.json)に全入力・dist hashと実versionを固定。

## 先に起きた失敗

初回全体検査は24時間送りでtimeout（4,078 PASS / 1 FAIL）。予約ごとのBFS、座標文字列の大量生成を計測し、静的経路の安全な短縮・1024件のコピー返却cache・同一geometry判定の直接呼出へ変更。途中の全体検査でも5,816msで5秒上限を超えたが、上限は変更せず最終683msに改善した。途中で中断した全体検査は合格に数えていない。

空島テストは旧30分滞在のfixtureを残していたため失敗し、実cadence切替を通すfixtureへ訂正。再演UI初回はfixture DB未初期化、次はtablet R5の提示timeout。その後の不安定な再試行を合格の根拠にせず、背後描画の休止後に両幅を通した。さらに保存一覧の非同期読込前に照合したharness失敗を訂正し、最終reportと区別した。

## 独立した判定

- **視覚: HOLD**。C3と実画面を比較。巨大な枝・水玉・色瓦のDEV表現と、本番の既存樹木では系統が異なる。C3の包まれる奥行き・局所陰・地形の質感に未達。今回の動作修正で美術の完成とはしない。
- **無文字理解・安全: 未認定**。Human N=0。自動導線検査は子どもの理解/愛着の証拠ではない。
- **runtime: 上記の検査範囲でPASS**。実機iOS、全混合配置/最大数、自然X3、固定10問の所定反復、全releaseは別の残件。

## 再現入口

`tools/check-life-saved-replay-ui.mjs` は `SANSU_REPLAY_URL` と新しい `SANSU_REPLAY_OUTPUT` を指定。単独診断は `tools/check-life-saved-replay.mjs`。fixtureの注入を隠さず、実獲得/PWAの代用にしない。

`tools/e2e-island-life-two-build.mjs` の `SANSU_LIFE_DIAGONAL_UPGRADE=1` は17→18の実更新を検査する。他のupgradeモードと同時指定しない。旧/新dist、manifest、出力先の環境変数は同ハーネスの既存契約に従う。

## mainとの統合後の最終候補

作業中に入った `a18e8c6`（未使用geometryの生成省略）を取り込み、実装commit `5a5cdf9` へ統合。仕様書の末尾追記だけ競合したため両方を保持した。他作業の未commit変更は取り込んでいない。

- 最終source: `8fc5f27128f5ecdaab8a6bcbd85770138fe52dec2aed35e5e49143cf5785471c`。[統合build manifest](integrated-build-manifest.json)に実versionと全artifactを保持。
- 統合後typecheck、経路/移行/repository/scene生成の19 tests PASS。描画生成だけの統合に対し全学習suiteを重複実行せず、前段4,080 testsと区別した。
- [実two-build更新](update/report.json): 両幅PASS。旧17で実回答・購入・通常連問を進め、学習中は更新保留、島でreload一度、新18の同じ所有・native全store・offline次問を保持。DB/clockを注入しない。
- [実保存・offline・失敗再試行](storage/report.json): 両幅PASS。実初回回答から苗購入、offline配置/収納/回答/reload、Life put故障時の正式学習保持と再試行一度を確認。
- [統合後の保存場面再演](integrated-replay/report.json): 両幅R5/R6 PASS。これは旧sceneの明示fixtureによるDEV確認。最終productionの新規施設獲得の証拠ではない。
- 統合前storageは両幅のUI検査を終えたが、終了前にこちらがrebaseして入力hashを変えたため全体FAIL。アプリ保存失敗ではなく検証手順の誤り。[失敗report](invalidated-storage-report.json)を保持し、固定した統合後buildで全行程を再実施した。

[実画面の一覧](contact-sheet.html)は旧学習→更新保留→新しい島→offline同じ次問、購入/保存失敗、元の場面再演を並べる。DEVの`canopy-dots-c3-v1`とproductionの既存世界は混合して合格にしない。外部配信サイトの表示確認は今回の証拠に含まない。

住民間の回避は現在位置と残り経路の予約点を対象とする。全移動線分どうしの時空間衝突保証や最大混雑の認定は含まない。
