# Sansu ポータル検証・2026-10-17

結果：**FAIL／正式受入HOLD**。Sansuの未commit作業ツリーのみを対象とした。統合先は `portal/index.html`。元 `.agents/index.html` と資源は維持し、入口切替・commit・push・公開は行っていない。

候補 `1896ace0b989df66427b4df811f508cca908388c927f45c6dadc5fa0708e3891`、生成manifest SHA `b76a54e15341dd75b70f6a30dc690500d1ba82cff321962e985b0135358225eb`、HEAD `eb4b907bdf5cb6e99c30c4ac6f28d2d3969cac50`。固定shell 1.2.2／reader 1.1.3。以前の合格は転用しない。

| 検査 | 結果・限界 |
| --- | --- |
| 既存出力の生成一致 | PASS、1,315ファイル。[ログ](generation.log)。 |
| 入口必須検査 | FAIL。`npm run agent:index:check` は元7画面検査と図の検査の後、歴史資料の `whole-landscape.blend` 欠損で停止。[ログ](entry.log)。 |
| 素材の網羅性 | FAIL。元generatorと同じroots/extensionsの14,069件中9,254件登録、4,815件未登録。資源参照6件が不存在。[現在版の一覧](inventory.json)。原本が存在するだけでは個別統合済みとしない。 |
| 空出力の診断 | FAIL。portal配下を不存在として読み取り、書き込みをメモリへ捕捉する非破壊診断で、固定integration adapterが既存 `portal/index.html` を読もうとして停止。[方法・例外](empty-output.json)／[実行脚本](empty-output.mjs)。物理的な隔離復元試験の代用にはしない。 |
| 主要操作 | 最初の標準harnessは詳細閉鎖直後のフォーカスでFAIL。[元記録](browser/browser.json)。close完了を明示待機した診断harnessでは6操作群PASS。[診断結果](browser-wait/browser.json)／[脚本](browser-wait-diagnostic.mjs)。ページ本体を変更せず検査の競合を切り分けた。 |
| 入口の表示比較 | 旧/新を同じ1440×900／390×900で撮影・実見。横はみ出し0、画像欠損0。[計測](comparison/comparison.json)。入口の表示範囲のみで、全ページ・全長の合格ではない。 |
| verify:core | PASS、623ファイル・5,384テスト。テスト781.17秒、build/asset budgetも通過。lintは警告3件。[全ログ](core.log)。test:runを内包するため同じ全体テストを重複実行していない。 |

操作は個人情報を持たない隔離Chromiumで、外部通信を遮断して確認した。検索／多条件／件数／0件／解除／URL復元／JSON／Escapeとfocus、図鑑32画像／比較／メモ追加編集保存再読込export削除、観察票save/import/export/invalid import/delete、保存失敗時の入力保持、フォルダ一覧を対象とした。file↔HTTP間の実メモ移行、実Safari/iOS、全ページの表・画像説明・読み上げ・フォーカス順、現行候補全体の独立審査は未確認。hubや他リポの合格は判定していない。

比較で確認できた改善は、入口の最初の画面に目的・現在地・次の判断・主要成果画像が並ぶ点。旧版最初の画面は試行履歴が中心だった。これは情報の配置の観察であり、実利用者の探しやすさを測定した結果ではない。

- PC：[旧](comparison/before-1440.jpg)／[新](comparison/after-1440.jpg)
- スマホ：[旧](comparison/before-390.jpg)／[新](comparison/after-390.jpg)

復旧：今回は製品・生成器・元画面を変更していない。保持した `.agents/index.html` が使用できる。欠損資料を別版の模型等で置換していない。既存の復旧保管は前回記録を参照する。未確認を残したまま元画面を削除・非表示にしない。

[機械記録](report.json)。終了時に生成manifestの13,450入力を再hashし、不一致0件。今回の追加記録は生成入力ではない。[再構成に備えた実態地図と削除分類](structure.md)／[308 HTML台帳](structure.json)。共通版の先行試行を待ち、外枠の独自改変は行っていない。
