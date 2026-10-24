# 「まなぶ」のレベルアップ案内

2026-10-24。利用者の「学習にもレベルアップを促す表示が出るはず」という指摘と、チャーピーへの相談・具体化・実装依頼への対応。愛着と学習の継続を支える入口の復旧で、島の柱・出題・進級資格・採点・保存の規則は変更しない。公開はこの作業の対象外。

## 相談と採用判断

[ぽこもこプロジェクト内の相談](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7-hokomoko/c/6adc34da-500c-83ee-bd2e-61f0761a8c03)へ、現行仕様と最新コードの要約を送り、配置・寸法・状態・戻り先を2往復で具体化した。画像は送っておらず、実画面の独立監査ではない。利用者の相談依頼に基づき `consult-chatgpt`（個人スキル） を使用した。

- 問題面の直上、相棒の指示の下に置く。吹き出し内は指示と競合し、ヒント下は小画面で見落とすため採用しない。強制モーダルも増やさない。
- 案内用に1行を積み増さず、既存の返事領域を固定44pxへそろえて共用する。小画面・短い横画面も44px。案内と返事を重ねず、入力開始後は返事を優先する。
- 文言は提案された「チャレンジ」へ変更せず、記録と同じ「LvNへ ちょうせん →」を採用。全問独力の進級条件は既存確認画面に残す。
- 予約の未入力の1問目・現在科目の資格readyだけに1件表示。両科目readyでも現在科目だけ。入力・支援・スキップ・案内選択後はその予約中の表示を終える。途中再開、保存済み誤答訂正・支援・筆算途中では出さない。未回答先頭の再読込では再表示してよい。
- 読取中に入力・本人・科目・予約・プロフィールが変わった場合は古い結果を破棄。資格読取失敗では案内を出さず、通常学習を止めない。保存中は案内を押せない。
- タップで既存の科目別確認へ進む。戻る／「れんしゅうを つづける」で元の通常学習へ復帰し、案内を繰り返さない。

