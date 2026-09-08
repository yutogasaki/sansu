# 島の教科切り替え

- Status: Completed 2026-09-08
- Review By: 2026-09-15

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/28_mystic_island_spec.md
- docs/product/29_learning_progression_spec.md
- docs/ai/verification_matrix.md

## Goal

ユーザーが採用した「新しい内容は短く続け、復習を混ぜ、区切りで必要量と希望に合わせて教科を切り替える」を島のmixモードへ実装する。

## Scope / SSOT

- 親仕様01、島仕様28、学習進行仕様29。初回3問・通常6問/複雑3問、保存済み予約、SRSと独力判定を維持する。
- 既存の島・音声・成長の作業差分と共存する。通常Studyと遊園地の教科選択は維持する。
- 教科選択、同じ内容の短い継続、任意の「つぎも」操作を一つの変更として扱う。

## Plan

1. 教科選択と一区間だけの希望の契約を仕様へ記載。
2. 純粋な選択関数、既存plannerの任意の継続候補、原子的な予約/希望保存を実装。
3. 実UIから継続を選び、再読込・次区間・取消・保存失敗を検証。

## Verification

- verify:core、e2e:smoke、e2e:pwa-update、e2e:island、e2e:island-pwa、benchmark:island-fixed-ten。
- 教科の偏り、初見/既習、期限到達/無効/停止中の復習、単教科設定、旧予約、プロフィール分離、二重送信/競合/予約失敗を対象とする。
- phone/tabletの実表示で操作領域、全入力、音なし・reduced motionと追加0操作の自動継続を確認する。

## Progress

- 仕様・選択関数・継続候補・原子的な希望保存・任意の操作を実装済み。既存の学習強化作業の独力カウンタとDue資格に接続した。
- 日付のみの旧期限は共通Dueと同じローカル時刻で比較する。希望保存は現在の問題/下書き/学習ログ/成長を変えず、次予約の成功時だけ消費する。
- 最終固定ソース `9300ea0-subjects-880a65a8d2ec` でverify:core PASS（182ファイル/2,128テスト、lint・typecheck・build・assets）。
- 最終phone/tablet UI 6シナリオ・26画面、通常島11ケース（各25区間）、classic smoke31/PWA4、島PWA7＋実offline、固定10問80run/全15gateがPASS。固定入力784ファイル一致。共有workspaceのtypecheckとdiffチェックもPASS。
- 原FAILと同一条件での再実行、実画面、独立ゲート、差分レビューは[監査](../../design/audits/2026-09-08-adaptive-subjects/README.md)へ保存した。成長比較クリックの単発未遷移は原因未確定のまま記録。
- sansu-doc-sync: 親01、島28、学習29、docs index、verification matrixを同期。optional fieldの追加で既存予約を維持し、schema移行/ADRの追加は不要。
- ローカル実装として完了。後日の学習効果・子どもの継続率・実機は未観察。公開/commit/pushは実施していない。既存の並行作業を保持。
