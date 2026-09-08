# 筆算の入力・訂正

- 採用仕様: [親仕様01](../../../product/01_app_spec.md#43-回答方式ui切替)、[教材02](../../../product/02_math_skills.md#自動採点と確定キー)、[多桁筆算06](../../../product/06_screen_specs.md#多桁の筆算)
- [実画面一覧](review.html)、[入力検証の全記録](input-report.json)、[build識別](build-identity.json)、[固定10問の検証結果](throughput-summary.json)

## 変更

数字入力で桁・段が自動で進む既存の筆算を維持し、誤答後は本人が正しく入れた数字を残す。間違えたマスだけ空けて順番に入力する。戻すは直前に入力したマスへ戻り、飛ばした正しいマスを消さない。

筆算時の画面上の左右キーと自動確定用Enterを空き領域へ置き換え、数字の位置を維持する。保存失敗時は下書きを保持して同じ位置の決定から再送できる。Studyの誤答後800ms待機と全消去、Islandの途中段180ms待機を除去。Parkは保存receiptをliveQueryより先に採用し、ヒント表示中もテンキーを固定する。横向きタブレットでは問題を左、入力と支援を右へ置く。

採点・支援・SRS・予約Problem・保存schemaは変更していない。部分訂正は表示中の下書きであり、再読込後は従来どおり保存済みの確定段から再開する。

## 対象と証拠

- 最終画面: `463508f-written-input-b71394fedf`、島 `http://127.0.0.1:5630`、Park `http://127.0.0.1:5631`。配布flagと各buildの一意versionはbuild識別JSONに保存。
- 島の候補: `mystic-island-living-v5` / 学習 `mystic-island-learning-v2`。絵や3D造形はこの変更の対象外。
- 本人データに触れない独立したnative IndexedDBプロフィールfixture。実planner・入力・保存を使う。保存abortは明示的な診断。
- Chromium、390×844と1024×768、音off・reduced motion。マスが祖先のスクロール領域に隠れず、中心でhitすることを検査。
- 品質チェック、共通の入力回帰24ケース、PWAと通常回帰は直前の `463508f-written-input-68f6b1cf7b`。最終版との差はParkの横向き配置CSSのみ。全TypeScript・採点・入力コードは一致し、最終の6ケースでその配置と実入力を再検証した。

## 検証

| 検査 | 結果 |
|---|---|
| docs:check / lint / typecheck | PASS。既存のIslandMilestone Fast Refresh警告1件 |
| Vitest | 239ファイル・2,632件PASS |
| classic / Island / Park build | PASS。classic assets:checkもPASS |
| 部分訂正の実UI | 3画面×2viewportの6ケースPASS。離れた2マス、Backspace、支援中の下書き、保存失敗/再送、35ms間隔の段をまたぐ物理入力、固定キーと入力マスのhitを確認 |
| 既存の自動入力・手動確定 | 24ケースPASS。単桁の誤答・再送、旧筆算、掛け算、割り算、小数、分数、端末の確定案内、Studyを含む |
| classic PWA | 4ケースPASS |
| Island PWA | 8保護フローと実service workerのoffline reload・回答・再開PASS |
| Park PWA / 通常回帰 | 3ケース / 6シナリオPASS |
| smoke | 広域実行のtablet root-tangleで一度timeout。該当5viewportを再実行して全PASS。その他の広域シナリオは初回PASS |
| 固定10問 | phone/tablet各10反復、Study/Island・全正解/誤答の80 run、15 gateすべてPASS/eligible。正解→入力P95 193.8/194.1ms、誤答→再入力194.2/193.7ms、区間境界193.9/196.0ms。追加操作0 |

固定10問は最終sourceと同じ `463508f-written-input-b71394fedf` を単独のdev serverで測定した。実行中のsource不変、単一の描画build/candidate、実保存receiptを確認。自動keyboardのUI待ち時間の測定であり、子どもの計算速度・学習効果や実plannerの出題品質を実証するものではない。生reportは `output/playwright/written-throughput-checked-02/report.json` に保持し、SHAと実行環境を上記summaryへ保存した。

## 別判定

- 見た目: 実画面の作者レビューでは、現在マス・残した数字・入力順を読み取れ、キー位置を保つ。Park横向きで発見した入力欄の隠れを左右配置で修正して再検証した。
- 無音での理解・安全: 色だけでなく空欄・カーソル・短い訂正文を使い、入力を待たせる誤答演出をなくした。作者レビューであり、未説明の子どもの理解・学習効果・再訪意欲は認定しない。
- Runtime: 今回の筆算・訂正・保存経路はPASS。アプリ全体の公開判定には広域Islandテストの下記制約が残る。

## 制約・初回の失敗

- 初回の全体チェックには、別作業中の写真hook/住民の仕事テストとconst警告が含まれた。後の固定コピーで全2,632件とlintが通った。旧失敗を成功記録として扱わない。
- `e2e:island` の全体実行は、学習中に非表示の3D舞台内の成長通知・WebGL復旧ボタンをvisibleで待つ既存検査で停止した。今回、これらの通知や3D復旧動作を変更していない。全体E2Eの完走は主張しない。
- 汎用readyヘルパーと自動入力回帰は、学習中は実入力面を、ホームでは3D canvasを待つように更新。これにより非表示canvasを待っていた再開・速度検査を実際の画面状態へ合わせた。
- 初回の筆算検査は、掛ける数の一の位が0になる実問題で「最初の段は3桁以上」というfixture前提が不成立だった。短い段を普通に解いてから、3桁以上の段で部分訂正を検査する形へ修正した。
- ローカル実装と固定buildの検証。公開・commit・pushは実施していない。
