# スワイプで選ぶ「つくる」と、配置後の短い反応

2026-09-12のユーザー依頼「続けて実装」「つくるの画面で矢印じゃなくてスワイプしたい」に対応。[採用仕様48](../../product/48_island_life_spec.md)。

## 変更

- 「つくる」は2品ずつ横へスワイプするnative scroll-snap。矢印を外し、44pxのページドット、現在位置、「よこに スワイプ」を表示。ドットはキーボードでも使え、reduced motionでは即時移動する。ドラッグを購入clickに変換しない。縦スクロールはブラウザのまま残す。
- 島のシーン構築・初回GPU描画準備で短い反応を消費しない表示用時計を追加。最初のbrowser frameに残るGPU待ちの増分だけ100msまでに抑える。通常frameの経過時間は制限しない。同じsnapshotの再構築では表示時刻を維持し、新snapshotは保存時刻へ同期する。非表示/context喪失中は進め、古い発見を再演しない。
- 反応中の検査用poseは500ms間隔から実描画frameごとへ変更。動きを補間・捏造せず、描画した姿勢そのものを記録する。
- 黄中心の瓦、紫の木、ミントの草、青い海、敷石はv8から継承。通貨・成長・学習・経路・到着時刻の保存契約は変更しない。

## 原因と失敗記録

[旧版のフレーム記録](baseline-frames.json)では、配置前後に865ms/843msのframe間隔があり、650msの発見hopは検査値に残らなかった。初回render後に時計を始めるだけの案も[初回](first-production-failure.txt)で失敗。反応中のpose採取頻度だけを増やしても[次の試行](second-production-failure.txt)は失敗した。初回GPU待ちが次のbrowser frameに残る場合も扱い、単なる検査の取り逃しと断定しない。

## 判定の境界

- 視覚：v8の美術を保つことと、品物・ページ・短い動きの可読性を実画面で確認する。新たな美術の数値採点は行わない。
- 無説明理解・安全：子どもの観察N=0、HOLD。作者による確認を利用者の理解・再訪意欲とみなさない。
- Runtime：ここに記載した固定buildと限定した操作経路だけを対象にする。全アプリrelease、実機iOS、正式throughput計測の合格とは扱わない。

## 固定版と検証

最終target `http://127.0.0.1:5332`、Island/Life=true、DEV=false、候補 `island-life-moon-garden-v9`。[artifact.json](artifact.json)に実versionと全buildファイルhashを保存。HEAD＋未コミット変更でありHEADだけをbuild識別に使わない。

- `npm run verify:core` PASS：350ファイル・3,660テスト、docs/lint/typecheck/build/assets。[ログ](core.txt)。
- [直前版のphone/tablet結果](pre-final-production-report.json)は5330での限定経路。最終版には非表示中の非同期snapshot更新の時計再開処理が追加されているため、最終版の結果とは区別する。
- [QAソース](production-qa.mjs)は実行時のコピー。再実行時は `output/playwright/` に置き、`SANSU_ISLAND_PRODUCTION_URL` と新しい `SANSU_ISLAND_OUTPUT` を指定する。native Chromium touch入力で左右に動かし、scroll-snapの停止位置・誤選択なしを確認する。プロフィール・学習・購入は実UIを通す。

表示準備の分だけ住人の説明文と身体の動きに差が出る場合がある。初回以外の継続した長い描画停止まで保証する修正ではない。

共有checkoutには確認途中から別タスクの「もちもの・いろ・ひろげる」変更が入った。5331での再buildはそのメニュー構造も含み、[旧メニュー用locatorで停止](mixed-menu-failure.txt)した。この結果をスワイプ失敗と解釈せず、`f1feca4`に今回所有のcatalog・表示時計だけを載せた独立ソースを作り、5332で検証する。並行変更は共有checkoutに保持しており、この証拠でその完成を認定しない。

最終の独立ソースではlint・typecheck・関連12テスト・flag付きbuild PASS（[lint](isolated-lint.txt)、[型](isolated-typecheck.txt)、[テスト](isolated-tests.txt)、[build](build.txt)）。5332でのphone 390×844 / tablet 768×1024（reduced motion）両経路PASS：[最終結果](production-report.json)。左右の実touchスワイプ、ドットのEnter操作、誤選択なし、実初回3問→6しずく→花配置→発見のhop→好みの返答と首傾げ→成長表示→保存→実SW制御下のオフライン回答・再起動を確認した。

[実画面の比較シート](contact-sheet.html)と[スマホの一周の録画](phone-journey.webm)はこの5332の最終結果。前回保留していた短いhopは、この限定runtimeで実際に描画されたposeを確認できた。子どもの理解・意欲のHOLDは維持する。今回はcommit/pushしていない。
