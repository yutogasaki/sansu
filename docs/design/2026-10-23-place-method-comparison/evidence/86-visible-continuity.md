# 最後の編集・Undo後の位置変化

最終v17、85と同じメモリ専用sessionで、通常UIから (4,4) を0→−1へ下げ、Undoで0へ戻し、編集パネルを閉じた。以降の3画面の間に、目的地指定・地形操作・再読込を行っていない。記録時刻はキャプチャ開始時刻である。

| 画面 | JST | 色のある住人 | 白い住人 |
| --- | --- | --- | --- |
| [a](86-H-continuity-frame-a.png) | 07:38:56.879 | ベンチの左手前 | 家と花の間 |
| [b](86-H-continuity-frame-b.png) | 07:39:25.343 | 家の入口付近 | ベンチの手前 |
| [c](86-H-continuity-frame-c.png) | 07:40:13.304 | 花の前 | 湾側の斜面 |

操作者と独立した目視担当が3画像を確認し、2体の位置変化を認めた。家・ベンチ・岸は同じ位置に見え、world記録のカメラ行列も変わっていない。**この一段編集・Undo後に、住人が位置を変える様子を確認した。**

これは3静止画であり、連続した歩行の映像ではない。フレーム間の経路・接地、全編集の安全、新しい利用の完了までは証明しない。LiveUseは85で得た4組を保持したままで、重複排除後の新規receiptを作るための内部変更は行っていない。81の二段編集後についての未確認を、この別の試行で遡って合格にはしない。

元記録：[操作・撮影時刻](86-H-continuity-frames.json) / [下降後](86-H-continuity-edit-world.json) / [復元後](86-H-continuity-restored-world.json) / [最終状態](86-H-continuity-final-state.json) / [最終world](86-H-continuity-final-world.json) / [利用観測](86-H-continuity-final-live.json)
