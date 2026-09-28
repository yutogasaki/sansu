# ぽこもこのポップな学習舞台 v5

2026-09-28。[比較試作](../2026-09-28-pokomoko-pop-study/README.md)と[参考リポジトリの分解](../2026-09-28-dopa-reference-breakdown/README.md)から、実際のIsland学習へ実装した候補。参考のキャラクター・録音・旋律は流用していない。

## 実装した体験

- 元のぽこもこの3Dモデルを関節ごとに動かす。顔・耳・布・頭身・足・選んだスカーフを保持し、入力した数字に頭と前足を向ける。
- 白い問題面、濃紺の輪郭、青・桃・黄・ミントの配色。問題面上端の舞台にまとめ、既存の4列TenKeyと問題入力を維持。
- 数字はキー→実際の前足→入力欄を移動する。新しい入力は前の演技を置き換える。次問が先に表示された場合も、前の数字を新しい空欄へ置かずに終了する。入力・保存・次問を演技待ちにしない。
- 学習を開いてからの完了3/6/9問で旗、星、色面と伴奏が増える。支援完了も含み、誤答で失わない。退出でリセットする表示専用の状態。
- 保存済みの3連続・5連続のほしのり、光・スタンプを大きい数字とジャンプへ接続。採点・SRS・保存・既存報酬は同じ。
- 算数は独自の120 BPM・4層の伴奏と和音に合うキー音。リーチで伴奏を絞り、正解・受取・配置・ジャンプ・着地を別の音にした。英語の読み上げと既存SEは継続。
- 音OFF・非表示・退出で音を停止。reduced motionでは跳躍・数字移動を止め、文字と色の状態を残す。WebGL障害時は元の静止画像で入力を続けられる。

## 対象と検証境界

候補 `pokomoko-pop-live-v5`。本番形式ビルドの表示revisionは `52ec984f-pop-v5-working`（新しいGit commitを意味しない）、`VITE_ISLAND_ENABLED=true`・`VITE_ISLAND_LIFE_ENABLED=true`・`VITE_ISLAND_FANTASY_ENABLED=true`。開発先 `http://127.0.0.1:5198/#/island?learn=1`、Island flag-on。基点 `52ec984f2a65613f89d015ac8b0a4048826ad5b6` に未コミットの実装を重ねたもの。以前の独立Canvas試作の画像・音測定を、今回の本体の合格証拠として扱わない。

自動検査は使い捨てプロフィールで実際のボタン・キー入力と保存を確認する。実端末や子どもの観察、聴感評価ではない。

## 別々に評価するゲート

- 見た目・演技：作者による実画面レビュー。元モデルの足、問題とキーの可読性、通常と節目の差を確認する。参考と同等の楽しさを独立評価したものではない。
- 無説明理解・安全：HOLD。作者は動作の意図を知っており、子どもの独立観察を代行しない。
- runtime：下の実行結果で範囲を区別する。スピーカーの聴感・実機Safariは未確認。
- 全体の美術：学習は意図的に平面のプレイ画面へ切り替える。庭・家までの最終美術の完成を宣言しない。

## 不具合と確認結果

初回のDEV描画検査で1フレーム後にfallbackへ落ちた。GPU変更でも再現し、StrictModeによるeffect再実行で、破棄した同一canvasを使い直すことが原因だった。描画面をeffectごとに所有・破棄する構造へ修正した。元の失敗記録は `output/playwright/pokomoko-live-v5-party-1`、切り分けは `output/playwright/pokomoko-live-v5-gpu-probe` に保持。

### 音の実出力

`tools/e2e-learning-music.mjs` は使い捨て本人で6問を実入力。伴奏単独のデジタル最大振幅は1問後0.020、3問後0.048、6問後0.043。3/6問で層が追加され、4連続時のフィルター約621 Hzから5連続達成時9 kHzへ復帰した。算数の回答中に旧MP3の重複再生は0。音OFF・OFF中の回答・退出後は出力0、stem停止・context終了。音OFF本人ではstemを作成しない。再ON後は新しい操作で4層だけ開始する。

