# 孤立配置・実画面確認

2026-09-14。採用仕様48の孤立予告、確定、再読込、無料移動による復旧を実アプリで確認した。実装者の検証であり、子どもの無説明理解・意欲は未観察（N=0）。

## 対象と再現

- 実アプリ対象: `http://127.0.0.1:5232`（DEV、使い捨てChromeコンテキスト）
- HEAD: `082958920f26efb5c8f55b80521bd86e0dc098de` に作業差分を適用
- アプリ入力SHA-256: `dba32cfd6713b26b71192fb19b59742f8bd7d439385c843b67575dcf241c485f`。取得前後で一致。
- 配信設定: `VITE_ISLAND_ENABLED=true`、`VITE_ISLAND_LIFE_ENABLED=true`、`VITE_ISLAND_LIFE_DISCOVERY_ENABLED=true`。`VITE_ISLAND_LIFE_PREVIEW` は未設定。
- 実renderのworld / visual candidate: `moon-garden-v1`。制作中のC3景観ではなく通常配色。productionへの配信確認とは区別する。
- phone: 390×844、動き通常。tablet: 768×1024、reduced motion。両方とも音OFF。
- キャッシュ: 新規DEVコンテキスト。production service worker更新はこのハーネスの対象外。
- コマンド: `node tools/e2e-island-isolation.mjs`
- 詳細結果: [manifest.json](manifest.json)

取得は明示fixture。新しいプロフィール、QA用100学習credit、図書館・小屋・ベンチの所有をdomainコマンドで投入した。実際の学習による購入達成を示す資料ではない。以降の移設、退避、確定、再読込、復旧は実UIと通常writerを使用し、住人をfixtureで消したり配置判定を無効にしたりしていない。

## 確認した流れ

[実画面コンタクトシート](contact-sheet.jpg)は、各行で配置前 → 既存建物の孤立予告 → 複数孤立の予告 → 確定 → 再読込 → 説明 → 復旧の順。

1. 図書館 `(0,0)`、小屋 `(3,2)`、ベンチ `(4,0)` が接続した島から開始。
2. 小屋を `(0,2)` に移す予告で、既存の図書館に足あとと「？」が出る。図書館へ訪問中の住人が移動先にいた場合は、保存された退避を実画面で歩いてから自動確定する。
3. ベンチを `(0,4)` に移す予告で、図書館・小屋・ベンチの3件すべてに印と名前が出る。成立しない経路線は出ず、追加確認なしで確定できる。
4. 再読込後も3件が孤立。図書館の世界上の印を直接タップして説明を開き、「むりょうで うごかす」に到達する。
5. ベンチと小屋を元の位置へ無料移動すると孤立判定と印が消える。

両サイズでしずく88を維持し、所有IDと元の学習データを保持した。pageerrorは0、ページの横方向はみ出しなし。確定時の自動退避は観察できた。キャンセル・非表示・unmount・新しい選択による予約取消は `placementWait.test.ts` で検証し、この実画面ハーネスで全パターンを操作したとは扱わない。

`phone-clearance-qa-hut.png` / `tablet-clearance-qa-hut.png` などの補助画像は復旧時の退避待ち表示。主コンタクトシートの時系列には混ぜていない。

## 別々の評価

- **視覚**: 通常の青い海・ミントの島・紫の木・黄中心の家を維持。tabletの配置全景では3件の静止印が同時に読める。初回診断で印が屋根に隠れたため、入口につながる支柱上へ移し、カメラの向きに追従する表示へ修正した。通常の近景では島の左端とベンチの印が一部切れる。既存の全景操作で見渡す前提が残り、「常に全印が同時に見える」とは評価しない。[採用moon-garden基準と実画面の比較](reference-comparison.jpg)も保存。独立したアート採点は未実施。
- **無説明理解・安全**: 色や動きだけでなく足あと・疑問符・対象名・無料移動を用意。音OFF/reduced motionでも同じ状態と操作へ到達。子どもが説明なしで意味を理解するかは未検証。
- **runtime**: このfixtureでの配置・実退避・確定・再読込・復旧、所有と学習データ保持はPASS。学習の実獲得、production配信、全PWA更新、一般端末の性能をこの結果から推定しない。

