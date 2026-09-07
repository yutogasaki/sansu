# 多桁の掛け算・割り算

[実画面を見比べる](review.html)

## 変更した体験

- 掛け算は一の位の部分積、左へずらした十の位の部分積、合計を同じ位の列で表示する。現在の段だけ入力し、計算に使う数を下線と面で示す。
- 割り算は商を上、割る数を左、割られる数を囲みの中に置く。商→かける→ひくを追い、確定した残りに次の数字をおろす。商の途中・末尾の0と、あまりを保持する。
- 現在の手順と入力方向を短文で示す。途中式の履歴だけをスクロールし、問題、現在の入力、全テンキー、支援ボタンを390×844に収める。Studyの狭いカードでは演算子専用の空列を表示から省き、数字の操作面を44px以上に保つ。保存座標は変えない。
- Study / Island / Parkに共通化。暗算設定、小数の既存入力、選択式・分数、途中誤答後の訂正、支援後の学習区分を保持する。
- 新規予約だけ`hissanVersion: 2`を使う。版なしの保存済み問題は従来の段・行・列で再開する。商とあまりの回答配列を連結しない。

仕様は [画面仕様06](../../../product/06_screen_specs.md)「多桁の筆算」と [保存仕様13](../../../product/13_data_storage_migration_spec.md)。この変更はUI・整数の手順生成・予約時の表示版を扱い、学習範囲、Due/SRS、報酬、ルーティング、DB schemaの変更は含まない。

## 実行対象と証拠

- 固定production artifact: `aa36adad7dcc-written-40b72d6bce2c`
- 確認先: `http://127.0.0.1:5303/#/island`
- flags: Island / BuildPlay有効、Park Three、`moon-garden`
- 世界候補: `mystic-island-procedural-v2`、学習面候補: `mystic-island-learning-v2`。筆算表示はProblemのversion 2。
- production画面は新しい隔離browser context、SW無効で同じartifactを確認。実SWのoffline回答・再開とPWA更新保護は別の回帰で確認。
- [buildの入力SHA](evidence/build-source.json)、[production9ケース・全段の操作面測定](evidence/report.json)、[Study/Park13ケース](evidence/routes.json)、[実hook33ケース](evidence/hook.json)。
- 最終筆算ソースはartifactと一致する。別タスクが並行更新している3D住民・経路コードは今回の完了範囲外で、差分を [scope照合](evidence/source-scope.json) に分けて記録する。artifactの背景をその後の3D改修の証拠には使わない。

## 検証結果

| 確認 | 結果と範囲 |
|---|---|
| `npm run verify:core` | PASS、127ファイル・1,405テスト、docs/lint/typecheck/build/assets。共有checkoutのその時点の全体チェック |
| 最終UI調整後の確認 | 関連64テスト、typecheck、対象lint、固定production build、最終9ケース、Study/Park13ケースPASS |
| `npm run e2e:smoke` | PASS、既存31導線 |
| `npm run e2e:pwa-update` | PASS、4更新保護ケース |
| `npm run e2e:island` | PASS、通常導入、全入力、実回答での区間・成長、描画復旧 |
| `npm run e2e:island-pwa` | PASS、4保護フローと実SW offlineのreload・回答・再開 |
| `npm run e2e:park` | PASS、6ケース。scriptの既存SVG玩具契約に合わせたlegacy renderer、Island無効の専用DEV |
| `npm run e2e:park-pwa` | PASS、学習checkpoint、保存hold、旧run優先の3ケース。専用Park build |
| 筆算固有 | production9ケース・45段、Study/Park13ケース、hook33ケースPASS。途中完了では独力正解ログが増えず、最後だけ記録 |
| 数値の境界 | 999×99、108×20、816÷8=102、220÷2=110、899÷9=99あまり8等を純粋engineで確認。999×99と816÷8は明示した固定問題で実画面も確認 |
| 再開・訂正 | 誤答で確定済み段を維持、現在段のC/Backspace、左右の画面方向、cell focus後のEnter、連続native入力、重複Enter、空欄Enter、保存失敗再送、旧版Park再開 |

通常の7つのIslandケースは実plannerの予約を使用する。最大桁と商の0の2ケースは、希少な数値を確実に通すため、隔離profileの先頭予約問題を明示したfixtureに置き換える。この2件はplannerの出題頻度の証拠ではない。Studyは既存の集中練習route、Parkは通常plannerを使う。旧版再開は別の合成保存fixture。

## 独立した評価

| ゲート | 判断 |
|---|---|
| 視覚的な読みやすさ | PASS。実画面で位の縦線、部分積のずれ、商の位置、現在段を確認。既存の島の世界色と紙の回答面を保つ |
| 理解・安全 | 机上確認PASS。文字・下線・枠で手順を示し、音OFF/reduced motionでも操作可能。誤答を責めず、未入力は採点しない。子どもとの実地観察は未実施 |
| 実装整合 | PASS。端末幅別の全入力44px以上、操作のhit確認、正規回答、最終だけの学習記録、支援状態、保存互換性を実行で確認 |

再遊びの仮説は「桁と途中式を頭だけで覚える負担が減り、自分で次の一手へ進みやすくなる」。実際の子どもの好み・再遊び率、Safari/iOS実機の観察はこのローカル実装検証では測っていない。

## 再実行

```bash
npm run verify:core
SANSU_WRITTEN_BASE_URL=http://127.0.0.1:5303 \
  SANSU_WRITTEN_EXPECTED_REVISION=aa36adad7dcc-written-40b72d6bce2c \
  SANSU_WRITTEN_OUTPUT=output/playwright/written-production-final \
  node tools/e2e-written-arithmetic.mjs
node tools/e2e-written-routes.mjs
node tools/e2e-written-hissan-hook.mjs
```

共通入力が再描画前に受ける連続イベントをpending refで追い、DOMの現在マスと送信を同じ段に保つ。スクロールは履歴自身の座標で計算する。検証中に見つかった最長段の補助ボタンのはみ出しと、Studyの42pxへの縮小は、履歴の高さと演算子列の表示を直して再確認した。
