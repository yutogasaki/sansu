# 同じ住民による施設の距離比較

DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。world `canopy-dots-c3-v1`、表示 `carry-care-v1`、検査候補 `facility-distance-v1`。本体コードは運搬記録のcheckpointから変更せず、実操作による比較検査を追加する。

100件のQA creditから実購入し、施設をぽこもこの行き先として明示する。近い相手の配置し直しで運搬を開始した後、同じ相手を遠ざけ、再び元のマスへ戻す。住民IDは全段階でぽこもこ。現在の配置から求めた利用位置間の経路距離、実画面の持ち物と利用先、現物観察、履歴保持を照合する。学習による実取得・自然初回の発見・利用者の理解の証拠ではない。

遠い場合は施設入口の通常利用になり、R5/R6の提示証拠を作らない。以前に保存した場面は消さない。復元後は同じ住民の運搬と利用へ戻り、現物観察でも提示を確認する。移設は無料で、残高・ひかり・学習正本を保持する。最後に再読込・収納・記録保持と学習入力への復帰を確認する。通常旅程後のowner APIによる版12書込は、UIの無料観察開始とは別の診断。

## 判定

対象runtime PASS。phone390×844（通常motion）/tablet768×1024（reduced motion）×図書室/小屋の4旅程を完了。図書室の利用点間距離は近4→遠7→復元4、小屋は近2→遠5→復元2。全段階の対象住民は同じぽこもこ。遠い現在観察ではcore/deliveredともfalse、新しい履歴はなく、元の保存記録とsaved IDを保持。復元後の実提示、再読込・収納取消・owner API版12再読込・学習入力復帰もPASS。console/page errorなし。

[比較画面](contact-sheet.png)、[構造化結果](report.json)、[実配信ラベル](delivery-probe.json)。44枚の実画面を保存した。reportはrawの大量の30ms sampleを件数と異なる運搬位置数へ圧縮し、raw SHA-256を記載。raw原本 `/tmp/sansu-facility-distance-runtime-1/report.json`、実行ログ `/tmp/sansu-facility-distance-ui1.log`。失敗や再試行なし。

アプリsourceは開始・終了とも `cee1cea9c4c41806b3ff6b0db94e036cd61d1ecffe9f40a41ffd81f6de6163bc`、親checkpoint `225b58aa2ff0b06d8541a15c6a72ffdf1657f93b`。今回の変更は継続検査と資料のみ。前checkpointの同一sourceでのcore387 files /3857 tests PASSを再利用し、アプリの再ビルドは行わない。ハーネスのESLintと資料検査を今回実施。実DEVのbuild revisionは `development-local` であり、Git親revisionを配信埋込値と呼ばない。

視覚はHOLD。色瓦と局所陰はあるが、C3の曲面・光・包まれる奥行きに達しておらず、本や道具も小さい。phone小屋の受け取り撮影には配置面がまだ残り、その画像単独を受け取りの分かりやすさの証拠にしない。無文字理解はHuman N=0で未合格。キャラクターの造形・配色・布は変更していない。runtimeはこの距離比較の結果を独立して判定する。全release、全関係の優先順、ベンチから図書室の現物指定、自然初回、魔法・出会いは残件。
