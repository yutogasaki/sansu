# Shared Done Index

- 2026-10-05: [育つ島の検証入口](../../docs/runbooks/growing-verification.md)を追加。`verify:growing`で隔離候補/core/classic smoke/Growing本番形式の実回答・購入・本・保存・SW offlineを集約。core4,722・smoke31・両幅4旅程PASS。公開判定PARTIALと未検証項目を分離。ローカルの検証運用変更 -> `docs/done/2026-10.md`

- 2026-10-04: [20問/日を基準にした島の経済](../../docs/design/2026-10-04-island-economy/README.md)。新規家/畑40・花10、まち時間2/問。資産保持、core4,690・両幅実20問PASS。smoke30/31＋当該1件再実行PASS。ローカル、未公開 -> `docs/done/2026-10.md`

- 2026-10-04: [使う人の切り替えを簡単にする](../../docs/design/2026-10-04-profile-switch/README.md)。設定→名前の2タップ、失敗retry・両プロフィール保持、core4,675・3サイズ・smoke31 PASS。ローカル、公開は未実施 -> `docs/done/2026-10.md`

- 2026-10-03: [Level-up and confirmation test entry consolidation](../../docs/design/2026-10-03-level-up-entry/README.md). Progress first in records; one level-up entry; confirmation/print in parent settings. 4606 tests, production14/parent2/classic31 PASS. Local, not published -> `docs/done/2026-10.md`

- 2026-10-02: [本の自己レビューと修正v6](../../docs/design/2026-10-02-guide-picturebook/review-v6/README.md)。挿絵と本人の模型を分離し、320幅の主操作を初期表示へ。core4,606、3サイズ48撮影・家両幅PASS。未公開 -> `docs/done/2026-10.md`

- 2026-10-02: [あそびかた6点のポップなデフォルメ](../../docs/design/2026-10-02-guide-picturebook/README.md)。全6種類の挿絵と固定snapshot模型、本/一覧/案内を統一。core4,606、3サイズ48撮影、家と実SW offline両幅PASS。ローカル、未公開 -> `docs/done/2026-10.md`

- 2026-10-02: [記録の文字量と進級停止の説明を修正](../../docs/design/2026-10-02-progress-clear/README.md)。メイン再選択による上位offを再現、選択済み操作を無効化、隣接次範囲だけの保護者確認付き再開を追加。core4,605・classic31・5サイズ35ケース/65撮影・両幅の読込/保存retry PASS。ローカル、本人の操作履歴/実機/公開は別 -> `docs/done/2026-10.md`

- 2026-10-02: [島以外を含む全画面の仕上げ](../../docs/design/2026-10-02-whole-app-atelier/README.md)。初期設定/学習/記録/設定/保護者/しあげ/副モード、短横入力と確認/英文focusを整備。519 files/4,603 tests、smoke31、実画面と保存/offlineを確認。ローカル、公開と利用者評価は別 -> `docs/done/2026-10.md`

- 2026-10-02: [学習・島・家のmain統合の最終確認](../../docs/design/2026-10-02-learning-island-integration/final/README.md)。最終core4,599 tests、両幅案内/家/実SW offline・メニュー4サイズPASS。変更なしの仕上げ14/保存バランス4/navigation両幅/classic31を入力照合して保持。実機/公開先/子どもは別 -> `docs/done/2026-10.md`

- 2026-10-02: [本の次の一手と記念を改善](../../docs/design/2026-10-02-guidance-ux/README.md)。通知の対象へ直行・導入の主操作・本人の大きな記念。core4,576、両幅DEV/家/production offline PASS -> `docs/done/2026-10.md`

- 2026-10-02: [2つの模型で選ぶ島メニュー](../../docs/design/2026-10-02-island-play-menu/README.md)。実住人と建築前の模型、主入口/補助列へ再設計。core4,603 tests、関連9、4サイズの全旅程・記録不変PASS。ローカル実装、子どもの無説明理解は未観察 -> `docs/done/2026-10.md`

