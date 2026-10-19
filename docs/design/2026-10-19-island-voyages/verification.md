# 海図から独立した島を育てる

2026-10-19 JST。利用者の「それぞれ個性を持った島を育てたい」「島の拡張を邪魔しない」を実装。正本は[海図と独立した島](../../product/island-voyages.md)。公開・push・commitは行っていない。

同日の[追加監査](./audit.md)で旧writerの写真削除・本人削除漏れ・別タブ切替後の名前誤保存を再現し、公開HOLDとした。以下のPASSは記載した対象版と経路に限る。

## できたこと

メニューの「海図と ふね」から名前と花／森／水辺の始まりを選んで無料で島を作り、元の島と往復できる。島別の座標・土地・配置・住人・町時間・自然時間を保持し、しずくと学習受取履歴だけを引き継ぐ。海図の距離や島数で土地拡張を止めない。家・木・花・水の現物への視点移動を追加。橋は同じ島の見晴らし台への散歩のまま。

schema6の現役 `voyageIslands` と `[profileId+islandId]` の退避表を追加し、schema5の `placedIslands` を一回コピーして旧writerを隔離。現在島の退避と対象島の復元は一つの保存transactionで、古い島IDのcommandを拒否する。写真も島別に読み、本人削除では全島と旧表を削除する。既存の家・本のwriterと実保存を読むQAツールも現役表へ合わせた。他作業のポータル変更、先の橋修正を保持。

## 検証

- `npm run docs:check`、`npm run check:current-ui-entry`、`npm run lint`、`npm run typecheck`、`npm run build`：PASS。既存lint warning4件、文書Review By警告は残る。Node24.18.0、前の作業でnpm ci済みの同じlockを使用。
- `npm run test:run`：625ファイル5,402テストPASS、1ファイル1テストが旧保存表名の期待値でFAIL（726.34秒）。旧期待値を現役表へ修正。`npx vitest run src/domain/growingIsland/voyages.test.ts tools/place-qa.test.mjs tools/e2e-growing-places.test.mjs` で3ファイル20テストPASS。往復・共通残高/学習/記念品の重複なし・町時間保持・別プロフィール・旧writer隔離・写真・保存途中失敗のatomic rollbackを含む。全体を再実行したという意味ではない。
- 保存回帰の先行検査は6ファイル44テストPASS。PWAのcritical persistenceを含む後続の対象4ファイル23テストもPASS。
- `npm run e2e:smoke`：PASS。classicの学習・既存回帰であり、海図の証拠とは分ける。
- `SANSU_PWA_PREVIEW_DIR=/tmp/sansu-voyage-classic-20261019 npm run e2e:pwa-update`：PASS。独立したclassic buildを使い、既存の保護route・同route checkpoint・版差復旧を検査。最初に通常Growing buildへ実行したものはtarget guardで停止し、その失敗を保存した。
- `SANSU_VOYAGES_OUTPUT=output/playwright/voyages-2026-10-19/production-house node tools/e2e-island-voyages.mjs`：PASS。`http://127.0.0.1:5298/#/island` の本番形式build、390×900通常motion / 768×900 reduced motion。本人の明示fixtureのみから、実UIの作成→元の島→家focus→新しい島→実SW offline再読込→木focus、所有/土地/残高と学習7ストアの保持を確認。Growing DB注入、学習credit、時計加速は使わない。

本番形式の対象は版 `development-local:ec278e28-021f-4ed5-93de-dbd57b6fc54d`、Island=true / NatureTown=false、delivery `snap-root-v1`、world `growing-island-v1`、通常描画候補 `native-05-place-runtime-v3`。revisionは作業ツリーbuildの `development-local`。実行時source SHA・日時・flag・version・両幅は `output/playwright/voyages-2026-10-19/production-house/report.json`、絶対app path・HEAD・dist SHAとその後のQAのみの差は同directoryの `candidate.json`。新規のテストとDEV診断の案内はその後に更新し、本番ソースの一致を確認した。

