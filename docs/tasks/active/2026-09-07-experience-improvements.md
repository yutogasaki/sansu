# Experience improvements

- Date: 2026-09-07
- Owner: Codex
- Status: Active
- Review By: 2026-09-14

## Goal

ユーザーの「セッションで見えてきた課題を解決していって欲しい」を継続実行する。根拠は [体験評価](../../design/audits/2026-09-07-experience-review/README.md)。小さな表示修正だけを全課題の完了としない。

## Scope and completion evidence

- [x] 配置previewが住民の背後に隠れる問題: 6家具のpreview、回転/取消をphone/tabletで実見。保存/衝突契約保持。
- [x] 遊び画面で学習復帰が主操作になる問題: 家具選択を主役にし、再学習導線も利用可能。
- [x] 自由遊びから再学習すると住民が切れる問題: 住民移動後/着座/東土地を含む画面で頭・耳・足を確認。
- [x] ホーム/学習の説明重複、見本/回答の図形二重提示: 意味を保って整理し、実画面と全入力で確認。
- [ ] 6区間以降の成長・再遊びの薄さ: 既存家具の組合せ等で結果が変わる具体的な遊びを実装し、再演を確認。家具追加だけで完了としない。
- [ ] 住民の個性・暮らし/素材表現・学習面とのつながり: 採用案を仕様化し、現行の大胆な配色を保持して実画面比較。
- [ ] 答えの書き写しへ寄る支援と「わからない」の期待差: 段階的な理解支援を実装し、支援記録・独力再確認・全入力を検証。
- [ ] SRSの同日成功/遅延想起、次レベル主練習化の理解条件: 親仕様から再検討し、採用変更と根拠を記録。共通学習回帰を実行。
- [ ] 初回導入の準備負担: 子どもが早く触れる導線を仕様化・実装し、既存profile/private route/PWAを検証。
- [ ] 1人からの観察・定着測定: 記録道具と短い手順を用意し、実参加者の結果を集計。人間の観察を自動入力で代替しない。年齢/学習範囲と参加はユーザー回答待ち。

## Source of truth

`CONSTITUTION.md`、`docs/product/01_app_spec.md`、`28_mystic_island_spec.md`、`07_ui_design_guideline.md`。挙動変更は仕様を先に更新。アプリのschema/進級を扱う変更は別の検証段階に分ける。

## Docs To Touch

- `docs/product/28_mystic_island_spec.md`: 島の表示・遊び・支援の契約。
- `docs/product/01_app_spec.md`: 共通学習・初回導入を変える段階で更新。
- `docs/design/audits/`: 固定buildでのbefore/afterと観察証拠。
- `docs/ai/verification_matrix.md`: 新しい恒常検証を採用する場合に追記。

## Verification

各変更のfocused検証に加え、統合時に `verify:core`、smoke、classic/Park/Islandの対応flag回帰とPWA、正式固定10問。固定buildの実target/候補/配色を識別し、390×844・768×1024のcritical-path画面と録画を残す。美術・無説明理解/安全・runtimeを別々に判定する。

## Progress

