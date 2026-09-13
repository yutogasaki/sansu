# 現在の花の観察とM2

[仕様50](../../product/50_mysterious_island_discovery_spec.md)の現在観察を花へ接続。配置した個体を「みてみる」で開き、触ると葉/花びらが上へ動く。実際に1秒以上見えた場面を記録し、本人が「のこす」を選べる。

## 対象

- `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV`。新規Chromium context、音off。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb` ＋未commit変更。
- Candidate `island-life-discovery-a-observation-v1`。
- source開始/終了SHA-256 `62a394294056e94c4003128c7010db0b9dcc9f336faaa321cccf4f6b146c8743`。ハーネスのpath/NUL/content/NUL方式でsource/public/package/viteを照合。
- phone 390×844、tablet 768×1024（reduced motion）。各3問を実UIで解き、得たしずくで花を購入。開花画像のみ明示的DEV24時間clockを使用し、実時間の成長の証拠とはしない。

## 検証

- [実画面contact sheet](contact-sheet.html)と[report](report.json)。観察、連打、任意保存、即時学習退出、再読込と本人保存保持、学習store不変、WebGL context loss前の未記録、開花後の花びらを検査。
- verify:core PASS: 355 files / 3690 tests、docs/lint/typecheck/build/assets。最終のlint/typecheckと対象13testsもPASS。既存Fast Refresh、docs期限、chunk size警告を保持。
- 最初の操作テストはPASSしたが、画像ではleafのshape scaleが失われて球状に拡大。元scaleへ相対倍率を掛けるよう修正し、形状回帰と再撮影を実施。失敗画像 `/tmp/sansu-v3-magic-runtime-1` を診断履歴として保持。
- ログ `/tmp/sansu-v3-observation-core.log`、`/tmp/sansu-v3-magic-runtime-3.log`。

## 非補償ゲート

- 視覚: 参考画像と最新runtimeを比較。青い海・ミント地面・家・紫の木・住人を保持し、同じモデルの拡大と小さな葉/花びらを確認。全体美術の新規承認ではない。
- 無説明理解/安全: Human N=0。自動テストから子どもの理解・意欲・学習効果を認定しない。
- Runtime: 上記DEV/単体範囲でPASS。production SW/offline/PWA update/throughputを含むrelease全体は未判定。

R1/R3の視線、他の発見の描画接続、記録一覧と解除/再演、価格/成長/有限ひかり/土地の移行、追加8商品とBの魔法/出会いは継続中。