正本は[親仕様01](../../product/01_app_spec.md)、[画面仕様06](../../product/06_screen_specs.md#2026-10-03-学習と保護者の動線を統一)、配置は[表示仕様44](../../product/44_display_layout_spec.md#学習と退出)。新しい保存形式や長期判断はなく、ADR・memoryの追加は不要。

## 実装

`LearningProgressCue` を `IslandLearningPanel` の共通ヘッダーへ接続した。未使用だった静的な教科・復習説明は表示仕様44に従って復活させず、挑戦入口だけを担当させる。既存 `readLearningProgress` と `finishEntryPath` を使用する。本人の学習イベント・SRS・進級判定には書き込まない。

`Learn` の練習継続は、学習から来た場合だけ既存のnavigation履歴を戻り、元の予約へ戻す。記録や直リンクから来た場合の既存の練習入口は維持する。問題フォームを再マウントせずに案内を消し、固定領域で返事へ切り替える。

[スマホ390×844](phone.png) / [小画面320×568の筆算](compact-written.png) / [短い横画面844×390](landscape.png) / [実20問クリア](clear.png)

## 検証対象と結果

2026-10-24 JST。共有作業ツリーから作ったローカル本番形式buildを `/tmp/sansu-level-cue-preview/dist` へ固定して `http://127.0.0.1:5214` で検証。公開版の検証ではない。build versionは `development-local:b0be46ad-6ca9-464c-9712-f68a670e1820`。Island有効、NatureTown無効、configured delivery `snap-root-v1`、Island candidate `mystic-island-shore-garden-v18`、learning candidate `pokomoko-pop-live-v8`。SWは許可し、captureごとに制御状態を記録した。2 build更新やoffline検証の代用にはしない。

実行開始時HEADは `20245fbdca0327aff0768b2f85ce6132785f2eb5`。検証中に別作業のcommitでHEADは進んだが、対象5ファイルの開始/終了SHA-256一致を検査した。[runtime記録](runtime-report.json)と[20問記録](finish-report.json)に日時・入力hash・実target・期待/実結果を保持する。実データは使用せず、資格は隔離したnativeプロフィールと純粋な教材生成器由来の独力証拠fixtureで用意した。

| 確認 | 結果 |
| --- | --- |
| `npm ci` | PASS。nvm未導入のためfnmでNode22.23.3を選んで実行 |
| `npm run docs:check` | PASS（既存の期限超過警告あり） |
| `npm run lint` | PASS、既存prototypeの警告5件。初回は別作業のportal再生成中にENOENT、再実行で解消 |
| `npm run typecheck` | PASS、Node22 |
| 追加5件＋既存FinishChallenge6件 | PASS、Node22 |
| `npm run test:run` | PARTIAL。662/663ファイル・5582/5583件PASS。無変更の `authoredCoreGrowthIntegration.test.ts` 1件が設定30秒を超えて11分以上同期CPU処理を継続したため、そのworkerを明示停止。全体PASSとはしない。追加5件は別途Node22でPASS |
| `npm run build` / `assets:check` | PASS。precache 8.90MiB / 12MiB |
| `check:current-ui-entry` | PASS |
| 専用E2E 9ケース | PASS、Node22、本番形式、通常4幅＋小画面/短横の筆算、英単語、両科目、読取失敗 |
| 専用E2E 実20問 | PASS、Node22。案内→確認→20問→クリア。通常予約・ログ・SRS・島状態/報酬を保持 |
| `npm run e2e:smoke` | 旧Exploreの1件で応答551msが550ms基準を1ms超過。他はPASS。該当phone/tabletのみ再実行してPASS（誤答429/528ms、正答132/131ms） |
| `e2e-island-learning` phone-hissan | 既存harnessが旧candidate `mystic-island-learning-v2` を期待して停止。現行candidateでの筆算は専用E2Eで確認 |
| `agent:index:check` / `portal:verify` | PARTIAL。別作業と共有の生成index staleとportal integration hash不一致。今回の変更外を再生成しない |

全体unit実行は12分44秒で終了。停止後の `Worker exited unexpectedly` は上記の明示停止に由来し、自然なアプリ例外とは区別する。初回smokeは `/tmp/sansu-level-cue-smoke.log`、対象再実行は `/tmp/sansu-level-cue-smoke-retry.log`、unit全体は `/tmp/sansu-level-cue-tests.log` に保存。全体unit実行は既存シェルのNode24.18.0、今回の追加・対象テストと本番形式E2Eはプロジェクト指定のNode22で実行した。全体smokeはclassicの回帰であり、現行Islandの専用E2Eと区別する。通常ページの入力・ヒント・テンキー位置、案内前後の座標一致、44px操作領域、確認の往復と同予約の不変をassertした。

実装者による画面確認では、新しい装飾・連続アニメーション・点数・催促文を追加せず、共有の青とフォーカス表示を使う。相棒・指示・教科予約・全入力を保持した。Reactレビューではeffectの取消、古い結果の遮断、独立readの並列化、入力経路にDBを追加しないこと、buttonのtype/disabled/accessible name、既存フォームのkey維持を確認した。

未確認：実機iOS/Android、文字拡大時の独立観察、子どもが案内に気づくか・理解するか・再訪するか、公開版・実更新。技術PASSを子どもの理解や再訪の合格とはしない。学習の任意性は維持するが、青い案内に気づけるかは利用観察が必要。

## 再実行

```sh
SANSU_LEVEL_CUE_URL=http://127.0.0.1:5214 SANSU_LEVEL_CUE_OUTPUT=output/playwright/level-up-cue-new fnm exec --using 22 node tools/e2e-learning-level-cue.mjs
```

記録済みの本番形式9ケースと、追加した `SANSU_LEVEL_CUE_EXTRA_ONLY=1 SANSU_LEVEL_CUE_MODE=finish-test` の1ケースを合わせて10ケースの対象分岐を実行した。最終CLIの既定では10ケースをまとめて実行する。
