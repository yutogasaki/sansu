# 施設から本・道具を運ぶ

2026-09-13。candidate `facility-trips-v1`、world `canopy-dots-c3-v1`、保存版11。対象はDEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。100件のQA creditから図書室/ベンチ、小屋/花を実購入する。学習での実取得・実参加者・本番配信の証拠ではない。

同じ住民が入口で受け取り、予約した実経路を歩き、ベンチで読む/植物で道具を使う。30分の活動枠は共通で、入口や運ぶ途中には利用報酬を与えない。植物成長にも加算しない。旧入口利用は切替境界で維持し、過去の場面を運搬へ置き換えない。既存キャラクターの顔・輪郭・頭身・耳・配色・布・好みは変更していない。

- **視覚:** HOLD。C3に比べ、光・奥行き・包まれる空間が不足。本/道具は通常画角で小さく、他の住民が前を通ると隠れる。全姿勢での手との接触や小さい持ち物の判別を合格としない。
- **無文字理解/安全:** Human N=0。自動検査は子どもが本の出所や手入れを理解した証拠ではない。学習正本保持・有限報酬・追加成長なしは技術上の確認として分ける。
- **runtime:** 対象の運搬の区切り。R5/R6のlive発見記録、無料観察、現物選択、同一住民での比較、全関係の優先順は未接続。全PWA/offline/update/throughput/全smoke・実機上限・魔法/出会いも未完。

純粋検査では旧action保持・同時刻切替・保存版維持・欠落/改変/別所有者/過去時刻拒否、移行書込失敗rollback/retry、予約済みベンチの観察待ち、利用中/遠い対象の入口fallback、実4歩の経路、30分で1回だけの利用計上、成長ボーナスなし、収納で解除、長時間の分割再生一致を検査する。3住民それぞれの運搬/到着、歩行位置保持、R5座面接触、captured-v1再演を別の明示scene fixtureで確認。3住民の自然な参加や全組み合わせの実画面を検証したという意味ではない。

実UIは、施設を呼び先にした後、相手の配置を確定し直して活動を開始する明示操作。自然な初回の組み合わせ発見ではない。最初の実行は検証サーバーが停止していたため接続失敗。2回目はphoneの両品を通過したが、tabletで購入保存完了前に次の操作へ進むハーネスの待機不足が判明。保存済み状態を待つよう修正した。appの実装を変更して解消した問題とは扱わない。

最終source `e8d6c48d17b766c4353191444089c4a1bb5e27df6307f1020e277c1953e4bb43`、撮影元 `9692a1b5e54f31c59912562ec8efbd024ed1f13b` 上の差分。[report](report.json) の開始/終了hashは一致。[critical-path contact sheet](contact-sheet.png) / [C3比較HTML](contact-sheet.html) は両幅の受け取り→運搬→利用→収納を含む。撮影後、同じ固定appの別の新規QA contextで[実DOMと保存版](delivery-probe.json)を照合した。4旅程の各contextで個別に取ったprobeではない。

phone390×844・tablet768×1024（reduced motion）、図書室/小屋の4ケースPASS。実購入、同じぽこもこの道中の複数位置、ベンチ座面接触、再読込で持ち物保持、収納時cursor解除、保存版11/切替境界保持、残高124/162、ひかり0、学習正本不変、学習入力への復帰、pageerror/console error 0を確認。運搬中の実reloadや全経路の衝突/全住民の自然参加、R5/R6の実記録を網羅したものではない。

`verify:core` PASS（386 files /3849 tests、docs/lint/typecheck/build/assets）。既存の期限/Fast Refresh/chunk警告あり。precache98件/10.83MiB。ログ `/tmp/sansu-trips-core1.log`、最終UI `/tmp/sansu-trips-ui3.log`、原本 `/tmp/sansu-trips-runtime-3`。UI2は待機診断であり、最終4ケースの証拠と混ぜない。視覚HOLD・Human N=0・全release未完は継続する。
