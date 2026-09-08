# 初回設定の学習範囲

九九より先が選べない報告に対応。既存教材のわり算・小数・分数・割合/平均/比・速さを加え、初回とプロフィール追加の12択を共有した。通常版の固定高さからはみ出す学年/範囲は、内側の縦スクロールで選べるようにした。

[実画面](review.html) / [親仕様2.4・補遺C](../../../product/01_app_spec.md) / [画面仕様](../../../product/06_screen_specs.md)

## 学習と保存

- 従来5択の学年補正には選択範囲末尾の上限を追加。小6の九九選択で小数を初期retiredにしない。
- 追加7択は学年を理由に範囲を変えず、選んだ範囲末尾の次から開始。最終の速さはLv28を練習する。
- 既存プロフィールを再計算せず、schema/transaction/採点/SRS/学習予約の方式は維持。名前必須の追加と、名前任意の島初回の区別も保持する。

## 検証

| 検証 | 結果 | 記録 |
|---|---|---|
| 関連unit | 20テストPASS。全学年の順序、2年/6年×追加7範囲×3入口の保存・再送、範囲より先をretiredにしないこと | `src/domain/user/onboarding.test.ts` |
| 全体unit | 230ファイル・2,556テストPASS（並行作業中の検証時点） | [ログ](unit-tests.log) |
| lint/typecheck/build/assets | PASS。lintは別機能の既存warning 1件 | [lint](lint.log), [typecheck](typecheck.log), [build](build.log) |
| smoke | 31フローPASS（classic、DEV） | [ログ](smoke.log) |
| docs | 完了記録前にPASS。記録後の再確認では、別作業の `2026-09-08-pwa-update.md` にReview By/Docs To Touch未記入を検出。今回の文書のエラーなし | [PASS時のログ](docs.log) |
| 島初回・追加 | 390×844・768×1024・390×640の3旅程で学年9択/算数12択、戻る、未完了時の非作成、保存/再読込、2年のわり算、6年の分数追加、既存プロフィール/予約保持を確認 | [結果](report.json) |
| 範囲別 | 小6の九九＋追加7範囲の8ケースで、保存した開始レベル・最初の実予約3問・回答フォームを確認 | [結果](advanced-report.json) |
| 通常版 | 390×640・768×1024の2ケースで6年生と全12択へscroll/tapでき、速さまで保存できる | [結果](classic-report.json) |

13専用ケースは、native空DBから実UIでプロフィールを作成したDEV診断。開始レベルの確認を独力正解や定着の証拠にしない。原実行driverは `check.mjs.txt` / `advanced.mjs.txt` / `classic.mjs.txt` に保存した。元の配置は `output/playwright/onboarding-math-range-20260908/`。

## 対象と境界

- 島は `VITE_ISLAND_ENABLED=true`、通常版はIsland/BuildPlay無効。対象URLは各JSONに記録。初回/追加は5198、範囲別は専用5638、通常版は専用5639のDEV。
- 設定面候補: `island-touch-first-v1`。正式配信buildに対する画像監査ではない。型/buildの最初の失敗は、別作業中のIslandStage/sharedJobActor/写真/shared memoriesの型不整合であり、[原ログ](build-initial-failure.log)を保持。最終のtypecheck/buildはPASS。
- 範囲別検査の初回は共用5198が終了して接続拒否。製品画面に達していない[失敗記録](advanced-connection-failure.json)を残し、専用ポートで再実行した。
- 初回/追加検査の前後と最終記録時に、今回の4 appファイルのhash一致を確認。共有workspaceの他機能は作業中であり、このDEV記録を固定production全体や速度の受入へ転用しない。
- 公開・commit・pushは実施していない。既存のproduction用 `e2e-island-onboarding.mjs` には追加範囲と追加画面の到達性を反映したが、この監査ではその固定build版を再実行していない。

## 個別判定

- 視覚: 実画像で見出し・選択肢・縦scrollによる6年生/末尾の到達性を確認。アート変更や新しい視覚候補の採用は含まない。
- 理解/安全: 1つの到達目安を選ぶ従来の問いを維持。非懲罰的な文言を作者が確認。子どもの無説明理解と学習効果は未評価。
- Runtime: 今回の保存・開始レベル・再送・既存プロフィール分離と上表の回帰をPASS。既存データの移行なし。
