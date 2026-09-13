# 水鉢とベンチ（R4）のDEV接続

2026-09-13。関係版 `water-bench-v1`、世界 `canopy-dots-c3-v1`。実DOM候補名は既存 `island-life-economy-checkpoint-v3` を継承し、reportのdeliveredへ実値を記録。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true`。撮影元 `5c06315ba9ee8dbc1fbf40b77d8cdd2654559881` 上の未commit差分、source開始/終了 `a335336f2a7a840e14d9ef2f1fc0bb3b712038abf21ea532bd48c1a769b9f695` 一致。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [比較HTML](contact-sheet.html)。phone390×844・tablet768×1024（reduced motion）、fresh DEV context、sound off。明示QA credit6件とベンチ/水鉢の2個体、ぽこもこの行き先をベンチへ指定したfixtureから開始。通常学習からの取得とは称しない。

不透明な画面覆いの間は記録を発行しない。覆いを外し実可視1秒以上でR4をlive記録、同じ場面を再演して本人保存。水鉢を実UIで遠くへ移すと同じぽこもこ・同じ席で通常の休憩へ戻り、元へ戻すと水面を見る。再配置で学習正本不変・個体2個/残高4を保持、通常入力へ復帰、pageerror 0。水面への向き・座面接触をreportのnear/far/restoredに保持する。この旅程で現物タップによる複数候補切替や再読込/PWAは検証していない。

verify:core PASS（376 files /3808 tests、docs/lint/typecheck/build/assets）、既存Fast Refresh/期限/chunk警告あり。対象18testsは4歩/5歩、経路遮断、R1→R4→R3の同距離優先と明示対象・収納、旧版のR3とsnapshot/hash保持、3住民の水面への実方向と座面接触、既存liveR1/R3の可視回帰。初回実UIは再演入口がR1/R3限定でR4を表示しない欠落でFAIL。入口修正後の2回目が両幅PASS。coreは入口修正中に開始したため、最終入口とハーネスは別途lint PASS、build/typecheckは修正後の内容で完了。実UIは最終source固定。ログ `/tmp/sansu-r4-core1.log`、`/tmp/sansu-r4-final-lint.log`。初回失敗 `/tmp/sansu-r4-runtime-1` は保持。

- **視覚:** HOLD。水面を見る差分は見えるが、C3の光/奥行き/包まれる構図は未達。キャラ造形・配色・布・既存の好みを変えていない。
- **無文字理解/安全:** Human N=0。子どもの理解や愛着を認定しない。座面接触、近い/遠いの再現性、学習入力への退出は検証した範囲。
- **runtime:** このDEV縦断範囲PASS。productionでは新関係を有効化しない。R2/R5/R6、残る6品、魔法/出会い、全PWA/offline/update/throughput/全smoke/実機性能は継続対象。
