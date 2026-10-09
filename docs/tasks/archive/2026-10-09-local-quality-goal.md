# 育つ島の一周を磨き、検証済みの一つの版へ仕上げる

更新: 2026-10-09。状態: ローカル候補の実装・検証を完了。公開・実機・参加者評価は含めない。

- Review By: 2026-10-16

## ゴールと境界

こちらで設計・実装・検証できる範囲で、遊び・学習・見た目・安定性を磨き、完成度の高い一つの版へ仕上げる。子ども・保護者の参加や物理端末の利用を完了条件にしない。楽しさ、無説明理解、再訪、学習効果、実機性能は未評価のまま明記する。これは憲法の製品としての合格基準を置き換えず、今回の作業範囲の完了を定義する。

正本は憲法・親仕様01・Growing仕様52・導きと記念・43/44・学習仕様02/03/29/31/34・保存仕様13。既存の作業差分を取り消さず、未コミットのホームUI、初回案内、触って遊ぶ反応、描画cacheを統合対象にする。公開・実利用者の保存操作は含めない。

## 完了監査

| 要求 | 必要な証拠 | 現在 |
|---|---|---|
| 初回→島遊び→学習→帰島→成長→次の遊び | 固定版の実UI旅程。案内・取消・再開・次の行き先の整合 | v3の実初回・guidance両幅PASS |
| 配置と反応、無料の試し直し | 初期/成長途中/混雑の同じ合成保存で実操作・所有と時間の保持 | 実獲得/配置PASS。同じ合成3状態の前後36ケースで操作・取消・保存不変を照合 |
| 学習の正しさと手触り | 全unit、通常入力/誤答/支援/連打/中断/再開/本人切替の関連旅程、入力速度 | v3でcore4,803・smoke32・小数12・学習6条件・本人切替・80runの入力速度PASS |
| 島/家/本/メニュー/学習の見た目 | 版・flag・candidate付きの実画面と主要経路の接触シート。比較基準と作者レビュー | v3の両幅20画面と独立した作者レビュー。Study重なり・初回見出しの可読性を改善。利用者評価は別 |
| 起動・入室・混雑時の負荷 | 同じ保存・環境の改善前後計測。性能計測は他のbuild/ブラウザ検査と重ねない | 主36ケースと混雑rAF追加6回を記録。配置→2rAFは6条件で約5〜17%短縮。起動/入室/定常の全指標改善は認定せず、同期に重なる待ちは後続へ |
| 保存と更新 | 移行/通信切断/更新中断/保存失敗と再試行/安全な復旧。学習・所有・住人・土地の保持 | v3で実旧writerと更新4ケース、保存失敗/再試行両幅PASS |
| 一つの検証済み候補 | 必要checks、固定入力archive/hash、画面、既知の制約・復旧手順、重大な未解決不具合なし | v3固定・必要checks・32画面の主要/同保存比較・source/dist archiveの展開照合・制約と復旧手順を記録 |

## 実行

1. 現行差分を確認し、隔離したbaselineを検証する。
2. 初回案内・描画資源・検証範囲を並行で点検し、再現できる問題を修正する。
3. 一周のUI、初期/成長途中/混雑状態、学習/保存/更新を固定候補で確認する。
4. 現行Growingで性能を計測し、主な遅延を改善して同条件で再計測する。
5. 見た目と操作を実画面で監査し、最終入力へ必要checksを実行してこの表を証拠で閉じる。

## 最終結果

固定候補は `7e9a6c7a-quality-final-v3-55d331f22e94`。core4,803/classic32、全主要旅程、実SW更新4ケース、入力速度80run、主要20画面と同保存12画面を確認した。[統合した証拠・実測表・既知の制約](../../design/2026-10-09-local-quality/README.md)を正本とする。

性能改善の確かな範囲は描画資源の寿命・重複再構築の削減と配置後の2rAF応答。混雑390の操作可能待ち、起動/入室/定常描画の混在は未解消として[性能タスク](../active/2026-09-23-island-performance.md)へ残す。測定成立、作者の視覚確認、機能の検査、利用者の評価を混同せず、一つの検証済みローカル候補として閉じる。未コミットの既存変更を保持し、commit/push/公開は行っていない。

## 証拠と進捗（当時の経緯）