- 2026-09-07: アプリHEAD `84d3ddf`、前回評価は未追跡の文書/画像のみ。評価と既存ログには子どもの生観察がなく、1人向け計測を準備中。
- 表示・操作階層の修正契約を28仕様に追加。最初の実装対象はpreview、learning camera、play操作、重複説明/選択図形。
- 最初の固定修正版 `84d3ddf-experience-3535575a1ce3` はcore 129 files / 1430 tests、smoke 31、DEV 11、23学習シナリオ、production 6家具/遊び、classic/Island PWA、東土地の追補、固定10問80 runsがPASS。正解P95はphone 193.3ms / tablet 481.7ms、誤答P95は195.4ms / 457.7ms。子どもの結果ではない。詳細は [表示改善監査](../../design/audits/2026-09-07-experience-corrections/README.md)。
- 東へ歩行中の住民同士の重なりを追補画像で確認。頭・耳・足の見切れとは別問題として、次の住民経路/共有遊びの改善に含める。最初の4項目を完了しただけでgoal全体を完了しない。
- 次の段階として「花とベンチ」「灯りときのこ椅子」「噴水とブランコ」の共有遊びを28仕様へ採用し、実装中。実経路の先行確認・占有回避・順番の歩行・実手への小物の受渡し・取消/再演を分離した。手の姿勢切替で小物が跳ぶ不具合を実rigの1ms測定で発見・修正。固定buildのphone/tablet実画面・全回帰は検証中のため、この項目はまだ完了扱いにしない。
- 共有遊びの初期版ではphoneで手渡しが背中に隠れるため、画角を採用し直した。受渡しは横から近くで見せ、運搬経路の全体が入る固定画角と現在動作に合う字幕へ変更。`84d3ddf-sharing-b3a00f4dbdf0` を603 app入力で固定し、core 134 files / 1496 tests、build/assetsがPASS。現行候補の全E2E/録画/正式10問は検証中。QAスクリプトは各runの開始/終了closureを別に記録する。
- 画角変更前の `84d3ddf-sharing-1a3d12c7d5d4` では、実歩行中の編集取消、椅子直前の中断から出発、同profile別画面での家具移動と通常遊びがphone/tabletでPASS。共有遊びの3組の動作は通ったが、QA配置でキツネが参加しなかったため全体PASSにはせず、実UIでキツネが座る配置を作る検査を追加。旧版の成功を現行候補の結果へ混ぜない。

- `84d3ddf-sharing-b3a00f4dbdf0` のphoneでは3組・キツネ参加・再演/取消・表示復旧まで確認したが、置き直した灯り/噴水に別の住民が重なり取出し元を隠すため採用保留。tabletの撮影は全段階の描画記録がある一方、撮影前処理で時間窓を過ぎていたため、撮影と連打を別の実再演に分離。閾値は維持する。保存家具との重なりを実経路で横へよける契約を採用し、移動中の最新選択・学習復帰・全身画角を実装/検証中。

- 退避/最新招待を含む `84d3ddf-sharing-624baa20586c` は607 app入力、core 136 files / 1515 tests、共有遊びのphone/tablet全機能・DB検査がPASS。ただし待機中のカワウソが星の手渡しを隠すため視覚HOLD。第三の住民・建物・木の実形状から見える画角を選ぶ調整を進めており、全体完了にはしない。退避後の招待1回・38.9ms後の実歩行・14 DB stores不変は単発診断で確認、学習途中復帰と最終ビルドの全回帰は継続中。

- 片手の実接点、18姿勢（通常17＋静止結果）の画角評価を含む `84d3ddf-sharing-0875c0778c8a` は610 app入力、core 137 files / 1542 tests、共有遊びのphone/tablet全機能・保存比較がPASS。花と水玉の5段階は両画面で読め、星の受取後も本人の頭から見えるようになった。ただし星の近景で第三の住民がランプや手元を隠すため視覚HOLD。小物だけでなく取り出し元と参加者を確認する画角へ改善中。旧484400では中断/最新選択/移動中学習の5ケースが両画面PASS、旧候補の結果を0875c0以降の全回帰へ転記しない。

## Next implementation slices

- b155の通常学習23/139画面、共有遊び2画面/84画面、段階支援9/45画面、初回6/49画面、6家具×2画面/60画面、自由遊び2/18画面、実獲得からの再学習2/20画面、再確認4/24画面、東土地2/18画面、Island PWA/実offlineがPASS。中断の初回はtabletで最初の描画記録前にassertしFAILを保存し、QAのみを修正した全5条件×2画面の再実行はPASS。共通回帰・正式速度は継続中。共有遊びの実画面で復旧後の古い字幕/再試行案内を発見し、次段階へ修正中。この不整合を機能PASSで隠さない。

- 次段階として親01/28へIslandの任意観測と、28へ種別の短い返事を通常訪問/学習で共有する契約を採用。どちらもb155には未実装で、独立した `/tmp` コピーで作業する。新観測はSRS時計/閾値/全経路を変えず、種別反応は経路/接地/共有遊び/入力待ちを変えない。rootはb155の全検証を継続し、未実装案を現buildの測定結果へ混ぜない。

