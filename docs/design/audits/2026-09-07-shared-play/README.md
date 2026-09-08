# 家具を組み合わせた住民の遊び

現行候補は `84d3ddf-experience2-3ddcac1103f0`。頭/胴体の各姿勢の最小可視判定を追加し、625 app入力・58 QA入力を固定。core145 files/1694 tests、docs/lint/typecheck/build/assetsがPASS。実target5399、version `84d3ddf-experience2-3ddcac1103f0:3ee728b8-f6c5-4668-a583-a1d589ef39ab`。一般共有遊びの両画面幅・88画面と、既知のキツネ向け配置を自然な準備訪問で再現した1経路・38画面がPASS。作者が取出し・受渡し・受取後の実画像で、樹冠に隠れていたウサギの顔が見えることを確認した。

学習・支援・初回・更新・対応flag回帰とIsland正式80 runはPASS。公開検証は同じ625入力と実versionを照合したうえで参照し、clean test数144/1676と以前の145/1694を区別する。詳細は [統合監査](../2026-09-07-experience2/README.md) と [公開検証](../2026-09-08-production-release/README.md)。既知配置の最初のgather描画CPU465.3ms・重なるlongtask501msは未解消で、回答の速度PASSとは別の残課題。子どもの自発的な再遊びと無説明理解はN=0のまま。

直前候補 `84d3ddf-experience2-5d7be27ceacb` は625 app入力、core 145 files / 1687 testsがPASS。住民interest・前向き観測・復旧案内を統合し、共有遊び2画面幅/88画像と通常学習・支援・初回・中断・再確認・東土地・Island PWAが機能PASS。復旧字幕の残留も8実画像で解消を確認した。一方、tabletのキツネ向け花pickupでは紫樹冠が運び手の顔を隠すため、作者の視覚判定はHOLD。画角を次候補で修正する。actual targetは5399、version `84d3ddf-experience2-5d7be27ceacb:5e42f036-dbb1-4c32-8e36-d225c1c75cd8`、Island flag/candidate/artは従来どおり。下記b155の共有画像や速度は比較用であり、新候補の成功を意味しない。

比較用b155の状態: `b155db0a54ec` は両viewportの全組・キツネ参加・再演・保存検査がPASS。表示復旧後に取消済み動作の字幕と古い再試行案内が残るため、表示整合はHOLD。次段階の隔離修正を準備している。実参加者N=0。

## 対象と意図

体験評価で挙がった「6区間以降の遊びが薄い」「住民の暮らしが単独動作に留まる」を改善する。既存の家具を近づけて向きを合わせると、花→ベンチ、灯り→きのこ椅子、噴水→ブランコの受け渡しが成立する。実際に取りに行き、手で運び、友だちへ渡す。成立条件・取消・学習復帰は [28仕様](../../../product/28_mystic_island_spec.md) が正本。

配置・SRS・報酬の保存を増やさない。子どもが自発的に繰り返すことや学力向上を、作者確認・自動入力で実証したとは扱わない。実参加者は N=0。

## 候補の識別

比較用固定候補は `84d3ddf-experience2-b155db0a54ec`、version `84d3ddf-experience2-b155db0a54ec:670c9457-e04d-4f4c-a165-cdf4bc531c7c`。618 app入力。検証時targetは `http://127.0.0.1:5399/`（現在は上記3dd）、配布flag `VITE_ISLAND_ENABLED=true`、delivery `mystic-island-v1`、world `mystic-island-procedural-v2`、learning `mystic-island-learning-v2`、配色 `moon-garden`。core 141 files / 1606 tests、lint/typecheck/docs/build/assetsはPASS。QAはアプリとは別に各runの開始/終了closureと改訂archiveを記録する。

直前に完了した同じ組合せ・同じ保存配置への招待では、同じ二人を優先して現在の経路と可視条件を再確認する。家具変更・編集・収納・学習・離脱・表示復旧では優先を解く。55経路/連続動作テストに加え、b155の固定productionで再演を確認した。

