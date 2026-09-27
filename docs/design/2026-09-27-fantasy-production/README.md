# 幻想の庭・自然の暮らしの本番統合

2026-09-27。ユーザーが本番統合を明示したため、既存のぽこもこを保った `living-fantasy-garden-v2` とNature Townの基本の一周を家庭内利用へ配信した。包括仕様51の全機能完成・最終美術承認とは区別する。

## 固定した対象

- 開始時の本番は `67406a18`。途中で別作業の学習feedbackが `620236a5` として公開されたため、これを保持して統合した。
- 検証した実装revision: `824d9a23d0e436c5f9e13675f5b11a6be81338b7`。
- [公開候補の入力・flag・build](integrated-manifest.json)、[直前本番の再build](current-baseline-manifest.json)、[互換復旧build](rollback-manifest.json)。過去の画像の合格は転記しない。
- 本番URL: https://sansu-seven.vercel.app 。`5bd7848d5b9b8cea9b3ed0fadec8f09f564ec8a4` を2026-09-27 20:19 JSTに配信。公開versionは `5bd7848d5b9b8cea9b3ed0fadec8f09f564ec8a4:0240ee1a-466b-4a70-982c-d84344cb399f`。公開URLの初回旅程で下記の報酬不具合を検出し、追加修正した。

修正版の公開revisionは `2da8efdf0e0cc82e0becf3bf90ef5a59295a7b0d`、versionは `2da8efdf0e0cc82e0becf3bf90ef5a59295a7b0d:ef17f79c-1131-46cb-b6a4-4073430e8e01`。[公開manifest](enrollment-live-manifest.json)で実際の公開設定を確認した。実装の入力hashはローカル検証版と一致する。Vercelの再buildをローカル成果物のbyte一致とは扱わない。

## 保存の修正

食料・土の切替は最初の更新でLife版20と同一transactionに保存する。水路購入前から旧writerを拒否する。既存のaction/credit/財布/学習正本は保持し、旧Nature Town DBは移行・削除しない。[旧本番の実コードを実行した検査](current-legacy-writer.json)で、旧writer拒否・所有保持・旧タブの学習事実の一度だけの回復を確認した。

## 公開後に検出した初回報酬の修正

[最初の実公開テスト](live-production/report.json)で3問の学習正本は保存されている一方、しずくが4個に留まった。実公開版のWorker取得を3.5秒遅延した[故障診断](live-delay-repro/report.json)では、3問すべての完了がLife作成時刻より前になりcreditが0になった。失敗画像と保存状態を保持し、合格に置き換えない。

`2da8efdf0e0cc82e0becf3bf90ef5a59295a7b0d`では、Worker取得前の最初の更新要求を参加時刻として渡す。進行時計は処理時点のままとし、既存の島と別タブの保存を巻き戻さない。参加前の学習を加算せず、取得中の完了は次の同期で一度だけ反映する。起動失敗時のfallbackも同じ境界を使う。[29件の回帰検査](enrollment-final-focused.txt)と[修正版の入力・build](enrollment-final-manifest.json)を保存した。

## 確認結果

- **実公開の修正版**: [通常取得](enrollment-live-normal/report.json)、[3.5秒遅延取得](enrollment-live-delayed/report.json)ともphone/tablet PASS。各4問を実回答し、花の実購入/配置、SW offlineの続き、再読込後の4creditと持ち物保持を確認。遅延側はWorker requestを実際に3500/3501ms遅らせた記録を含む。公開URL・配信version・候補を全captureに記録。実データを書き換えず、使い捨てブラウザーの初回設定から検査した。

- [修正版の遅い初回取得](enrollment-delayed/report.json): Workerに3.5秒の通信遅延を入れ、phone/tabletの実4問→実購入→offline保存がPASS。通常速度の証拠とは区別。
- [統合版から修正版への更新](enrollment-two-build/report.json): 両幅で実SW更新、学習と既存の持ち物、offlineの続きの保持 PASS。
- 修正版の[基礎検証](enrollment-final-core.txt): 473ファイル4,243テスト、docs/lint/typecheck/build/assets PASS。
- 統合時点の[基礎検証](integrated-core.txt): docs/current-entry/lint/typecheck、473ファイル4,239テスト、build/assets PASS。lintに既存のIslandMilestone Fast Refresh warningが1件。別作業の学習更新も含む。
- [旧→新→互換復旧](three-build-normal/report.json): phone/tabletで実初回・4問・花購入・学習途中からSW更新。版20、新しい水路の実購入、offlineの同じ次問、幻想OFFの互換buildへの更新とoffline保持 PASS。
- [更新中断](two-build-interruption/report.json): 両幅で旧SW固定・検出後切断・offline旧版再開・再接続・新版更新・同じ学習と所有保持 PASS。
- [公開形式の初回利用](integrated-production/report.json): 両幅で実初回→4問→実購入/配置→実SW offline再読込/続き→保存 PASS。DEV creditや時計送りなし。
- [PWAの汎用更新](pwa-update.txt): onboarding、protected router、same-route checkpoint、version drift PASS。
- [素材予算](integrated-assets.txt): precache 8.29 MiB / 12 MiB。
- [30品の明示fixture](thirty-items/report.json): 200個の診断creditと合法commandで作成。30品の表示、学習への復帰、学習正本の保持 PASS。**描画性能の合格ではない**。223 calls / 139,536 triangles、desktop ChromiumのrAF P95はphone幅67.3ms/tablet幅81.6ms。実機FPSの証拠ではなく、30品時の軽量化は残件。

`verify:release` は全基礎検査4,238件を通った後、変更していない旧探索smokeの「数字の並び」を算式専用の検証器が解けず失敗した。その後、本番baseline変更を受けてその旧runを停止した。ログは[停止前を含む記録](verify-release.txt)。終了直前のbrowser closedはこの停止による。最新統合版の基礎検査、今回対象の島とPWAは上の別検査。`verify:release` 全体PASSとは報告しない。

## 三つの判定

| 軸 | 結果 |
|---|---|
| 視覚の魅力 | 元のぽこもこを使用。最新の実画面を[一覧](contact-sheet.html)に保存。入口・家を含む最終美術統一と独立承認はHOLD |
| 無説明理解・安心 | 子どもの独立観察0人。自動検査で理解や意欲を実証したとはしない |
| Runtime | 対象の学習・所有・更新・復旧・offlineはPASS。30品の描画負荷、実機、旧探索smokeの検証器は残件 |

## 復旧

幻想表示を戻す場合は今回の版20reader/writerを保持して `VITE_ISLAND_FANTASY_ENABLED=false` で配信する。旧deploymentへのロールバックやデータ消去で代用しない。水路と食料・土の保存、学習と持ち物を維持する。上の実3build検査で検証済み。
