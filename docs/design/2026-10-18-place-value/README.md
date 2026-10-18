# 100・10・1の量を表す教材への修正

2026-10-18。対象は `foundation_expanded` の新規生成、旧予約の表示、通常学習のヒントと縦画面。共有dirty treeのHEADは `eb4b907bdf5cb6e99c30c4ac6f28d2d3969cac50`。対象入力のSHA256と採取時刻は [source.json](source.json)。公開・commit・pushは行っていない。

## 変更と学習上の意図

「1こが100／1こが10／1こが1」という色・記号の約束を撤去。同じ単位マスから100の板・10の棒・1のマスを描く。各選択図の縮尺もそろえる。問いを短くし、図→数、0を含む数→図、棒10本を板1枚に交換する問題を既存introの3段階へ接続した。正解位置は固定しない。十・一の位は0〜9を含む。

旧予約は既知ラベルと正常な個数を確認した場合だけ、表示上で同量の板・棒・マスへ変換する。保存された問題、答え、文脈、ID、進度、独力判定、SRSを変更しない。新形式の正解を全形式の習得認定にしない。[教材の正本](../../product/learning-content-integrity.md)に挙動を反映した。保存形式・ルート・PWA更新処理を変えないため、ADR・memory・runbookの追加は不要。

学習を短く読みやすくし、島へ戻る流れと愛着を支える仮説。子どもの理解・楽しさ・再訪は未観察（N=0）。

## 実画面

- [390×844 通常](390-actual.png) / [ヒント](390-actual-hint.png)
- [768×1024 通常](768-actual.png) / [ヒント・reduced motion](768-actual-hint.png)
- [数→図の3択](390-1.png)：これは実コンポーネントを固定問題で表示した診断。通常plannerの自然出題の証拠とは区別する。

実アプリは `http://127.0.0.1:5239/#/island` のDEV、Island=true / NatureTown=false、delivery=`snap-root-v1`、learning candidate=`pokomoko-pop-live-v8`。版・root flag・viewportは [flow-report.json](flow-report.json) に保存。SW制御なしのDEVであり、配布・offline更新の検証ではない。

隔離プロフィールで対象教材をDueにした後、実planner・予約・UI・保存を使用。両幅で再読込前後の問題の完全一致、ヒント後のassisted保持と正解完了、回答によるrevisionの1回だけの増加を確認。図のscrollHeight/clientHeightはphone=135/135、tablet=188/188で全量が見える。音off、tablet reduced motion。固定部品診断は新3形式、旧予約、ヒントを両幅で表示し、はみ出しと数字・選択入力を確認した。[部品診断](ui-report.json)。

初回の実画面で、従来の相棒領域とヒントが図を押し縮めることを発見。phoneで135pxの領域に142px、tabletで100pxの領域に218pxの内容があり、見切れを再現した。縦画面でこの教材だけ相棒と図の高さを調整し、全数字キーの位置と44px以上の操作を保持した。最終画面は上記リンク。部品だけの確認では不十分だった。

## 検証

2026-10-18 11:05〜11:30頃 JST。Node 24.18.0、既存依存を使用。nvmは未導入。共有環境の依存を削除しないため `npm ci` は行っていない。

| コマンド・確認 | 期待と実結果 |
|---|---|
| `npm run lint` | エラー0でPASS。既存Fast Refresh警告3件。変更ファイルの最終eslintもPASS |
| `npm run typecheck` | PASS。追加テストのProblem型を修正後に再確認。最終buildでも型検査PASS |
| `npx vitest run src/domain/math src/hooks/blockGenerators.test.ts src/hooks/blockGenerators.progression.test.ts src/hooks/useStudySession.logic.test.ts src/domain/test/trigger.test.ts src/domain/algorithms/srs.test.ts src/components/island/IslandAnswerForm.test.tsx --maxWorkers=2 --minWorkers=1 --testTimeout=30000` | 33 files / 583 tests PASS。量と答え、0〜9、一意な3択、交換、旧予約不変、幾何、印刷、学習/SRSを確認 |
| 時間切れの8ファイルの再検査（maxWorkers=2、testTimeout/hookTimeout=30000） | 8 files / 120 tests PASS。island、expressionRepository、experienceRepository、photosRepository、learningObservationCommit、user/repository、learningContinuity、learningProgression.integration |
| `npm run build` | 最終CSSを含むbuildとassets:check PASS。precache 143 files / 8.52MiB。既存chunk size警告あり |
| `npm run check:current-ui-entry` | PASS |
| `npm run docs:check` | PASS（期限を過ぎた既存タスクの警告あり） |
| 実ブラウザーの確認 | 上記2幅の表示・再開・支援・回答保存PASS。検証コードは `output/place-value/check-flow.mjs` と `check-ui.mjs`（gitignored） |

`npm run test:run` は全体を実行したが、複数の既存検証との競合下で17分以上かかり完走せず、本作業のparentと子プロセスだけ終了した。初回8ファイルの14件は5秒/15秒の時間切れで、同じ8ファイルを低並列で再検査し120件PASS。全体suiteのPASSとはしない。実行時のログ出力先は `/tmp/sansu-place-tests.log`、`/tmp/sansu-place-focused-final.log`、`/tmp/sansu-place-timeouts-recheck.log`。会話中断後の再開時には一時ログが消失していたため、現在取得可能な原ログとしては扱わない。上記結果は実行時のツール出力から記録した。再開後に対象入力SHAの一致、保存済み両幅のflow結果、diff check、docs:checkのPASSを再確認した。

`npm run agent:index:check` は生成入口4件のstaleでFAIL。`npm run portal:verify` は既存 `docs/tasks/active/2026-09-27-living-fantasy-first-playable.md` のflow証拠不一致でFAIL。これは本作業の新規証拠追加前にも確認しており、他の仕事の生成物をまとめて書き換えていない。

未確認は全体suiteの完走、実iPhone/Android、PWA更新・旧版rollback、子どもの理解・再訪、公開反映。今回の自動検査をこれらの合格へ読み替えない。
