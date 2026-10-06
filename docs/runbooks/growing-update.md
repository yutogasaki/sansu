# 育つ島の更新と復旧を確認する

## 目的と範囲

`tools/e2e-growing-update.mjs`は、隔離したlocal originで実Service Workerを旧版→候補版→安全な復旧版へ切り替える。390/768幅、通常更新と更新検知後の通信切断を検査する。本番の配布・実利用者のデータ操作・実iPhoneの確認は行わない。

更新中の通常学習と保存済み問題を保護し、島へ閉じたcheckpointで1回だけreloadする。実回答と配置で作った所有物、学習正本、同じ予約を保持し、候補版のoffline再起動後に追加回答する。旧workerへの固定は明示した通信障害で、appの更新イベントを注入しない。

## 入力を用意する

旧版・候補版・復旧版を、それぞれ固定したsourceから独立にproduction buildする。Island/Growing有効、Life preview/BuildPlay/NatureTown無効の構成を明示する。root dotenvを隔離buildへ持ち込まない。復旧版は現行Growingの`guidedIslands`を読めるwriterを選び、保存形式切替前の古いdeploymentへ戻さない。

各manifestは次を持つJSONで、三つの版のversionとentry JSは異なること。

- `sourceDir`、`distDir`: source/buildの絶対local path。
- `inputs`: source/QA入力の相対path→SHA256。`sourceHash`はそのJSON文字列のSHA256。
- `distFiles`: 全distファイルの相対path→SHA256。
- `version`: 実際の`dist/version.json`の内容。

manifestの入力は実行前と成功終了時に照合する。QA helperも開始終了に照合し、実行中に編集したsourceの結果を最終候補のPASSへ流用しない。既存outputの上書きを拒否する。

## 実行

```bash
SANSU_GROWING_OLD_MANIFEST=/absolute/path/old.json \
SANSU_GROWING_NEW_MANIFEST=/absolute/path/new.json \
SANSU_GROWING_ROLLBACK_MANIFEST=/absolute/path/rollback.json \
SANSU_GROWING_UPDATE_OUTPUT=output/growing-update-new \
node tools/e2e-growing-update.mjs
```

`report.json`は実URL、buildの入力/版、旧保存→現行保存、画面identity、通常/中断の結果、reload列、失敗時の画面とcleanupを記録する。使用した旧Git版とwriter境界を完了記録へ残す。同じ最新版を二回buildしただけの検査を、過去保存の移行検査と呼ばない。

## 失敗と完了の判断

最初の失敗をapp・harness・環境に分け、失敗reportを保存してから修正する。ブラウザとlocal serverはfinallyで終了する。学習正本・既得所有の保持、更新待機、offline再開、対応writerへの復旧をそれぞれ判定する。

この検査は、全写真Blob・兄弟の全保存・過去の全deployment・実ユーザー端末を網羅しない。旧writerの正本隔離はrepository回帰と、対象の実旧writerを使う診断で別に検査する。視覚の魅力、子どもの理解/安全、翌日の再訪は独立した未評価のゲートとして残す。

旧writerを実sourceで診断する場合は、同じ旧/候補manifestと新規JSON出力を指定する。`fake-indexeddb`内の別DBで実旧commandが旧tableだけを書き、現行の正本を上書きしないこと、旧tabの学習事実を現行writerが一回だけ取り込むことを確認する。ブラウザの更新検査とは別の診断。

```bash
SANSU_GROWING_OLD_MANIFEST=/absolute/path/old.json \
SANSU_GROWING_NEW_MANIFEST=/absolute/path/new.json \
SANSU_GROWING_LEGACY_OUTPUT=output/growing-legacy-new.json \
node tools/check-growing-legacy-writer.mjs
```
