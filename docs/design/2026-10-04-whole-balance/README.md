# 学習と島の成長の全体整合 — 2026-10-04

学習→資源/まち時間→家/食事/来訪→げんき/土地/解放を一つの循環として確認した。数字は[前回の成長配分](../2026-10-04-growth-balance/README.md)を保持し、進み方の表示と、大きくなった島の住人選択を修正した。正本は[仕様52](../../product/52_growing_island_game_spec.md)。全般の起動/描画性能の最適化とは範囲を分ける。

## 修正

- 船の位置は保存されたdockAtと最後の入居時刻で計算する。旧26時間、新50時間の航行はどちらも出発0%、中間50%、到着100%。保存を書き換えず、新しい定数で旧航行の表示を伸縮させない。
- なかま一覧で選ぶと、表示中なら本人へ、表示枠外・夜・おでかけ中なら本人の家へカメラを寄せ、名前と住まいの操作を開く。13人目以後も無反応にしない。固定の歩く人数を増やさず、室内の本人を架空に外へ出さない。
- 試算に、合計あそび点に基づく建設方針だけでなく、実すみごこちの差からベンチを選ぶ方針を追加した。人口、Lv、解放数、土地、残高、bankを一緒に確認する。

## 全体の試算

3種類の島のすみごこち優先方針は、30日目で以下の人数/Lv/面積になった。配置と購入をスクリプトで決めた結果で、子どもが実際に選んだ行動ではない。

| 1日の問数 | 住人 | Lv | 面積 | 残高（しずく） | bank |
|---|---:|---:|---:|---:|---:|
| 6 | 5 | 4 | 30 | 20 | 0 |
| 20 | 16 | 6 | 45 | 330 | 0 |
| 40 | 28 | 7 | 60 | 690〜730 | 0 |

少量でも成長し、20問と6問の差は2倍以上。工夫で消費が抑えられた資源は残る。1問の日課、週まとめ、装飾優先と365日までの既存成長チェックも保持する。供給不足で退去させたり、残高/未使用時間を没収したり、出題・採点・復習/独力判定を島のために変えたりしない。

## 検証

- `verify:core`: 537 files / 4,698 tests、docs/current-entry/lint/typecheck/build/assets PASS。既存Fast Refresh警告1件。最初の実行は試算の未使用importでlint FAIL、除去後に全体を再実行した。
- Growing対象: 34 files / 179 tests PASS。旧/新船の表示、夜/表示枠外の家、12人の描画枠、保存不変、3島×6/20/40問を含む。
- classic `e2e:smoke`: 31/31 PASS。
- DEV `http://127.0.0.1:5272/#/island`、Growing flag-on、390×844/通常motionと768×1024/reduced motion。両幅計8シナリオPASS。実回答20問→購入→reload/同予約復帰と、明示fixtureの記念品/旧版1→3/地区/bank/13住人の選択を分けて実施した。
- 13住人・7家は診断のための合法配置fixture。表示枠外の本人を一覧で選び、実カメラの呼び先を家に確認、名前の操作を撮影し、所有/人口/土地/clock/bank/学習完了/解放不変と同予約のcursorを照合した。実入居で得た13人の証拠ではない。
- [metadataとsource SHA](verification.json)に実URL、DEV版/revision、delivery、visual candidate、app root/Growing flagを保存。QA開始/終了のapp/QA source一致を確認。raw report/captureは `output/playwright/2026-10-04-whole-balance`。ログは `/tmp/sansu-whole-core-final.log`、`/tmp/sansu-whole-focused.log`、`/tmp/sansu-whole-smoke.log`、`/tmp/sansu-whole-browser.log`。

実SW/two-build・実機・子どもの理解/自発学習/再訪は未検証。美術全体や性能の合格へ置き換えない。

## 実画面

[スマホで室内の住人を選択](390-indoor-friend-focus.png) / [タブレットで室内の住人を選択](768-indoor-friend-focus.png)。
