# 手元の変更を最新mainへ整理して統合する

2026-09-27。ユーザーが「バックアップ→最新版との重複整理→未統合の変更を目的別にcommit→検証してmainへpush」を依頼した。

## 固定した範囲

- 元の作業フォルダは `620236a5`、統合先は `4af6d892`。幻想の庭・自然循環・版20の保存保護・初回報酬・ほしのりとスタンプは公開済みの実装を維持する。
- 非ignoreの変更一式をローカルの `backup/pre-main-sync-20260927-214035`（`83a6a34e`）に保存。元のindex、staged/unstagedのbinary patchは `.git/codex-backups/20260927-214035/` に保存した。バックアップcommit自体をmainの履歴へ混ぜない。
- 最新mainとの比較で249ファイルは同じ内容、65ファイルは差があった。3-wayの統合後、古い保存実装と検証器を復活させず、未統合の旧試作撤去・メニュー整理・資料整理を残した。[保護した入力](reconciliation.json)。
- ぴったり連鎖の独立実装と開発commandを撤去し、仕様・検証を履歴へ保存。島メニューの「ほかの あそび」を外し、旧 `/battle`・`/explore` と保存は維持する。ぽこもこ・島の美術・学習判定・保存writer・配信flagは変更しない。
- 資料ポータルに「仕様と実装」の一覧、画像寸法・容量・検索を追加。公開済みと未実装の状態を仕様・タスクと照合した。

## 失敗を含む確認記録

- 最初の[core](core.txt)は4232件PASS、保存clockの1件が5000msでtimeout。同時実行下の結果を合格に置き換えず保持する。同じ無変更の[保存10件の単独再検査](repository-recheck.txt)はPASS（対象のclock検査896ms）。
- [旧home-layout検査](home-layout/report.json)は既存のナビ高さ65.59375pxに対し、旧検証器が上限64pxを要求して停止。ナビのCSSと高さを作る実装は今回の差分に含まない。上限を緩めて合格にしない。
- 今回の入口整理を直接確認する検査の[初回](legacy-entry/report.json)は、折りたたまれた「しまを ととのえる」を開く前に中のボタンの可視性を要求して失敗。検証操作を修正した[再検査](legacy-entry-v2/report.json)は390/768幅でPASS。実UIで回答→旧ゲームの直接URL→同じ学習へ戻り、記録と予約を保持する。初期プロフィールのみ明示fixture、取得した報酬は注入しない。
- [classic smoke](smoke.txt)は31条件PASS。[classic PWA](classic-pwa.txt)は4条件PASS。
- [資料マップ](portal/report.json)は390/1024幅で横はみ出しなし、検索・旧履歴の展開・JavaScript errorなしを確認。

## 最終候補の検証

- 全件の再試行も同じ5000ms timeoutだったため、[その失敗](core-contended-retry.txt)も保持し、テスト内容・timeoutを変更せず `npm run test:run -- --maxWorkers=2 --minWorkers=1` を実行。[474ファイル・4233 tests](tests-controlled.txt)すべてPASS。対象のclock検査は909ms。`verify:core` という一括コマンドそのものがPASSしたとは記録しない。docs/current-entry/lint/typecheckは先行core内でPASS、全件testsとbuildは個別に完了した。
- [本番フラグのbuild](production-build.txt)はPASS。別の一時ディレクトリへ隔離し、[1326件の入力SHA](production-build-source.json)が統合候補と一致することを照合。PWA precacheは8.38 MiB / 12 MiB。
- [旧Islandの全経路](island.txt)は両幅の全4地区成熟、実WebGL loss/復旧、初回設定、通常/誤答/筆算/分数/英語/reduced motionがPASS。[Island PWA](island-pwa.txt)も8保護フローと実SW offline再起動・回答・復帰がPASS。これらはメニュー変更のあるLife無効の対象で実施した。

- [固定10問の速度比較](throughput.json)は両幅・10反復・80 runで `evidence.eligible=true / pass=true`。正答後の入力可能P95最大221.9ms、誤答228.2ms、区間境界206.3ms。前後のapp/QA source一致、通常問題間の追加操作0。明示した使い捨てfixtureであり、本番plannerや子どもの速度の証明ではない。

## 判定の境界

今回の目的は差分の安全な統合。庭の美術の最終承認、実機・子どもの理解、30品の性能改善、仕様51全体の完成を新たに認定する作業ではない。旧home-layout検証器の制約は残件とする。

## 元フォルダへの同時変更

検証中に元フォルダの `IslandAnswerFeedback.tsx`、`PokomokoLearningEffects.tsx`、`PokomokoLearningFeedback.css`、`usePokomokoFeedback.ts` に当初backup以降の別変更を検出した。staged patchは当初と一致。未検証の新しい演出変更を今回のmain候補へ混ぜず、元フォルダのstash/一括同期も行わない。観測時点の全作業内容は追加のローカルbackup `backup/concurrent-learning-main-sync-20260927`（`59b31f06`）にも保存した。この後の同時作業まですべて凍結したという意味ではない。
