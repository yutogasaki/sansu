# PWA更新の到達性とoffline保持

- Review By: 2026-09-08

## Docs To Touch

- `docs/product/01_app_spec.md`: 更新契約。
- `docs/runbooks/pwa-release.md`: 復旧と二build検証。
- `docs/ai/verification_matrix.md`: 必須検証への接続。

## Purpose

ユーザー依頼「pwaがちゃんと更新されるように」に対応し、通信遅延で止まる確認と、復旧時のoffline cache削除を修正する。

## Source of Truth

- [親仕様8.1](../../product/01_app_spec.md#81-pwa更新契約)
- [更新runbook](../../runbooks/pwa-release.md)
- [検証matrix](../../ai/verification_matrix.md)

## Plan

1. 版確認とSW更新を独立させ、確認にtimeoutを設ける。
2. cache削除を伴わない復旧、オンライン/表示/保存の再確認、ループ防止を実装する。
3. unit、既存PWA、実二buildの更新と保存保持、core/smokeを検証する。

## Verification

- PASS: docs:check / lint（既存Fast Refresh警告1件）/ 最終typecheck / 全237ファイル2,606テスト（PWA関連57件）/ 固定sourceからのclassic 2build・公開flagのIsland build / assets:check（10.47 MiB）/ smoke31件 / classic PWA4件。
- PASS: 実二buildでSW更新、保護フォームの入力・保存、全IDB/localStorage保持、1回だけのreload。SWを旧版に固定し、検知後切断→offline再起動→再接続→新HTMLへ復旧しcacheを保持。既存artifact指定と、自動2buildの両実行を確認。
- PASS: 公開flagのIslandで保護フロー8件と実SWによるoffline回答・成長保存・同じ予約への復帰。
- 実iOSホーム画面からの起動は実機未接続で未検証。公開・commit・pushは行っていない。
- 固定build・生ログ・JSON: `output/pwa-update-20260908-210023/`。`verified-pwa-source-hashes.json`で最終PWA関連7入力と固定sourceの一致を確認。広いUI変更は他作業によるもので、この更新では表示を変更していない。

## Progress

- 完了。版確認をSW更新通信から独立させ、本文取得を含め10秒で打ち切る。復旧はcache/登録の削除をやめ、更新markerをnavigation fallbackから除外する。オンライン・表示状態・保存holdを取得前後で確認し、同じ版の復旧reloadをタブ内で制限する。
- SWのactivatedだけでreloadせずcontrollingを待つ。学習中・保存中の既存checkpoint契約を維持する。
- `verify:release`へ実二buildテストを追加。個別には `npm run e2e:pwa-two-build` で起動できる。
- 原失敗と修正: 最初の共有typecheckは並行中の島実装の型エラーで停止し、後の固定buildと最終共有typecheckはPASS。新テストの設定画面遷移は初回root redirect完了待ちへ修正。Island PWAテストは新しい学習集中レイアウトの非表示canvasを待って停止したため、学習中だけ入力準備完了を待ち、homeは従来どおり可視canvasを確認するよう修正した。
- Review: 保存・入力保護とcache保持を別に確認し、コード上の手動cache削除経路がなくなったことを確認。UI/学習ルールは変更せず、学習の継続を更新が妨げないことを目的とした。実機iOSと本番反映は今回の検証範囲外。