- 2026-09-08: 十進ブロックのヒント領域を初回から確保するCSS修正を含む `84d3ddf-experience2-b155db0a54ec` を618 app入力で固定。core 141 files / 1606 tests、lint/typecheck/docs/build/assetsがPASS。最初のcore試行は記録票READMEの相対リンク誤りでdocs段階に止まり、ログを保持して修正後に全coreを完走。最大2回の実訪問を使うキツネ配置QAも固定archiveに含む。production全検証は実行中であり、旧候補の成功を転記しない。東土地QAはfreeze後の独立した追加archiveとして保存し、旧QA archiveを上書きしない。
- 1人用の記録票v2は2問/4問の事前計画、初回回答と支援/訂正/中止の分離、未記録/未知、理由付き訂正履歴、20–48時間の実間隔を扱う。Node 17条件とphone/tabletの記録・書出しを確認。現時点の実参加者はN=0であり、道具の検証を学習効果へ換算しない。

- 5c5のproductionで段階支援9経路/45画面、初回6経路/49画面がPASS。共有遊びはphone全体PASS、tabletの3組/再演は通過後、専用キツネ配置のQA探索が1回前準備までしか扱えずFAILを保存。実座標のNode診断で2回の合法な実訪問/収納による手順が見つかり、QAを改訂中。通常学習は9番目のphone十の棒の引き算で、hint後のお手本ボタンが844px viewport下端を約22px超えFAIL。次候補へbase10の固定余白とヒント領域を修正し、全検証する。5c5全体を完了・配布扱いにしない。

- 同じ完了ペアの再演改善を含む `84d3ddf-experience2-5c5b5289a8f8` を618 app入力で固定。core 141 files / 1606 tests、lint/typecheck/docs/build/assetsはPASS。実画面・全回帰・正式速度測定は検証中。Playwrightのasync条件を誤って早期完了扱いする6箇所もQAだけを改訂し、実際の保存と入力readyを待つ共通helperへ変更。旧PASSを新候補へ移さない。

- 993の初回導線は `onboarding-3` で6経路・49画面がPASS。空DBからの4通常経路、プロフィール追加/既存Explore優先、別診断の保存rollback/retry/実新文書reloadと全store保持を確認。共有遊びは花の初回を通過後、再演時の参加者交代で旧運搬役が通路へ残り通常利用へ戻ったためFAILを保持。同じ完了ペアへの連続招待に限って同じ二人を優先する契約を採用し、次候補へ修正中。993のsupport/onboarding成功を次候補の全回帰へ自動転記しない。
- 統合候補 `84d3ddf-experience2-993febcf1560` を618 app入力で固定。core 141 files / 1599 tests、lint/typecheck/docs/build/assetsがPASS。段階支援のproduction 9経路・45画面が `support-3` でPASSし、全筆算/入力停止/下書き保持/再開/支援完了と報酬/Due保持を確認。初期2runのQA selector失敗と改訂履歴を保持した。共有遊び・初回導線・全回帰・正式速度測定は未完了のため全体は継続中。
- 同じ993入力の [SRS仮想DB測定](../../design/audits/2026-09-07-srs-policy/README.md) は12条件が現行仕様と一致。3分内/25時間間隔/実Due後の4正解でいずれもstrength 2→3→4→5。同一問題の誤答→訂正も1→2。次レベルの非復習・非skipの誤答30件で、writerとStudy側の両方がmain 8→9へ移行した。04:00の学習日境界直前の誤答では1分後にDueとなる。いずれも現行方針の機械的測定であり、子どもの定着測定ではない。具体的な新閾値はまだ採用していない。
- 共有遊びは見えない時だけ既存の合法な別配送経路を選ぶ実装へ更新。実際のtablet配置は正面経路で可視条件を満たし、phoneは元の経路を維持する診断結果を保存。動作中のreduced motion変更で経路選択前に移動が完了する不具合を独立レビューで検出し、選択を先に固定する修正と32 controller/continuityテストを完了。実画面は次の統合buildで確認する。
- 初回導線は8 source/testファイルと4仕様節をSHA照合して統合。プロフィールなしの花/灯り遊び、学習直前の明示設定、任意の名前、原子的な一度だけの保存を実装した。隔離64テストと型/lintはPASS、実ブラウザ/PWA確認は未完了。記録は `output/experience-integrations/onboarding-20260907/`。
- `84d3ddf-sharing-cdc5f17707d4` はcore 137 files / 1548 tests、全共有遊びphone/tabletがPASS。phoneの取り出し元は改善したが、tabletの星で木が手元へ重なるため視覚HOLD。診断も可視条件未達を記録しており、実際の最新配置で画角候補を再検討する。段階支援の隔離実装はfocused 8 files / 120 tests、app typecheck、変更ファイルlintがPASS。rootへの統合と実UI検証は未完了。

