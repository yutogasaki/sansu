# Stage4 最初の法線不一致 — 完了診断の保存

**Source は HOLD のまま。修正・stage4 再build・描画・runtime 採用は行っていない。** このarchiveは、最初の法線不一致を再現した診断と、その後の原GLB accessor対応確認だけを保存する。archive作成時点で未実行だった次の `zero-face-comparison` は含めない。

診断は2026-10-12 04:59:09.435〜04:59:12.865 UTC、PID34262、exit0で終了。CPU2、.25秒sampleの最大RSS494,698,496 bytes。19 roleの変形後、20番目の l14 hanging-leaf / source node2239 で元の `.002` guardを再現した。期待値→格納値の最大L2差は `.1176502396`。これは診断の正常終了であり、変形の合格ではない。

- 同じ頂点0の5cornerが不一致。5cornerの期待normalは同一で、格納normalも同一だった。
- 明示的なmesh/view-layer更新、同じ期待値の再設定、元入力複製でも同じ残差となった。今回試したcache更新は原因を解消しない。
- 原本と抽出GLBのPOSITION/NORMAL/indicesは完全一致し、Blenderの78頂点位置と456cornerの頂点indexも対応した。一方、変形前の17cornerが原NORMALと `.002` 以上異なり、最大L2差は `.5755355484`。原NORMALはunitだが、import後の最小長は `.8177572697`。
- 原本から正確に面積ゼロの4三角形があり、うち2面は失敗頂点のfanに属する。因果関係は未検証で、Blender内部の符号化制限を推定断定していない。

[診断結果（gzip）](attempt-01/result.json.gz)、[全corner/位置/normal/transformのraw](attempt-01/failing-role-raw.json.gz)、[原GLB対応結果](attempt-01/raw-correspondence.json)、[元accessor値](attempt-01/source-role-accessors.json.gz)、[実行記録](execution-01/result.json)、[終了・SHA照合](execution-01/postflight.json)、[ログ](execution-01/execution.log.txt)を保存した。

[archive-proof.json](archive-proof.json) は18診断ファイル＋1包装scriptについてsource前後SHA、storedSHA、展開後SHAを記録する。64KiB以上の未圧縮JSONはmtime0の決定的gzip、それ以外は原bytesのまま。元のgzipも圧縮bytesまで保持した。過去のREADMEとPythonは内容を変えず `.txt` を付けた。`readiness.json` の未実行表記は実行前の封印記録であり、結果はexecution側を参照する。
