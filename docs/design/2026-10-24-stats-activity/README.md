# 直近7日・30日の学習記録

## 目的と採用した案

愛着の柱を支える、本人の取り組み量の振り返り。自分からの再訪に役立つという仮説であり、児童の理解・学習効果・再訪は未実測。

[チャッピーとの相談](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7/c/6adc34da-500c-83ee-bd2e-61f0761a8c03)で配置・文言・折りたたみを具体化し、現行仕様と共通UIへ照合した。相談の根拠は文章の要約であり、最新実画面の独立評価ではない。追加相談は内部情報を除いたUI案だけを送信した。

- 既存の英語基礎と「つぎへの道」の順序・操作を保ち、その下へ期間サマリーを置く。
- 「この7日間／この30日間」（やさしい表示は「7にちかん／30にちかん」）を切り替え、回答回数・学習日数・算数/英単語の内訳と年月日を表示する。
- 朝4時の学習日境界に従う。正答・誤答・スキップを含む通常回答ログが対象。別の英語基礎イベントを合算しない。0件の日は記録不足としない。
- 今日・カレンダー・週間図は「日ごとの記録」、技能・復習・テスト等は「学びの詳しい記録」へ折りたたむ。進級の条件はそのまま。
- 共通の紙面・カード・文字・青い選択UIと48px操作を利用。320pxで長くなるかな表記だけを短縮した。
- 読込失敗は0件と区別し再読込を出す。時間は詳細で「目安」と明示する。

## 変更境界

読み取りと表示だけ。ログ・SRS・進級・所有・報酬・保存形式を変更しない。読み取り期間を14日から30日へ延長し、開始を含み終了を含めない。同じ30日ログから今日の数も計算し、朝4時ちょうどの回答を落とさない。

正本は [親仕様](../../product/01_app_spec.md) と [画面仕様06](../../product/06_screen_specs.md)。保存契約・島の規則・永続memory・ポータルの役割は変更していない。既存の別作業の未commit変更はコミット対象外。

## 検証

対象はmain基点 `68ab8a603d45aec7a52aeab31d1d045eb84bcf39` と今回だけをstageしたindexから取り出した候補。アプリ/検証コードのstage差分SHA256は `04985570c156362d2400149f4f858b9ee33b25f90812646275b5542ab4524f67`。別作業の未stage変更を含めず、`/tmp/sansu-stats-index.FUnNcR` へ取り出して検証した。Node 22.23.3（nvm未導入のため既存fnmの22を使用）、既存lockに対応する依存を利用。

ローカルDEV `http://127.0.0.1:5318/#/stats`、Island=true / NatureTown=false、delivery `snap-root-v1`、revision `development-local`、version `development-local:4d835461-710c-4df6-93f6-cdedf118170e`。共有Utilityのcandidateは該当なし。帰島先のcandidate等はreport内のdestinationへ別に記録。DEVでSW制御なし。公開版・実機・PWA更新の合格とはしない。

- [実画面一覧](screens.html)：320×568（やさしい表記/通常motion）、390×844・568×320・768×1024（標準表記/reduced motion）。音なし。年月日・回数・日数・科目内訳、48px操作、横溢れなし、キーボードでの詳細開閉を確認。
- [UI検証report](ui-report.json)：4サイズPASS。7日2回/2日、30日4回/4日となる明示fixture。朝4時ちょうどの記録、期間外、別profile、英語基礎イベントの除外、reload、読取失敗→再試行、0件、帰島の実画面を確認。表示前後のprofile・通常ログ・memory・英語基礎の保存不変を照合。自然な本人取得・子どもの行動の証拠ではない。
- 帰島の画像取得は4サイズとも初回45秒でタイムアウトし、再取得で実画像を保存。初回の失敗はreportのcaptureWarningsに保持。GPU/実機の性能合格には使わない。
- 集計・既存stats・とじる操作の対象テスト：4ファイル10件PASS。初回境界、年またぎ、うるう日、30学習日、同日/別科目、スキップ、別profile、ID重複、空を確認。
- 候補のdocs:check / check:current-ui-entry / lint / typecheck：PASS。lintは既存4警告・error 0件。作業ツリー全体のlintは別作業の `docs/design/2026-10-23-place-brush-trial/two-bay-pair-check.ts` の未使用変数でFAILであり、候補の結果と分離した。
- `verify:core` はtest段階でexit 1。全体は653ファイル・5,530件を完走し、644ファイル/5,517件PASS、9ファイル/13件が既定5秒または15秒のtimeout。同じ入力・同じ制限時間のまま `--maxWorkers=1 --minWorkers=1` で対象9ファイルを再実行し、111件すべてPASS。最初の全体runをPASSへ読み替えず、再検証と分ける。
- `npm run build` を別に実行しPASS。Island=true / native study=false / native owned=false、version `development-local:6b8ce865-89fc-4180-b123-ae72372fe448`。`assets:check` はprecache 158ファイル・8.83MiB/12MiB、探索美術27ファイル・2.97MiB/8MiBでPASS。
- src/public/tools等2,133ファイルの候補内容を、Git indexのblob SHAと直接照合して一致。今回のUI/集計への修正後、アプリ入力は変更していない。
- smoke：最初の記録テストがグラフの常時表示を待って失敗したため、詳細を開く契約へ更新。再実行では記録はPASSしたが、別の探索tablet入力で `expected=2, actual=?` を確認。最初は同ケースがPASSしており、未変更の探索コードでの不安定な結果として保持。3回目は同じ候補の `npm run e2e:smoke` が32ケースすべてPASS（exit 0）。初回と2回目のFAILは保持し、条件を分けた再確認とする。
- 既存island-navigation（390×844）は記録への到達前の `.island-welcome` 待ちでFAIL。全ナビゲーションの合格は宣言せず、上記の今回専用UI検証と区別する。

最初のcaptureでは帰島がロード中だったため、実キャンバスと描画フレームを待つようQAを修正した。共通waitReadyでは実画面が描画済みでも待機が終わらず、診断画像を保持して今回の可視canvasへ判定を限定した。DEVの冷起動15秒制限も45秒へ修正。これらをアプリの保存障害として扱っていない。詳細な初回ログはgitignoredの `output/playwright/stats-activity-*`、`/tmp/sansu-records-*.log` に分け、今回の固定入力の結果を上のreportへ保存した。

## レビューと残る確認

Sansuの差分・デザインレビューとReactのチェックリストで確認。共通SurfacePanel/InsetPanel/SegmentedControl、紙面・文字・選択色を再利用し、静的なUtility表示として統一。数量と習得を分け、0件や休みを能力評価にしない。既存の進級/設定への操作は保持。保存/出題の変更や新しい報酬は追加していない。

未確認：児童の無説明理解と再訪、利用者の実機、公開版、英語基礎の期間別集計。全島・全ナビ/PWAの合格へ読み替えない。

最終の文書検査も、アプリ検証用とは別の新規directoryへexportしたreview済みindexで実行する。作業ツリー内の無関係な生成物・ignored画像を、コミットの根拠にしない。