- 2026-10-02: [学習と島の固定統合候補](../../docs/design/2026-10-02-learning-island-integration/README.md)を確認。core4,587 tests、仕上げ14ケース、家/メニュー/案内/保存/両幅SW offline、classic31件PASS。証拠logのGit除外を修正。実機・後続の並行変更・公開は別範囲 -> `docs/done/2026-10.md`

- 2026-10-02: [家の本と案内の修正](../../docs/design/2026-10-01-island-guidance/fixes-checks.json)。直接入口・不足理由・あとでやる・別タブ同期。コミット対象core4,570、両幅DEV/production offline PASS -> `docs/done/2026-10.md`

- 2026-10-02: [島を眺めながら選ぶメニュー](../../docs/design/2026-10-02-island-pocket-menu/README.md)。縦は小さな下側の紙、横は右側、実住人の入口・遊び優先・操作の折りたたみへ。4サイズの往復と0/8人を検査。ローカル実装、未公開 -> `docs/done/2026-10.md`

- 2026-10-01: [島と共有メニューのデザイン](../../docs/design/2026-10-01-menu-atelier/README.md)。紙の素材を島/種/収納/仲間/設定/5タブへ展開。core4,586 tests、classic31件、Island navigation両幅、4サイズの実画面確認。ローカル実装、未公開 -> `docs/done/2026-10.md`

- 2026-10-01: [あそびかたの家入口](../../docs/design/2026-10-01-island-guidance/house-entry.html)を追加。家で開閉、遊びを選ぶと島へ。読書の保存不変・両幅の実操作/学習予約再開・core4,586テストPASS。未公開 -> `docs/done/2026-10.md`
- 2026-10-01: [育つ島のスターターとアチーブメント実装](../../docs/design/2026-10-01-island-guidance/README.md)。任意S1〜S5/A1〜A6・本・固定記念・保存3。core4,586テスト、固定両幅DEV/production/offline PASS。ローカル実装、未公開 -> `docs/done/2026-10.md`

- 2026-10-01: [家のメニューのデザイン](../../docs/design/2026-10-01-house-atelier/README.md)を整理。基本検証・回帰31件・標準/育つ島の4サイズ計6ケースPASS。ローカル実装、未公開 -> `docs/done/2026-10.md`

- 2026-10-01: [スターターとアチーブメントの仕様案](../../docs/product/island-starter-achievements-proposal.md)を検討。最初の一周・初期6件・任意目標・実達成/保存/受入を整理。文書検証済み、採用前・未実装 -> `docs/done/2026-10.md`

- 2026-10-01: 育つ島のバランスB1〜B6を実装。反復地区・時間保持・実日の出来事・到達判定・重複防止・保存2。関連88 tests、両幅の実操作/production offline PASS、未公開 -> `docs/done/2026-10.md`

- 2026-10-01: しあげの準備3条件を常時表示し、入口と保存済みの結果にレベルアップを明示。関連16テスト・固定両幅14ケースPASS。ローカル実装 -> `docs/done/2026-10.md`

- 2026-10-01: 学習教材の語義・型・範囲・基礎9導入と仕上げ被覆を修正。core4,544テスト、classic smoke31/31、両幅20ケースPASS。ローカル実装 -> `docs/done/2026-10.md`

- 2026-10-01: 家の歩行案内と読み上げ用説明を「ぽこもこ」へ訂正。ローカル修正、公開未実施 -> `docs/done/2026-10.md`

- 2026-10-01: [しあげによる進級と入口UI](../../docs/done/2026-10.md)。ローカル実装・検証済み。公開・実機・利用者評価は別。

- 2026-09-29: 起動/島/家の読み込み表示と同じ保存の描画再試行を実装。core4,300 tests・4サイズ・写真・smoke/PWA通過。水源/時計の次期導入設計を整理。main c1e3bebfから本番反映・公開両幅も通過 -> `docs/done/2026-09.md`

