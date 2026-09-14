# 住人の短い滞在と寄り道

## 変更

通常の自発利用を30分から到着後12/16/20秒へ短縮し、読書・手入れは24秒を確保する。直前の家具を避け、空きがなければ地面の散歩へ移る。散歩は到着後1.8秒で次の住人へ交代する。明示行き先・無料観察・GP3は専用行程を保つ。仕様は[48](../../../product/48_island_life_spec.md)。

利用報酬は家具種別ごとの実滞在を30分積算した時だけ、既存の有限ひかりとcounterへ渡す。歩行/散歩/無料観察では増やさない。保存版16の境界で旧所有・学習・確定報酬・過去の行程を保つ。既存の自発訪問は現在位置と経路を維持して短い滞在へ切り替える。

同じ入力の正式stateを最大8件だけメモリで再利用し、毎回のrefreshで過去の歩行を計算し直す負荷を減らす。履歴・checkpoint・所有者・版の変更で別のkeyになる。保存前の検証を省かず、cache自体は保存しない。

## 実画面

[90秒の同一画角一覧](contact-sheet.html)と[行程・source記録](motion-manifest.json)。DEV http://127.0.0.1:5236、Island=true/Life preview=true、`canopy-dots-c3-v1`。390×844 / 768×1024、後者はreduced motion、両方sound off。空の別プロフィールへ12 credits/花1個を注入する明示fixtureで、自然獲得の証拠ではない。実時計で各90秒、全3人の位置変化、学習store不変、同じ版16/cutover/actions/creditsでreloadを確認した。

基準revision `922c1444d03b0ddff0c9e98d0cb9cf36b16c3038` ＋作業差分。最終app source hash `7e1107dae201d62cc9822b1417d60066e164a8affd6a9842a135a8beb75363a3`。本番用は `resident-cadence-final:abb4df76-2c11-4119-9e01-84b6a7dade02`、Island/Life/Discovery=true、Preview/BuildPlay=false、http://127.0.0.1:5336。DEVのC3と本番用の景観を同じ視覚候補と扱わない。

## 検証

- verify:core PASS: 418 files / 4,002 tests、docs/lint/typecheck/build/assets。既存のlint warning 1件と期限済みdocs warningsあり。
- 移行/短い滞在/運搬/積算/描画時計/同時刻操作/cache有無の一致、破損/降格拒否の対象検査PASS。
- e2e:smoke 31 scenarios PASS、e2e:pwa-update PASS（classic用build）。
- 配置の退避・孤立化・reload・無料復旧、phone/tablet PASS。cache追加前の同じ移動ロジックの証拠は `output/resident-cadence-isolation/manifest.json`。
- [本番Life storage](storage-report.json) PASS、両幅で実初回回答→苗購入→offline移動/収納/回答/reload→Life put失敗→再試行。学習の保存・所有・残高を保持。
- [旧15→新16のtwo-build](update-report.json) PASS、両幅で実回答/花購入/次区間1問完了→学習中の更新待機→島でreload1回→全native store/所有/cutover保持→offlineで同じ次問。旧版は上記HEADのgit archiveから別にbuild、新版は最終source。

初回coreは長時間不在のrepository検査が5秒でtimeout（4,000 PASS / 1 FAIL）。上記cache追加後に全件を再実行しPASS。初回two-buildは購入前の正式なclear-placementを含む2件のactionを旧検査が1件と決め打ちしたためFAIL。保存内容・consoleは正常。退避と購入のkind/座標を正確に確認するようハーネスを修正し、初回結果は `output/resident-cadence-two-build/report.json` に保持した。

## 三つの判定と限界

- 視覚: 移動の増加は実画面で確認。C3参考に対する素材感・奥行き等の全体承認は今回の対象外で、既存のHOLDを変更しない。
- 無文字理解/安全: 操作や警告を増やしていない。Human N=0で、子どもの理解・自発的な再訪意欲は未確認。
- 実装整合: 上記の範囲で検証。外部公開はしていない。実機iOS、旧島専用E2E/固定10問throughputの再測定、長期の経済体験は未実施。7日分の空島行程を一括で計算する診断は約3.3秒で、数か月分のcold replayの性能認定ではない。