以下は調査当初の設計案。採用・統合・固定buildの現状は上記の進捗と親・子仕様を参照し、未実装の挙動を現在のbuildの機能や検証結果としない。

1. 家具の組合せによる二人の遊び。花→ベンチ、灯り→きのこ椅子、噴水→ブランコの近接・向き・実経路が成立すると、一人が物を取って友だちへ運び、手渡す。単体動作の同時再生で済ませない。占有点/到着anchor/取消を純粋なcontrollerへ分離し、初回は新DBを書かない。配置と再演で結果が変わる証拠を残し、長期継続の実証とは呼ばない。
2. 支援を短いヒント→試す→明示的な答えの見本→書き写さず区切れる形へ。Island固有の支援完了を正解receiptと区別し、支援で報酬を減らさない。既存の独力再確認を残し、先行誤答/ヒント/途中段を独力初回正答へ混ぜない。Parkとの型共有に注意する。
3. 共通SRSを変える前に、問題内容identity・先行誤答・援助・一問全体の完了・記録時刻の前向きな証拠を整える。旧履歴から遅延独力正答を捏造しない。同日練習と期限延長を分け、主練習化の2重判定とretired判定も一緒に検討。旧レベル/報酬/既存retiredを一括降格しない。具体閾値はまだ未採用。
4. 初回Welcomeの花/灯りを、プロフィールを作らず触れる入口にする。学習設定は解き始める直前へまとめ、学年/科目/開始範囲を明示選択、名前は任意。初期学力を推測しない。Settingsの追加profile導線、既存seed値、旧探索run優先を保持し、保存側は一度だけ完了するtransactionとPWA holdで保護する。

段階支援は `/tmp/sansu-progressive-support-0875c0778c8a` の独立コピーで実装・domainレビュー後、15ファイルすべてのbase/new SHAを照合してrootへ統合した。`output/experience-integrations/support-20260907/` に転送と隔離検証の記録を保存。hint/model/明示的な支援完了は次の固定buildで実UI確認する。旧共有遊びbuildには含まれず、公開済みとは扱わない。

## Next-slice investigation boundaries

共有遊びの検証と並行してread-onlyで確認した範囲。以下の閾値・挙動は未採用であり、現行の製品仕様としない。

- 段階支援: IslandのactionはParkのalias、commitはsupport以外を採点へ流すため、Island固有のhint/model/finishを明示分岐にする必要がある。モデルを見て区切る操作で正解値を自動送信しない。現在のsupportはexampleと筆算correctValuesの両方で答えが見える。revisionごとのform remountによる入力消去、筆算全体のモデル、guided bridge→independentの引継ぎを扱い、独力Dueを維持する。skip1回制限はUIだけでなくdomainで防ぐ。
- SRSの前向きな証拠: AttemptLog/MemoryStateに問題内容identity・先行誤答・支援・一問全体の完了の事実がないため、旧履歴から独力の遅延成功を復元できない。Studyの筆算途中誤答は現在ログに残らない。独立レビュー後のv2案では観測時刻を既存の日次/SRS計算clockへ流さず、Islandの既存eventへの任意の加算情報に絞る。旧/途中/欠測はunknown。閾値や新tableを含め、まだ採用・実装していない。
- 進級の二経路: learningAttemptWriter.resolveMathProgressionとStudy経由math/service.checkMathMainPromotionが別に存在し、現在は過去30件の非復習・非skipを誤答も含めて数える。片方だけを変えない。英語のattempted-word coverageとretirementは別の採用条件が必要。既存のmain/unlocked/retired/報酬を一括降格しない。
- 重点検証: same-day/遅延境界、04:00境界をまたいだ数分、同内容の訂正、支援、筆算途中段、再読込、旧データunknown、二経路の同判定、二重イベント/同時回答/rollback。共有Study/Park/Exploreの通常入力も対象になる。