- 2026-09-29: 住人の影の同じ姿勢を再利用。出力同一性、core4,300 tests、両幅の影タップ/保存/再演を確認。main 8d57fc11を公開し、両幅の実学習/購入/offlineも確認 -> `docs/done/2026-09.md`

- 2026-09-29: 記録を島と同じ布配色・toyアイコンへ統一。ぽこもこは足まである既存全身素材へ修正。両幅/固定build/core確認、ローカル実装 -> `docs/done/2026-09.md`

- 2026-09-29: 記録の文字量を削減。レベルの2地点表示と詳細折りたたみ、両幅/固定build/coreを確認。ローカル実装 -> `docs/done/2026-09.md`

- 2026-09-29: 学習進捗の公開確認、読込再試行、旧島PWAと実2ビルドの更新/切断復旧を両幅で追加検証。実機・子ども観察は未実施 -> `docs/done/2026-09.md`

- 2026-09-29: 記録の学習進捗・しあげチャレンジ導線、学習中の現在地と解放通知を実装。core4,293 tests/両幅/80 runsを確認。追加PWA等の未確認範囲と未公開を明記 -> `docs/done/2026-09.md`

- 2026-09-29: 学習音を8小節・複数音色・ステレオ残響へ更新。新旧試聴と実画面の音ON/OFF検証、ローカル実装 -> `docs/done/2026-09.md`

- 2026-09-29: 自動回答中に「こたえる」行が一瞬追加される不具合を修正。両幅の連続DOM監視とcore/build PASS、未公開 -> `docs/done/2026-09.md`

- 2026-09-29: 元の庭とぽこもこを保持し、実形状のraycast CPUを約84〜85%削減。core4,283 testsと同じ保存の比較を確認。33.3ms目標・実iPhoneは継続 -> `docs/done/2026-09.md`

- 2026-09-29: 庭と家の連続表示、自然の来訪/入居、保存21、30品223→110 callsを一括実装・本番反映。既存ぽこもこ・住人・所有・学習を保持し、実操作/更新/offlineと固定80 runを確認。フレーム時間と実機/利用者評価は継続 -> `docs/done/2026-09.md`

- 2026-09-29: タスクを4担当へ整理し、実装済み・確認待ち・比較資料とポータルを同期 -> `docs/done/2026-09.md`

- 2026-09-28: 参考Gitを踏まえた全画面のぽこもこ学習演出v8をローカル実装・検証。実画面と速度、音、offlineを記録 -> `docs/done/2026-09.md`

- 2026-09-28: 星の玩具盤面v4を最新mainへ統合。統合core4,233 tests・build/assets PASS。ユーザーのcommit/main push依頼に対応 -> `docs/done/2026-09.md`

- 2026-09-27: 画像3案からぽこもこの星の玩具盤面をローカル実装。最終UI6条件・固定80 runを確認、視覚採用/子どもの観察/公開は別状態 -> `docs/done/2026-09.md`

## Purpose

This file is a lightweight shared index for recently completed work.
Durable completion history and verification facts still belong in `docs/done/YYYY-MM.md`.

## Current Index

- 2026-09-27: ぽこもこの全身・3/5連続のほしのり・保存される3種スタンプを実装。最新main統合core4,251、production6条件/実SW offline、実2ビルド更新、fixed-ten80 run PASS。動画あり、実機/子どもの評価は別 -> `docs/done/2026-09.md`

- 2026-09-27: 元のぽこもこを保つ幻想の庭・Nature Townの基本循環を本番へ統合。初回報酬の取得競合を修正、core4,243・更新/復旧/offline PASS。30品負荷・全仕様・実機/独立観察は継続 -> `docs/done/2026-09.md`