- 開始HEAD: `7e9a6c7a`。初回の作業差分とbuild入力は `output/goal-quality-20261009/baseline/` に固定する。過去のPASSを現在の差分全体へ転用しない。
- baselineの検査を開始。レビューは初回旅程、性能、検証の対応関係に分ける。
- baselineはcoreの541 files / 4,782 tests、docs/lint/typecheck/build/assetsがPASS。classic server起動はsandboxのlisten EPERMで停止したためアプリFAILとは扱わず、原ログを保持。許可された別診断のRoot Tangle限定5サイズはPASS。全smokeの代替ではない。
- 初回案内を修正：贈り物/自然混色を本人の初購入と混同しない。収納済みベンチに別の花を案内せず、無料の選択肢は実在する対象と空き場所に合わせる。S5の「たねを見る」は未完成または未開封の現物へ寄る。既に開いた旧建物を待機中としない。対象guide/domain/repository33件と追加修正後book11件がPASS。
- actor/portrait/menu miniatureの固有geometry・sparkle材質を解放し、共有材質を保持。20回の同じsyncで未解放geometryは309→43（表示中の3actorぶん一定）、最終退出後309→0。実GPU/FPS測定ではない。`output/goal-quality-20261009/actor-lifecycle/`に修正前後の同じfixture/hashと回帰ログを保持。
- worldSceneの非表示rigの所有と家の共有DFG cache登録も修正。worldScene/cacheの対象4件、actor/play16件、menu6件がPASS。共有typecheck PASS。
- 最新UIに合わせて本番Growing、家、本人切替の検証入口を更新。実保存の主張は実行結果が揃ってから記録する。
- `integrated-v1` はこの新taskの必須見出し不足でdocs FAIL、アプリ/ブラウザは未実行。文書を修正してdocs PASS。
- `integrated-v2`はcoreの542 files / 4,794 tests、docs/lint/typecheck/build/assets PASS。classic smokeはRoot Tangleの2誤答後の専用文言待ちでFAIL。仕様11では非対応の再提示は通常の問題へ戻ることを許容しており、以前の同種失敗のnative保存でsymbolへのrepresentation retryを確認。smokeを正本に沿って両分岐の保存/描画を検証する形へ修正し、1誤答後のRoot固有観察を必達ケースとして追加。v2の直接診断は未取得で、失敗結果は保持する。以後runnerが失敗時のnative/画面を保存する。
- `after-v1`（`7e9a6c7a-quality-after-v1-35cb0c06fc8c`）を保存。`journeys-v1`の本番形式guidance/balance/singleは両幅PASS：実初回・実回答・購入・本・帰島・旧URL・同予約・実SW offline/reloadを確認。本人切替は設定経由が通過後、ホームの切替dialogが開かずFAILし調査中。学習詳細は実行中。
- `journeys-v1`のpartyはphone/tablet/横画面×通常/reducedの6条件PASS。通常の実出題、30回答、訂正、支援、中断・再開、実SW offlineを確認。追加decimal検査は11/12 PASS、Study 390幅のスキップが解答欄へ重なる失敗を保存し、独立した行に修正した。
- `failure-v1`は両幅PASS。実初回と20回答からの有料farm購入をIDBで一度abortし、残高/所有/学習不変、同じ配置から一度だけ再購入、reload保持を確認。本人切替もabort/retry/本人別保存/復帰を確認。エラーの実フレーム提示もPASS。
- `profiletrace-v1`は同じ本人切替FAILを再現し、押下直前に裏側の同期保存がtriggerをdisabledにして、pointerdown/upでもclickが発火しなかったことを記録。名前一覧を開く読み取り操作は常時可能にし、本人変更のdisabled/同時操作防止/PWA保護は保持する。関連37回帰とtypecheck PASS、修正後の本番旅程は次の候補で確認する。
- 起動時の同一入力による二重rebuildと非表示の試作住人生成を除去。配置・選択・ヒントだけの変更は既存の建物/住人/船を保持してpreview資源だけを更新する。保存state変更時は従来の全再構築を行う。
- 性能の暫定`performance-before-v1/v2`は正式比較から除外。Playwrightの固定時計がperformance/rAFも差し替えることを確認し、v2を中断した。元reportと除外理由を保持し、Dateだけ固定する計測へ直して両候補を再実行する。暫定値を改善率へ流用しない。
- 固定候補`final-v1`（revision `7e9a6c7a-quality-final-v1-840a97d1c528`、sourceHash `840a97d1c52877c4fa8ef67c892cdfef19cab05de6cab689d5f9d7c8c34eb461`）でcoreの544 files / 4,800 testsとclassic smoke32経路PASS。coreにはdocs/lint/typecheck/build/assetsを含む。既存のdocs期限警告とIslandMilestone fast-refresh警告は残る。
- `final-journeys-v1`の本人切替・guidance・balance・singleは両幅PASS。Study390の小数入力も重なり修正後PASS。decimal全体は11/12 PASSで、island768 written-retryが15回の抽選中に2桁回答を引けず3桁を検査してFAIL。原結果を保持し、通常plannerと実問題を維持した採用条件・上限・抽選履歴のQA修正を同じ固定アプリへ別overlayとして適用する。アプリの再修正や問題差し替えはしない。
- `final-focused-v1`で小数/筆算12ケースと実初回設定の10画面PASS。`final-journeys-v1`のparty6条件・保存故障2幅もPASS。`update-final-v1`は実旧writer診断と旧→候補→対応writerの通常/通信切断4ケースPASS。
- `throughput-final-v1`は固定10問×80run、eligible=true、全gate PASS。正解から次問操作可能までのP95はphone202.7ms/tablet202.0ms、同じ問題への誤答再入力は202.6/201.4ms、6問境界は201.3/202.0ms。DEV固定問題・自動キーボード操作の測定で、人の解答速度や通常plannerの真正性を示すものではない。
- 初回設定の補助見出しが暗い模様へ沈むことを追加の実画面レビューで発見。44を先に更新し、既存paper/ink色の面を見出しだけへ追加。アプリ差分は`IslandOnboarding.css`の1ルールに限定。`final-v2`（`7e9a6c7a-quality-final-v2-9b4ae574bf02`）のcore544 files / 4,800 testsとbuild PASS。新しい初回画面/主要旅程/実SW更新/性能を同候補で検証する。v1の変更に関係しない経路はアプリ入力の一致と限定差分を照合して結果を適用し、v2で再実行したとは表記しない。
- `performance-native-v1`はこのCSS変更を検出する事前照合で停止し、browser/時間計測は未実行。新しい固定候補で`performance-native-v2`を実行する。
- v2のclassic32・guidance両幅・小数/筆算12・初回10画面・旧writer/実SW更新4もPASS。初回設定見出しは両幅3段階で不透明な紙面色と11.70:1のコントラストを確認。[最終候補の実画面と検証範囲](../../design/2026-10-09-local-quality/README.md)へ集約する。v1からの1,529入力の差分は初回見出しCSS1ルールのみで、変更のない経路の結果適用に限定する。