この候補では、元の配送経路が見えない場合だけ同じ参加者・家具・取り出し経路を保持した合法な別配送経路を選ぶ。どの経路でも見えない場合は通常の家具遊びへ戻る。reduced motionの途中切替も移動完了より先に経路を固定する。b155は共有遊び84画面、段階支援9経路、初回6経路がPASS。正確性の全回帰も完了し、Island正式固定10問80 runもPASS。classic正式40 runは次の統合候補で測定する。作者確認では花/水玉の因果を追えたが、phoneの星の細い輪郭、第三住民による部分遮蔽が残る。復旧案内の不一致と併せ、[統合監査](../2026-09-07-experience2/README.md) と同じbuildの画面一覧に記録する。

### 993の記録

旧候補 `84d3ddf-experience2-993febcf1560` はcore 141 files / 1599 testsがPASS。versionは `84d3ddf-experience2-993febcf1560:807557ee-5c7d-454e-ad54-6c71cd1fb8a7`。以下はこの旧候補の結果であり、5c5へ自動転記しない。

993の全共有遊びrunはphoneの花の初回5段階と保存比較を通過した後、再演で通常遊びへ戻りFAILを保存した。初回のカワウソ→ウサギからキツネ→ウサギへ交代し、カワウソが第三者として受渡し地点に残るため、配送1案の可視条件が不成立になった。通常利用へのfallbackは現行契約どおりだが、同じ組の再演価値が弱い。実座標のNode比較では、直前の二人を優先すると配送3案が合法で、先頭案の最小小物可視率0.889・構図1.0（通常案は0.311 / 0.306）。17ソースSHA一致、2fit、閾値変更なし。これは実画面PASSや速度ベンチマークではない。直前の完了ペアへの連続招待に限る優先を28仕様へ採用し、5c5へ実装し実画面を再検証している。

段階支援は同一productionの `support-3/report.json` で9経路・45画面、source closure一致、browser終了までPASS。筆算の途中入力/カーソル保持、hint→model、全筆算、物理キー停止、保存再開、支援完了と通常報酬、Due/独力確認の維持、英語、reduced motion、旧optional field省略の明示的互換fixtureを含む。最初の2runはQAの筆算見出し/英語ラベル指定で失敗し、失敗記録を保持した。captureのbuild revisionをplan revisionで上書きしていたQAも修正し、`support-3`の全45画面で実build revisionを照合した。作者はphoneのヒントと英語のお手本、tabletの割り算全段を実見し、読めることを確認。子どもの理解・定着は未測定。

初回導線は同じ993の `onboarding-3/report.json` で6経路・49画面、source closure一致、browser終了までPASS。4つの通常初回経路はネイティブの空DBから実際に設定し、3枠の最初の予約まで到達した。名前なし/英語のみ/mix/reduced motion、花/灯りの実操作、Settingsでの実プロフィール追加、実Explore予約の起動優先を含む。別の2診断ではネイティブ保存失敗の全store/cache rollbackと同一IDでの再試行、保存完了callback保留中のPWA保護、実際の新文書への更新後の全store保持を確認した。PWA診断は実SW offline検査とは別。最初の2runはQAがHashRouterのhistory更新を見逃す問題と、async predicateでIDBを十分待てない問題で停止したため、実URL遷移と同期DOM入力ready/同run・profile・checkpoint照合へ修正し、失敗記録を保持した。

### cdc5の記録

旧固定候補は `84d3ddf-sharing-cdc5f17707d4`、version `84d3ddf-sharing-cdc5f17707d4:d390bfb1-a88b-4570-bd2f-7dc544b9a500`。610 app入力、QA `5c61b0e07c80`。検証時targetは同じ5399だったが、現在は上記5d7候補を配信している。

core 137 files / 1548 tests、build/assets、phone/tablet共有遊びの全組・キツネ・再演/取消・復旧・保存比較がPASS。2026-09-07 13:24–13:29 UTCのrunはsource closure一致、browser終了済み。全回帰と正式固定10問は未実施。