- 2026-09-27: ぽこもこの入力・正解・区間完了の演出を実装。main抽出候補のcore4,213・画面/入力14条件PASS。先行共有候補のfixed-ten80 runもPASS。動画あり、公開版・実機/子どもの観察は別確認 -> `docs/done/2026-09.md`

- 2026-09-27: ぽこもこの元のモデル・模様・portraitを復元。プレビューを同じ実アプリの表示へ揃え、Nature Townは部分統合と明記。固定版で関連検査・両幅の実獲得/水/再演/offlineを確認。全画面美術・全統合・公開は継続 -> `docs/done/2026-09.md`

- 2026-09-27: Three.jsの幻想の庭・昼夕夜・普通の庭の水反応と思い出を実装。core4,218、両幅の実獲得/offline、fixed-ten80 run PASS。最終美術・全v1・実機/子どもの観察は継続、未公開 -> `docs/done/2026-09.md`

- 2026-09-27: 幻想の暮らしの包括仕様51と8章、58要件節・26受入ケースを策定。B方向、遊び・経済・発見・画面・移行・共有を定義し現行と区別。docs/portal確認PASS、実装・公開は未実施 -> `docs/done/2026-09.md`

- 2026-09-27: 今の島で土が時間とともに湿り乾く。鉢の育ち・地面・文字と保存境界を接続。core、DEV両幅、classic smoke PASS。実機・子どもの理解と来訪/入居は継続 -> `docs/done/2026-09.md`

- 2026-09-26: 島の追加学習の差分反映・復元Worker・白紙時の回復案内。core、両幅の保存/offline/更新とブラウザー応答を検査。実機と残りの描画負荷は継続 -> `docs/done/2026-09.md`

- 2026-09-25: 同じ再生ルールの更新で島キャッシュを保持。core 4,177 tests・両幅の更新/offline PASS。旧キャッシュの初回再構築と実機30秒待ちの確認は継続 -> `docs/done/2026-09.md`

- 2026-09-25: 島の起動計測・小物読み込み分散と、Life学習中の見えない旧3D生成を除去。core・両幅の保存/配置/offline・classic smoke PASS。再起動の待ちと実機確認は残る。未公開 -> `docs/done/2026-09.md`

- 2026-09-22: 仕様・タスクを人向けに分類し、Nature Townを今の島へ取り込む方針へ統一。旧S1は履歴へ退避、docs確認PASS。機能移植・公開は未実施 -> `docs/done/2026-09.md`

- 2026-09-19: Studyの退場中「次へ」による問題飛ばしを修正。PWA4件・clean commitのfixed-ten40run正式PASS -> `docs/done/2026-09.md`

- 2026-09-19: Nature Townの全身受渡し4ポーズ・既存立体素材・offline画像を実装。両幅の実配送／入居／更新を確認。受入46/47、最終美術・独立観察は継続 -> `docs/done/2026-09.md`

- 2026-09-19: Nature Town最適化等を39faaceでmainへpush。Linux固定フレーム比較PASS、受入46/47。SAFE-06の独立観察は未確認 -> `docs/done/2026-09.md`

- 2026-09-19: Nature Townの経路最適化・全4負荷条件を確認。受入45/47。実機・最終美術等は残件、未コミット -> `docs/done/2026-09.md`

- 2026-09-19: Nature Townの初回負荷診断を記録。3条件一致、96人・24地区未完了。次は性能改善、受入44/47維持。未コミット -> `docs/done/2026-09.md`

- 2026-09-19: Nature Town NT-4の実2ビルド更新・offline継続を両幅で確認。次は負荷診断。未コミット -> `docs/done/2026-09.md`

- 2026-09-18: Nature Townを `11d0d25` でmainへpush。続けて画面再開・プロフィール往復の一致を確認、受入44/47。続きの記録は未コミット -> `docs/done/2026-09.md`

- 2026-09-18: Nature Townの将来地区接続を修正、成長・乱数・学習境界8項目を確認。受入43/47、実画面の乱数検証へ。未コミット -> `docs/done/2026-09.md`

