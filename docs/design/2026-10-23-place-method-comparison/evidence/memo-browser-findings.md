# 実ブラウザの座標キャッシュ比較

2026-10-22 UTC。記録77（memo ON）と78（OFF）は同じ `place-method-comparison-v16` のbuild/version/delivery DOM。両方ともH＋stable base＋linear＋single compile＋frozen query、`shore-memory-only`。候補IDの差は `+memo-samples-v1` だけだった。

比較前・比較後それぞれで、地形全体（高さ・Undo64件・Redo）・土地・所有物・住人定義・通貨・townが一致した。同じ `(4,4)` の高さを0→−1へ下げ、Undoへ1件追加して古い1件を落としている。成功した地形command、冷たいworld生成、compile、scene再構築は各1回。CPU開始時刻と記録されたクリックの差は0.5／0.6msで、測定窓の操作も対応している。

| 測定値 | OFF（78） | ON（77） | 差 |
|---|---:|---:|---:|
| world生成全体 | 427.7ms | 370.6ms | −57.1ms（−13.35%） |
| world生成のself時間 | 137.4ms | 77.3ms | −60.1ms（−43.74%） |
| compile | 290.3ms | 293.3ms | ＋3.0ms |
| terrain command | 429.0ms | 372.6ms | −56.4ms |
| scene再構築 | 66.9ms | 59.9ms | −7.0ms |
| 最大rAF間隔 | 500.0ms | 435.1ms | −64.9ms |
| rAF中央値 | 16.7ms | 16.7ms | 同じ |
| 50ms超の間隔 | 1回 | 1回 | 同じ |

この1対では、狙ったworld生成のself時間が短縮し、compile時間はほぼ変わらなかった。ONでも435.1msの長いフレーム間隔が残るため、滑らかな編集を達成した判定にはしない。CPUの親子inclusive時間は重なるので合算しない。rAF間隔はGPU処理時間ではない。

自然な生活記録は同一ではない。村人v2の直近利用先はONが庭、OFFがベンチで、利用日時と履歴の長さ・順序にも差がある。これらの差分を除去して「全state一致」とは扱わず、[照合JSON](./memo-browser-pair-check.json)に全差分パスと前後の利用記録を残した。地形・配置・履歴など比較対象の入力は一致している。

N=1ずつ、ON→OFFの固定順で、反復・順序入替はない。記録ファイルにはviewport/camera行列や住人の瞬間座標がないため、その完全一致までは独立に証明していない。これはメモリ内比較データの操作であり、DB保存・公開版・他端末の性能の合格を示さない。元の10ファイルとv16 build manifestのSHA256、照合条件、数値は照合JSONに収録した。

この報告作成ではruntimeを変更していない。memo実装・runner・比較記録を凍結する。