記録 `output/playwright/pokomoko-live-audio/1790590393232/report.json`。対象sourceの開始/終了hash一致。最初の失敗は終了済みAudioContextのanalyserが最後の波形を保持する測定上の問題で、実行中contextだけを測定し、停止/closeを別に照合して修正した。**音楽の聴感、耳疲れ、実スピーカーは未評価。**

### 現時点の自動検査

- `verify:core`：477ファイル / 4,251テスト、docs、lint、typecheck、build/assetsがPASS。既存の`IslandMilestone.tsx`のFast Refresh警告1件は残る。
- 追加修正後：入力延期・舞台進行・音・演技の49テスト、actorの4テスト、lint/typecheckと本番buildを再確認。
- classic smoke：31シナリオPASS。
- [入力と描画](feedback-report.json)：14行程PASS。390×844・768×1024・844×390、通常/reduced、筆算・複数段・分数・英語、WebGL障害と復帰。
- [連続正解と舞台](party-report.json)：6行程PASS。実入力から全3スタンプ、3/6/9問の舞台、誤答・支援・退出・再読込を確認。描画中source開始/終了一致。
- [音](audio-report.json)：上記の実出力と停止を確認。

[実画面の比較シート](contact-sheet.html)は通常→3連続→5連続→誤答とtablet、先行試作を並べる。全景・退出・offlineの本番行程も同じシートへ含める。


### 固定10問の速度

[集計と判定履歴](throughput-summary.json)。phone/tablet各10反復、正答のみ／4・8問目の誤答、Study/Islandの交互実行、計80行程。使い捨ての明示固定問題であり、実際の子どもや通常plannerの能力評価ではない。

| 測定 | 390×844 | 768×1024 |
| --- | ---: | ---: |
| 正答から次の入力可まで P95 | 244.3 ms | 233.4 ms |
| 誤答から再入力可まで P95 | 205.5 ms | 205.0 ms |
| 区間境界 P95 | 274.2 ms | 271.8 ms |
| Studyに対する自動入力の処理速度比 | 2.226 | 2.235 |
| 問題間の追加操作 | 0 | 0 |

速度・保存・空欄・操作数・source固定は全て通過。元ハーネスの候補判定だけが旧`mystic-island-learning-v2`を要求したため、元のreportは`pass:false`を維持した。実記録は80行程を通じて同一buildと`pokomoko-pop-live-v5`である。判定器の期待値をv5へ更新し、元測定値を一切変えずこの1ゲートだけ再判定した結果は`eligible:true` / `pass:true`。再計時ではない。元と再判定のhash、全gateを集計JSONに記録する。

### 本番形式とoffline

[本番行程の記録](production-report.json)：390×844 / 768×1024ともPASS。空の保存から実設定、実3問、実購入・配置、実SW制御、通信を切った起動・追加1問・再読込を確認。通常motion/ reducedを両幅で分け、保存した4件の学習creditと購入1件を保持した。実versionとsource manifestを照合。表示revision`52ec984f-pop-v5-working`はこの未コミット候補用で、新しいGit commitではない。

production最初の実行は、QA用manifestの`version`へ文字列を渡した入力形式の誤りで、UI行程の前に終了した。実`version.json`全体をmanifestへ格納して再実行した。classic専用`e2e:pwa-update`はIsland buildを拒否するため、その結果をIsland更新の合格とは扱わず、上のmode別実SW/offline検査を実施した。実2build更新、実機Safari、写真Blob全体の移行はこのUI変更の証拠に含めない。

[offline演技・報酬の記録](offline-report.json)もphoneの通常/reducedの2行程でPASS。実際のSW cacheにactorのJSと元画像が存在し、通信切断後も再読込・連問・全スタンプ・訂正/支援を実操作できた。`live-original`の実描画を確認し、静止fallbackの成功で代用していない。[本番5連続の実画面](production-phone-peak.png)、[offlineで続きへ戻った実画面](production-phone-offline-resumed.png)。

実装・ローカル検証を完了。コミット・push・公開はこの依頼では行っていない。
