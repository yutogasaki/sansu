# 木の苗・水鉢の基礎実装

2026-09-13。機能candidate `life-v3-plants-water-v1`、実world `canopy-dots-c3-v1`。DEV 5223 / `VITE_ISLAND_LIFE_PREVIEW=true`。実DOMのroot候補名は既存 `island-life-economy-checkpoint-v3` を継承しており、新機能の識別と同一視しない。reportに実DOM候補名とworldStyleを記録。撮影時は `b72180fd510d09c9052ab0575c0282c1184912f5` 上の未commit差分。source開始/終了 `725d43e354a39aa39a8cee1b09ba00bb217d9d56a759d7b3551a253cd355893b` 一致。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [HTML](contact-sheet.html)。phone390×844、tablet768×1024（reduced motion）、sound off、fresh DEV context。QA credit12件から実UIで苗/水鉢を各4しずくで購入配置。成長は明示DEVの6時間/24時間送りを使用した診断。実学習からの取得や実時間30時間の観察とは扱わない。

苗/若木/成木の同一個体、木のM2を実観察で表示して記録、通常の水鉢タッチと波紋を確認。水へのタッチでは購入履歴/発見記録/通貨が不変。再読込で保存版6・成熟木18・水鉢0・所有と残高16を保持。学習正本不変と通常入力への復帰、pageerror/console error 0。木のM2はcurrent-context-testの提示であり、自動live魔法ではない。既存キャラの顔/輪郭/耳/頭身/布/配色と好みを再設計していない。

core PASS（373 files /3790 tests、docs/lint/typecheck/build/assets、既存FastRefresh warning 1件）。precache98 /10.81MiB。対象テストでは旧4品の価格/receiptを維持した新品receipt、欠落/改変/版降格拒否、意図再送、削除半額、木の6/18時間と24時間窓失効・収納停止・refresh分割不変、同系統G0、成木M2の「はっぱ」記録名、成熟形状の1マス内包絡を確認。木の魔法が個体から葉を削除しないことも検査した。

初回の実UIはDEV detailsを開かず時間送りボタンを探したharnessで失敗（`/tmp/sansu-plants-runtime-1`）。2回目は両幅の操作を通過したが途中で記録名修正が入ったためsource hash不一致を検知し、最終証拠に使わない（`/tmp/sansu-plants-runtime-2`）。固定した修正後sourceの3回目だけをこの資料へ格納した。最終coreは `/tmp/sansu-plants-core3.log`。

- **視覚:** HOLD。成長の形の違いと水面は読めるが、木はまだ簡素でC3の曲面/素材/陰に未達。木陰で休む構図は未完成。C3の世界全体の視覚HOLDも継続し、技術PASSで補わない。
- **無文字理解/安全:** Human N=0。利用者の理解/愛着/安全を認定しない。隣接マスの通路を成熟形状が塞がないことは自動検査の範囲。
- **runtime:** 上記範囲PASS。新2品の購入UIはDEV Life preview限定。木立/森の庭/水辺、木陰の休み、R2/R4等、M4、特別な出会い、Bの残り6品は未実装。全体PWA/offline/update/throughput/全smoke/実機性能も未完。B完成や本番公開の宣言ではない。