## 最初の失敗と修正

診断の最初のハーネスはasync関数を `page.waitForFunction` に渡し、保存を早まって成功扱いした。`waitForAsync` に直した後、実際は住人の身体と建物の配置先が重なり保存されていないと確認した。さらに配置面で保存エラーが表示されない問題が見つかった。

配置面にもエラー・再試行・読込操作を表示し、通常操作では住人の安全な退避を保存して描画完了後に配置を自動確定するよう修正した。キャンセルや離脱では元の配置を確定しない。診断の画面・DOM・保存レコードは `diagnostics/` に隔離し、最終PASS画像と混ぜていない。

## 同じ実装のproduction保存検証

上記と同じアプリ入力hashで、Island/Life/Discovery=true、Life preview/BuildPlay=falseの独立production buildを作成し、`http://127.0.0.1:5297` で `tools/e2e-island-life-storage.mjs` を実行した。phone/tabletの両方で、空DBの実初回設定・3問回答・苗購入・実SW制御下のoffline移動/収納/回答・再読込/再接続がPASS。12品のカタログも照合した。プロフィール・資源・回答のDB注入はない。app入力とdist、配信versionを検査し、開始終了のsource hashも一致した。

[保存検証の要約](storage-summary.json)。完全なローカル記録は `output/island-isolation-storage-20260914/report.json`、build manifestは `/tmp/sansu-isolation-production-manifest.json`。これはlocal production形式の検証であり、公開環境・異なる実build間のSW更新・実機iOSの検証ではない。

`npm run verify:core` は同じアプリ入力でPASS（416 files / 3,990 tests、docs/lint/typecheck/build/assets）。`npm run e2e:pwa-update` も最終coreが生成したclassic用distで4シナリオPASS。孤立の無報酬・復旧後の再訪、歩行中の編集、保存版15への境界と旧履歴の再演は単体検査に含む。

旧島をLife=falseで分離したproduction buildでも `npm run e2e:island-pwa` がPASS（8 protected-flow checks と実SWのoffline reload/answer/resume）。ローカル完全記録は `output/island-isolation-legacy-pwa-20260914/pwa-report.json`。この旧島検査をLife版15の実two-build移行の証拠として扱わない。

## 全体回帰と応答時間

- `npm run e2e:island`: Life=falseのDEVで全シナリオPASS。phone47区間/tablet46区間の実回答で4地区の成熟、3D履歴、表示復旧、全入力形式・支援・保存再開を確認。完全記録は `output/island-isolation-legacy-20260914/report.json`。
- `npm run benchmark:island-fixed-ten`: Life/Discovery=trueのDEVでphone/tablet各10反復、Study/Island・全正解/誤答訂正の計80runがPASS。正解後の操作可能P95はphone216.2ms/tablet217.5ms、誤答後は215.8ms/214.5ms、区間境界は208.9ms/208.7ms。全保存・追加操作なし・source不変のgateもPASS。[測定要約](throughput-summary.json)。自動キーボード入力の測定であり子どもの速度・学習効果ではない。
- `npm run e2e:smoke`: 実装途中のclassic31件PASSは `/tmp/sansu-isolation-smoke.log`。最終sourceで旧島E2Eと並行した再検査は30/31件PASS、1080×1920のRoot Tangleで次問待ち1500msを超過した（`/tmp/sansu-isolation-smoke-frozen.log`）。負荷の影響は推定であり原因確定ではない。アプリ・制限値を変えず、他のブラウザ検査終了後に `SANSU_E2E_ROOT_TANGLE_ONLY=1` で対象の5サイズすべてがPASS（`output/island-isolation-root-diagnostic-20260914/smoke-report.json`）。この再確認を「最終の全スモーク一括PASS」と言い換えない。

ローカル実装と対象機能の検証は完了。公開・実two-buildのLife版15移行・実機iOS・子どもの無説明理解は未検証であり、全release認定はしていない。保存データの旧規則からの切替は単体とnative IndexedDBの統合検査で確認した。
