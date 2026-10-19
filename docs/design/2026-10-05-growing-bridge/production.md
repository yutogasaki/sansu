# 橋の本編機能

家を作って住民を迎えた子が、メニューから無料の橋を一つ作れる。ポコモコが作る短い場面の後、橋は島に残り、住民とポコモコは見晴らし台まで普段の散歩で渡る。橋は学習報酬・進級条件にしない。

保存は既存の GrowingState に任意の `bridge: { x }` を追加する。既存記録に値がなければ橋はない。建設と撤去は通常の profileId 単位の commandGrowingIsland トランザクションを使い、再送は intent id で一回だけ適用する。橋の手前の岸は空きかつ家から到達可能なセルに限り、橋を作った後はその岸への設置を禁止する。橋の先二セルを歩行経路に加える。南へ土地を広げる時は空いていて到達可能な新しい岸へ橋を移す。候補がなければ拡張を保留し、橋をしまえば拡張できる。

メニューから「はしをつくる」を選び、確認画面で作るかやめるかを決める。建築後は橋をタップして「はしをしまう」を選べ、確認して取り消せる。試験フラグは使わない。案内を開いている間、既存のヒントカードは背後に重ねない。再読み込み時は保存された橋をすぐ描画し、建築演出を繰り返さない。

建設直後は橋へ視点を向ける。建設の合図は描画の初期化が終わるまで保持し、描画の復旧中に未完了の建設があれば再開する。同じ画面で完了した演出は、描画の再初期化だけでは繰り返さない。再読み込みでは建設の合図を発行しない。

検証：移行前記録、連打と同じ意図の再送、岸の衝突、撤去、南拡張、二プロフィール分離、再読み込み、住民の散歩、320/390/768px、学習記録不変。本編を使う最終画面で確認する。


## Mac原本への統合（2026-10-05、ローカルのみ）

ユーザー承認の `integration.patch` を `/Users/yutogasaki/Projects/sansu` へ適用。原本の17ファイルを反映し、適用前の未コミット31ファイルを端末の一時領域に退避した。既存変更との重複は `GrowingIsland.tsx` の1ファイルで、適用結果が「既存変更を含む適用前内容＋パッチ」と完全一致することを確認した。他の既存30ファイルとGit indexは適用前と同一。commit・push・公開は行っていない。

- `npm run verify:core`: PASS（538ファイル・4,705テスト、build/容量検査を含む）。lintの既存 `IslandMilestone.tsx` Fast Refresh警告1件と文書のReview By警告は残る。
- `npx vitest run src/domain/growingIsland src/components/island/growing`: PASS（35ファイル・184テスト）。橋の旧任意フィールドなし記録、保存/再オープン、同intent再送、二プロフィール分離、岸と経路の保護、南拡張、通常散歩/撤去後の岸への復帰を含む。
- `npm run e2e:smoke`: PASS。既存の初回設定・通常学習・復習・保護者テストと旧Exploreの回帰。
- `tools/e2e-growing-balance.mjs`: PASS。390/768pxで各20問の実回答、家の不足/取消→購入→reload→同じ学習予約への復帰、旧保存と地区拡張/13住人の別fixtureを確認。app/QAの開始終了SHAは一致。証拠は `output/playwright/bridge-balance-2026-10-05/report.json`。
- 橋の実UI: 320/390/768pxで建設取消→建設→渡橋→到着→reload保持/演出非再生→撤去取消→撤去→学習回答保存がPASS。橋操作前後の学習7ストアが不変、pageerrorなし。住人は船を開いて迎え入れてから建設する。初回ハーネスの未入居段階でのボタン待機timeoutは手順の問題として残し、入居後の再実行を正式結果とした。

対象はDEV `http://127.0.0.1:5291/#/island`、Growing/Island flag ON、world candidate `growing-island-v1`、学習 `pokomoko-pop-live-v8`。ベースHEADは `7eda1fd9ebff9ade0dba139aa88da60fbc6aa837`、既存変更と橋パッチを含む作業ツリーで検証した。使い捨てChromiumの保存のみを使用し、実際の子どものブラウザ記録には触れていない。

実画面・URL/旗/版とapp SHAはローカル証拠 `output/playwright/bridge-integration-2026-10-05/` の `result.json` / `integration-manifest.json` / `contact-sheet.html`。元パッチ付属の320px建築と390px到着画像を実画面と並べ、橋の形・位置・短い案内の一致を確認した。視覚の候補一致は確認済み、子どもの無説明理解・自発的な再訪は未評価、runtimeは上記範囲でPASS。本番SW/offline・two-build・実機の検証や公開完了を意味しない。

## 描画初期化と建設の合図（2026-10-19、ローカル修正）

橋は保存できても、`GrowingWorld` の非同期初期化前に `bridgeBuild` のeffectが走ると、未設定のAPIへの呼出しが捨てられて建設・渡橋が始まらなかった。未完了の合図をrender loopで受け取り、モデルと住人がそろってから建設する。完了通知で親の合図とbusyを解放し、描画復旧で完成済みの場面を再生しない。建設時の視点は既存の橋focusを使い、拡大しすぎた状態も戻す。保存・学習・橋の利用条件は変更しない。親仕様52の既存の渡橋契約への修復であり、親仕様・memory・ADRの追加変更は不要。

くふう・愛着に効く修正。「作ると住人が渡る」が見えるという仮説で、本人の無説明理解・再訪は未評価。添付写真の端末状態そのものは取得しておらず、写真と同じ原因だとは断定しない。

2026-10-19 JSTの検証：

- 修正前HEADの実コンポーネントへ初期描画時から建設の合図を渡すと、30秒待ってもbuildingへ進まないことを再現。`output/playwright/bridge-fix-2026-10-19/baseline-failure.log`。
- `SANSU_BRIDGE_OUTPUT=output/playwright/bridge-fix-2026-10-19/lifecycle-final node tools/e2e-growing-bridge-start.mjs`: PASS。390/768幅、通常/reduced motionで建設→渡橋→到着、橋focus、同じ合図でのrenderer再初期化時の非再生、新規合図なしの非再生。reportは開始/終了の対象source SHA・日時・viewport・candidateを持つ。合成の保存済み相当stateを実コンポーネントへ渡す描画診断であり、通常取得や保存の証拠ではない。初回harnessはCSS未読込と実行中のsource編集が混じり不成立、別出力に保持した。
- 通常DEVの使い捨てプロフィールからメニューの建設確認→つくる→渡橋→到着もPASS。`output/playwright/bridge-fix-2026-10-19/normal.log`。子どもの実データは使わない。
- `npx vitest run src/domain/growingIsland/bridge.test.ts src/components/island/growing/growingLife.test.ts`: PASS（2ファイル19テスト）。
- docs:check、check:current-ui-entry、lint、typecheck、build/容量検査：PASS。lintの既存4 warningは残る。nvmはこの環境に見つからず、利用可能なNode 24.18.0でnpm ciと検証を実行した。
- 全体 `npm run test:run`: PASS（5,397テスト、642.69秒）。全体実行中にUIの完了通知とcameraを仕上げたため、最終UIはその後の対象19テスト・実描画診断・lint・typecheck/buildで確認。固定sourceの配布検証とは扱わない。本番SW/offline、実機、写真の端末での再確認、公開は未実施。公開・push・commitは行っていない。
