# 家のメニューを紙のアトリエへ

ユーザーの[現行画面](reference.jpg)から、家のメニューの階層・折り返し・素材を改善した。愛着の柱を強める表示変更。既存の室内、ぽこもこ、所有、学習、保存と移動先を保持する。実装はローカル、コミット・push・本番公開は未実施。

## 引き継ぐものと変えるもの

| 引き継ぐ | 変える |
|---|---|
| 生成り、藍、青と既存の玩具アイコン | 同じ高さの縦長カード列を、宝ものの主入口と対の小入口へ |
| 家の全入口と任意チャレンジの直接開始 | 未読数を題名から分け、手紙・模様替えの題名と説明を縦に揃える |
| 実際の未読・ことば数・記録 | 説明がアイコンの隣で窮屈に折れる配置をなくす |
| 既存の室内3Dと住人のidentity | メニューの局所的な紙・布・短い影の表現 |

画像生成・新しいキャラクター・遭遇美術は使っていない。DOMのUtility面として既存の素材を整理し、学習の演出・入力・テンポ、ゲーム規則と保存境界には触れていない。仕様は[UIガイドライン07](../../product/07_ui_design_guideline.md)の「家のメニューの素材と階層」を更新。親仕様01、画面遷移43、島の規則52、保存仕様13は挙動不変のため変更不要。

## 実画面の確認

Candidate: `house-paper-atelier-v1`。開いたdialogの `data-house-menu-candidate` で照合する。家自体の `house-world-first-v1` とIslandの配信flagを上書きしない。実画面のメタデータ・revision/version・viewport・URL・音off/reduced motion・SW状態は検証reportへ記録する。DEVであり、revisionはdirty sourceを識別しきれないため、対象実装の開始/終了SHAも比較する。

検証用の隔離プロフィールで、添付と同じ未読2通・ことば74こ・チャレンジ開始資格を明示fixtureとして描画する。320pxと短い横画面は空の手紙・未取得の語・開始資格なしも確認する。このfixtureは実獲得・学習効果・子どもの利用の証拠ではない。

最初の実画面で旧CSSの全幅指定との干渉を発見した。修正中のcaptureは `output/playwright/house-atelier-first-pass` に診断として保持し、最終候補の証拠に混ぜない。

## 独立した判定

- **見た目**：実画面で主入口・短い副入口・手紙の実数・チャレンジの強弱を比較する。作者によるUtility面の視覚レビューであり、世界最高・子どもの好みを実証したものではない。
- **理解・安全**：偽の未読・緊急性・報酬・学習の圧力を追加しない。未説明の観察者はN=0、子どもの理解や翌日の再訪は未評価。
- **動作**：家の開閉、Escapeとfocus復帰、記念・お知らせの往復、手紙の既読、模様替えの展開、遊び方の展開、通常学習への復帰を確認する。保存失敗表示は既存のまま。実機・PWA更新・本番配布はこの変更の合格に含めない。

## 検証記録

`npm run verify:core`: docs、入口guard、lint、typecheck、512ファイル・4,565テスト、buildとassets PASS。既存のReview By期限warning4件、IslandMilestoneのFast Refresh warning1件を保持。最初のcore中にCSSの視覚修正が入ったため、最終CSSでbuild/assetsを再実行した。

`npm run e2e:smoke`: classic回帰31/31 PASS。現行IslandのUI証拠として流用しない。

実画面検証は[再実行スクリプト](ui.mjs)で行う。`SANSU_HOUSE_OUTPUT` へ新しい出力先を指定する。現行標準DEV5198と育つ島DEV5260を起動する。育つ島の390×844、768×1024、320×568、568×320と、標準Islandの390×844、768×1024の全6ケースPASS。[実行report](report.json)の開始/終了対象source SHA一致、全caseのpageerror 0、44pxの入口、横overflowなし、Escape focus復帰、閲覧中の学習/プロフィールstore不変、学習の全数字キーを確認。音off、390幅は通常motion、他はreduced motion。

[変更前後と実画面の往復](screens.html)、[接触シート](contact-sheet.png)、[スマホ](growing-390-menu.png)、[iPad](growing-768-menu.png)。各画像は実際のruntime screenshotから構成し、画像案やモックを混ぜていない。

[core](core.log)、[最終build/assets](build-final.log)、[smoke](smoke.log)、[最終lint](lint-final.log)、[文書](docs-final.log)、[実画面実行](ui-final.log)のログを保管。追加の[全src snapshot](source-snapshot.json)は1,368ファイルを集計し、実画面検証中も同じhashであることを確認した。最初のcoreの全入力を固定したcommit検証の代用ではない。

終了記録を加えた後の[文書check](docs-closeout.log)は、並行作業で新規追加された `docs/tasks/active/2026-10-01-island-guidance.md` の必須見出し `Docs To Touch` / `Verification` 不足2件でFAIL。上記の先行docs PASSと区別する。今回のUI/仕様07/証拠の文書エラーではなく、他作業の進行中ファイルは変更していない。最終working tree全体のdocs PASSやrelease PASSは認定しない。
