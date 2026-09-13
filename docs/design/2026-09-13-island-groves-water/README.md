# 木立・水辺のDEV接続

2026-09-13。機能candidate `groves-water-v1`、世界 `canopy-dots-c3-v1`。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。撮影元は `279680a046ca9d796db936d5c8c5ae2809e14dd0` 上の未commit差分。source開始/終了 `cf3573fdf297a74023880823338750ef7945bf0d1edfe2b2cd39ee45dcd18c9e` 一致。実DOMのroot候補名は既存 `island-life-economy-checkpoint-v3` を継承する。[配信識別の実DOM照合](delivery.json) は同じDEVの別fresh contextで確認したもの。

[実UI report](report.json) / [critical-path contact sheet](contact-sheet.png) / [比較HTML](contact-sheet.html)。phone390×844は通常motion、tablet768×1024はreduced motion。fresh DEV context、明示QA credit20件、成熟木6本・水鉢2個、ぽこもこの行き先を水鉢へ指定したfixtureから開始。旧G0は版なしの場面を明示的にseedしたsimulated記録で、過去の実利用者のlive記録とは称しない。

実際の表示からGT6/GW2のlive記録を取得。旧G0を再演し、新しい木陰や樹冠を遡及しない。実GW2を反対のmotion設定で再演して当時の視線を照合。実UIで1本収納しGT3の5本へ更新、undo・再読込でも旧G0/GT6/GW2の本文を完全保持、残高8・学習正本不変、通常学習入力へ復帰、pageerror/console error 0。記録は条件だけで生成せず、実メッシュ・地面の接続・住民の見比べが可視であることを必要とする。

verify:core PASS、375 files /3801 tests、docs/lint/typecheck/build/assets。既存Fast Refresh警告1件、docs期限・chunk size警告あり。新しい回帰は成木本数/外接サイズ、対角非接続/収納、旧snapshotのhash、資源/訪問選択不変、木陰内の立ち位置、実可視地面、反対motion設定での視線保持。PWA予算98件/10.81MiB。ログ `/tmp/sansu-grove-core2.log`。

初回 `/tmp/sansu-grove-runtime-1` は非同期waitForFunctionがPromiseを真として早期終了するハーネス不具合。ローカルPlaywright 1.58.1のpollerから診断し、共有waitForAsyncへ置換した。既存9ハーネスも同じ待機だけ修正し、過去の全旅程を今回再実行したとは扱わない。2回目はタブレットで木の葉に隠れた冗長な内部境界まで必須としていた可視判定で失敗。各個体と足元の可視性を保ち、実可視の接続で全木へ到達できるかへ修正し、回帰で再現/解消した。3回目は診断中のsource変更をhashで検知し最終証拠から除外。4回目だけが固定sourceで両幅PASS。

- **視覚:** HOLD。局所的な青緑の木陰と水辺の縁を追加。C3と比較すると木陰は矩形が強く、苗木の葉は単純で、奥行きと光の質も不足する。既存キャラの再設計はしていない。世界全体のC3承認や本番配信とは扱わない。
- **無文字理解/安全:** Human N=0。表示の違いを子どもが理解した・好んだとは認定しない。歩行/利用セルと既存モデルを保つ自動回帰、両幅の退出・通常入力を確認した範囲。
- **runtime:** このDEV縦断範囲PASS。R2/R4・M4・出会い、残り6品、全PWA/offline/update/throughput/全smoke/実機性能は未完。v3全体とreleaseの判定は保留。
