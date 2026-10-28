# もちもののまとめ表示

対象は通常Growingの「もちもの」。[画面仕様44](../../product/44_display_layout_spec.md#島の入口と面積)と[仕様52](../../product/52_growing_island_game_spec.md)に従う。

同じ個体状態の収納品を個数付き1枠にし、現在配置数の多い種類を最大3枠先頭に表示する。そのほかは種類別、学習記念品は単元を保持する。種類フィルターからは先頭の品も取り出せる。まとめた枠だけの商品画像を生成し、100個分の同じ描画を繰り返さない。選択時には元の所有IDで既存の無料再配置を行う。保存・学習・価格・所有数の規則は変更しない。

## 検証

2026-10-23 JST。Node 22.23.3（nvmが未導入のため既存fnmで指定）、依存は`npm ci`で準備。既存の多数の作業差分を保持した共有作業ツリーが対象で、HEADだけの検証ではない。

- `npm run typecheck`: PASS。
- `npm run lint`: PASS、既存5 warnings。今回の変更ファイルの最終lintは0 errors / 0 warnings。
- `npx vitest run src/components/island/growing/GrowingTray.test.tsx src/components/island/growing/storedCatalog.test.ts src/components/island/growing/catalogPictures.test.ts`: 3 files / 11 tests PASS。100個の圧縮、色/育ち/由来/外観/単元の区別、旧家具、分類からの到達、次の所有ID、画像生成数を検査。
- `npm run build`: 最終コードでPASS、assets:checkもPASS（precache 8.89 MiB / 12 MiB）。
- `npm run docs:check`: PASS。最終文書追加後にも再確認する。
- 実画面旅程は390×844 / 768×1024の両方でPASS。[入力SHA・runtime metadataと結果](report.json)。音off・tablet reduced motion、種類選択→取消/同じ分類→実1個再配置→再読込→99個/次の所有ID→学習7store不変を確認。新しい隔離browser contextのDEVで、実SWは未制御。
- `npm run test:run -- --maxWorkers=4 --minWorkers=1`: **PARTIAL**。最終appで137 files / 2,402 testsの完了を記録したところでローカル作業枠を終了し停止。全体suiteのPASSではない。[集計](suite-partial.json)・途中ログ（ローカルログ：`suite-partial.log`）。先行する通常並列数のrunも完走前に止め、並列数を抑えて最終コードでやり直した。次回は全体suiteを完走させる。
- 共有索引4ファイルを再生成し、`node tools/generate-agent-index.mjs --check` はPASS。標準portal buildはNode 24.18.0で実行したが、今回変更していない `docs/tasks/active/2026-09-27-living-fantasy-first-playable.md` のflow証拠hashが古く失敗（`Stale flow evidence`）。失敗ログ（ローカルログ：`portal-failure.log`）。別の `agent:index:check` はadapter検査のPASS出力後に作業枠で停止し、portal:verify全体は未完。証拠を作り直したことにせず残す。

対象テスト（ローカルログ：`focused.log`）・ビルド（ローカルログ：`build.log`）・全体lint（ローカルログ：`lint.log`）の出力も保持する。全体検証の未完了と既存portalの失敗を解消するまで、全体受入・配布合格とはしない。

| 幅 | 入口 | まとめ表示 | 1個再配置・再読込後 |
| --- | --- | --- | --- |
| 390 | [島](390-home.png) | [100個](390-grouped.png) | [99個](390-after-placement.png) |
| 768 | [島](768-home.png) | [100個](768-grouped.png) | [99個](768-after-placement.png) |

[320幅のまとめ表示診断](320-grouped-diagnostic.png)も保持する。320幅の操作旅程全体のPASSとは区別する。

実画面driverは `tools/e2e-growing-inventory.mjs`。`SANSU_INVENTORY_URL=http://127.0.0.1:5198` と新規の `SANSU_INVENTORY_OUTPUT` を指定して実行する。明示DEV fixtureは100収納ベンチ・配置済み1ベンチ・2色の花・2単元の記念品。実取得の証拠とは区別する。390通常motion・768 reduced motion、音offの本人で、まとめ表示・種類フィルター・取消/分類復帰・1個の実再配置/再読込・学習7store保持を検査する。320幅は別の画面診断。reportに日時、URL、実runtime metadata、対象入力SHAと結果を残す。

初回driverはproduction DB名と旧foundation storeを参照して失敗し、Preview DB / terrain storeへ修正した。アプリの保存故障ではない。途中のsource変更前の旅程は診断として保持し、最終固定sourceの結果と分ける。ローカル原記録は `output/inventory-20261023-v1` から `output/inventory-20261023-v4`。固定appの診断は `output/inventory-20261023-final` と `output/inventory-20261023-final-v2`、修正driverは `output/inventory-20261023-final-v3`。最初の再配置先が固定家用の予約cellで拒否されたため、実canvasのhitを確認して合法な候補を選ぶよう修正した。アプリの正当な配置拒否を保存故障と扱わない。

公開・push・commitは実施していない。実利用者の保存、実機性能、PWA更新、子どもの理解/再訪は今回の判定に含めない。
