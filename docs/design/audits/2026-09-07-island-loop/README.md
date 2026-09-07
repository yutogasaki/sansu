# 不思議な島 — 入力・再確認・暮らしのつながり

ユーザーの「全体を通して、スムーズさ、楽しさ、学力向上をあっとうして」に対応する。[28仕様](../../../product/28_mystic_island_spec.md) に入力、支援後の再確認、復習の巡回、どうぶつとの自由な遊びを追記して実装した。大胆な色彩と水玉の `moon-garden` は維持する。ローカルの実装・検証を完了した。

## 対象

- before: `aa36adad7dcc-island-3d-a427ea0225cf`。[前回の3D監査](../2026-09-07-island-3d/README.md) の完成状態を保持。
- after: `aa36adad7dcc-island-loop-32cb1f0b89f8`。
- source SHA-256: `32cb1f0b89f8f586b7245b54e211b970ee56b54d75b653fc165bee2d2560a848`、577ファイル（アプリ/asset等572と設定5）。
- 実target: `http://127.0.0.1:5299/#/island`。固定artifact: `output/builds/island-loop/aa36adad7dcc-island-loop-32cb1f0b89f8`。
- world `mystic-island-procedural-v2`、learning `mystic-island-learning-v2`、delivery `mystic-island-v1`、art `moon-garden`。
- flags: Island/BuildPlay有効、Park renderer `three`、Island art `moon-garden`。
- manifest: `output/playwright/island-loop-final/build-source.json`。復元可能な入力一式とarchiveのSHAは同フォルダーの `source-archive.json` に記録。
- 旧候補cabdの証拠は `output/playwright/island-loop-cabd-evidence/`、初回fdf5は `output/playwright/island-loop-production/` に保全。旧候補の結果を32cbの最終結果へ置き換えない。

## 変更と根拠

### 操作できる最初の瞬間から入力を受ける

共通回答フォームのkeyboard購読をpaint前に反映し、同じイベント列の数字とEnterが古い入力値を参照しないようにした。筆算の連続キーも一つの入力状態へ順に反映する。Islandの既存180ms guardと、押しっぱなしの連続確定の拒否は維持する。

Studyは問題とプロフィール設定が別々に読み込まれるため、初期設定の遅延で入力形式が変わり、入力や保存待ち状態が消えるケースがあった。初期設定の取得後に回答UIを開き、最初の操作可能なpaintまでに入力形式とkeyboard購読をそろえる。設定取得に失敗した場合は既存の問題取得失敗表示へ戻す。

実Reactの境界probeでは共通入力が同じ9ケースで3/9から9/9へ改善し、二重Enter等を含む最終13/13がPASS。Studyの遅延設定は同じ16ケースで11/16から16/16へ改善し、初回paintでの入力も含む最終19/19がPASS。前後のraw記録、source SHA、対象は `output/playwright/island-smoothness/input-evidence-index.json` に記録した。これらは遅延を制御するDEV probeであり、通常productionや子どもの速度の証拠とは分ける。

### 支援した内容を、別の問題でもう一度確かめる

算数では誤答・支援・skipから元skillごとの再確認を保存する。同じ問題を訂正しても再確認は消えず、既存のbridge等を次区間の候補へ引き継ぐ。元skillの異なる内容を独力で正解すると解消し、同じ区間に自然に予約された別問題での独力正解も認める。bridgeの通過自体は解消条件にしない。問題IDだけが違う同内容や、筆算の途中段階では解消しない。区間中の実問題は予約時のまま固定し、支援やreloadで作り直さない。

次の算数区間は再確認候補を最大1つに絞り、通常Dueとの優先を区間ごとに交代する。複数の再確認候補も巡回する。未選択の再確認が通常Due側へ紛れ込む偏りを別担当のレビューで再現し、全pending skillを通常Dueと重複させないよう修正した。英語はDueを最初の問題に置く契約を保ち、前回の語の次から巡回する。支援を使った一語がDueに残り続けても、他の語の復習機会を奪わない。

追加状態は既存Islandレコードのoptional項目で、schema/table/indexの変更はない。予約・receipt・revision・writerの既存transaction内で更新し、古い保存の読込、重複確定、stale revision、writer失敗時のrollbackを検証した。focused 174テストPASS。

### 支援で考え方を短く示す

数を一つずつ対応させる、並べて比較する、前後の並びを調べる等の短い方略を、元の問題表示と組み合わせる。検証できる整数の繰上がり・繰下がりだけ具体的な分解例を出す。例えば実問題 `2 + 9` には `2 + 8 = 10`、`10 + 1 = 11` を示す。問題形式や正答との整合が取れなければ例を作らない。筆算は今の段階と入力順を明示する。

cabdの実画面検査では、十のまとまりを表示する問題で支援を開くと下段キーが画面外へ出た。32cbはヒント見出しと方略を同じ段にまとめ、支援枠の余白を詰めた。方略・実式例・正答と入力順は保持し、この表示を最終buildで検証する。

