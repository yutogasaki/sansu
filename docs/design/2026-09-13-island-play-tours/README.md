# GP3の正式な巡回

2026-09-13。candidate `gp3-tours-v1`、世界美術 `canopy-dots-c3-v1`。DEV 5223 / `VITE_ISLAND_LIFE_PREVIEW=true`。撮影時は `c684142` 上の未commit差分。source開始/終了 `f15c536725417c3b81dc7629da2e496cf319af3f1df55e74562119e47e440b76` 一致。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [HTML](contact-sheet.html)。phone390×844とtablet768×1024、tablet reduced motion、sound off、fresh context。明示QA credit9件、ブランコ3台と同位置moveで予約を再開始したfixture。実学習からの取得や、初めて遊具を連結したときの即時反応の証明ではない。

40秒の実描画を追い、3住民それぞれが3台を訪ねた。短い利用でひかりが増えないことを確認。実表示からliveとして記録されたGP3を思い出で再生し、保存された姿勢を再計画しないことを確認した。実UIで1台を収納すると巡回が解消し、元の思い出は不変。学習正本を変えず、通常入力へ戻った。pageerror/console error 0。旅程を描画だけで差し替えず、正式stateの時間進行を使用する。

保存版4の切替・旧訪問維持・同時刻action順序・失敗時rollback・再送・既存economy checkpointはunit/integration testsで確認。利用中断、待機時間の除外、有限ひかり、7日分の巡回、refresh分割不変、描画投影とsnapshot固定も確認した。

`npm run verify:core` PASS: 370 files / 3777 tests、docs/lint/typecheck/build/assets。PWA precache98 files /10.80MiB。検証後のstaged sourceも同じhashで照合する。

- **視覚:** C3の陰・素材・構図は[前段のHOLD](../2026-09-13-canopy-runtime/README.md)を継続。今回の実画面でも枝葉の形と色瓦は見えるが、C3の素材感には未達。巡回の技術PASSで補わない。住民の顔・耳・頭身・布・配色は既存のまま。
- **無文字理解/安全:** Human N=0。動作の正確さを利用者の理解と同一視しない。
- **runtime:** 上記範囲PASS。自然な初回連結の全条件、実SW更新/offline、実機長期replay負荷、固定問題throughput、全smokeはこの候補では未検証。全体release認定ではない。