## 残す評価の境界

v2のnative性能計測は、変更前18ケースを全て完了・保存/版/入力不変を照合した後、最終候補の入室遅延増加を調査して中断した。資源観測が`onBeforeCompile`をwrapperへ変えると、Threeの既定`customProgramCacheKey`も変わり、家の観測対象の壁と未観測の壁の同じshaderが別programへ分かれる不備を確認。wrapperの`toString`を元hookへ透過させる最小修正を追加した。新規3回帰は修正前FAIL、修正後は既存を含む6件PASS。遅延の何msがこの不備に由来するかは断定しない。

変更前の18件は完了時の整合性検査まで通っており、有効な比較基準として保持する。v2の中断した候補側は診断結果に限定。v3で同じ計測コード・同じ準備済み保存・同条件を使い、core/全主要旅程/更新/入力速度/候補側18ケースを確認した。混雑rAFの限定6回も別に記録した。旧clock方式の無効計測とは区別する。証拠: `performance-native-v2/report.json` と `performance-baseline-reuse.json`。

視覚の作者レビュー、操作/保存の技術検査、利用者による理解/安全は分ける。localhostの本番形式検証を公開済みとは記録しない。エミュレーションを実iPhone/iPadの性能や写真/音の合格へ広げない。

## Docs To Touch

- この実行詳細、最新候補の統合タスク、完了記録、必要な検証記録。
- 操作の変更は導きと記念の仕様へ先に反映。リソース寿命の修正は内部不具合修正で、保存/学習/美術仕様の変更は不要。

## Verification

- `npm run verify:growing`、対象回帰、本人切替・旧URL/家の本番形式旅程。
- 同じ保存の主要画面と性能の比較、Growing実SW更新/中断復旧/旧writer診断。
- 差分と[検証マトリクス](../../ai/verification_matrix.md)を照合し、上の完了監査で不足する学習・保存失敗の旅程を追加する。

描画量の追加診断6回も保持する。観測されたgeometry保持の減少・安定化と描画量の継続は、元の遅い回の原因特定や速度全般の合格を意味しない。
