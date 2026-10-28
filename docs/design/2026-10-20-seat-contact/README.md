# 通常の島での着座接触修正

2026-10-20。利用者の実機画像で、ウサギの下半身がベンチの座面に埋まって見える不具合を確認した。

## 原因と変更

`GrowingLife.tick` は実座面と体・足を合わせる既存処理を authored 地形だけに適用していた。通常の島では固定の持ち上げ量が残り、全サイズのウサギの胴体接触点がベンチ座面より約0.061 world unit低くなった。再現テストは修正前にベンチとブランコの2ケースで失敗した。

ベンチ・ブランコ・食卓の着座にも既存の `alignActorOnSeat` を適用する。通常の地上歩行や他の遊具へ authored 用の接触補正を広げない。座面寸法、人物のモデル・縮尺、所有、保存、学習規則は変更しない。

仕様52の既存の「着座から遊び、降りるまで」の表示不良を直す変更で、製品規則・保存契約の変更は不要。美術の刷新や仕様51の採用判定にはしない。

## 検証

- Node 22.23.3（`.nvmrc` の22をfnmで選択。nvmは未導入）。既存の依存を利用。
- `npx vitest run src/components/island/growing/growingLifeScale.test.ts src/components/island/growing/actorScale.test.ts src/components/island/growing/growingLife.test.ts src/components/island/growing/growingLifeContinuity.test.ts`：47件PASS。通常サイズのウサギ/ぽこもこ、ベンチ/ブランコ、通常motion/reduced motion、退出時の足位置復元、保存state不変を含む。
- `npm run verify:core`：docs/入口/lint/typecheckはPASS。全体テストは642ファイル5,466件の完了まで失敗出力なしだったが、残る地形検査が長時間継続したため12:40 JSTに当該プロセス群だけを停止。全体suiteは未完でありPASSとはしない。対象47件は別実行で完了している。
- `npm run build`：同じ修正コードと後続のsafe-area CSS修正を含む作業ツリーでPASS、付随する`assets:check`もPASS。lint/型検査後の追加修正はCSSだけなので、TS/ロジックの検査を繰り返さず、CSSの12条件は別の[実画面検査](../2026-10-20-home-safe-area/README.md)で確認した。
- Playwright CLIの独立したDEVプロフィールで実ポインターによる運搬・着座を確認。音OFF、reduced motion、390×844と768×1024。[スマホのウサギ](390-bench.png)、[タブレットのぽこもこ](768-bench.png)。タブレット画像のウサギは着座確認対象ではなく、座席の隣にいる遷移中の人物。

## 入力と評価境界

- 対象：`http://127.0.0.1:5198/#/island`、DEV、`VITE_ISLAND_ENABLED=true`、通常地形（`curved-owned-v1`）、明示的な家・ベンチ・ブランコ・ウサギのfixture。
- 視覚candidate：`growing-island-v1` / `native05-expanding-runtime-v2`。DEVの使い捨て保存に限定し、利用者のDBを操作しない。
- [タブレットのruntime観測](runtime.json)：standard品質、pixelRatio 1、SW制御なし。DEVにはproductionの`version.json`がなく、下記HEADと対象コードhashで入力を識別する。
- 開始時HEAD：`9355c416ed188abe686d13cc35bf74626e7ac581`。共有作業ツリーのローカル候補で、commit・配布済みの主張ではない。
- 修正コードSHA256：`growingLife.ts` = `a3713bfaf9a83b7b556b9a9eae5fd925e4302d8160515ace36972ea70fe3d145`。
- 回帰テストSHA256：`growingLifeScale.test.ts` = `a060e12912f60b624050ed6bfa3b15299c1d00dbd7413087f82f3d297d96facb`。

実機iOS、公開版への反映、PWA更新、子どもの理解・再訪は未検証。commit/push/deployは行わない。
