# 初回の失敗と修正の帰属

c1は同じrenderer候補の別source。最初の苗l28購入が成功した直後、previewに`color: undefined`を含み確定は省略していたため、strict shape比較が失敗した。[元のFAIL report](first-failure/report.json)、[画面](first-failure/first-failure.png)。JSONがundefinedを除くことを踏まえ、previewのoptional colorも有るときだけ追加した。試験をstrict equalityへ強め、c2の新build/新出力で全旅程を実行した。c1をc2のPASSに書き換えていない。本人saveを失った事例ではない。

legacy回帰の最初のrunは、検証用5350サーバーでIsland flagを明示しておらず、ready locatorがtimeoutした。失敗画面は旧探索基地だった。[元のreport](legacy-first-failure/report.json)、[画面](legacy-first-failure/failure.png)、[原因分類](legacy-first-failure/classification.json)。アプリやharnessを変えず、Island=true/native=falseを起動環境で明示した5351サーバーへ修正し、新規出力で全旅程をやり直した。初回のreportには終了source mapがなく、sourceFixedを後付けしない。成功DEV captureのactual nativeはtrue（DEV有効化契約）、worldはlegacy-world-v1・artはnative05-expanding-runtime-v2。native=falseは起動環境値であり、actual falseの通常production buildとは別。これは接続環境のFAILで、子どもの保存失敗の例ではない。

actorの最初のswing検査では、傾いた親へlocalY補正を加えたためworldZもずれ、接触Yが1.9416454846604358対座面1.930964458351767になった。世界Y補正をlocal逆行列へ変換した。その後のread-only software reviewで、高いray hitがcrossbar/tabletopを拾うことと座面に足が埋まることを指摘され、実座面のsemantic namesとperched poseへ変更した。退出weight0.001のfoot liftが残り、0で急に消える指摘も修正した。最初のraw実行logは保存しておらず、値と指摘だけをここへ記録する。[最終a4 raw log](review/actor-focused-a4.log.txt)。最後のread-only reviewerは退出blockerの解消を確認。子どもの観察ではない。

cameraの最初のfocused clippingと、森林のbig/lord倍率保持を追加したときの旧court scale期待値`.45`対`.585`はfocused testで失敗し、それぞれbounded eye retreatと正しいage期待値へ修正した。最初のraw logは保存していない。coreが最終固定sourceの回帰を含む。

THREEの`map: undefined`警告、既存lint警告・bundle chunk警告は実行logへ残す。成功は対象check/診断だけの範囲で、性能・美術・新世界の本人保存/配布の合格にはしない。
