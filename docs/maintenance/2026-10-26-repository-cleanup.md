# 生成物と重複ファイルのGit整理

2026-10-26。利用者の「いらんもんあるよね？」「どうにかして」への対応。目的は未コミットの生成物と不要な重複を整理すること。国語・住人・島の実装、過去の唯一の原本・判断・失敗証拠をこの整理へ混ぜない。push・公開は行わない。

## ポータル

`portal/` は既存の `.gitignore` にある再生成可能な内部出力。既追跡をGitの管理対象から外し、現存するローカルファイルは保持する。整理前の全2,118ファイル・268,037,495 bytesを、ignoredの `output/repo-cleanup/20261026-0746/portal.tar.gz` へ保全した。archiveと元ファイルのSHA256が全件一致することを検査した。詳細manifestは同じフォルダの `portal-manifest.json`。

archive SHA256: `bf2c1a7c7420eb45351cc3b171b85c9e14139c85231788a634ea11a2baa25d0a`。

これは現存する出力の復旧を確認した記録で、以前から欠損する歴史資料6件などの全復元を確認したものではない。過去のGit上の版は履歴に残る。Git外の素材や実利用者の保存には触れない。

通常の生成はNode24以上で `npm run agent:index`、検査は `npm run agent:index:check`。既存のflow evidence不整合などによる生成停止は、今回の追跡解除とは分ける。生成器・固定vendor・入力仕様は変更しない。

## ローカルの現存版を戻す

archiveを既存の `portal/` へ直接上書きしない。まず空の退避先へ展開する。

```sh
python3 -m tarfile -e output/repo-cleanup/20261026-0746/portal.tar.gz output/repo-cleanup/20261026-0746/restored
```

展開した `restored/portal/` とmanifestの全ファイルSHA256を比較する。元のローカル出力が必要なら、現在の `portal/` を別名へ退避し、照合済みのディレクトリを戻す。archive自体はローカル保管であり、公開Gitへ追加しない。

## 重複の選別

1KB以上の未追跡ファイルでは、同一内容の余分なコピー262件・約15.3MiBが見つかった。同じbytesでも参照や検証時点の役割が異なる場合があるため、一括削除しない。参照のないコピーを選び、削除前に元パス・SHA256・同一内容の残す先と復旧archiveを保存する。初回失敗・採用判断・唯一の画像は保持する。

今回、既追跡のポータル1,764件の追跡を解除し、現物2,118件は保持した。重複の多くは別の検証記録から参照されていたため残し、参照のない同一画像1件と、同じアプリ入力の最終PASSに置き換わった中間PASS診断7件のみを退避した。合計8ファイル・287,494 bytes。初回失敗と最終診断は保持している。

退避先は `output/repo-cleanup/20261026-0746/removed-copies.tar.gz`、元パスと全件hashは同じ場所の `removed-copies-manifest.json`。archive SHA256は `2afafab3fea0d4ca586ebd315158f99a8b3eac45c63699b4fba8de69a780c3b8`。全件の読み戻し一致を確認した。復元する場合は空の別ディレクトリへ展開し、manifestと照合してから戻す。

`docs/design/2026-10-24-terrace-method-lab/lab.bundle.js` はREADMEに生成手順があるためignoreへ追加した。現物とローカルの復旧コピーは保持した。編集元の `lab.ts` と撮影・生成手順は管理対象のまま。

国語・住人・島の製品ソース、教材、唯一の原本・採用判断、既存の未コミット変更は保持した。整理のローカルcommitだけを作り、push・公開は行わない。作業場の `npm run docs:check` と、ポータル出力を含まないindexの書出し先での `node tools/check-docs.mjs` はPASS。初回のindex検査で見つかった生成前ポータルへのリンク2件は、生成・入口の案内へ修正して再検査した。ポータル読取・入口のVitest 7件もPASS。検査コマンドを誤ってNodeのtest runnerで実行した初回エラーはローカル記録に保持し、正しいVitestで確認した。アプリsource・生成器は変更していないため製品の全体検査・buildは追加していない。ローカルの詳細記録は `output/repo-cleanup/20261026-0746/`。
