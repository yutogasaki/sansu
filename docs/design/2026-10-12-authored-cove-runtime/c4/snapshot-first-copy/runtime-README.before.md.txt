# P04の殻・入口・共有床 — 本体への接続

2026-10-12。**美術HOLD、独立理解／安全HOLD（N=0）、runtime PARTIAL。M1は未完。** [編集可能なsource](../2026-10-12-authored-cove-entrance/README.md)を、配置・予告・描画・実歩行が同じ床を読む本体へ接続している。

c1の実全景と近景では、高い大屋根を低い殻へ置き換え、二軒の屋根と入口が見えるようになった。一方、矩形の床が台座に見えたため、c2では殻のbyteと所有物を保ち、既存岸に接する丸い草地へ改稿した。[c2の実全景・近景](c2/contact-sheet.html)で矩形台座の解消を確認。全島の作者評価は38/60、別agentは35/60で、どちらも美術HOLD。

c2固定coreは606 files／5,263 tests・lint／typecheck／build／asset budget PASS。2,137入力が開始終了一致し、[入力archiveとSHA](c2/core-archive-proof.json)、[core log](c2/core/execution.log.txt)、[通常false配布境界](c2/build-boundary/README.md)を保持する。raw GLB/gzip/Blenderは通常配布に含まないが、coveの床／nav JSONとJS adapterはbundleに残る。全dataの除外や実SW更新を証明したとはしない。

c2の全browser旅程は実殻選択と予告取消を通過した後、p9を(4,-4)へ移した時点で24 ownerへの接近が不成立となりFAILした。[失敗画面と生記録](c2/full-first-failure/report.json)を保存し、[実geometryの診断と回帰](target-diagnosis/README.md)で移動先(4,-4)が主路の19歩行点を占有したと確認した。同じworldでp9を元位置へ戻すと全32ownerへ接近でき、水庭と継続床は不変。配置許可を全島通行保証と取り違えたharnessの前提を修正し、通路を保つ(12,-9)を事前確認する。l20〜l23のdryFloor=falseは初期の成功画面にもあり、新しい床消失の証拠ではない。

c3固定coreは606 files／5,265 tests PASS、2,137入力の開始終了一致を確認した。[coreと最初のbrowser失敗](c3/core-full-first-failure-proof.json)、[base＋QA二ファイルの復元archive](c3/source-recovery/README.md)、[通常false配布境界](c3/build-boundary/README.md)を保持する。実画面では殻選択・予告取消・(12,-9)への移動と32 ownerの接近・収納まで通過した。元位置への復元予告のID待ちでタイムアウトし、[生記録と実画面](c3/full-first-failure/report.json)を保存した。失敗時の予告metadataは初期IDと一致し、殻も表示されている。検査用JSONで省略されたcellキーを後付けする期待値と、アプリの予告stateのfield順を診断中である。回転・390/768幅と元の全島／水庭／花庭・通常Growing・classicの5回帰は未完。

- [c1実画面と美術評価](c1/art-review.md)：固定DEVの2画面。全編集旅程・390/768幅は未実行。
- [実geometry／利用のfocused検査](focused-integration/README.md)：2 files／13 tests PASS。初期previewで衝突判定が消える不具合を再現し修正した。
- [実装の範囲・仕様同期・レビュー](implementation.md)。
- [c1実行証拠](c1/archive-proof.json)：2,068入力を凍結し、browserの1,961入力が同じhashのsubset。入力tarと初回core失敗を保持する。

c1のcoreはdocs段階でFAIL。c6検証記録の二つのリンクがgitignore対象の `.log` を指し、非ignoreファイルから作った固定コピーにログが入らなかった。ログ内容を保った `.log.txt` のdurable copyとリンクへ修正した。c1でlint／unit／buildまで通ったという意味にはしない。

現在のvisual candidateは共有岸の改稿を含む `native05-authored-cove-shore-v4`。殻だけのsource IDは `native05-authored-cove-corner-v3` とSHAを保持して区別する。[v4 focused 5 files／30 tests](focused-v4/README.md)と[独立したsource検査](source-v4-independent/README.md)はPASS。全編集旅程の失敗を解決し、全回帰を固定入力へ照合してからこの制作単位を閉じる。次の全島構図は[中央丘肩の地区と森林の面](../2026-10-12-authored-whole-massing/next-production.md)。本人取得・自然成熟・保存／offline・性能・独立観察・公開は未達。
