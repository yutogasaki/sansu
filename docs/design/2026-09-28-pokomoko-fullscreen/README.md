# ぽこもこ — 画面全体で育つ学習演出

2026-09-28。候補 `pokomoko-pop-live-v8`。ユーザーの「Gitをしっかり参考にして実装」に対応したローカル実装。公開・pushはこの作業に含めない。

[実画面の比較](index.html) · [実アプリを開く](http://127.0.0.1:5198/#/island?learn=1)

## 参考と移した構造

指定された [dopa-drill](https://github.com/grmchn/dopa-drill/tree/0720ddfe37334628bab61ba5b3a9282bd6bfb31c) をローカルに取得し、remote HEADも同じと確認。`main.js` の入力・正解・進行・連続・リーチ・区間完了・EX・結果、`fx.js` のviewport座標・紙吹雪・リボン・花火、`bg.js` のE/beat/背景描画、`dopakichi.js` のcarry/hop/celebrate、`audio.js` の進行編成とSE、CSSのレイヤー・色・キーを照合した。ローカルの公開版デモで通常画面と進行後の全画面ピークも目視した。元X動画そのものと同一revisionとは断定しない。

| 移す | Sansuでの実装 |
|---|---|
| 進行と連続の別軸 | 既存learningShowの0/3/6/9完了で背景・キー・音楽が育つ。誤答で戻さない |
| 前景と背面 | 画面全体の背面色面＋pointer-events:noneの前景Canvas。小さなstageのoverflowから分離 |
| 操作に参加するキャラ | 既存のキー→前足→答えの運搬を保持。祝福分身も元WebGLモデルの描画直後のコピーなので顔・布・着替えが一致 |
| 違うスケールの節目 | 3連続は広がる紙吹雪、5連続は左右のリボンと分身、区間完了は短い斜め帯 |
| 音の編成と接触 | 完了数で増える和音・打音、拾う/置く/跳ぶ/着地、予兆の上昇音と区間の締め音 |
| 通常へ戻る | 常設の星列・黄色い丸・スタンプ列・保存済み連続見出しを整理。獲得記録自体は保持 |

EXの制限時間・新しいスコア・無限通貨・画面揺れ・全面白フラッシュ・強制演技待ちは移していない。Sansuの問題生成・学習評価・保存・報酬・自動次問は変更しない。参考のキャラ素材や音源を流用していない。

## 実画面と配信対象

- DEV: `http://127.0.0.1:5198/#/island?learn=1`。Island ON、Life OFF、Fantasy OFF。表示版development-local、v8。
- 本番形式preview: `http://127.0.0.1:5298/#/island?learn=1`。Island ON、Life ON、Fantasy OFF。公開環境そのものではない。正確なUUIDはbuild-version.json。
- 基点Git: bed374c4、今回の未コミット差分を含む。各レポートに実root、candidate、viewport、cache/SWとsource開始/終了hashを保持。
- 筆算4状態は使い捨てプロフィールから実問題を解いたDEV撮影。通常問題の旅程は実回答・実獲得を使う。固定十問は別の明示fixtureであり、通常plannerの証拠には使わない。

## 確認

- verify:core PASS（480 files / 4,270 tests、lint/typecheck/build/assets/docs）。その後の区間フェード1150ms化と静的正解表示の2修正はtypecheck、対象lint、5 unit tests、build/assetsを再実行してPASS。
- 最終sourceのscreen 4旅程、32画像：全画面寸法・実hit・3/5連続・区間帯・静的正解・ミス後の進行保持・再開で再演しない・退出でportal消去、通常/reduced各phone/tablet。
- 最終production preview 6旅程：phone/tablet/landscape×通常/reduced、各21正解、報酬・支援・再開、実SW offline reload。
- 最終sourceの入力14条件：通常/reduced 3レイアウト＋320/844幅の筆算・多段筆算・分数・英語。先行390/768幅の入力14条件も通過（2修正前として別レポート）。
- 音声2旅程PASS：ヘッダーだけの開始、無音プロフィール、ミュート・保存失敗の取消と再開、実PCM。最終2表示修正前の実行で、音声コードは同一。実機スピーカーを聞いたとは扱わない。
- 固定十問は80走（各幅10反復、Study/Island交互、通常/誤答）。eligible/passともtrue。追加操作0、source開始終了一致。

| viewport | 正答から次入力 P95 | 誤答から再入力 P95 | 区間境界 P95 | Study比の問題速度 |
|---|---:|---:|---:|---:|
| phone | 247.4 ms | 202.7 ms | 271.4 ms | 2.26倍 |
| tablet | 232.8 ms | 202.8 ms | 265.6 ms | 2.25倍 |

[画面](screen-report.json)・[production](production-report.json)・[小画面と入力](small-input-report.json)・[音](audio-report.json)・[速度](throughput-summary.json)・[build](build-version.json)。全速度raw reportはローカルの `output/playwright/pop-v8-final/throughput.json` に保持。PWA precacheは8.50MiB / 12MiB。保存schema・routing・PWA実装を変更しておらず、新しい2-build更新試験は実施していない。

## 分けて扱う評価

- 見た目: 実装者がphone/tabletの通常・入力・3/5連続・落ち着いた後を参考画像と比較。画面全体の色面と前景、通常へ戻る差を確認。ユーザーによる最終評価は未実施。
- 音なし理解・安全: 問題/入力/支援の判読とreduced motionは技術検査。独立した子どもの無文字観察は0人、未評価。
- 実行: 下記チェックの対象範囲で確認。実機iOS/AndroidのGPU負荷・スピーカー音量、全アプリ美術承認・本番配信の判定は含めない。
