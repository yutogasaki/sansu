# 局所性能計測 2回目 — quiet preflight棄却、性能未測定で終了

2026-10-12 06:35:30.940–06:35:36.341 UTC。exec 34239はexit 1。**worker 0／計測値0**、`performanceValid=false`、`inputsFixed=true`。両版の6,460 source＋6依存と準備／Node等、計12,960 pathの前後SHAは一致した。[生report](report.json)、[生host観測](host-observations.jsonl)、[生supervisor stdout/stderr](attempt-02-supervisor.log.txt)を保持した。

[修正版protocol](../performance-preparation-02/README.md)の4観測目でFirefox GPU Helper PID956の実累積CPU差分が **10.859%（1core基準）** となり、事前規定10%を超えた。外部CPU合計も有効な3連続観測で155.538%／123.551%／155.647%となり、100%上限を超えた。10core機全体の使用率ではなく、各process CPU差分の合計である。最初の観測は差分基準未取得として除外し、0やidleの証拠にしない。

これは定義した隔離窓を確保できなかった棄却であり、c2／c3の速度差やアプリ失敗を示さない。ユーザーGUI Blender／browser、rootのViteへsignalは送っていない。benchmark worker groupは作られておらず、supervisor終端を確認済み。[終端と解析](terminal-analysis.json)と[原byte保存証明](archive-proof.json)を参照。

[初回失敗](../performance-attempt-01/README.md)と両protocolを変更せず残す。閾値・回数・上限を途中変更せず、第3準備／自動retryへ進めない。**この単位は性能未測定で閉じる**。c3の統合core／water・classic機能回帰PASSは別の証拠であり、性能や美術／M1の合格へ置き換えない。

Raw report SHA: `1ebf466efdb5db7ba8ba669d86dd038a8b95e6e98aa7ee586c13fc63487b0d9a`。
