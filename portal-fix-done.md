# 内部ポータル状態表示の訂正

実施日: 2026-10-14。根拠: `/Users/yutogasaki/Documents/Codex/2026-10-14/task/portal-crosscheck-report.md`。

## 変更点

- `tools/portal-content.mjs`: 固定の「花庭P05制作中」を削除し、`.agents/tasks/TASKS.md` の冒頭と「次の一手」から現在地を生成。入り江R0〜R2完了、輪郭採用の利用者判断待ち、R3自動開始なしを表示する。旧全島の測定は過去の固定版として区別する。
- `tools/generate-agent-index.mjs`: 見出し区分を保持する共通抽出を使用。「実装済みとして扱うもの」「実行キューから分けるもの」等を仕事キューから除外。関連する仕事は4件で、育つ島v1・任意の導きと記念は実行対象に混入しない。同時に開始する件数ではないと表示する。
- 最新の正式試行をローカル証拠のtrial番号順で取得し、trial4のmachine／environment FAIL、uuidのrealpath境界の停止理由、browser・最終独立review・accept・report等の未実施、固定候補と停止記録への導線を表示する。記録欠落・読取失敗は未確認と表示する。trial3の旧PASSを現候補へ転用しない。
- 正本文書カードの固定確認日を削除し、内容確認日は未記録と表示する。Markdownリンクのフラグメントはパスと分けて生成する。
- 生成器は一致するファイルを再書込せず、書込失敗は対象と理由を報告して他の出力を処理する。一時検証出力用に `--output-dir` を追加。

## 再生成・未解決点

初回の `npm run agent:index` は7画面を書き込めた。その後、正本の見出しリンクのフラグメント処理を訂正した最終再生成は `.agents/index.html` のopenで `EPERM: operation not permitted` となった。権限変更・拒否の迂回は行っていない。

6画面は最終生成内容と一致しているが、正規の `.agents/index.html` だけ未同期。概要には最初の訂正内容があるが、親タスクの見出しリンクが `.md%23…` のままで不正。`npm run agent:index:check` はこの1画面をStaleとして失敗する。書込可能な実行環境で `npm run agent:index` → `npm run agent:index:check` → `node tools/check-internal-portal.mjs` が残る。

最終生成内容の7画面は `/tmp/sansu-portal-fix-preview/` に保存し、同出力への再生成一致と静的検査を確認した。これは正規出力の同期完了や正式trialの合格ではない。一時出力は7 HTMLのみで、正本文書・画像・証拠への相対リンクはrepo配置を前提とする。

正式trial4の環境FAILは未解決。新たな正式試行、履歴reset、browser・独立最終review・accept・reportへの進級は行っていない。今回のChromeによる補助表示確認も接続先が利用不能（`Browser is not available: chrome`）で未実施。

## 検証

- 対象回帰検査: PASS。正本の現在地／次の一手への追従、見出し文脈、4件と実装済み除外、trial4未実施段階、フラグメントURL、証拠欠落・破損・最新trial選択、HTMLエスケープを確認。ログ: `/tmp/sansu-portal-fix-regression.log`。
- 最終2生成元のESLint: PASS。
- `node tools/generate-agent-index.mjs --check --output-dir /tmp/sansu-portal-fix-preview`: PASS。
- 既存 `tools/check-internal-portal.mjs` の7画面読取先だけ一時出力へ置換した一時検査: 33検査PASS（共通ナビ、正規repoを参照先とするリンク、旧アンカー、graph異常系）。既存検査器は変更していない。
- 正規出力の整合: FAIL／1画面未同期。ログ: `/tmp/sansu-portal-fix-generate.log`、`/tmp/sansu-portal-fix-sync-check.log`。正規出力でのリンク検査も未同期の見出しリンクで失敗する。
- `npm run verify:core`: PASS（exit 0）。docs・現行UI入口guard・lint・typecheck・621テストファイル／5,377テスト・buildを完了。lintは既存のreact-refresh警告3件、buildには既存のchunkサイズ警告がある。生成器の最終追加分は全体検証開始後に変更したため、最終2生成元のESLintと対象回帰・生成検査を別途実施した。全体検証は共有のdirty作業ツリーの結果で、固定trial4の再試行・合格ではない。ログ: `/tmp/sansu-portal-fix-verify-core.log`。
- 完了記録追加後の `npm run docs:check`: PASS（既存のReview By期限切れ警告）。ログ: `/tmp/sansu-portal-fix-docs-final.log`。

## 変更範囲と引継ぎ

生成元2ファイル、再生成した7 HTML、依頼された本記録だけを変更。開始時にtracked／untrackedの25,936ファイルをSHA256で保存し、最終照合で上記9ファイル以外の不変を確認した（本記録は新規）。島制作・TASKS・既存の正本変更を保持。照合結果: `/tmp/sansu-portal-fix-preservation-final.json`。commit、push、stage、公開、外部送信は行っていない。

アプリ・学習・保存・配布の挙動を変えない内部表示訂正のため、製品仕様・TASKS・memory・ADR・runbookの更新は不要。未解決の同期拒否と正式検証の停止を本記録で引き継ぐ。