- 2026-09-18: Nature Town NT-3前半。開拓時の水分保持を修正、水路・配送6受入項目を確認。残り12項目、未コミット -> `docs/done/2026-09.md`

- 2026-09-17: Nature Town NT-2の入居案内と成長の一周を実装・確認。次は受入残18項目、最終美術等は継続。未コミット -> `docs/done/2026-09.md`

- 2026-09-16: Nature Townの芽・葉・実、在庫、実受渡し、共同食、供給不通を表示。core4,037と本番形式の両幅を確認。最終美術・全身演技・S1全体は継続、未コミット -> `docs/done/2026-09.md`

- 2026-09-16: Nature Townの独立コア・通常学習・保存接続と、住人観察・連続ブラシ・配置予告・失敗時の編集保持を実装。S1全体は継続、初期分のみpush済み、続きは未コミット -> `docs/done/2026-09.md`

- 2026-09-14: 島の孤立予告・自由配置・住人の退避・無料移動復旧と保存版15を実装。core3,990・両幅の実画面/production保存・80runを確認、smoke再確認の範囲と公開未実施を記録 -> `docs/done/2026-09.md`

- 2026-09-13: 島の文字面を縮小し、実3Dの花・ぽこもこと望遠鏡の絵付き操作を1列へ。core3,665・smoke31・Chromium4サイズ確認、ローカルのみ -> `docs/done/2026-09.md`

- 2026-09-09: 島・学習・一覧・編集・管理の目的別レイアウトを実装。背景保存中の学習開始も保護。最終core3,376・PWA・正式80runを確認 -> `docs/done/2026-09.md`

- 2026-09-09: 島の表示面積を広げ、タブとホーム操作を縮小。3viewport・横位置復帰・キーボード・PWAを確認。ローカルのみ -> `docs/done/2026-09.md`

- 2026-09-08: 筆算をEnterなしで連続入力し、正しい数字を残して誤りだけ訂正。固定キー・保存再送、実UI6ケース・2,632テスト・固定80runを確認。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: PWA確認の通信待ちと復旧時cache削除を修正。実二build更新・offline保持・学習保存保護を確認しrelease検証へ追加。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: 学習中の島を非表示にし、全テンキーと支援をスクロールなしで固定。iPad縦横/phoneの固定Chromium・WebKitで計392状態PASS。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: iPad横向きの問題と入力を左右配置し、全キー・支援・続行を画面内に保持。固定Chromium/WebKit20ケース、全2,580テストを確認。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: 初回/追加の算数範囲を九九から速さまでの12択へ拡張。6年生と末尾への縦scroll、開始レベル上限、保存分離を確認。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: 算数の1桁形式と筆算段の自動採点、必要なEnterだけの視覚案内、再起動後も案内の動きを止める端末記憶を実装。単体・固定実画面24ケースPASS、公開なし -> `docs/done/2026-09.md`

- 2026-09-08: 算数のヒントを図の問い・分解の目的・現在の筆算段に合わせて修正。全体2,442件、最終関連67件、実UI21ケースを確認。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: 島に「おとを だす／おと オン」を追加し、明示gestureで音声を再開。正解表示も拡大。固定コピーで音声/PWA/2,240テスト、Mac Metalの正式80runを確認。共有全体の統合と公開は別 -> `docs/done/2026-09.md`

- 2026-09-08: 島の360度回転・1〜2.5倍ズーム・復帰操作を実装。カメラ専用phone/tablet・37unitと共有版typecheckはPASS、全体gateの未達を記録。公開なし -> `docs/done/2026-09.md`

- 2026-09-08: パッチワークのくま風アプリアイコンを生成。正方形PNGと180/64/32pxの表示確認を保存、配布アイコンは未変更 -> `docs/done/2026-09.md`

