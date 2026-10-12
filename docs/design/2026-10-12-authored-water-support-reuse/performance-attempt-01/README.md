# 局所性能計測 初回 — preflight停止、未計測

2026-10-12 06:22:29.596–06:22:31.557 UTC。exec 39317 は exit 1。[封印した初回protocol](../performance-preparation/README.md)のquiet preflightで停止し、**worker 0／計測値0**。`performanceValid=false`、`inputsFixed=true`。両候補の6,460入力＋6依存と準備／Nodeを含む12,957 pathの前後SHAは一致した。

[生report](report.json)と[生host観測](host-observations.jsonl)は変更していない。最初の1 snapshotで、browser／helperに分類された128 processと、rootのViteに属するesbuild 2 processの「存在」が拒否条件に該当した。これはCPU高負荷を確認した結果ではない。初回のdelta CPU欄の0は、前回sampleがないための初期値であり、idle実測値とは扱わない。

[終端と分類](terminal-classification.json)に、PID／親／実行名中心の観測と証拠の限界を別記した。GUIブラウザー、OS helper、待機Vite serviceの存在を実行競合と同一視したpreflight条件の問題を含む。アプリ失敗や速度改善／悪化の証拠にはしない。ユーザーGUI Blenderやブラウザー、rootの5359／5360にはsignalを送っておらず、所有worker groupは作られていない。

条件を実行中に緩めず、自動retryもしていない。別の計測を行うなら元失敗を保持した新protocol／出力が必要。[保存証明](archive-proof.json)で全rawのbyte／SHA一致を確認済み。

Raw report SHA: `4a5c81cd82ca7be0840e23f0d4f489ee5bb45c459340dc8b6ef8352d4858475e`。