- 2026-09-08 01:42 JST: b155はIsland/Park DEV、両flagのPWAと実offline、共通筆算13、smoke31、classic更新回帰までPASS。Island正式80 runの第4試行がPASS/eligible、正答P95 phone195.7/tablet195.1ms、誤答195.1/195.0ms。初回profile照会とQA seedの競合、および途中QA修正2回の失敗は別reportで保持し、最終はseed前のWelcome DOM commit待ちだけを追加した。classic正式40 runは次統合候補で実施する。
- 住民interest v2（対象外の葉・噴き上げを通常訪問では維持、107 focused PASS）と復旧案内v2（初回実描画後、renderer案内だけ解除）をrootへ統合。runtimeの2差分を両立したSHA照合を保存した。前向き観測v2は支援時の筆算段と後続slot欠測判定を補い100 focused PASS、移送待ち。これらはb155の実測結果に含めず、次の固定候補で実UI/全回帰/速度を確認する。

- 観測v2/新QAもrootへ統合し、pageの復旧callbackを保持したbyte照合を保存。`84d3ddf-experience2-5d7be27ceacb` を625 app入力・58 QA入力で固定し、core145 files/1687 tests、docs/lint/typecheck/build/assetsがPASS。実観測QAはphoneを通過し、tablet筆算のボタン探索で全体FAILを保存、原因切分け中。新候補の実画面・回帰・速度は検証中であり、b155のPASSを引き継がない。

- 5d7の前向き観測はQAの回答ボタン1行を修正した `observation-2` が数字/筆算2経路・11画面PASS。初回FAILを保存し、625 app入力は維持。自由遊びの最初のrunと6家具3Dは両画面PASSだが通常カワウソ/reduced画像の不足があり、既存の後続訪問で補測するQAのみ改訂。共有遊びも全体PASS、復帰後字幕の実画像を独立確認中。通常学習以降の対応flag回帰/正式速度は未完了。子どもN=0、学習効果や小さなしぐさの理解を自動検査の成功へ置き換えない。

- 5d7の残りproductionは通常学習23、支援9、初回6、中断/再学習/再確認/東土地、Island PWAが全てPASS。通常全3種とreducedの画像補測もPASS。一方、作者がtabletのキツネ向け花pickupで紫樹冠による運び手の顔の遮蔽を確認し、視覚HOLD。既存の参加者可視契約に沿う画角修正を調査する。5d7の対応flag build/regression/formalは未実行で次候補へ延期。準備済みのclassic clean snapshotは独立検証repoでありroot commit/配布ではなく、まだ正式実行していない。

- 顔が隠れた5d7の実配置をNodeの実geometryで再現し、従来のgather頭部平均19/36に対して、1姿勢の頭/胴体は3/9まで下がることを確認。既存の.5を姿勢ごとに要求すると現画角を棄却し、既存の−35度配送案と画角で最小1.0の案が成立した。基本6flowは元の経路・fit1回を維持。これはブラウザ/美術PASSではなく診断で、28仕様を補足して隔離実装・既知配置を実UIで再現するQAを準備中。

- 頭/胴体の各姿勢判定を2ファイルのbase/newSHAで統合し、独立レビューでブロッカーなし。`84d3ddf-experience2-3ddcac1103f0` を625 app入力・58 QA入力で固定し、core145 files/1694 tests、docs/lint/typecheck/build/assetsがPASS。5399はこのversionへ切替済み。共有遊びの実UIを確認中で、既知配置の再現QAは別追補として準備。実画像・対応flag回帰・正式速度は未完了。

- 2026-09-08: ユーザーのコミット/main push/公開指示により3dd候補の625入力を公開対象と照合。公開対象だけのclean環境でverify:release（144 files / 1676 tests、smoke31、classic PWA4）、Island11、島PWA/実offline、初回6、支援9、観測2、学習23、主導線2と正式速度80 runがPASS。正式速度はeligible=true、正答P95 phone193.8/tablet194.1ms。以前の145/1694をclean検証の数へ転記しない。記録票のローカル専用リンクだけを修正し、アプリ625入力は維持。[今回の公開検証](../../design/audits/2026-09-08-production-release/README.md)を参照。人の観察N=0と実機確認の未測定は残る。
