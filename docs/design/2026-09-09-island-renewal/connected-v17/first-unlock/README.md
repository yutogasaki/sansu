# 初めての土地解放：固定37の限定検証

後続検証: 新しい学習ヘッダーは[別版39の7実経路](../../../audits/2026-09-09-island-learning-milestones/README.md)で限定PASS。以下のPENDINGは固定37の訂正時点を表す。固定37の原測定・画像を新コードの合格へ転用しない。

入力継続と成長保存は4経路 PASS。学習中の成長通知は4経路とも DOM に存在し不可視で、これは固定37当時の仕様と一致します。新たに採用した学習ヘッダーの可視通知は PENDING です。全 Goal は ACTIVE、アート全体の一致は HOLD、人の評価は N=0 のままです。

訂正（2026-09-09）: 前記録の「表示 FAIL・修正待ち」は、当時のSSOT照合が不足した誤分類でした。`d4d157f` の仕様30:34は「学習中は島とその通知を非表示」と明記しています。旧分類と訂正理由を[検証JSONのcorrection](../first-unlock-verification.json)に残し、原report・4件のDOM/可視性・測定値・画像/SHA・12回答のPASSは変えません。旧nav全成長巡回のFAILは、QAの可視期待と当時契約の不一致として保持します。これからの[仕様30](../../../../product/30_living_island_growth_spec.md)は大きな節目のみ既存ヘッダー領域へ最大6秒、キー等の寸法を変えず誤答支援を優先して出す変更であり、固定37の証拠から新表示の成功は主張しません。

対象は固定37 `workshop-20260909-794c920135eb` / `mystic-island-shore-garden-v17` / 両フラグ true / production `5423`。1081入力の source SHA は `794c920135ebfeadbe7bb3a1db99d2bb53b38d115767d7d0bd20fea7543e17d8`。`569d1c0` 相当の固定版で、ナビゲーション統合後の live HEAD `8e36612` ではありません。

各経路は、native profile と解放直前の IslandRecord を宣言した診断 fixture から始めました。東は completedSets=20・庭 progress=5/pending=15・管理品3個、西は completedSets=41・庭6/水辺5/pending=15・管理品5個です。初期の実保存 memory は保持し、過去の回答・予約・receipt・成熟 memory は合成していません。

その後は通常 planner が3問を予約し、実 UI で3問とも正答しました。最後の1答で庭／水辺が6になり、東0→1／西1→2を保存、次予約の1問目へ追加操作0で進みました。全12件の answer receipt、完了旧予約、次予約を照合しています。

| 経路 | 最後の実 submit → 次入力 ready | 初期化・最初の2回答まで | 全経路時間 | 通知 |
| --- | ---: | ---: | ---: | --- |
| phone-east | 187.9 ms | 5.77 s | 7.36 s | DOM あり・不可視 |
| phone-west | 187.2 ms | 5.82 s | 6.94 s | DOM あり・不可視 |
| tablet-east | 187.1 ms | 5.65 s | 7.33 s | DOM あり・不可視 |
| tablet-west | 186.9 ms | 5.94 s | 6.96 s | DOM あり・不可視 |

各1回の単発測定で、P95や正式80runではありません。時刻は frozen helper の実 submit click から、rAF が次予約 ID/revision=0/inputReady と1問目を確認するまでです。実回答ボタンの可視領域と center hit も確認しました。学習中の世界は非表示なので、この値が geometry 生成の全時間を含むとは証明していません。計測後に「しまへ」を押し、新しい土地の実 frame と画面を別途保存しました。脚本全体は29.11秒で、準備編集・純チェックの時間は含みません。

17全 table を保存し、直前 fixture の書込みが islands だけであること、最後の実回答で変わらない10 table の完全一致を確認しました。学習で変わる profile/SRS 全体を独立再計算する oracle ではありません。初期 memory、3問の問題、各 receipt、旧予約の完了、次予約、成長と追加品を frozen helper と保存データで照合しています。

1081 source と489個の QA/helper/Playwright JS・JSON の開始終了 SHA は一致。Node/Chromium は版を記録し、native executable の全 byte hash は対象外です。SW allow、通常 motion、音 off。4 context と browser は閉鎖、terminal 0、専用 server は起動せず親の5423を維持しました。page/console error は0です。

検証値・SHA・対象範囲は [first-unlock-verification.json](../first-unlock-verification.json)。原 report/trace/全DB/24 PNG は `output/playwright/island-renewal/first-unlock-37-01/` に保持しています。下記10枚は原PNGの無加工 byte copy で、対応 SHA をJSONに記録しています。

| 経路 | 解放前の帰島画面 | 計測後に戻った画面 |
| --- | --- | --- |
| phone-east | [解放前](phone-east-before-home.png) | [解放後](phone-east-after-home.png) |
| phone-west | [解放前](phone-west-before-home.png) | [解放後](phone-west-after-home.png) |
| tablet-east | [解放前](tablet-east-before-home.png) | [解放後](tablet-east-after-home.png) |
| tablet-west | [解放前](tablet-west-before-home.png) | [解放後](tablet-west-after-home.png) |

[phone の次入力](phone-east-next-input.png) / [tablet の次入力](tablet-west-next-input.png)。これらの画面では成長通知は見えず、当時の仕様どおりです。帰島後の通知が見えることを、新しく採用した学習ヘッダー通知の表示成功へ転用しません。

準備時には esbuild の仮想入力を実ファイル扱いした収集エラーが1件あり、ブラウザ開始前にQAだけ修正しました。原説明は `preparation-first-failure.txt` に保持。固定37の app/source、過去結果、通知表示条件は変更していません。
