# Memo比較の再検証

このフォルダの他担当checkerと共存する、77/78およびNodeのmemo試験専用の記録。最終v17のruntime・変換コード・既存証拠JSONは変更していない。

リポジトリのルートからNode 22.23.3で実行する。

```sh
fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/evidence/checkers/sansu-memo-browser-pair-check.mjs
fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/evidence/checkers/sansu-memo-node-replay.mjs
```

## ブラウザ77/78の記録照合

`sansu-memo-browser-pair-check.mjs` は一時フォルダの実使用checkerを移したもの。証拠の場所だけ相対指定へ変更し、既存結果を書き換える処理を、保存済み結果との一致検査へ変更した。

元入力は親フォルダの77/78のbefore-state、cold-state、app-dom、cpu、cadenceの計10JSONとv16 build manifest。全入力SHA256を `memo-browser-pair-check.json` と照合し、操作前後の地形・Undo・配置・候補・実操作・時間窓を再確認する。利用記録の差も保存済みの全差分パスと照合する。ブラウザを再操作するスクリプトではなく、N=1の既存測定を検証する。ファイルは書き込まない。

## Nodeの厳密一致試験

`memo-samples-historical-bundle.mjs` はA/H試験と追加C/G試験に実際に使った `/private/tmp/sansu-memo-samples-check.mjs` のバイト同一コピー。入力fixture・実変換後の地形コード・診断counter・検査本体を含む。Node標準モジュール以外を必要とせず、当時の入力をそのまま再生できる。製品配布用bundleではない。

`sansu-memo-node-replay.mjs` は各方式のOFF/ONを別プロセスで再生し、親フォルダの `memo-samples-{A,H,C,G}-{false,true}.json` にある全hash、command結果・拒否、呼出数、純粋検査と一致することを要求する。元から不支持のexpanded/極値の拒否を成功へ変えない。合計40,340照会・108,954経路。新しい出力は一意のOS一時フォルダへ保存し、最後に場所を表示する。既存証拠を上書きしない。時間・heap値は実行環境で変わるため一致条件に含めない。

人が読める元の検査・生成手順は試験フォルダ直下の `memo-samples-check.ts` / `.mjs` と `memo-samples-transform.mjs` に保存済み。直下の元runnerは既存証拠を書き換える仕様なので、最終記録の再検証には上記のreplayを使う。最新sourceからの再bundleと、当時の診断bundleの再生は区別する。

コピー元・コピー先のSHA256と変更範囲は `memo-checker-provenance.json`。元入力JSONと主要結果は親フォルダに保持している。
