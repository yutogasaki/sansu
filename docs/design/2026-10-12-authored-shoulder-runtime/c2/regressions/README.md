# authored-shoulder-c2: sequential browser regressions

8 段階すべて PASS、外側 runner は exit 0。初回失敗・再試行・一時停止・deadline 変更はありません。各段階と全体で **6,460 local inputs + 6 installed dependencies** が core の確定値と前後一致しました。

実表示の shoulder revision は `authored-shoulder-c2:79e9300a-ec58-4cfc-83fc-5dc24d2d4092`。対象は固定 `/private/tmp/sansu-authored-shoulder-c2/candidate`、DEV `127.0.0.1:5359`（Island=true / native=false）。classic は自身の `4173` server（island=false / native=false）で実行しました。5359 は root の次の診断用に保持し、この archive 作業からは停止していません。

| 段階 | 結果 | 外側 wall time | 実 report の件数 | 証拠 |
| --- | --- | ---: | --- | --- |
| 01 床 source/legacy A/B | PASS / exit 0 | 359.301 秒 | 10 captures / 5 pairs | [raw report](01-floor-shading-ab/actual/report.json) · [log](01-floor-shading-ab/execution.log.txt) |
| 02 中央肩 full | PASS / exit 0 | 3002.829 秒 | 20 captures（acquisition 6 + fixed35 14） | [raw report](02-shoulder-full/actual/report.json) · [log](02-shoulder-full/execution.log.txt) |
| 03 baseline27 編集 | PASS / exit 0 | 415.360 秒 | 7 captures | [raw report](03-baseline27-editing/actual/report.json) · [log](03-baseline27-editing/execution.log.txt) |
| 04 wide27 水辺 | PASS / exit 0 | 372.545 秒 | 14 captures | [raw report](04-wide27-water/actual/report.json) · [log](04-wide27-water/execution.log.txt) |
| 05 花場 full（cove off） | PASS / exit 0 | 1284.371 秒 | 12 captures / canvas 4 / edits 4 | [raw report](05-authored-flower-full-cove-off/actual/report.json) · [log](05-authored-flower-full-cove-off/execution.log.txt) |
| 06 入り江 full | PASS / exit 0 | 1102.954 秒 | 10 captures / canvas 1 / edits 4 | [raw report](06-authored-cove-full/actual/report.json) · [log](06-authored-cove-full/execution.log.txt) |
| 07 通常 Growing | PASS / exit 0 | 235.161 秒 | 22 captures / 8 scenarios | [raw report](07-ordinary-growing-balance/actual/report.json) · [log](07-ordinary-growing-balance/execution.log.txt) |
| 08 classic smoke | PASS / exit 0 | 144.964 秒 | 32 scenarios | [raw report](08-classic-smoke/diagnostics/smoke-report.json) · [log](08-classic-smoke/execution.log.txt) |

全体 wall time は 6919.396 秒です。これは検査操作の所要時間であり、製品 P95 や性能合格ではありません。後半に独立した限定 source 制作が重なった記録は [source concurrency](runner-records/source-concurrency-window.json) と [root の記録](../source-work-concurrency.json) を参照してください。[一時停止を行わなかった判断](runner-records/scheduling-assessment.json)も保持しています。

この結果は固定入力の機能回帰です。造形の承認、視覚 HOLD の解除、M1 全体の受入を意味しません。c1 の OOM 失敗は別記録として保持されています。

[外側最終 report](report.json)（SHA `acc1732a2e505dc49add8fa5fa410fa078b3347c5cdc61a95b1cb533eea0dc79`）、[terminal summary](terminal-summary.json)、[runner log](runner-execution.log.txt)、[core report](../core/report.json) を参照してください。実行した [runner 原本](runner-records/prepared/regressions.py.txt) の SHA は `c7b14ec8107ae17b6cb9e4afda1b935b4cc0dcb84b466af86e25430ac64f19ca` です。8 drivers の原本と core/regression 前後 SHA 照合は [archive proof](archive-04-08-and-terminal.json) に保存しています。

04〜08・外側記録・wrapper/driver 原本の 150 ファイル（43,152,314 bytes）は元 raw と byte 同一で追加しました。root が先に保存した 01〜03 の 48 ファイルはファイル集合と SHA を再照合して再利用し、上書きしていません。[既存 01〜03 proof](archive-01-03.json) と root の visual contact sheet も変更していません。原 report の一時ディレクトリへの絶対 path は原 byte を保つためそのままです。このページのリンクは durable 相対 path です。
