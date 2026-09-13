# 灯りの近くの水鉢：M4

DEV `http://127.0.0.1:5223` / `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true`、world `canopy-dots-c3-v1`、機能候補 `water-stars-v1`。実build label `development-local` とGit親checkpoint `001d461c0e47406d5193bb6eb942015a8017f209` を区別する。

灯りと水鉢の実利用点間4歩以内で、水鉢に触れると約5秒だけ水面の中に星空と波紋が現れる。灯りが遠い/収納中なら通常の波紋。水鉢の外は反応させず、縁/本体への入力は最も近い水面の端へ写す。狭い水面だけに入力を限定しない。キーボード入力は中央を使う。魔法中の連打は延長せず、普通の波紋は再タップに反応する。非表示・画面終了・対象や相手の配置変更で中断する。

水面だけの円形meshへ星/波紋を描き、既存の縁が隠す関係を維持する。別の空や世界を描かず、世界全体やキャラの色・造形・布を変えない。動きを抑えた設定でも星空の差は残る。新しいsnapshotに `waterMagicVersion: 1` と触れた水鉢ID・局所x/zをhash付きで保存し、再演は元の触れた位置を使う。旧snapshotへ新規則を足さず、通常の世界action/経済/保存版を変更しない。

発見は入力後に実可視性と1秒提示を確認してからcurrent-context-testとして記録する。条件判定だけ・配置仮表示・中断した未提示の魔法を発見にせず、無料の試行を学習実績/報酬へ変換しない。

## 検証

固定source `27d5645aefdb63c75a5f0b1d48f0268b6d7465ab9113e01862eb5fbb2b21da61` でcore2は392 files /3888 tests、docs/lint/typecheck/build/assets PASS。precache98件/10.85MiB。既存の期限・Fast Refresh・Browserslist・chunk警告あり。core2後の最終UI4はphone390×844/通常motion・tablet768×1024/reduced motionの両旅程PASS。近→遠→復元、縁の入力、連打の統合と5秒終了、元のタップ位置での再演、収納の保存完了後の再読込と通常波紋、過去の保存イベント/しずく28/ひかり0/学習正本の保持、学習入力への復帰を確認。console/page errorなし。開始/終了sourceは一致。新規QA世界は版13を維持し、M4で世界actionや保存版を追加していない。20件のQA creditを用い、実取得/自然初回の証拠にはしない。

診断1は共通helperが関係観察の専用クラスを待ち、水の実画面が出ているのにtimeoutした。描画済みの観察面を待つようhelperを一般化した。診断2はスマホ旅程を完走したが、星が小さく読みにくかったため、少なく大きな形へ修正した途中のsource不一致で終了した。続いて仕様の「水鉢をタップ」に合わせて縁/本体の入力も補強した。core1を最終候補の証拠には使わず、補強後のcore2とその後の固定source UIを区別する。

## 独立した判定

- 視覚: C3 HOLD。今回の星は水面内に限られ、静止した世界の光/局所陰影/奥行きの改善を代替しない。世界と住民を包む空間は引き続き改善対象。
- 無文字理解/安全: Human N=0。星空と普通の水の差・残高/学習正本保持を技術的に確認しても、子どもの理解を検証したことにはしない。非表示中断はdocument visibilityへの明示注入診断で、実ブラウザーの背景遷移やPWA合格とは区別する。
- Runtime: 対象のcoreと両幅DEV旅程はPASS、全受入はPARTIAL。全体smoke/PWA/production島旅程/固定十問throughput、M1/M3と出会いX1/X2/X3、自然初回/全住民/混合配置・全releaseは未完。

UI3は収納をクリックした直後、保存完了を待たず再読込し、灯りがまだ配置済みの状態で魔法が出た。失敗時の保存actionは最後が灯りの移設であり、収納actionは存在しなかった。保存消失や遠距離判定の不具合とは扱わない。UI4は収納済みのowner stateを待ってから再読込する。アプリsourceはcore2/UI3/UI4で同一。


[実画面とC3の比較](contact-sheet.png)、[構造化結果](report.json)、[各旅程の実配信ラベル](delivery-probe.json)。実画面14枚と比較表を保持する。原本 `/tmp/sansu-water-magic-runtime-4/report.json` のhashは構造化結果に記載。最終ログは `/tmp/sansu-water-magic-core2.log` と `/tmp/sansu-water-magic-ui4.log`。実画面では水面内の星と通常の水の差を確認したが、C3の立体的な光・世界の奥行き・住民の暮らしの読み取りは引き続き未達。