作者はphoneのランプ取り出し元の改善を実画面で確認した。一方、tabletの星の受渡し・結果では手前の木がキツネの胴体と接点へ重なる。保存された画角診断も `readabilitySatisfied:false`（胴体可視率0.333）であり、候補を使い尽くした際の最良画角が十分でなかった。機能PASSを視覚PASSにしない。実際のtablet配置では待機カワウソが (0.5, 2.25)、受渡し点が (0.433833, 1.403877) にあり、以前の診断fixtureとは異なる。現在この配置を使って候補角度を検証中。

### 0875c0の記録

旧固定候補は `84d3ddf-sharing-0875c0778c8a`。610 app入力を固定し、QAは各runの開始・終了でその実行ファイル群も照合した。配布flagは `VITE_ISLAND_ENABLED=true`、deliveryは `mystic-island-v1`、worldは `mystic-island-procedural-v2`、learningは `mystic-island-learning-v2`、配色は `moon-garden`。

versionは `84d3ddf-sharing-0875c0778c8a:611c9ac7-9fc9-44e4-990a-2dc36304c2c2`、実targetは `http://127.0.0.1:5399/`。core 137 files / 1542 tests、build/assetsはPASS。QAは `5c61b0e07c80` として別途保存した。phone/tabletとも3組・キツネ参加・再演/取消・表示復旧・次回答・各19回の全store保存比較がPASS。source closureは一致し、browserを終了した。全回帰と正式速度測定は未完了。

作者確認では、花・水玉の取出し→運搬→受渡し→結果は両画面で読める。星の運搬と受取後も改善した。phoneの手渡し中の腕との重なりは録画89.6〜90.0秒の短い接触で、90.4秒には星形が戻る。一方、phoneの取出し時は待機中のカワウソがランプの大部分を隠す。tabletの手渡し・受取直後もカワウソがウサギの胴体・手元を隠す。小物の見える割合が高くても、因果や参加者が読めない画角は採用しない。

## 見つかった問題と変更

- 両手の中央では本人の頭に小物が隠れるため、腕を伸縮させず外側の実際の片手で持つ構えへ変更。持つ手は途中で変えず、受取後は着座した胴体の高さに合わせる。実controllerの17姿勢とreduced motionの静止結果を使い、参加者・揺れる家具・第三の住民・建物による遮蔽を確認して固定画角を選ぶ。
- 初期の広い画角では手渡しが背中に隠れたため、二人と家具と運搬経路を横から見せる画角を採用。運搬開始以降はカメラを固定する。
- 姿勢を切り替える瞬間に小物が跳ぶ問題を実rigの1ms比較で検出し、実際の手のanchorと連続する姿勢へ修正。
- 置き直した灯りや噴水に待機中の住民が重なったため、保存後に安全な経路を一人ずつ横へ歩く処理を追加。編集中のpreviewで住民を動かさず、家具を勝手に移動しない。
- 退避中の選択は最新の一つを保持。学習は待たずに開始し、後から動く住民の経路も全身の画角へ含める。
- 退避完了後に通常の歩行を始めた際、次の描画が9秒のidle timerまで待つコード経路をレビューで発見し、直後の描画を継続するよう修正。

## 旧候補の扱い

`84d3ddf-sharing-b3a00f4dbdf0` はphoneで3組・キツネ参加・再演/取消・表示復旧を通過したが、別の住民が取出し元を隠すためHOLD。tabletは全動作の描画記録が存在したが、撮影前処理と連打が短い撮影時間を消費した。撮影と連打を別の実再演に分け、同じ段階の撮影前後であることを検査する。動作・経路・手元の閾値を緩めていない。

`84d3ddf-sharing-74d6d9d32413` はcoreが通ったが、上記の描画継続の欠落があるためHOLD。新候補の証拠に旧候補の成功を混ぜない。

