# ピクニックテーブルとR2のDEV接続

2026-09-13。新商品candidate `life-v3-picnic-v1`、world `canopy-dots-c3-v1`。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。実DOM候補は `island-life-economy-checkpoint-v3` を継承し、reportのdeliveredへ実値を保存。撮影元 `477b6c73fe5166f84de3cf5c4b572ca8016522ae` 上の未commit差分。source開始/終了 `d113cec59acc7bcbb8f99a69cfb3c8f98e3f4c5506c1d69a1b47730cb68094be` 一致。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [比較HTML](contact-sheet.html)。phone390×844・tablet768×1024（reduced motion）、fresh DEV context、sound off。明示QA credit24件から、実UIでテーブル8・苗4を購入。成長は明示DEVの24時間送りであり、実時間や通常学習による取得とは称しない。

前後の別席に2人が到着し、互いへ顔を向ける。苗の間はR2を記録せず、成木1本との実可視のおやつをlive記録、当時の場面を再演する。テーブルを実収納して利用とおやつ表示を終了。再読込で保存版7・残高36・収納状態・元イベント本文を保持、学習正本不変、通常入力へ復帰、pageerror/console error 0。2人のR2はcanonicalな1組の候補とし、皿/おやつ・対象・住民が可視であることを必要とする。

verify:core PASS（378 files /3817 tests、docs/lint/typecheck/build/assets）、既存Fast Refresh・期限・chunk警告あり。precache98件/10.82MiB。対象では価格8/receipt欠落・改変・版降格拒否、旧receipt保持、同意図retry、削除半額4、土地購入との両順序、前後2席/3人目拒否/片側時の1人、座面接触/席の分離/1マス本体包絡/利用終了、成木1本・未成熟・距離外、R2 snapshot解決、共同候補の重複抑止、おやつ非可視時の不記録を確認。片側1人・距離外・現物選択の網羅的な実画面比較はこの旅程には含めない。

初回coreの未対応版7を拒否する旧テストは、新品の版7対応に合わせ、版7可・8不可へ更新。土地receiptの許可版漏れも購入の両順序で検出/修正した。実UI1〜3は修正中の診断として `/tmp/sansu-picnic-runtime-1`〜`-3` に保持。2回目では履歴に見えているR2と最初の保存IDが異なることを確認。共同候補の重複を除き、ハーネスも実際のhistoryIdsから選ぶようにした。修正中のsourceを混ぜたcore/UI結果は最終証拠に使わず、固定sourceのcore4・実UI4だけを採用する。ログ `/tmp/sansu-picnic-core4.log`。

- **視覚:** HOLD。人物とテーブルは通常画面で小さく、おやつ・会話の読み取りやすさは改善が必要。C3の光/奥行き/包まれる空間にも未達。既存キャラの顔・輪郭・頭身・耳・配色・布・好みは維持。
- **無文字理解/安全:** Human N=0。子どもの理解・愛着の合格ではない。別席・利用点予約・座面接触・退出の自動検証と両幅の操作が確認範囲。
- **runtime:** このDEV縦断範囲PASS。新商品UIはDEV限定。残り5品、R5/R6、魔法/出会い、120/60上限の実機評価、全PWA/offline/update/throughput/全smokeは未完。