初回のDEV検査は海図読込完了前のcount assertionを修正。追加同期を待って保存済みの海図が閉じない実装は、保存完了後の画面切替と背景同期へ修正。productionの初回はmetadataの誤ったproperty名だけで失敗し、実際の往復/保持を確認した後のharness失敗として保存。修正済みharnessの終端PASSを上記に記載した。

## レビューと残る範囲

くふう・にぎわい・愛着に効く。島の作成で元の拡張権や既存物を減らさず、テーマは少数の実所有素材を変えるだけで育て方を固定しない。画面は既存の明るい紙の面と控えめな青を使い、音off/reduced motionでも名前と現在地・出発状態を表示。写真による素材再制作やキャラクター変更はない。

自動検証と作者の画面確認は、子どもの無説明理解・自発的な再訪・実機性能の合格ではない。旧build→schema6の実二build SW更新／rollbackは今回未実行（保存の旧writer隔離はunitで確認）。大きな実所有島で多数の島を往復する性能・長期保存容量・実時間成熟、利用者端末での移行、公開も未確認。個人の実ブラウザ記録には触れていない。


## 監査3件の修正（2026-10-19）

[監査](./audit.md)の写真消失・旧本人削除漏れ・名前の誤保存を修正。[判断と復旧境界](../../adr/2026-10-19-growing-voyage-writer-fence.md)に従い、schema7/8で写真Blob・ID・島IDを `voyageMoments` へ一回コピーし、旧 `moments` を自動採番とプロフィールindexを持たない空表へ置き換える。旧表を単に消すだけではDexieが再作成することを回帰で検出したため、旧版の写真追加と本人削除transactionが失敗する境界を使う。schema8対応版で本人削除を完了する。名前は編集開始時の本人・島IDを保持し、切替effectで欄を閉じ、submitでも照合する。

### 対象検証

- 保存・本人削除の関連5ファイル55テストPASS。schema5/6移行、Blob/ID保持、写真コピーabortと再試行、旧保存/削除拒否、新版全削除、別本人保持を含む。全体実行下で新しい写真テストが5秒を超えたため、大量fixtureをbulk準備し、各島の通常保存・刈込みは実writerで検査する形へ軽量化。修正後の最終対象実行は保存/本人削除/移行/同期/更新保護の7ファイル62テストPASS（5.89秒）。
- `SANSU_VOYAGE_LEGACY_OUTPUT=output/audit/voyages-2026-10-19/fixed-legacy.json node tools/check-growing-voyage-legacy.mjs` の先行fake IDB診断で、旧写真保存拒否・120枚保持・旧本人削除拒否・主DB本人保持・新版での削除完了を確認。
- `SANSU_VOYAGE_LEGACY_BROWSER_URL=http://127.0.0.1:5306 SANSU_VOYAGE_LEGACY_OUTPUT=output/audit/voyages-2026-10-19/fixed-legacy-browser.json node tools/check-growing-voyage-legacy.mjs`：Chromiumの実IndexedDBでも同じ期待/実結果がPASS。旧版はHEAD `882937581c46ec633a4e4663726385ad7e7a09f1` のGrowing repositoryと実 `deleteProfile` を使用し、その他は互換する現依存。使い捨てorigin/明示fixtureの診断で、実二build/SW更新や利用者端末の証拠ではない。
- `SANSU_VOYAGE_EDIT_URL=http://127.0.0.1:5307 SANSU_VOYAGE_EDIT_OUTPUT=output/audit/voyages-2026-10-19/fixed-name-production3 node tools/e2e-growing-voyage-edit.mjs`：390×900の本番形式画面でPASS。実名前欄で `MAIN-EDIT` を入力中に、タブBから実repository APIで `FOREST` へ切替・通知し、元タブを前面に戻す。旧欄が閉じ、最初の島は `MAIN`、移動先は `FOREST` を保持。移動先で新規入力した `FOREST-EDIT` の保存も成功。ページ例外なし、主要3ファイルの開始/終了SHA一致、実SW制御あり。海図全操作や更新そのものの診断とは分ける。