根拠にした [IESの小学校算数介入ガイド](https://ies.ed.gov/ncee/wwc/practiceguide/26) と [学習と指導の組み方](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) は、系統的な支援、具体表現との接続、例題と問題解決、間隔を空けた想起を扱う。今回のアプリへの応用は実装上の推論で、このアプリの学力向上を測定した研究ではない。

### 自分からどうぶつを誘って遊ぶ

homeの「どうぶつと あそぶ」から、置いた家具を選んでどうぶつを誘える。4区間で登場するキツネも、カワウソ・ウサギと順番に遊びに参加する。同じ座面に二体を重ねず、移動中の再タップは歩行を維持し、到着後はその遊びをもう一度始める。遊ぶ操作は学習・報酬・保存記録を増やさない。

新しく置く家具の初期候補は、合法な配置の中から住民が届く位置を少数だけ探す。既存の家具やユーザーが動かした位置を勝手に補正しない。道がふさがったときは「うごかす」をその場で使い、移動して遊び直せる。6区間後は実際に遊べる暮らしへ案内する。

実UI検証で、動かした灯りが再読み込み時のカワウソの初期位置を覆うケースを発見した。新規sceneと初登場時だけ、既定位置が障害物内なら近い安全点から始めるよう修正。安全な既定位置はそのまま、家具の保存位置も不変。空きがない場合はその住民の初登場を保留し、実際に配置を確定/収納して空間ができたら再試行する。すでに見えている住民は編集や取消のたびに再配置しない。39関連テストがPASS。道を完全に囲った全家具へ必ず歩ける契約は追加せず、再開後は届く家具で遊ぶこともできる。

## 検証履歴

以下は旧候補の実装確認または失敗診断であり、32cbの最終判定とは分ける。cabd配下の相対名は `output/playwright/island-loop-cabd-evidence/` を基準とする。

- 初回fdf5の速度計測はtablet第6反復のStudy初期表示で停止。計測中の並行作業が印刷画面のimportを追加し、まだない参照先によりViteが停止した。開始時の共通442ファイル一致だけでは終了時の一致を保証できなかった。途中の値は正式速度に採用せず、raw画像・JSON・ログを保全した。
- fdf5の572入力を隔離copyへ復元したが、当初のmanifestにPostCSS設定等がなく、a68の生成CSSからgrid等のutilityが欠落した。実44px/hit検査が幅15.64pxのキーを検出して停止。設定5ファイルも復元・記録し、生成CSSと実入力面を確認するcabdへ再buildした。a68の機能PASSは完成画面の証拠にせず、PostCSS欠落と終盤約34秒の別E2E重複があった隔離fdf5の80レーンも正式速度に採用しない。
- cabdのcoreは120 test files・1299 tests/build/assets PASS、precache 10.56MiB / 12MiB。初回fdf5の1311件には過去の出力フォルダーの18テストが重複していた。現行の同18テストを保持したうえで、初期spawnの新規6件を加えたのがcabdの1299件である。
- cabdの自由遊びは両サイズPASS・18画像。実4区間/4家具/キツネ、3住民の参加、canvas/keyboard、再演、通路復旧、全DB不変、安全な初期位置、同じ学習予約の再開を確認した。
- cabdの再確認は4シナリオPASS・24画像。両サイズで同問訂正・reload後も再確認を保持し、実bridgeを経た3区間目の異なる元skill問題を独力正解して解消した。英語はapple→orange→appleを提示し、支援した両語の正解回数と旧Dueを保持。全577入力の開始/終了hashと画像hashが一致した。これは `recovery/report.json` の実装証拠で、32cbの支援表示や利用者の学習効果を実証するものではない。
- cabdの3Dはphone/tabletの機能2/2がPASSした一方、`interaction/report.json` の全体gateは `pass=false` / `sourceStable=false`。未importの2つのQAツールが途中で変わったためで、`relevant-source-audit.json` は観測した445 build入力と実使用4ツールの一致を補足する。rawの失敗判定を成功へ書き換えていない。
- cabdのlegacy回帰は機能確認後、並行実行中の正解入力可能P95 808.9msで速度上限650msを超えて停止した。負荷の原因は分離できておらず、`legacy-parallel-timing-diagnostic/` を診断として保持する。閾値を緩めず排他実行で再確認する。
- cabdの全入力検査では、遅いcontact観測による撮影待ちと、base10問題の支援時の実レイアウト超過を別々に記録した。前者は回答前の観測へハーネスを修正し、後者は支援表示2ファイルを修正して32cbへ進んだ。旧候補の未完了検査を全入力PASSとして集計しない。

- 32cbの再確認検査の初回は、Dueのorangeとは別に通常枠のorangeを独力で正解し、正解回数が正しく18から19へ増えた。検査が対象語のすべてを支援したと仮定していた誤りで、実receipt/logからアプリの記録が正常と確認。通常枠に対象語が出た場合も実UIで支援を開くよう検査を修正し、count/旧Due/logの条件は維持した。失敗原本と修正理由は `output/playwright/island-loop-final/recovery-main-word-fixture-failure/` に保持。再実行の4ケースはPASSしたが、その回には追加通常枠が出ず、新しい条件分岐の実発火を測定したとは扱わない。

## 最終検証の状況

[最終検証の要約](evidence/verification-summary.json) と [smoke再検証](evidence/smoke-source-report.json) を最終判定の入口にする。初回の回帰要約はsmoke失敗を含むため、`regression-summary.json` の `pass=false` を書き換えず保持した。

| 検査 | 32cbの結果 |
|---|---|
| verify:core | docs/lint/typecheck・120ファイル/1299テスト・build/assets PASS |
| 学習入力 | 23シナリオ・139画像 PASS |
| 起動から次の学習 | 両サイズ・16場面 PASS |
| 再確認と復習巡回 | 4シナリオ・25画像 PASS |
| 自由遊びと再開 | 両サイズ・18画像 PASS |
| Island PWA | 4項目＋実Service Workerのoffline回答/再開 PASS |
| 通常Island / Park | 11 / 6シナリオ PASS |
| Park PWA / classic PWA | 専用flag構成の固定artifactで3 / 4項目 PASS |
| smoke | 全31ケースを1回でPASS。577入力不変、全context閉鎖 |

smoke初回28/31の原本は `smoke-first-failure/` に保持。新しい問題の見出しだけでなく保存・入力・退出の準備を待ち、数字を一度だけ入力して表示値を照合した。短い誤答反応は回答前から観測し、実receiptと光の減少も照合する。途中の診断には、通常の発見確認の保存とクリックが重なり入力だけが残ったケースがあるが、当時のclick発火状態がなく、アプリの受付不具合とは断定しない。後の単独診断と全31ケースはpointer履歴を含めてPASS。アプリの保存保護、入力、表示時間、速度閾値は変更していない。

32cbの `verify:core` はdocs/lint/typecheck・120ファイル/1299テスト・build/assetsがPASS。precacheは10.57MiB / 12MiB。全入力23シナリオ・139画像、critical path16場面、PWA4項目と実オフライン回答/再開もPASS。全577入力と実行report/captureの版の一致を `functional-source-end.json` に記録した。自由遊びは2/2・18画像、再確認は4/4・25画像でPASS。最新buildだけの48画像を [実画面レビュー](review.html) にまとめた。legacy11・Park6・Park PWA3・classic PWA4はPASS。smokeは観測を改善した再検証で31/31を通過した。shared checkoutの後続筆算/印刷改修は別タスクのbuildで検証し、この島buildの範囲と区別する。

## 正式固定10問

phone/tablet各10反復・80レーンで13ゲートすべてPASS。[測定値](evidence/throughput-latest.json)、[sourceとの照合](evidence/throughput-manifest-comparison.json)、[条件と制約](evidence/throughput-final-summary.json) を保存した。

| 画面 | 正解後の入力可能P95 | 誤答後の再入力P95 | 自動入力のIsland/Study速度比 |
|---|---:|---:|---:|
| phone 390×844 | 194.1ms | 193.6ms | 2.20 |
| tablet 768×1024 | 195.4ms | 194.8ms | 2.15 |

各画面の正解180・誤答20サンプル。650/550msの上限、44px以上の実入力、問題/receipt一致、余計な通常操作なし、空入力への移行、browser errorなしを確認した。音off・reduced motion・同じ固定10問の自動keyboard測定であり、通常plannerや子どもの解答速度・学力の測定ではない。

実測targetは隔離DEV5219、表示revisionは `development-local`。production32cbと同じ577入力を開始/終了に照合し、ベンチ内の共通447ファイルも両時点で一致した。開始・途中・終了の観測で別の自動ブラウザはなく、OSの `mediaanalysisd` が1サンプルだけ78.9% CPUだったことを条件として残した。OS全体が無負荷だったとは主張しない。旧fdf5の不適切なCSSでの値は採用していない。

## 評価の境界

視覚の魅力、無音での理解/安全、runtime integrityは、それぞれ独立したゲートとして判定した。[目視記録](evidence/visual-review.json) は最新10枚と前回完成home2枚を比較している。

| ゲート | 今回の確認と限界 |
|---|---|
| 視覚の魅力 | 作者目視では大きな色面・水玉・顔と足・庭の余白を維持。重大な視覚退行なし。子どもの好みや自発的再訪は未測定 |
| 無音での理解/安全 | 報酬選択、配置の移動/回転/確定/取消、支援中のキーを目視確認。初期ベンチが住民の後ろに一部隠れる場面があり、無説明・無文字での理解成功を実証したとは扱わない |
| Runtime integrity | 同一32cbの操作・保存・復旧と画面SHAを確認。変更範囲外の全6家具3D機能は旧cabdの機能PASSと補足監査を [継承記録](evidence/interaction-carry-forward.json) に限定して参照。旧raw全体gateはfalseのまま保持 |

自動入力で実証できるのは入力速度、正答記録の整合性、支援後の再確認と復習機会の処理までである。子どもの自発的な再遊び、理解の改善、時間を空けた定着は利用者観察が必要で、現在は未測定。実機の電池・熱・長時間利用も未評価。公開配布は今回の作業に含めない。
