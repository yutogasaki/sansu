# Written digit entry — 2026-09-09

筆算は左から数字だけを入力する。小数点、位合わせの補助0は表示側で補い、従来の保存座標・回答配列へ戻して採点する。SSOT: [画面仕様](../../../product/06_screen_specs.md)。

## Scope and evidence

- 対象: 共有作業ツリーのローカル Vite、Island enabled、http://127.0.0.1:5689。固定production版・配布済み版の認定ではない。
- component diagnostic: [14ケース](component-report.json)。12.3+4、3.5−0.78、0.9+0.1、0.1×0.2、1.2÷0.3、1000−999、0.50互換を390/768幅で入力。実LearningAnswerFormへの明示fixtureで、planner/保存は含まない。最初の診断ページはReact DOMの直接import指定を誤って起動失敗。bare importへ修正後の結果を掲載。
- native integration: [8ケース](native-report.json)。明示プロフィールを起点に実plannerで取得した問題へ物理入力し、実回答receiptを確認。全8receiptがcorrect。reportのskillは予約を誘導した希望skillであり、実際の出題はquestionを参照（希望と同じcategoryを保証しない）。
- hint regression: [6ケース](hint-report.json)。390/1024幅、即時・完了通知800ms遅延・保存abortと再試行。元の保存配列、単一receipt、下書き、Backspace、キー位置を保持。
- Study hook: 小数点自動保持、連続入力、誤答部分訂正、C、Backspaceを単体検査。

## Visual review

[Phone runtime](phone.png) / [Tablet runtime](tablet.png) / [位合わせのcomponent診断](alignment.png)

- 視覚: 位をそろえた数字と細い小数点を確認。掛け算は末尾の数字をそろえる。
- 理解・安全: 入力開始が左側。小数点は自動。必要な0（0.02の0など）は数字として入力。子どもの理解・実機iPadは未検証。
- Runtime: 上記の入力と保存検査。PWA更新・offline・島全体の成長検査は今回再実行していない。

## Boundaries

既存の桁マスによる補助は維持する。入力完了は正誤ではなく全数字マスが埋まった時点。答えの桁数や小数点位置まで独力で問うモードではない。小数の割り算は両数の同じ小数点移動を示す最終回答形式で、整数の多段筆算と同じ途中式を新設したものではない。

## Verification

- `npm run verify:core`: PASS（301 files / 3,270 tests、docs、lint、typecheck、build、asset budgets）。lintの既存IslandMilestone export warning 1件、buildのchunk size警告あり。最初の全体実行は旧右側カーソル期待1件だけFAIL、期待を左側へ更新して全体を再実行した。
- shared working-tree checksであり、他タスクの変更を含む。commit・push・公開なし。
- 再現: 開発サーバー起動後 `node tools/e2e-place-input.mjs`（ignored outputへ明示diagnosticページを生成）、`node tools/e2e-decimal-input.mjs`、`node tools/e2e-hint-input.mjs`。対象URL/出力先は各ハーネスの環境変数を参照。

## Main commit candidate verification

- Base `e40565a6521e5d0f234e3201d05b043a2df6c49f` に今回の41ファイルを重ねた独立worktreeで `npm run verify:core` PASS（3394 tests、docs/lint/typecheck/build/assets）。共有作業ツリー全体の結果とは別。
- 同候補のVite/Island有効で [component14件](commit-component-report.json)、[実planner回答8件](commit-native-report.json)、[ヒント保存6件](commit-hint-report.json) PASS。実planner reportはrequestedSkillとactualSkillを区別。
- ユーザーのmain commit/push指示に対応した候補。PWA/全体releaseの認定ではない。