`SANSU_VOYAGES_URL=http://127.0.0.1:5307 SANSU_VOYAGES_OUTPUT=output/audit/voyages-2026-10-19/fixed-voyages node tools/e2e-island-voyages.mjs` も同じ本番形式buildでPASS。390×900通常motion / 768×900 reduced motionで、実UIの新島作成→往復→家focus→実SW制御offline再読込→木focusを確認。全所有と学習7ストアの保持、開始/終了の全src入力一致も確認。本人のnative fixture以外にGrowing DBや学習creditを注入しない。

固定outputは `/tmp/sansu-voyage-fix-production`、版 `development-local:16c9c45b-ea60-4340-b6f7-b81fbfc79e17`、root Island=true / NatureTown=false、delivery設定 `snap-root-v1`。対象版・dist SHA・検査した3入力は `output/audit/voyages-2026-10-19/fixed-candidate.json`。これは全入力の隔離source archiveではない。repository SHA256は `b8188d7b721837cc8c3c95d7d2e4e1fe570dfeaac065d5f67951158745333faa`、GrowingIslandは `0c70e43d889619e8a148929a6d22bc3656888f7ccdd9333d68ae5676296440a5`、hookは `33d01103ede8bc3befb7b149c97c0bbbcfdfe489e37295de4b24da4053517cc5`。

DEVの先行名前診断は並行する生成HTML書込による再読込の干渉を受け中断。本番形式の初回はpreview起動前で接続拒否、次は元タブの前面復帰を行わず40秒の待機で失敗した。これらを保存したまま、上記は前面復帰と150秒の上限を持つharnessで終端まで確認した。元の失敗を製品PASSに変更せず、起動性能や実機性能の合格へ読み替えない。

### 共通検査と残る範囲

`npm run lint`（既存4warning）、`npm run typecheck`、`npm run build`（assets checkを含む）、`npm run check:current-ui-entry`、`npm run docs:check`はPASS。独立outDirのVite production buildもPASS、未使用のoptional asset glob警告は残る。classic smokeは初回30 PASS / 2 FAIL（1024 portraitのlight bridge測定、Root Tangleの1500ms観察待機）。コード変更を加えず再実行し32件全てPASS。初回結果は `/tmp/sansu-voyage-fix-smoke.log`、再実行の診断は `output/audit/voyages-2026-10-19/smoke-retry/` に保持する。全体テストでは最適化前の新しい写真テスト、学習進行、旧Life保存の計3件が時間切れになった。新しい写真を含む最終62件と、学習進行/旧Life保存の再実行22件はPASS。別作業の `tools/portal-entry.test.mjs` 1件（Missing expected exception）は、原本とportal生成物の同期後に6テストを再実行してPASS。portalの検査ロジックには変更を加えていない。全体実行は628ファイル・5,410 PASS / 4 FAILで終了（1229.33秒）。失敗は上記3時間切れとポータル1件で、最終の対象再実行を含む全体再実行は行っていない。最後まで計算していた未変更の `authoredCoreGrowthIntegration.test.ts` も通過した。初回の索引検査は古い生成物、原本再生成後はportal参照SHAの不一致を検出。共通builderで派生出力を同期した後、`npm run agent:index:check`（portal検査とvendor12テストを含む）はPASS。製品の修正3件の対象結果を、全体回帰や公開の合格とは扱わない。

旧build→schema8の実二build SW更新・schema8対応復旧buildへのrollback、実iPhone、長期容量・性能と子どもの理解/再訪は未確認。公開・commit・pushは行っていない。

最終のコマンド別結果・主要3入力SHAと生ログは `output/audit/voyages-2026-10-19/checks.json` と同directoryの各ログ。個人の実ブラウザ記録を使わず、診断用のブラウザと5306/5307の自前serverを終了した。既存5198は変更していない。
