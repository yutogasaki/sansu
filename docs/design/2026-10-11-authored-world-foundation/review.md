# M0 共通床と経路の制作基盤の確認

## 対象と変更の境界

採用native05の地形を一つの世界定義にし、床の補間・逆hit・配置地点・歩行/結合/通水を評価する基盤。現行本体は既存土地の互換地区を使い、描く床と足元を同じ三角形へ切り替えた。次期の全島入力は制作診断で、本人の保存4/schema5へ追加していない。

仕様52/13、[共通契約](../../product/island-world-contract.md)、[制作順](../../product/island-construction-strategy.md#12-作る順序を変える)を先に合わせた。既存取得地を新地形へ移す処理、学習/SRS、価格、時計、ルーティング、本人保存writerとPWA更新処理は変更していない。

## 回帰と描画データ

- 最終 `npm run verify:core`: 571 files／5,010 tests、docs/current-entry/lint/typecheck/build/assets PASS。[元log](verify-core.txt)。
- `worldDefinition`／`worldFloorGeometry`／`nativeWorldSource`／既存 `curvedLandscape`: 4 files／24 tests PASS。水底、床外、異なる実床、権利の分離、地区追加、旧全取得地と橋、原本SHA、実rayを確認。[元log](verify-focused.txt)。
- [旧描画との10組の比較](legacy-geometry-comparison.json): 所有床の全bufferはbyte一致。装飾の岸/岩の微小な丸め差はREADMEに記録。
- 原本入力4件と生成artifactのSHAを照合。73地点への到達は、明示した地形床と診断歩行グラフ上の結果。
- `npm run e2e:smoke`: 32項目、終了code0。明示classic flag-offの互換検査であり、新世界の全島の証明には使わない。[元log](verify-smoke.txt)。

既存のfast-refresh警告2件、Browserslist期限とbuildの警告は残る。失敗のない本体入力を変更せず、検査側の修正後に全体検証を重複実行しない。

## 実画面の検査

ローカルDEV `http://127.0.0.1:5338/#/island`、revision `authored-world-m0-final`、Island/native美術flag true。世界は `legacy-world-v1:…:curved-owned-v1:…`、美術候補は既存 `native05-expanding-runtime-v2`。次期 `native05-authored-world-m0-v2` が本体に描かれた証拠へ読み替えない。

[初回report](history/balance-initial/report.json)は古いメニュー名を探すharnessで停止。実画面・元runnerとsource SHAを保持した。共有 `openGrowingMenu` と実cameraの `productionCellPoint` を使用するよう検査を合わせた。残った別の古い呼出しを修正する前に[中断run](history/balance-harness-interrupted/interruption.json)を止め、sourceを実行中に変更していない。

現行runは390/768幅の各20実回答、配置・再読込・同じ学習への復帰、明示した旧土地/時間/記念品/13住人の8組・22画面がPASS、終了code0。全app/QA入力1,518件が前後一致し、本体runtimeの入力は現行sourceとも一致する。初回から変わった入力は検査側の `tools/e2e-growing-balance.mjs` だけで、本体は同じ。結果・画面・全入力は [runtime/report.json](runtime/report.json)、[critical-path実画面](contact-sheet.html)、[版と検証summary](verification.json) を参照する。実回答と、明示注入した互換診断は別scenarioとして記録した。

indexの差分確認で、新規の単体試験fixtureの末尾に余分な空行が見つかった。検証後にその空行だけを削除し、[試験時の元fixture（gzip）](history/world-fixture-tested.txt.gz)と前後SHAをsummaryへ保持した。実行するfixtureの内容と本体runtime入力は同じで、ブラウザーreportの元SHAは変更しない。[修正後の関連17回帰](verify-fixture-eof.txt)もPASS。

## 三つのゲートと未完の工程

| ゲート | 今回の範囲 |
|---|---|
| 美術 | HOLD。M1の家・森・水庭・花庭・集落を含む実配置と歩行が未接続。新しい全島の採用比較は未実施 |
| 独立理解・安全 | NOT_EVALUATED、独立観察N=0。回帰の通過を子どもの理解や再訪へ読み替えない |
| runtime | M0の床/権利/明示経路、旧床のbyte一致、coreと本体DEVの互換検査はPASS。新世界のproduction統合と配布は継続 |

次は本体rendererとdomainに同じ世界を渡し、8軒と森・泉・花庭・集落の全島一例を操作可能にする。水面・接続床・入口を実所有と成熟へ対応させる。その後に同材料の三配置、接続/成熟/利用/分離/再接続、既存地区を保持した16/32軒と次の拡張へ進む。

新世界の固定production、本人保存の新writer、実SW/offline/中断/rollback、実機性能と独立観察、公開は未完。以前のA3の結果はそのcandidateの履歴として保持し、包括ゴールを継続する。
