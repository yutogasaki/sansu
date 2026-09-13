# 利用開始時の関係選択とベンチからの読書

DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`、world `canopy-dots-c3-v1`、表示 `carry-care-v1`、機能候補 `relation-selection-v1`。

保存版13 / `relation-selection-v1` の切替境界で、以前のaction prefixとhashを保持する。以前から進行中のvisitは視線を含めて従来の選択を使い、新しく開始するvisitだけ新しい選択版を持つ。新snapshotは選択版を保持し、旧snapshotに後から規則を足さない。

新規利用は、現在の活動対象で成立する関係について、利用点間の実経路距離→同距離R5/R1/R4/R3/R2/R6→相手IDの辞書順を使う。図書室が近いベンチを行き先にすると、そのベンチを予約し、同じ住民が図書室入口へ歩き、本を受け取って戻る。より近い花があれば花を見る。選ばれた図書室が使用中なら通常の着座へ戻り、利用者を押し出さない。施設側でも選ばれた相手が塞がっていたら、別の相手へ勝手に置き換えない。

無料のベンチ観察は空いた住民だけを使い、往復を含む有限の枠を確保する。受け取り・運搬へobservationTestを引き継ぎ、利用報酬へ変えない。明示した任意の現物へ運搬を試す操作はまだ未接続であり、この自律利用の変更とは分ける。

## 検証

最終core2は388 files /3868 tests、docs/lint/typecheck/build/assets PASS。precache98件/10.84MiB。進行中の旧visitの視線保持を追加する前のcore1も通ったが、最終候補の証拠へ混ぜない。対象20テストと型検査の後、ソースを固定してcore2を実行し、その完了後にUI検査を開始した。既存の期限/Fast Refresh/chunk警告あり。最終UI5はphone390×844（通常motion）/tablet768×1024（reduced motion）×図書室/小屋の4旅程PASS。図書室はベンチ指定を保存したまま図書室の配置を確定し、新しい往復を計測した。近い花を追加して配置を確定すると、同じぽこもこ・同じベンチがR1へ切り替わり、本を持たず花を見る。距離比較は施設を呼び先に戻し、図書室4→7→4歩、小屋2→5→2歩。遠い場合は新しい関係履歴を作らず、復元後は実提示へ戻る。版13の再読込・収納・owner API observe・過去の保存イベント・学習正本/残高の保持・学習入力復帰PASS。console/page errorなし。

[比較画面](contact-sheet.png)、[構造化結果](report.json)、[実配信ラベル](delivery-probe.json)。46枚の実画面と比較表を保存。大量の30ms sampleは件数と異なる運搬位置数へ圧縮し、raw reportのSHA-256を記載。原本 `/tmp/sansu-relation-runtime-5/report.json`、UIログ `/tmp/sansu-relation-ui5.log`、coreログ `/tmp/sansu-relation-core2.log`。

アプリsourceは全最終検査中固定の `150945e11145afb441dc5fd664dcdaa5f81aa5683525b93c35d3d0926932be1c`。親checkpoint `9d2168a12f673832bd269aadb999da3bda941833`。実DEV build revisionは `development-local`、Git親revisionとは区別する。100件のQA creditと明示した呼び先/配置再確定を用いる。自然な初回発見・学習での実取得・実機性能・利用者の理解の証拠ではない。無料の空いた住民の往復はdomain検査であり、owner API observe probeはそのUI開始の証拠にはしない。

初回UI1は、ベンチを指定してからそのベンチを移設する手順だった。既存の移設は呼び先も解除するため、運搬後のtarget固定assertで失敗した。アプリの保存消失とは扱わない。UI2は配置確定後にベンチを指定し、owner保存のtargetを待ってから計測する。UI1 source `150945e11145afb441dc5fd664dcdaa5f81aa5683525b93c35d3d0926932be1c`、診断 `/tmp/sansu-relation-runtime-1`。アプリの移設契約は変更しない。

視覚C3 HOLD、Human N=0、対象runtimeは独立判定。キャラ造形・配色・布は変更していない。C3の奥行き・光・包まれる空間や、本/道具の読み取りは未達。受け取り画像の一部には配置面が残り、その画像だけで仕草の読み取りが十分とは判定しない。自然な初回利用、任意の現物指定、魔法/出会い、全releaseは未完。


UI2は計測開始時のsamplesが運搬/読書のみで、受け取り撮影を待ってtimeoutした。同じ目的地への進行中のvisitは、再度「よぶ」でもやり直さない既存契約。UI3はベンチ指定後に図書室の配置を確定して新しい往復を開始し、運搬/記録/再演まで進んだが、花の比較にも同じ「新しい利用開始」の手順が必要と分かったため、実行中PIDを確認して停止した。UI3を完走の証拠にしない。UI4は花の配置を確定してから新しい選択を計測する。即時に進行中の読書を奪う動作は追加していない。アプリsourceは全UI診断で変更なし。

UI4は3個目の花がもちものの2ページ目にあり、1ページ目だけを探すhelperがtimeoutした。失敗画面は残高122とページ1/2を表示しており、購入の消失ではない。UI5は既存ページ送りで現物へ到達するhelperを使う。これもアプリsourceの変更ではない。
