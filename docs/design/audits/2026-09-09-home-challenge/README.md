# 家の1分チャレンジの実装と検証

2026-09-09。[仕様46](../../../product/46_home_learning_challenge_spec.md)の初版。家から一操作で始め、単調時計60秒の正解数・賞状・トロフィー・展示を本人別に保存する。通常学習・SRS・成長に得点を混ぜず、関連する足し算への接触だけ遅延確認へ反映する。

## 実画面

[入口→挑戦→結果→展示の一覧](contact-sheet.html)、[実行結果](report.json)、[固定ソース](build-source.json)。targetは `http://127.0.0.1:5317`、runtime revisionは `1177140-challenge-v1`、Island/challenge flagはtrue、candidateは `home-challenge-v1`。正式コミットSHAではなく作業コピーの固定ビルド識別子。ファイルhashで対象を特定する。

各幅で明示したLv8プロフィールと過去の独力正解1件だけをfixtureとして投入。挑戦の資格を初学習から実取得した証拠ではない。実表示した式を物理キーで回答し、実時間60秒・12問正解から2品を取得・展示・再読込した。phone390×844、tablet768×1024、横向き1024×768の全キー収容。tabletはSW制御下のoffline開始・完走・再読込。正式結果の再送、途中reloadの参考化、同じ累計完走数、通常logs/memory/completedSets不変を確認。得点、時間、獲得品を直接注入していない。

## 検証結果

- 専用domain/保存/hook/学習lease/家/ナビの62テストPASS。期限59999/60000ms、同一receipt、背景化、未確定保存、削除、旧DB、当日停止、配信flag、同時タブleaseを含む。
- 追加展示のgeometry/室内camera16テストPASS。旧16品の配置保持と追加2枠の投影範囲を確認。
- 全体3349/3353 PASSだった実行のDB migration/deletion3失敗はテストfixture更新後47テストでPASS。残る語彙70%進級の正式15秒テストはtimeout。新しい照会を除去した隔離比較でもtimeoutし、130回答の追加照会累計は97ms。診断コピーの60秒上限では18.45秒で進級assertion PASS。正式テストの上限を緩めて合格にはしていない。
- 全体lintはerror0（既存warning1）、最終対象lintとtypecheckはPASS。Island production buildとasset budget PASS。
- 隔離snapshotのclassic smoke31シナリオ、PWA update4シナリオPASS。固定buildのIsland PWAも8 protected-flow checksと実SWのoffline再読込・回答・再開がPASS（[要約](island-pwa-summary.json)）。Island専用の正式固定10問benchmarkは80 lane予定中65 laneで中断。次laneのwelcome表示待ちが15秒でtimeoutし、集計前なので速度gateの判定はない（[要約](fixed-ten-summary.json)）。完走分だけで合格扱いにしない。実iOS、二build移行E2Eは今回未実施。v8→v9の保持はIndexedDB単体検証であり二build実機検証の代替ではない。
- 全体docs:checkは最終実行でPASS。初回は並行作業の英語タスク文書の必須見出し不足でFAILし、当該文書の修正後に再確認した。差分空白チェックもPASS。

最終の「実行中プロフィール削除でPWA holdを解放する」処理は画像採取後の追加修正で、23対象テスト・typecheckを別確認した。画像をこの修正込みのexact-build証拠と偽らない。全release gate通過やデプロイ完了の宣言ではない。

## 三つの判定

- 視覚：実画面で全キー、結果と追加2品を確認。既存の家の画風を利用。外部のart承認は未取得。
- 理解・安全：時間切れと参考記録を非罰的に表示し、順位・賞の剥奪なし。子どもの無説明理解・再挑戦意欲・1分10問の適切さはHuman N=0で未検証。
- Runtime：上記限定シナリオはPASS。全体の正式verification/releaseはtimeoutと未実施項目があるためPARTIAL。

## main反映時の分離確認

並行作業の未コミット変更を含めず、remote main `79b0ace` に本機能だけを統合した。分離後の保存・移行・削除・hook・家・ナビの119テストがPASS。上の画像は撮影時の固定buildで、家の別タスクの装飾変更も含むため、この分離コミットの完全一致画像ではない。
