# P04の殻・入口・共有床 — 本体への接続

2026-10-12。**美術HOLD、独立理解／安全HOLD（N=0）、包括runtime PARTIAL。M1は未完。** [編集可能なsource](../2026-10-12-authored-cove-entrance/README.md)を、配置・予告・描画・実歩行が同じ床を読む本体へ接続している。

最新の固定候補c4はcore606 files／5,265 testsと入り江の全編集旅程がPASS。[実画面シート](c4/contact-sheet.html)に全景・近景・回転・390幅・768幅の10画面と予告画像を保存した。殻の実選択、予告取消、通路を保つ移動、収納、元位置への復元を同じ32所有物／家8軒／73配置権で確認した。[入力と実行証拠](c4/core-full-archive-proof.json)の2,137 core入力とdriverの2,012入力は前後一致し、driverは同byteのsubset。[既存回帰の初回結果](c4/regressions/README.md)は島編集・水庭・通常Growing・classicの4件PASS。花庭の初回900秒上限による未完了を保存したうえで、外側上限のみ2,400秒に変更した[同入力の再実行](c4/flower-full-retry-2400/verification.md)が12画面・4canvas選択・4編集・若い／成熟入力までPASSした。これで既存5回帰が揃った。全体の範囲と限界は[c4検証記録](c4/verification.md)にまとめる。

[作者の実画面評価](c4/art-review.md)はdesktop38/60、390幅35/60、768幅34/60をそれぞれHOLDとする。丸い岸は矩形台座を解消したが、中央の裸丘と薄い森、均一な地面、tablet全景の余白が残る。次の制作は[中央丘肩の実支持・入口と森林](../2026-10-12-authored-whole-massing/next-production.md)。[c4 sourceの復元](c4/source-recovery/README.md)と[通常falseの配布境界](c4/build-boundary/README.md)も保存した。rawモデルの通常配布除外は確認したが、床JSON／JS adapterは残るため全native dataの除外とは呼ばない。

c1の実全景と近景では、高い大屋根を低い殻へ置き換え、二軒の屋根と入口が見えるようになった。一方、矩形の床が台座に見えたため、c2では殻のbyteと所有物を保ち、既存岸に接する丸い草地へ改稿した。[c2の実全景・近景](c2/contact-sheet.html)で矩形台座の解消を確認。全島の作者評価は38/60、別agentは35/60で、どちらも美術HOLD。

c2固定coreは606 files／5,263 tests・lint／typecheck／build／asset budget PASS。2,137入力が開始終了一致し、[入力archiveとSHA](c2/core-archive-proof.json)、[core log](c2/core/execution.log.txt)、[通常false配布境界](c2/build-boundary/README.md)を保持する。raw GLB/gzip/Blenderは通常配布に含まないが、coveの床／nav JSONとJS adapterはbundleに残る。全dataの除外や実SW更新を証明したとはしない。

c2の全browser旅程は実殻選択と予告取消を通過した後、p9を(4,-4)へ移した時点で24 ownerへの接近が不成立となりFAILした。[失敗画面と生記録](c2/full-first-failure/report.json)を保存し、[実geometryの診断と回帰](target-diagnosis/README.md)で移動先(4,-4)が主路の19歩行点を占有したと確認した。同じworldでp9を元位置へ戻すと全32ownerへ接近でき、水庭と継続床は不変。配置許可を全島通行保証と取り違えたharnessの前提を修正し、通路を保つ(12,-9)を事前確認する。l20〜l23のdryFloor=falseは初期の成功画面にもあり、新しい床消失の証拠ではない。

c3固定coreは606 files／5,265 tests PASS、2,137入力の開始終了一致を確認した。[coreと最初のbrowser失敗](c3/core-full-first-failure-proof.json)、[base＋QA二ファイルの復元archive](c3/source-recovery/README.md)、[通常false配布境界](c3/build-boundary/README.md)を保持する。実画面では殻選択・予告取消・(12,-9)への移動と32 ownerの接近・収納まで通過した。元位置への復元予告のID待ちでタイムアウトし、[生記録と実画面](c3/full-first-failure/report.json)を保存した。[純粋診断](target-diagnosis/c3-recovery/README.md)で、検査用JSONから消えたundefinedのcellキーを末尾へ戻すと、全stateの値・床・経路・殻が同じでも検査期待値の指紋だけ変わると確定した。実アプリの予告／復元IDは初期IDと一致する。保護したstateの不変条件を確認した後、初期state自体を復元目標にするようdriverを補正し、c4の全編集・回転・390/768幅で再検証した。失敗したc3の記録は上書きしない。

- [c1実画面と美術評価](c1/art-review.md)：固定DEVの2画面。全編集旅程・390/768幅は未実行。
- [実geometry／利用のfocused検査](focused-integration/README.md)：2 files／13 tests PASS。初期previewで衝突判定が消える不具合を再現し修正した。
- [実装の範囲・仕様同期・レビュー](implementation.md)。
- [c1実行証拠](c1/archive-proof.json)：2,068入力を凍結し、browserの1,961入力が同じhashのsubset。入力tarと初回core失敗を保持する。

c1のcoreはdocs段階でFAIL。c6検証記録の二つのリンクがgitignore対象の `.log` を指し、非ignoreファイルから作った固定コピーにログが入らなかった。ログ内容を保った `.log.txt` のdurable copyとリンクへ修正した。c1でlint／unit／buildまで通ったという意味にはしない。

現在のvisual candidateは共有岸の改稿を含む `native05-authored-cove-shore-v4`。殻だけのsource IDは `native05-authored-cove-corner-v3` とSHAを保持して区別する。[v4 focused 5 files／30 tests](focused-v4/README.md)と[独立したsource検査](source-v4-independent/README.md)はPASS。全編集旅程の失敗はc4で解決した。5回帰を同じ固定入力へ照合し、入り江の局所実装と対象runtime検証を閉じた。本人取得・自然成熟・保存／offline・性能・独立観察・公開は未達。
