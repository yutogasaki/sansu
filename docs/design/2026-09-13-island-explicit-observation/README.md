# 現物を選ぶ関係観察

DEV `http://127.0.0.1:5223` / `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true`、world `canopy-dots-c3-v1`、表示 `carry-care-v1`、機能候補 `explicit-relation-observation-v1`。実DEV build labelは `development-local`。本番配信・利用者検証の完了を示す資料ではない。

ベンチ/テーブル/施設の「みるもの」で配置済みの現物を選択する。見えている現物への直接タップも使える。対象と住民のIDを保存版14へ記録し、選択を同じ住民の有限の無料visitへ閉じる。視線比較は席を保持、運搬は実経路を使う。遠い/無関係な相手は通常利用、歩行中や他の活動中は変更せず、他の住民を借りない。同席者の選択や既存キャラ造形・配色・布は変えない。

既に同じ物を運び終えている場合は、その出発点・経路・席を再利用する。新しい運搬で先客を押し出さない。記録は実提示の1秒確認を経て保存し、無料観察をlive発見や利用報酬に変えない。snapshotに観察した本人のIDとvisitの現物指定を残し、再演/現在の入口も同じ本人・同じ観察元へ戻る。現在本人が別の活動中ならその事実を表示する。

## 検証の状態

固定source `f91b2d7bd5bd225abe7b4cdf0233aa0f9ef2b12920e4b64b86efebdd56de8dcc` でcore390 files /3882 tests、docs/lint/typecheck/build/assets PASS。precache98件/10.84MiB。既存の期限・Fast Refresh・Browserslist・chunk警告あり。core完了後の最終UI4はphone390×844/通常motionとtablet768×1024/reduced motionの図書室/小屋4旅程PASS。図書室の現物タップ、花/水/通常休憩への同じ席での切替、本の実往復、小屋の非既定の空き植物への運搬、R5/R6のcurrent-context-test記録/本人保存/再演/現在入口、版14再読込/収納後の過去イベント保持、しずく110/148・ひかり0・学習正本不変と入力復帰を確認。console/page errorなし。開始/終了のsourceは一致した。診断や局所検査は全旅程の完了へ数えない。100件のQA credit、明示呼び先、実配置を使い、園芸小屋では現在の空き対象を読み取りだけで選ぶ。時間加速や住民の抽選やり直しはしない。自然初回・学習での実取得・実機性能の証拠ではない。

UI診断1は保存イベントを `snapshot.residents` と読んだ検査側の誤り。実際の保存先 `snapshot.scene.residents` へ修正した。診断2は同じ関係の新しい履歴で置き換わった旧イベントを「みえた ばめん」で探してtimeoutした。本人が残したイベントは保存一覧に保持されており、検査を「のこした おもいで」へ修正した。異なる物を追加購入した際も、新しいbuy actionの保存を待つようhelperを補強した。

診断3は両施設のスマホ操作を完走したが、source一致assertは不一致で終了。診断3の途中では、テーブルの二人をID順に並べることと観察本人の選択を分離し、元の観察施設へ戻る処理を補強した。選択の目印を地面より上へ出す修正と占有先の回帰検査も加えた。したがって診断3は最終固定sourceの証拠にしない。本人IDはsnapshot hashの対象であり、旧場面には追加しない。

## 独立した判定

- 視覚: C3 HOLD。色瓦・既存の大きな葉は維持しているが、C3の光・局所陰影・奥行き・包まれる空間は未達。小さな持ち物/手の接触の読み取りも改善対象。
- 無文字理解/安全: Human N=0。本人・同席者・席・報酬・学習正本を保持する技術検査と、子どもが無文字で理解できることは分ける。現物の文字selectがあるため、これだけで無文字理解を合格にしない。
- Runtime: このDEVの対象4旅程とcoreはPASS。全受入はPARTIAL。魔法M1/M3/M4、出会いX1/X2/X3、全混合配置、PWAを含む全releaseは未完。


[実画面比較](contact-sheet.png)、[構造化結果](report.json)、[実画面から取得した配信ラベル](delivery-probe.json)。30枚の実画面と比較表を保持する。Git親checkpointは `6bb3406e4bcf73da2271c778eaf4b7cd5e4613c6`、実DEV build revision `development-local` とは区別する。原本 `/tmp/sansu-explicit-runtime-4/report.json` のhashを構造化結果に記載。coreログ `/tmp/sansu-explicit-core1.log`、最終UIログ `/tmp/sansu-explicit-ui4.log`。検査後の比較でも、C3との差は局所陰影・立体的な光・静止画の空間密度と、小さな持ち物の読解に残る。

全体のsmoke/PWA更新/島のproduction journey/固定十問throughputは今回のDEV旅程で代替していない。これらと自然初回・全住民/混合配置の受入は全体goalの残件として継続する。