- 2026-09-08: 学習区間で10ほし、島3テーマ/3飾りの試着・交換・無料切替・目標を実装。2,232テスト、実UI/PWA、正式80run/15gate、追加操作0を確認 -> `docs/done/2026-09.md`

- 2026-09-08: 独力正答、卒業後の再学習、実時間SRS、Lv11の7単元進行、英語Due予算を実装。共有core2,188テスト、固定実UI/PWA・正式80runを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 島のカワウソ1体を布のパッチワークとまんまるしっぽに変更。2,131テスト、専用19画面、回帰/PWA、固定80 runの数値条件を確認 -> `docs/done/2026-09.md`

- 2026-09-08: 居場所1つ/2つの完成で島が東/西へ広がるよう変更。5記録・旧土地保持・2,020テスト・実25区間×2・正式80runを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 島の教科を初見継続・復習量・任意の「つぎも」で選択。2,128テスト、実UI6、通常島/PWA、固定80runを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 学習の効果音・○／×・英語の手動/自動読み上げを実装。1,977テスト、native音声8ケース、全形式23ケース、保存/PWAと80runの数値基準を確認 -> `docs/done/2026-09.md`

- 2026-09-08: 一部の島の住民にパッチワークの質感を取り入れる参考画像と方針を保存。docs:check PASS、造形の実装は未実施 -> `docs/done/2026-09.md`

- 2026-09-08: 島を東西へ大きく拡張し、成熟の輪郭差・節目通知・比較・6件の成長記録を実装。1,995テスト、実UI25区間×2、正式80runを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 追加12作品のポイント交換・島スキン・収集を公式資料で比較。欲しくなる8つの入口、報酬16種類、実操作24項目を整理 -> `docs/done/2026-09.md`

- 2026-09-08: 忘却・復習・レベル分けを現実装と一次研究で分析。維持誤答のDue漏れとLv11定着の境界を合成診断し、改善順・評価指標を文書化 -> `docs/done/2026-09.md`

- 2026-09-08: 7作品のベンチマークを104項目・18観点に整理。公式の事実、体験解釈、Sansu候補を分離 -> `docs/done/2026-09.md`

- 2026-09-08: 全教材の単元対応とLv11比較試作を実装。独力・支援・表現・遅延確認を分け、1,989テスト・既存導線/PWA・正式80runを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 育つ島の4地区・有限7物・暮らし・任意編集・発見/3D履歴を実装。1,933テスト、実UI25区間×2、正式80runと保存/PWA回帰を確認 -> `docs/done/2026-09.md`

- 2026-09-08: 算数の成功に応じた導入、英語の意味別IDと出題、正解実績による昇格、日を空けたSRSを実装。1,867テスト・全経路回帰・固定10問80run通過 -> `docs/done/2026-09.md`

- 2026-09-08: 初回設定から直接3問、初回報酬の後回し、通常の連続学習を実装。固定eb5fで1,720テスト・正式80 run・入口60測定・保存/遊び回帰を確認 -> `docs/done/2026-09.md`

- 2026-09-08: Island navigation and shared utility identity unified; native practice and specialty learning preserved; fixed-build UI/PWA regression verified -> `docs/done/2026-09.md`

- 2026-09-08: 島ホームの住民紹介・成長予告・自動保存の常設説明を削除。phone/tablet実画面と1,720テストを確認 -> `docs/done/2026-09.md`

- 2026-09-07: Island input readiness, independent rechecks, rotating vocabulary review and animal replay verified on fixed 32cb; 1299 tests, smoke31 and 80 timing lanes -> `docs/done/2026-09.md`

- 2026-09-07: Multi-digit partial products and long division shared across Study/Island/Park; 44px inputs, final-only grading and legacy resume verified -> `docs/done/2026-09.md`

- 2026-09-07: Learning progression and focused review corrected; faithful A4 tests, persistent reprint and atomic scoring verified -> `docs/done/2026-09.md`