`84d3ddf-sharing-624baa20586c` は共有遊びのphone/tablet全動作・DB検査を通過したが、待機中のカワウソが星の手渡しを隠すため視覚HOLD。退避後の最新招待1回・14 DB stores不変は単発の診断で確認したが、その成功を最終候補へ転記しない。

旧484400のversionは `84d3ddf-sharing-48440092ede6:cc6ff900-e3fe-4b5b-8443-523fc02c9c40`。検証時targetは同じ5399だった。core 137 files / 1525 tests、build/assetsはPASS。共有遊びのphoneは全検査PASS。tabletは3組の共有動作後、キツネが座る合法配置をQAが見つけられず全体FAIL。source closureは一致し、browserを終了した。全回帰・正式速度測定とcritical-path contact sheetは未完了。

phoneの作者確認では、花の運搬と手渡し、星の手渡しが見える。一方、星の受取後はキツネ自身の頭・腕で星の大半が隠れ、水の取出し・運搬でもキツネの背中に小物が隠れる。全機能のPASSを視覚のPASSに転用しない。tabletの視覚確認は未完了。

同じ484400 buildの中断・学習途中復帰は、phone/tabletの全5ケースがPASS（`interruption-full-2/report.json`）。持上げ時の位置差0、退避完了後の歩行開始40.8 / 40.0ms、退避中の学習入力準備53.3 / 46.5ms。実際の2人の移動予定を含む固定画角、通常回答、全storeの保存差分も通過した。初回のrunは他プロジェクトのブラウザ処理と重なり、クリックが退避終了後になったため失敗を保存。競合処理終了を確認し、通常の操作可能判定と同じ閾値で再検証した。この局所的な操作時間を正式固定10問や実機性能の結果として使わない。

## 独立した判定

| 軸 | 現在の判定 |
|---|---|
| 視覚的魅力・取出し/受渡しの見え方 | 5d7は基本の花/星/水玉×2画面幅で出所・手渡し・結果を作者確認。tabletキツネ向け花pickupは運び手の顔が樹冠に隠れHOLD。薄い星などの限界を別記 |
| 無説明理解・自発的再遊び・安全 | 子どもの観察未測定。非懲罰性と取消は実装検証する |
| Runtime・保存・学習速度 | 5d7のcore/buildとproduction各経路はPASS。対応flag全回帰・正式速度は視覚修正後の次候補で確認。b155の正式80 runを5d7へ転記しない |

## 計測上の限界

退避経路の同期計算は家具保存後だけに実行する。ホスト上の診断では通常の灯り/水の配置は約1ms、7個の花で出口を塞ぐ合法配置は同時core実行下で経過170〜489msだった。これは配置時の局所的な負荷であり、実機測定や通常回答の速度ではない。通常回答のP95は別の固定10問で測る。

画角を決める実形状との交差計算は、初期方式では初回約2.7秒・以降約0.9〜1.6秒かかったため不採用。交差判定を正確に保って探索範囲を絞った段階のNode診断では、78 mesh / 73,472 trianglesに対して初回81.1ms・以降13.5〜23.7msだった。これは参加する二人の全姿勢を含む後の方式とは測定範囲が異なる。

0875c0の片手の姿勢評価を含むNode診断は、同じ全景78 meshに対し初回63〜114ms、後続41〜47ms。`output/diagnostics/shared-activity-posed-camera-cpu.json` に実fixture・対象source hash・測定範囲を保存した。これは各画角を決める同期処理だけの診断で、ブラウザ入力速度や子どもの回答速度ではない。

0875c0のブラウザ描画記録でも、各組の初回gather描画（画角計算込み）は43.6〜79.9msだった。6場面の局所診断を `output/playwright/84d3ddf-sharing-0875c0778c8a/gather-frame-diagnostic.json` へ保存した。開始時には他プロジェクトのコンパイルが動いていた事実も記録しており、制御した端末ベンチマークや通常回答のP95には転用しない。
