# X3後の既存導線・入力回帰検証

アプリsourceは `74514aaad4483288a65ec4e85e8c576a832fcf64d813fad4e2762c37fea6bfec`、app commitは `4e250d5`。今回の修正はE2Eの誤答入力だけで、アプリの入力/判定/保存/世界のコードは変更していない。[出所とhash](provenance.json)。

| 検査 | 結果 | 対象 |
| --- | --- | --- |
| `npm run e2e:smoke` | 31/31 PASS | 4173のDEV、harnessが指定するclassic-v1。旧Root Tangleの全tablet幅も今回はPASS。[report](smoke-report.json)、[log](smoke-output.txt) |
| `npm run e2e:pwa-update` | 4/4 PASS | 4273のproduction preview。Island/BuildPlayが無効の既存導線。初回、保護中の復旧、同じ問題、実SW制御下の版ずれ。[log](pwa-update-output.txt)、[実build](classic-build-version.json) |
| 旧島E2E初回 | FAIL / 部分PASS | 5198、Island有効/Life・Life preview・BuildPlay無効。両幅の全4地区成熟/発見/3D履歴/再演、WebGL故障→学習→再試行、初回設定、phone keyboard/touchはPASS。tablet分数の誤答で停止。[report](legacy-first-report.json) |
| 修正後のtablet分数限定 | PASS | 誤答を最後まで入力し、通常の保存/再試行の確認へ進めた。[report](fraction-focused-report.json)。限定検査を全E2E完走とはしない |
| 修正後の旧島E2E全体 | 11/11 PASS | 同じapp sourceで全シナリオを最初から再実行。両幅とも46回の実UI学習区間で全4地区成熟、故障復帰、通常連問、分数、筆算、選択式、英語、reduced motionを確認。[report](legacy-final-report.json)、[log](legacy-final-output.txt)、[分数の区間完了](fraction-completed-growth.png) |
| `npm run e2e:island-pwa` | PASS | 5298の旧島有効/Life無効production preview。8つの更新保護hook検査と、実SWのオフライン再読込/回答保存/自動成長/同じ予約の再開。[report](legacy-pwa-report.json)、[実build](legacy-build-version.json)、[offline復帰](legacy-offline-resume.png)。実two-build更新、全DB store、写真Blob、実機iOSの証拠とはしない |

## 最初の失敗と修正

[失敗画面](fraction-incomplete-input.png) は `4/11 + 5/11` に対して `8/9□` までしか入力していない。分母2桁の枠が未完成のままなので、自動確定しないのが正しい。従来のhelperは誤答時に全フィールドを一律1桁の8または9へ置換していた。

helperを、先頭の数値の最後の1桁だけ変え、桁数/小数点/残りの分母や筆算欄を保つ方法へ修正した。アプリの入力完了条件を緩めず、回答欄を完成させた上で誤答にする。分母11/13、2桁の分子、小数、筆算の複数欄を含む3件の単体検査とeslintがPASS。その後、全シナリオを省略せず再実行してPASS。初回の不完全入力の失敗は残し、最終結果と混ぜない。正答/誤答の待ち時間は通常plannerの少数診断であり、10反復のfixed-ten比較へ代用しない。

coreの402 files /3928 testsは同じapp sourceで前のX3実装時に通っている。今回のhelper用3 testsは追加の対象検査として区別する。全体smokeと既存PWAの結果を、Lifeの新しい全機能/PWA/自然初回/C3視覚/Human Nの合格へ置き換えない。C3はHOLD、Human N=0、全体releaseは未完。