- 2026-09-07: Mystic Island procedural 3D and bold moon-garden palette; shared seat/life response, reusable dragging and arrival-path fix verified on both viewports -> `docs/done/2026-09.md`

- 2026-09-07: Island solving workbench, consistent learning glyphs and short world reactions completed with preserved input speed and full regressions -> `docs/done/2026-09.md`

- 2026-09-07: Mystic Island learning/life implemented with normal inputs, free placement, real animal paths, offline persistence and verified repeated throughput -> `docs/done/2026-09.md`

- 2026-09-06: Gameplay-first direction restored; new 12-board standalone Pittari prototype, HTML and runtime evidence verified -> `docs/done/2026-09.md`

- 2026-09-06: Corrected the first-launch park entry and verified real registration plus hosted PWA update -> `docs/done/2026-09.md`

- 2026-09-06: Published Three.js park and verified real hosted PWA replacement with data preservation -> `docs/done/2026-09.md`
- 2026-09-06: Three.js park candidate integrated with rearrangement, acting, learning return, and runtime evidence -> `docs/done/2026-09.md`
- 2026-09-05: Shared-subject build-and-play MVP, reserved learning, profile-safe parts, and PWA verification -> `docs/done/2026-09.md`
- 2026-07-24: PWA update pickup hardening and Service Worker-controlled drift regression -> `docs/done/2026-07.md`
- 2026-07-18: Exploration direction, independent `/explore` MVP, and app-wide consistency -> `docs/done/2026-07.md`
- 2026-07-19: Immersive encounter foundation, root-tangle slice, deterministic problems, and replay goal -> `docs/done/2026-07.md`
- 2026-07-19: Research Library return visual slice and real-flow layout evidence -> `docs/done/2026-07.md`
- 2026-07-19: Explore answer receipts, retry-safe UI, and persisted run lifecycle -> `docs/done/2026-07.md`

- 2026-09-07: Latest app production release — docs/done/2026-09.md

- 2026-09-08: ぽこもこ正式名と紫/生成りの共通UIをローカル実装。最終26画面PASS、速度の一部未達は公開前の残件として記録 -> `docs/done/2026-09.md`

- 2026-09-08: 星の問題数連動・価格・島の段階的な成長/解放を調整。既存成果と旧予約を保持し、2,466テスト・実UI/PWA・固定80run再測定がPASS -> `docs/done/2026-09.md`

- 2026-09-08: ぽこもこの背景を白い布と大小の水玉へ変更。固定production26画面と2,232 testsを確認 -> `docs/done/2026-09.md`

- 2026-09-08: 水玉と色使いだけで不思議さを表す3配色比較。Aをローカル試作へ統合、固定26画面と2,232 tests PASS -> `docs/done/2026-09.md`

- 2026-09-09: 島の入口名と画面見出し、戻る/閉じる、家内の一段戻りを統一。3,423 tests・smoke31・ナビ2幅・退出操作4幅を確認 -> `docs/done/2026-09.md`
- 2026-09-09 家の履歴・棚の空状態・保存再確認・短い画面を改善。4サイズ/3428unit/smoke31 PASS -> docs/done/2026-09.md
- 2026-09-09 写真の読込/削除中断・家への帰還・空報酬・短い横向き撮影を改善。4サイズ/3440unit通過 -> docs/done/2026-09.md

- 2026-09-27: 手元変更のbackupと最新mainへの整理。公開済み保存/報酬/ぽこもこを維持し、旧試作・入口と資料を整理 -> `docs/done/2026-09.md`
- 2026-10-01: しあげの条件を全20問独力正解に変更。19/20のレベル維持、新予約20/20の進級を実UI/保存で確認、4391 tests PASS -> `docs/done/2026-10.md`

- 2026-10-01: 学習アルゴリズム監査A1〜A10修正。独力/代表出題/coverage/復習・回復・配分を整え、全4474 tests・smoke31・固定preview80実回答を確認。ローカル、本番未配布 -> `docs/done/2026-10.md`
