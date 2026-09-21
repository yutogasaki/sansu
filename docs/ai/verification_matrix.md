# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.
GitHub Actions should mirror the same baseline for `docs:check` and `verify:core`.

`node tools/e2e-island-reading-fixture.mjs` は新しい `SANSU_READING_OUTPUT` を指定する。実コンポーネントで明示した読書snapshotを描画し、実提示の証拠を `simulated` として保存した後、アプリの一覧から本人保存・再生・再読込保持をphone通常motion/tablet reduced motionで確認する。行動/通貨/学習正本不変とsource一致を検査する。これは自然なカワウソのX3出現、実取得、学習入力復帰、PWAや無文字理解の証拠ではない。自然初回の不成立は別に残し、住民や時刻の再抽選で埋め合わせない。

## Current Commands

現行アプリのUX/UI監査・実画面作業は `npm run dev` または明示した `npm run dev:island` から開始し、`VITE_ISLAND_ENABLED=true` と `/#/island` を確認する。通常起動はIsland flag-onのIsland画面を開き、port競合はfail-fastにする。`/explore` はIsland有効時も残る任意の副モードで、全体UX監査の主対象に混ぜない。flag-offのclassic起動は専用ownerが明示した場合だけ行う。全ルート共通の `.app-container` はIsland/Nature Townの実feature flagとbuild revisionを公開し、Island画面はさらにdelivery、visual/learning candidateを公開する。各captureでURL/routeと共通rootのflagを照合し、route固有candidateがない共有Utility面は「該当なし」と記録する。必要なmarkerが欠けるcaptureは現行UIの証拠にしない。`npm run verify:core` の `check:current-ui-entry` は標準起動/flag/route契約、共有root flag、Island画面identity markerに加え、製品仕様01/06/15とmemory・ownership map・Explore実装計画・risk registerの現行入口および旧Exploreの履歴境界を検査する。

Islandの画面captureは `tools/island-e2e-helpers.mjs` の `runtimeMetadata` でIsland画面identityと `.app-container` root identityを両方記録する。全体ナビゲーションのcapture前に、root Island=true / NatureTown=false、configured delivery `snap-root-v1`、revision/versionの存在とIsland画面側との一致を厳密検査する。rootのboolean marker欠落はfalseへ丸めずunknownとして失敗させる。共有Utility routeも同じroot helperとflag gateを使う。

`node tools/e2e-island-life-facility-production.mjs` は `SANSU_FACILITY_PRODUCTION_URL`、新規 `SANSU_FACILITY_PRODUCTION_OUTPUT`、絶対pathのapp/dist SHAとversion/flagsを持つ `SANSU_FACILITY_PRODUCTION_MANIFEST` を指定。phone/tabletで初回設定から通常入力60問・施設の実購入・単体利用・R5/R6の明示観察/本人保存・offline再読込を行い、学習等7ストアと所有を比較する。相手が利用中なら案内を確認し、追加購入後の実poseから空いた花を選ぶ。利用中分岐を通らなかった幅の案内表示までPASSとしない。DB注入/時間加速/自然発見の代用ではない。

`node tools/e2e-island-life-facility-replay-production.mjs` は上記の成功結果を `SANSU_FACILITY_PRODUCTION_SOURCE`、新規出力を `SANSU_FACILITY_REPLAY_OUTPUT`、新build manifestを `SANSU_FACILITY_REPLAY_MANIFEST` に指定。同じlocal originへ新buildを配信してから、元の隔離ブラウザを開き、実SW更新とentry JS/versionを照合する。元の保存場面を変更せずofflineでR5/R6を再演し、元scene・残高・学習等7ストアを保持することを検査する。元の獲得buildと新rendererのsourceは別々に記録する。

`SANSU_FACILITY_REPLAY_OPEN_SCENES=1` では横幅を広げた枠なし場面の寸法を確認し、保存解除の取消・現在画面・高さ390pxで閉じる操作とEscape・学習復帰の全数字キーを追加検査する。throughputや実機理解を測定した検査ではない。

`node tools/e2e-island-water-magic-v3.mjs` は `SANSU_WATER_MAGIC_URL` と新しい `SANSU_WATER_MAGIC_OUTPUT` を指定。DEVのphone390×844/通常motion・tablet768×1024/reduced motionで、水鉢の実タップ・連打統合・5秒後の通常水面、灯りの近→遠→復元、縁からの再試行、本人保存/元のタップ位置での再演/現在入口、収納・再読込後の過去保持、残高/学習正本不変と学習入力復帰を確認する。20件のQA creditを使う。非表示中断はdocument visibilityへの明示障害注入であり、実ブラウザーのバックグラウンド遷移やPWA検証と区別する。`SANSU_WATER_MAGIC_DEVICE` は診断の幅限定。固定sourceのcore後に実時間UIを実行する。

`node tools/e2e-island-explicit-observation-v3.mjs` は `SANSU_EXPLICIT_URL` と新しい `SANSU_EXPLICIT_OUTPUT` を指定。DEVのphone390×844/通常motion・tablet768×1024/reduced motionで、図書室の現物タップ、同じ住民の花/水/通常休憩への切替と本の往復、小屋から自動選択とは異なる現物への道具運搬、R5/R6のcurrent-context-test記録/本人保存/再演/現在復帰、版14再読込/収納後の過去保持、残高/学習正本不変と学習入力への復帰を確認する。100件のQA credit、明示呼び先・実配置、小屋では読み取りだけの現在空き対象判定を用いる。時間加速・住民の抽選やり直しはしない。`SANSU_EXPLICIT_DEVICE` は診断の幅限定用。全coreを固定sourceで完了してから短い実時間のUI旅程を実行し、source開始/終了一致も必要。対象旅程のPASSを自然初回・無文字理解・全PWA/releaseの合格へ置き換えない。

`node tools/e2e-island-facility-relations-v3.mjs` は `SANSU_FACILITY_RELATIONS_URL` と新しい `SANSU_FACILITY_RELATIONS_OUTPUT` を指定する。DEVのphone/tabletで本/道具の実運搬、見える実利用のR5/R6記録、再演・本人保存・現在入口、同じぽこもこの近→遠→復元の実移設と入口通常利用への切替、遠い配置で新しい提示履歴を作らないこと、収納後の記録保持と学習復帰を確認する。実取得は100件のQA creditで代用。所有者の更新は版13へ移行する。`SANSU_RELATION_BENCH_START=1` は図書室旅程をベンチ指定から始め、より近い花へのR1切替も実操作する。距離比較は施設指定へ戻して行う。通常旅程後の所有者APIへのobserve書込と版13再読込は明示診断であり、UIから無料住民を呼んだ証拠と区別する。短い受け取り場面の撮影を含むため、全体検査と分けて実行した結果を正式証拠とする。

`node tools/e2e-island-facility-trips-v3.mjs` は `SANSU_TRIPS_URL` と新しい `SANSU_TRIPS_OUTPUT` を指定する。DEVのphone/tabletで図書室/ベンチと小屋/花を実購入し、入口→同一住民の運搬→利用、再読込保持、収納取消、学習正本/残高保持と学習入力復帰を確認する。100件のQA creditと、施設を呼び先にして相手の配置を確定し直す明示操作であり、自然初回発見・実取得・子どもの理解・R5/R6記録の検証とは区別する。

`node tools/e2e-island-life-world-first.mjs` は `SANSU_WORLD_FIRST_URL` と新規 `SANSU_WORLD_FIRST_OUTPUT` を指定。4サイズの実画面で絵付き操作の44px/hit、残高・世界・操作の分離、全景/近景/zoom復帰、情報面とカメラの排他、7秒の完了文と自動で消えない保存失敗、再試行、配置取消と学習復帰を確認する。花4個/ベンチと残高は明示native fixtureで、実取得や子どもの理解とは区別する。`SANSU_WORLD_FIRST_BROWSER=webkit` と `SANSU_WORLD_FIRST_WIDTH` で対象を限定できる。

| Command | Purpose |
|---|---|
| `node tools/e2e-island-direct-scale.mjs` | `SANSU_DIRECT_URL` と新規 `SANSU_DIRECT_OUTPUT` を指定。合法配置1/9/16個・長い名前・空の配置を明示native fixtureで作り、4サイズで直接操作の大きさ、実hit、眺めとの排他、7store不変、絵と実3Dの遊び、混雑時の移動入口を検査。390幅は実キツネ選択・退出/再読込・明示WebGL故障、320幅は24px文字の診断を含む。`SANSU_DIRECT_BROWSER=webkit` は390幅、`SANSU_DIRECT_WIDTH` は指定幅だけ。`SANSU_DIRECT_BASELINE=1` は旧mainのリスト/重なり再現であり修正候補のPASSではない。実取得・実機・子どもの観察とは区別する |
| `npm run e2e:island-navigation` | 島有効のDEV/productionを `SANSU_ISLAND_BASE_URL` で指定。標準viewportは `320x568,390x844,768x1024,480x431,599x430,568x320`。`SANSU_NAVIGATION_VIEWPORTS=390x844,768x1024,1280x720` のように指定すると全画面導線を任意viewportで検査できる。トップ訪問、5項目ナビ、設定詳細の保持、半透明面上の補助文字コントラスト（合成背景と不透明paperの両方で4.5:1以上）、回答下書き・7store不変、履歴の戻る/進む、島再読込で自動開始しないこと、配置取消/保存、持ちものscroll cue（短横画面の到達と320px縦画面のno-overflow/no-cue）、Records内部scroll、実撮影/写真拡大、直リンクfallback、学習後の記録更新を検査。出力先は `SANSU_NAVIGATION_OUTPUT`。nativeプロフィールfixtureのみを作り、学習予約・回答・写真は実UIで行う |
| `node tools/e2e-island-house-edges.mjs` | `SANSU_ISLAND_BASE_URL` と新規 `SANSU_HOUSE_EDGES_OUTPUT` を指定。家内履歴/再読込/学習復帰、実初回3問と賞状展示、写真入口からの復帰、オフライン復旧を4サイズで確認。全16品の資格は明示aggregate fixture、保存abortとroot文字拡大は別診断として記録する |
| `node tools/e2e-island-photo-exits.mjs` | `SANSU_ISLAND_BASE_URL` と新規 `SANSU_PHOTO_EXITS_OUTPUT` を指定。4サイズで実撮影・保存→一覧→家/写真棚、読込失敗と再試行、削除確認/Esc、削除完了を保留した履歴移動、不明写真/空のおくりものの退出を検査。操作全体の画面内表示・44px・上中下の実hit、学習6store不変と写真receipt4件を照合。native障害注入は明示診断 |
| `npm run e2e:launch` | `SANSU_LAUNCH_BASE_URL` と `SANSU_LAUNCH_MODE=island/park/classic` を指定。未登録・登録済みのトップ、実探索のactive checkpointを残したトップ/再読込/初回設定再訪、不明URLと残留query、明示的な探索再開を検査する。出力先は `SANSU_LAUNCH_OUTPUT` |
| `node tools/e2e-island-keepsakes.mjs` | 空の学習履歴を持つnativeプロフィールfixtureから実初回3問/累計5区間を回答し、賞状/最初のトロフィーの無料展示・収納・一括展示、家内overview/棚/掲示板の往復と実通知件数、近景/全体、実写真PNG、再読込、同予約の非最終回答による全islands保持をphone/tabletで確認する。`SANSU_ISLAND_PRODUCTION_URL`、新しい `SANSU_ISLAND_KEEPSAKES_OUTPUT`、固定 `SANSU_ISLAND_BUILD_SOURCE` が必須。native全storeとcanonical receipt、app/QA closureの前後hash、visibleな実frameとcameraを保存する。16品盛景fixture、家の直接tap/実おくりもの通知の全入口、故障/PWA/実参加者は別検証。`--plan`は準備のみで実画面合格ではない |
| `node tools/e2e-island-reward-goals.mjs` | 固定productionの両幅で、無料の横断目標選択/解除/再表示、未資格0ほしの条件、通常学習で35ほし分を得た3カテゴリの実取得時解除、試用保持、同予約への1回答/reloadを確認。固定manifest・production URL・新しい `SANSU_ISLAND_REWARD_GOALS_OUTPUT` が必須。appと明示QA overlayの前後hash、native全table差分を保存する。写真は空store保持、音/故障/PWA/実参加者は別範囲。`--plan`はブラウザ未起動 |
| `node tools/e2e-island-expression-audio-focused.mjs` | 初回1区間と必要な工作から三音の実資格/明示取得へ進み、既存audio phaseの実PCM・native時計・loop・無料音・hidden/退出/学習中停止を限定再検証する。固定20のmanifest・明示QA overlay・新規出力が必須で、初回予約と全tableの比較を各往復へ継承する。検証済みnative before/afterをstructuredCloneのままcallerへ渡し、JSONを保存baselineとして再読込しない。`SANSU_AUDIO_FOCUSED_BOUNDARIES_ONLY=1`は実初回/ベル取得からhidden/退出/学習停止だけを確認し、三音/無料音の測定は別runへ帰属させる。長い訪問/全取得/写真の経路を反復しない。実音の未計測prefix、実スピーカーと参加者の未検証は保持。環境変数と範囲は `--plan` を参照 |
| `node tools/e2e-island-expression-qualified.mjs` | 固定productionのphone/tabletで実初回設定・通常回答から蝶/葉鳥を実観察し、実道具で標本を調べて組立・接続・水の実演を行い、音offでもbell観察から4記念品を明示取得/装備する。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_QUALIFIED_OUTPUT`、固定`SANSU_ISLAND_BUILD_SOURCE`を指定。未観察の試用・図鑑閲覧・組立だけ・接続だけでは資格を得ず、実readyフレームとnative完了transaction、各workshop操作のcanonical intent/全保存枝、写真の同bytes・同学習予約を確認。自然なhome観察も継続記録し、読取画面の保存不変と区別する。`SANSU_ISLAND_QUALIFIED_AUDIO=1`と`SANSU_ISLAND_QUALIFIED_HEADED=1`で追加の音QAを実行し、元PCMと同gainの実出力、無料音への復帰、実hidden、同文書の設定退出、同予約への学習復帰と音停止を別reportへ保存する。計測moduleを含むQA closureを固定し、初期未測定部分・計測失敗・未到達境界を残す。既定のrunでは実音は範囲外。旧景色、故障/競合、実スピーカーと子どもの意欲は別範囲。`--plan`・監査helperの回帰合格は実画面PASSではない |
| `node tools/e2e-island-expression-persistence.mjs` | 実初回設定と通常回答のほしを基に、身支度のnative abort/全table rollback、通知欠落/同receipt retry、別windowのknown CASと再選択、実hidden、実profile切替、夕/冬の非既定選択を保つ実SW offline/reload/通常回答をphone/tabletで確認。A/Bそれぞれの初回答前に異なる被写体（全景/ウサギ近景）の実frame写真を撮影し、元画像/thumbnailとも異SHAを必須にする。失敗/競合/プロフィール往復/オフライン後のbytes/metadata保持、各本人の実アルバム1件・実imgとPNG出力を照合する。gallery内は全DB不変、ホーム往復は事前の実visible-ready frameとnative完了に対応する厳密な初発見差分のみ許可し、未知writeを次のbaselineへ吸収しない。`SANSU_EXPRESSION_PERSISTENCE_URL`、新しい`SANSU_EXPRESSION_PERSISTENCE_OUTPUT`、固定`SANSU_ISLAND_BUILD_SOURCE`を指定。故障注入を明示し、実hiddenが成立しなければそのgateを未検証にする。旧cap receipt/別機能購入競合/精密liveQuery順序/時計変更/実参加者は別範囲。`--plan`は実行結果ではない |
| `node tools/e2e-island-expression.mjs` | 固定productionのphone/tabletで実初回設定・通常回答による85ほし、全10品の未保存試用、6有料品の取得と装備の分離、3住民の衣装/試歩、朝昼夕/季節と既定復元、実写真の外装とPNG不変、同予約への通常回答/reloadを確認。sceneStyle v2の確定選択保存→衣装/模様/足跡/表紙/環境変更→保存景色の実景試用/取消→明示適用→再編集を全tableの厳密差分と照合する。3住民それぞれで無料cap→追加合羽→命名で合羽保持→保存済みと同じ無料capを明示選択して復元→追加品再装備を行い、模様/足跡・同じ実rig・写真を保持する。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_EXPRESSION_OUTPUT`、固定`SANSU_ISLAND_BUILD_SOURCE`を指定。4観察資格品は未達/既達状態を検査し、資格を得る実経路/audio/nativefault/offline/profile/旧景色/後発家具衝突/子どもの意欲は別検証。`--plan`は計画確認のみで実画面PASSではない |
| `npm run docs:check` | Docs/process link and structure checks |
| `node tools/e2e-island-landscape.mjs` | Chromium/WebKitの1024×640で通常・数図・十進図・小数・分数・筆算・英語の入力/ヒント/お手本/続行を検査。1024×600/768・1180×820・1366×1024・縦画面への回転と下書き保持も確認。`SANSU_ISLAND_PRODUCTION_URL`と新しい`SANSU_ISLAND_LANDSCAPE_OUTPUT`を指定。実iPad Safari・インストール済みPWAとは別のviewport検証 |
| `node tools/e2e-answer-completion.mjs` | 固定production previewのphone/tabletで1桁/筆算の自動採点、可変桁/小数/分数の手動確定、Enterの静止/初回案内/reduced motion、同一イベント内連打、保存abortと下書き再送、Study復習の実保存を確認。`SANSU_AUTO_ANSWER_URL`と新しい`SANSU_AUTO_ANSWER_OUTPUT`を指定。独立したnativeプロフィールfixtureと作者による画面確認であり、子どもの無説明理解とは区別する |
| `node tools/e2e-island-workshop.mjs` | 空DBの実初回設定と通常回答1区間後、3標本の区画洗浄/光/水/正体/棚、4部品の組立、異なるA/B作品の実演/保存、undo/reload、同じ学習予約の回答をphone/tabletで検査。`SANSU_ISLAND_PRODUCTION_URL`と新しい`SANSU_ISLAND_WORKSHOP_OUTPUT`を指定。`SANSU_ISLAND_BUILD_SOURCE`なしはDEV診断。直接drag、住民利用、実offline/背景、作者以外の理解・意欲は別検証が必要 |
| `node tools/e2e-island-workshop-gestures.mjs` | 空DBから実区間後、actual ray位置へのnative touch/mouseで長押し・取消・速いなぞり・現物drag・くぼみでの組立・盤へのdrag・重複/範囲外・A→B→A・undo/redoを確認。同じ通常予約の回答まで通す。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_WORKSHOP_GESTURES_OUTPUT`、固定版の`SANSU_ISLAND_BUILD_SOURCE`を指定。tabletのpointercancel注入はnative touchCancelと区別して記録 |
| `node tools/e2e-island-workshop-residents.mjs` | 空DBの実学習から3住民を解放。明示選択した実住民の歩行・手/handle接点・接触描画後の実行・種別の注視と、本人/選び直し/退出/学習/実背景化を確認。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_WORKSHOP_RESIDENTS_OUTPUT`、固定版manifestを指定。距離/順序が通っても、手・顔・道具の実画像が隠れる場合は視覚HOLD |
| `node tools/e2e-island-workshop-persistence.mjs` | 空DBの実操作から、全テーブル不変、native abort、FIFO、成功後のcompletion通知欠落と同receipt再送、別tab/profile、実document.hidden、実SW offline/reload/通常回答を確認。`SANSU_WORKSHOP_PERSISTENCE_URL`、新しい`SANSU_WORKSHOP_PERSISTENCE_OUTPUT`、固定版manifestを指定。`SANSU_WORKSHOP_PERSISTENCE_HEADED=1`で実タブ切替を使える。`--plan`は準備状況のみ |
| `node tools/e2e-island-photos.mjs` | 空DBの実回答からcamera/写真棚へ進み、全景/実住民の近景/入江の画素一致、保存PNGの同bytes、12枚満杯、削除取消/削除、変換途中の学習復帰、実SW offline、実2人目の写真分離を確認。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_PHOTOS_OUTPUT`、固定版の`SANSU_ISLAND_BUILD_SOURCE`を必須とする。近景は画像hash差だけでなく実camera倍率を比較。toBlob遅延は取消の診断であり速度証拠ではない。住民/展示/写真の魅力と子どもの理解は実画面/参加者の別判定 |
| `node tools/e2e-island-photo-persistence.mjs` | 空DBの実設定・通常回答・実canvas撮影から、保存/削除のnative IDB abortによる全table rollback、commit通知欠落後の同PNG/metadata/revision/receipt再送、同時に可視の別windowで削除後の古い再送、実document.hidden中の変換結果破棄と同じ学習予約への復帰をphone/tabletで確認。`SANSU_PHOTO_PERSISTENCE_URL`、新しい`SANSU_PHOTO_PERSISTENCE_OUTPUT`、固定版の`SANSU_ISLAND_BUILD_SOURCE`を指定。headedが既定で、`SANSU_PHOTO_PERSISTENCE_HEADED=0`はheadless。`--plan`はブラウザを起動しない準備確認。故障注入とdriver focus emulation解除は明示診断であり、実hidden未観測なら `backgroundGatePassed` / `fullPersistenceMatrixPassed` を合格にしない。v7移行はunit tests、実SW offlineと写真分離はphotosハーネスで別に確認 |
| `node tools/e2e-island-camera.mjs` | phone/tabletで島のmouse/touch平面移動・ピンチ/ホイール/ボタン拡縮・縦scroll・取消・resize・DB不変・家の扉への実tap/退出・同予約の学習復帰を検査。真正初回の経路と、拡張島の6倍/4端/地区移動を確認する明示成熟fixtureを分ける。`SANSU_ISLAND_CAMERA_URL` と新しい `SANSU_ISLAND_CAMERA_OUTPUT` を指定。実操作による作者の検査で、子どもの理解は未評価 |
| `node tools/e2e-island-guide.mjs` | 空DBから実初回設定/段階2までの通常回答で、未発見/無料ヒント・固定画角の次成長予告/取消・未解放の案内・実観察/再演・実frame写真/再mount時の重複DLなし・同じ予約の回答再開をphone/tabletで検査。`SANSU_ISLAND_PRODUCTION_URL`、新しい`SANSU_ISLAND_GUIDE_OUTPUT`を指定。`SANSU_ISLAND_BUILD_SOURCE`なしは明示DEV診断で、正式固定sourceや子どもの理解の証拠にしない |
| `node tools/e2e-island-customization.mjs` | 固定productionのphone/tabletで実初回設定→学習でほし獲得→実景プレビュー/取消→目標→確定交換→再着替え/過去の外見→実SW offline再開を検査。旧島の一回限り加算と全所持は別の明示fixture。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_CUSTOMIZATION_OUTPUT`を指定。実参加者の意欲は未評価 |
| `node tools/e2e-island-discovery-navigation.mjs` | 実設定・6区間の後、自然に起きた発見保存のnative完了callbackを明示的に保留し、背景保存中の比較/アルバム往復と手動保存のロックを検査。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_DISCOVERY_NAVIGATION_OUTPUT`を指定。保存遅延の故障診断で、通常速度・子どもの挙動とは区別 |
| `npm run learning:report` | 全教材の単元対応・前提参照の検査と、Lv11の7合成シナリオをHTML/JSONへ出力。通常進行や実参加者の学習効果の証明とはしない |
| `npm run lint` | Static linting |
| `npm run typecheck` | Fast TypeScript verification |
| `npm run test:run` | Unit/integration tests |
| `npm run assets:check` | PWA precache・探索画像の容量と制作物混入を検査 |
| `npm run build` | TypeScript build + production build + `assets:check` |
| `npm run e2e:smoke` | Smoke E2E for critical flows |
| `npm run e2e:print` | 実Settingsで紙テスト作成・再印刷・採点・取消とA4 PDFの意味／改ページを390×844・768×1024で検査。DEVを5199で起動。`SANSU_PRINT_BASE_URL`で変更可能 |
| `npm run e2e:learning-progress` | 旧英語プロフィールの次レベル練習開始と、当日停止／生成エラー時の復習導線を実Studyで検査。DEVを5199で起動。`SANSU_LEARNING_PROGRESS_BASE_URL`で変更可能 |
| `node tools/e2e-learning-reinforcement.mjs` | 固定DEVの通常Studyで筆算既定ON/OFF・途中誤答訂正・実表示切替をphone/tabletで回答し、保存ログの表現・独力数を照合。`SANSU_LEARNING_REINFORCEMENT_URL`、`SANSU_LEARNING_REINFORCEMENT_OUTPUT`（新しいJSONパス）を指定。14ケース、実参加者の学習効果とは別の回帰検査 |
| `npm run e2e:pwa-update` | Production-preview regression for protected-route and same-route update checkpoints |
| `npm run e2e:park` | Flag有効のDEVで制作・配置・再演・再開・プロフィール分離とphone/tabletの入力を検査 |
| `npm run e2e:park-pwa` | Flag有効のproduction previewで遊園地の更新checkpoint・保存hold・旧run優先を検査 |
| `npm run e2e:island` | 島の通常planner入力・初回からの自動成長/連問・4地区の成熟・任意編集/過去の姿・発見/3D履歴・表示復旧をDEVで検査 |
| `node tools/e2e-island-shell.mjs` | 島→学習→設定→記録→島のphone/tablet往復、通常Study転送と専用復習/テスト保持、保存済み問題・報酬・ログ、共通navのhit/44px/横溢れを検査。`SANSU_ISLAND_SHELL_URL`で対象、`SANSU_ISLAND_SHELL_OUTPUT`で実画面とreportの保存先を指定 |
| `node tools/e2e-island-3d.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 島productionのdrag/取消/接触/局所反応/描画資源を検査。`SANSU_ISLAND_PRODUCTION_URL`で固定build、出力先はscriptの3D専用環境変数を指定 |
| `node tools/e2e-island-patchwork.mjs` | 固定productionの空DB初回設定・実回答・獲得したベンチへの歩行/着座・学習復帰・reload/WebGL復旧をphone/tabletで確認し、住民候補IDと素材資源を照合。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_PATCHWORK_OUTPUT`を指定。app入力とQAの開始/終了hashを別々に保持し、作者の実画面を子どもの観察と区別する |
| `node tools/e2e-island-experience.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 島productionの実獲得→配置/回転/取消→着座/灯り遊び→再学習をphone/tabletで検査。遊びの操作順と住民全身の描画範囲を確認。`SANSU_ISLAND_PRODUCTION_URL`と`SANSU_EXPERIENCE_OUTPUT`を指定。画面の魅力と子どもの理解は別判定 |
| `node tools/e2e-island-east-learning.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 固定productionで2区間を実回答して獲得したブランコを東土地へUI配置し、橋を歩行中/着座後の学習復帰・全身・固定画角・次回答をphone/tabletで検査。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_EAST_OUTPUT`を指定。全app入力とQA closureの開始/終了、実versionを照合。DEV成長fixtureとは別の証拠 |
| `node tools/e2e-island-learning.mjs` | 島の全入力・意味保持・連打・支援再開・表示復旧を検査。`SANSU_ISLAND_PRODUCTION_URL`指定時は同一buildの6形式×phone/tabletと候補IDを照合 |
| `node tools/e2e-island-feedback.mjs` | 390×844・768×1024で効果音のデコード/実出力、正誤/訂正/区間完了、音off/reduced motion、英語の手動/自動/中止を検査。再生拒否は明示的な診断。`SANSU_ISLAND_PRODUCTION_URL`と`SANSU_FEEDBACK_OUTPUT`を指定。端末の音声エンジンを確認するMac Chrome実行は`SANSU_AUDIO_NATIVE_SPEECH=1`。スピーカーの実聴や子どもの理解とは別の証拠 |
| `node tools/e2e-island-sound-control.mjs` | phone/tabletで文字付き音ボタンのtap/keyboard、実デジタル出力、既存プロフィール設定の共有、入力下書き・全学習状態の保持、再読込を検査。resume無応答、gesture途中の復帰、設定保存abortは明示診断として区別する。`SANSU_ISLAND_PRODUCTION_URL`と新しい`SANSU_SOUND_CONTROL_OUTPUT`を指定。OS/タブの消音や実スピーカーの聞こえ方を検知した証拠にはしない |
| `node tools/e2e-island-support.mjs` | 固定production buildで段階支援の下書き/カーソル保持、お手本中の物理入力停止、全筆算、支援完了/報酬、Due/独力確認の保持、再開を検査。旧slotのoptional field省略は別の明示的な互換fixtureとして記録 |
| `node tools/e2e-island-observation.mjs` | 固定productionの実DOMと前向き観測イベントを照合。誤答訂正、筆算途中の支援、同slot再入場/reload、表示/支援の観測範囲をChromiumの2 viewportで確認する。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_OBSERVATION_OUTPUT`を指定。明示profile/memory fixtureを使い、実参加者・独力・定着は認定しない |
| `node tools/e2e-island-onboarding.mjs` | 固定production buildで空DBからの初回遊び/明示設定/最初の実予約、プロフィール追加、島トップから明示的に旧Exploreを再開する経路をphone/tabletで検査。保存abort/retryと実save完了callback保留/PWA更新は別の明示的診断。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_ONBOARDING_OUTPUT`を指定 |
| `node tools/e2e-island-rhythm.mjs` | 空DBの実設定から最初の3問も通常区間も自動成長/継続し、任意帰島・3Dアルバム・予約再開をphone/tabletで確認。新予約は報酬受取操作0、旧予約は保存済み契約を維持 |
| `node tools/e2e-island-subjects.mjs` | 固定productionのphone/tabletでmixの「つぎも」の選択/取消/再読込/保存失敗と次一区間への反映、初見継続、Dueによる教科選択、自動2区間上限、追加0操作の切替を実回答で確認。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_SUBJECT_OUTPUT`を指定。独立したnativeプロフィールfixtureを使い、学習効果は認定しない |
| `node tools/e2e-island-rhythm-recovery.mjs` | 初回予約・初回3問後/通常の次区間予約をnative IndexedDBで一度だけabortする明示診断。最終回答/成長の保存、次予約だけの再試行、任意帰島/reloadで同じ問題へ戻ることを検査。旧報酬の互換性はisland-pwaで別確認。通常速度・子どもの観察とは別の証拠 |
| `node tools/e2e-island-entry-timing.mjs` | 固定productionの実初回設定・ホームからの同じ予約の再開・新文書reloadをphone/tablet各10反復で補測。trusted clickとnavigation startを分け、実入力readyまでのP50/P95・操作数・保存整合を記録する。初回へ問題間650msの閾値を転用せず、実機のcold launchやPWA更新の測定とはしない |
| `node tools/e2e-island-recovery.mjs` | 島productionの誤答訂正・bridge・元skillの独力再確認と、英語Due巡回をphone/tabletの実UIと保存記録で検査 |
| `node tools/e2e-island-play.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 島productionの自由遊び・3住民の参加・通路復旧・学習再開をphone/tabletで検査。自由遊び前後の全DBテーブル不変も照合 |
| `node tools/e2e-island-sharing.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 実獲得した家具の距離・向きによる3種類の受渡し、キツネ参加、実物/手/経路/固定画角、再演・取消・全DB不変・reduced motion・表示復旧をphone/tabletで録画。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_SHARING_OUTPUT`を指定。限定実行はdiagnosticとして扱う |
| `node tools/e2e-island-interruption.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 実獲得したベンチへの歩行中編集/取消、座面直前の中断から再出発、同profile別画面での家具移動、保存後の退避/最新選択/学習復帰をphone/tabletの実操作と位置記録で検査。`SANSU_ISLAND_INTERRUPTION_OUTPUT`で出力先を指定 |
| `npm run e2e:island-living` | 島有効の固定production buildで、空DBの実設定→各viewportで新しい問題数ペースの4地区成熟と追加1区間→有限7物→自発発見→地区表示→過去/現在の実3D→発見再演→以前の姿/移動→再読込を確認。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_OUTPUT`を指定。全app/QA入力の開始終了を照合 |
| `node tools/e2e-island-chapters.mjs` | 固定productionで、初回の花壇予約後に家を選び、両viewportで家へ63問分を積み上げる最初の成熟まで土地が開かず、完成時に東が開くことを確認。旧省略値0/2区間と新しい明示値の実成熟snapshotを混ぜる互換fixtureは実獲得と区別する。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_OUTPUT`を指定。app/QAの開始終了hashと実versionを照合 |
| `npm run e2e:island-pwa` | 島有効productionの `#/onboarding` 上の実welcome・空保存→profile fixture→実homeから更新checkpoint/保存holdを検査。旧予約の問題・gift・10ほしと明示移行時の残高保持、フックなし実SW制御・初期homeのJS/CSS cache確認後のoffline開始/回答/reloadを分離。比較はIsland/学習/Exploreの7storeと初期owner確認に限定し、全DB/写真bytes保持とは扱わない。`SANSU_ISLAND_PRODUCTION_URL`、新しい `SANSU_ISLAND_OUTPUT` を指定し、固定app＋QA overlayの外側fingerprintで版を照合。`--plan` はブラウザ未起動の範囲確認 |
| `npm run benchmark:island-fixed-ten` | Study / Islandを固定10問、phone/tablet各10反復で比較。初回済みの明示fixtureで6問区切りの自動次問まで計時し、追加操作0・自動報酬面0を必須とする。初回3問は別の実設定検査 |
| `npm run benchmark:fixed-ten` | Study / Exploreの固定10問throughput、回復、中断、game-only receipt整合を比較 |
| `node tools/e2e-island-world-shadow.mjs` | DEV Life全景の実影タップ→同じ本人の拡大または全景挨拶→連打/対象切替→保存/再読込→編集/収納→学習。`SANSU_WORLD_SHADOW_URL` と新しい `SANSU_WORLD_SHADOW_OUTPUT` を指定。任意の `SANSU_WORLD_SHADOW_FIXTURE` は元recordの論理時刻/割当を保持しrealAtを起動へ合わせる明示fixture。自然獲得の証拠とはしない。fixtureなしでは実購入後に本当に着座した住民だけを検査。`SANSU_WORLD_SHADOW_ZOOM=1` / `SANSU_WORLD_SHADOW_DEVICE=phone` は拡大限定診断。core後に順次実行し、source hashと表示時刻/着座位置列を照合 |
| `npm run verify:core` | Docs check + full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E + production PWA checkpoint E2E |

旧契約の履歴用と記した6ハーネスは、プロフィールだけの初期化から手動報酬を待つため、現行互換テストとしては実行できない。現在の成長・土地・配置・再演の検証は `e2e:island-living` / `e2e-island-chapters.mjs` を使う。旧ハーネス固有の受渡しや歩行途中の中断をすべて代替したという意味ではない。

## Matrix

`npm run e2e:smoke` is intentionally a flag-off classic Explore regression suite: it uses `dev:test-server`, an isolated port, and `VITE_ISLAND_ENABLED=false`. Its Explore captures do not count as current Island UX evidence. For the current Island shell use `npm run e2e:island-navigation` against port 5198 and retain the Island flag, delivery/candidates, revision, and viewport metadata.

小数点の手入力・誤答行の全消去は `node tools/e2e-manual-decimal.mjs` で検査する。`SANSU_MANUAL_DECIMAL_URL` に島有効production、`SANSU_MANUAL_DECIMAL_OUTPUT` に新しい出力先を指定。Study/Islandのphone・tabletで、小数点キー/物理キー、小数点の削除と再入力、2桁の一方だけ正解した誤答行の全消去、Enterなし再回答を確認する。明示プロフィールfixtureから通常plannerを通す。旧 `e2e-written-input.mjs` は部分訂正とParkを含む過去契約用で、現行の合格証拠にはしない。

| Change Type | Required Checks | Manual Checks | Notes |
|---|---|---|---|
| Docs only | `npm run docs:check` | Read-through for role/tone sanity | No app build required unless behavior text changed |
| Copy or content only | `npm run lint`, `npm run build` | Affected screen wording | Check tone for child/parent UX |
| Shared UI component | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Desktop + mobile layout sanity | Prefer screenshot or visual notes |
| Page-level UI/state | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Main flow through affected screen | Include modal, loading, error, empty state |
| Learning/domain logic | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Targeted scenario walkthrough | Add/update tests when logic changes |
| Exploration pure domain | `npm run docs:check`, `npm run lint`, `npm run typecheck`, targeted reducer/generator tests, `npm run test:run`, `npm run build` | Fixed-seed run, incorrect-answer penalty, voluntary return, energy depletion | Ensure energy never goes below zero and every run can end |
| Exploration page/routing | `npm run verify:core`, `npm run e2e:smoke` | Complete and replay one run on phone-width and tablet-width layouts; check reduced motion | Existing `/study`, `/battle`, onboarding, and private-route behavior must remain reachable |
| Mystic Island domain/page/storage | `npm run verify:core`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:island`, `npm run e2e:island-pwa`, `npm run benchmark:island-fixed-ten` | 390×844と768×1024で起動・初回/通常の自動成長連問・有限の4地区成熟・配置/回転/収納/過去の姿・自発的な住民反応・実3D履歴/発見再演・再開。音off、reduced motion、実SW offlineも確認 | `dev:island` は5198。島有効production previewは5298。視覚・無文字理解/安全・runtimeは別判定 |
| Build-and-play domain/page/storage | `npm run verify:core`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:park`, `npm run e2e:park-pwa` | 390×844と768×1024で初回再演→制作→支援/再開→配置変更→次制作を確認。視覚的魅力・無文字理解・実装整合を別々に記録 | DEVはflag有効で5187、production previewはflag有効で5287を先に起動。接続先は各scriptの環境変数で変更可能。PWA hook検証と実機インストール検証を区別する |
| Image-led UI / encounter | `npm run verify:core`, `npm run e2e:smoke`, `npm run assets:check`, `npm run benchmark:fixed-ten` | On the actual app target, compare 390×844 and 768×1024 runtime screenshots beside the approved benchmark; capture launch through the next destination; verify full TenKey, fixed-question throughput, sound off, reduced motion, and cold-cache/PWA update | Fixed-tenはreportの `evidence.eligible = true` かつ `pass = true` とversioned監査への集計転記を必須とし、10反復未満をdiagnostic、通常planner真正性を別検証とする。Record build revision, delivery flag, rendered candidate ID, and cache state. Report visual magnetism, silent comprehension/safety, and runtime integrity separately; mixed legacy/HOLD visual lineage is a HOLD |
| Storage/schema/profile data | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Existing profile load/save | Write ADR or migration note if needed |
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run assets:check`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:pwa-two-build` | Real two-build install/update/reload path; iOS relaunch | `e2e:pwa-update` はclassic build（`VITE_ISLAND_ENABLED=false VITE_BUILD_PLAY_ENABLED=false`）専用。島有効buildは専用PWAハーネスを使う。Two-buildはclassicの異なる実buildを `SANSU_PWA_OLD_DIR` / `SANSU_PWA_NEW_DIR` で指定。実SW更新・保護フォーム・1回reload・全IDB/localStorage保持、SWを旧版に固定した復旧・検知後切断・offline再起動・cache保持を検査。実iOSとは区別する |
| Release candidate | All of the above | Critical path smoke on target devices | Include iOS/Android/PWA notes if relevant |

## Review Prompts

- Did the change touch a high-risk area from `memory.md`?
- Does `ownership_map.md` imply a doc or ADR update?
- Did the spec need updating?
- Is there a missing regression test?
- Is there a host/deploy side effect?
- Does `risk_register.md` need a new note or updated mitigation?

## Escalation Rule

If a task spans more than one change type, use the stricter row.

## Shortcut Commands

- 既存 `e2e:pwa-update` はclassicの初回導線を検査するため、Island/BuildPlay flagを無効にしたbuildを使う。別buildは `SANSU_PWA_PREVIEW_DIR` で指定でき、省略時は `dist`。島とParkの更新検査は各flagを有効にした対応buildで実行し、配布用の固定artifactと回帰用のflag構成を混同しない。

- Use `npm run docs:check` for docs/process-only changes.
- Use `npm run verify:core` when a change touches code across multiple layers.
  It already includes `npm run docs:check`.
- Use `npm run verify:release` for release-sensitive changes.

## 暮らす島の家庭内本番切替（2026-09-11）

`node tools/e2e-island-life-production.mjs` は `SANSU_ISLAND_PRODUCTION_URL` と新しい `SANSU_ISLAND_OUTPUT` を指定し、本番の空所有物→実回答→しずく→花購入→reload→実SW制御のオフライン回答と再起動を390/768幅で検査する。空の制作メニューで「まなぶと しずくが ふえるよ」と不足数を表示すること、住人チップにぽこもこ/うさぎ/カワウソそれぞれの好みを表示すること、学習後に一度だけ表示する「学んだぶん」通知の値、通知から「つくる」への導線、通知前後の島ワールドの同一サイズ、再読込での重複非表示も確認する。ひかり残高の意味（住人が楽しむと増える）と「いろ」メニューのひかり価格を表示し、増加通知の差分計算は `rewardCue.test.ts` で初回非表示・増加・支出を検査する。配置した花の持ち物に成長3段階の印と「あと 2じかんで つぼみ」を表示することは `growthStatus.test.ts` と同ハーネスで検査し、段階を越えた通知の初回除外・一度だけの遷移は `growthCue.test.ts` で確認する。配置直後の住人の気づき通知は `observationCue.test.ts` と同ハーネスで文言・一度だけの表示を検査する。`!`の気づき中に一回だけ跳ね、reduced motionでは跳ねないことも`data-life-poses`で確認する。好きな家具へ到着した住人の短い返事（うさぎの「におい すき」）と、その反応時計中の首かしげ姿勢を両幅で確認し、反応中の実画面を保存する。DEVの時間送りがなく、preview DBを作らず、保存された学習と所有が残ることを確認する。所有物移行はユーザー承認により省略。PWA保存holdの待機・完了・失敗と、プロフィール削除の所有者隔離は単体で別検査する。実機iOS、実参加者、長期の経済調整の証拠ではない。旧島専用E2Eは新flagをfalseにして残存導線の回帰として分離し、throughputは新しいホームにも対応して同じ通常学習を測る。


### Lifeの実SWオフラインと投影失敗

`node tools/e2e-island-life-storage.mjs` に `SANSU_LIFE_STORAGE_URL`（local production）、新しい `SANSU_LIFE_STORAGE_OUTPUT`、`SANSU_LIFE_STORAGE_BUILD_SOURCE` を指定する。manifestは `sourceHash`、各app入力の `files[{path,sha256}]`、`distFiles[{path,sha256}]`、実 `version` を持つ。実URLのversionと開始終了の全hashを照合する。Island/Life有効・Life preview/BuildPlay無効のbuildを先に用意する。

実初回3問・購入・実SW制御/cache・offline移動/収納/回答・再読込/再接続の重複なしを両幅で検査する。`SANSU_LIFE_STORAGE_FAIL_PROJECTION=1` では、正式回答の後だけLife DBのputを明示的に失敗させ、学習保存・元の所有・エラー案内・UI retryを確認する。DBへprofile/credit/購入を注入しない。現在のproduction4品の検査で、DEV専用v3描画、実two-build、写真Blob全体、実機iOSの代用にはしない。


### Lifeの異なる実buildへの更新

`node tools/e2e-island-life-two-build.mjs` に `SANSU_LIFE_OLD_DIR` / `SANSU_LIFE_NEW_DIR`、それぞれの `SANSU_LIFE_OLD_MANIFEST` / `SANSU_LIFE_NEW_MANIFEST`、新しい `SANSU_LIFE_TWO_BUILD_OUTPUT` を指定。manifestはLife storage検査と同じ形式で、各distのversion/全ファイルを開始終了に照合する。異なるversionとentry JSを必須とし、実SWを同じlocal originでoldからnewへ切り替える。

実初回・実獲得・購入・通常予約の1問目完了から始め、学習中の更新待機→島checkpointで自動reload1回→全native storeとLifeの所有/checkpoint保持→新buildのoffline同じ次問を両幅で確認。`SANSU_LIFE_UPDATE_INTERRUPTION=1` はSWだけoldへ固定した検出後切断・offline旧版再開・固定解除/再接続を追加する。実registration.updateの照会を行うが、app更新イベントやDBを注入しない。写真Blob/実機/旧v2既得権の移行検査とは別。


`SANSU_LIFE_DISCOVERY_UPGRADE=1` を追加すると、oldの4品とnewの明示Discovery=true・12品を照合する。旧版の花と学習途中の予約を保持したまま更新し、新版で苗を実際に4しずくで購入、その2品と残高2をoffline再起動後も保持する。通常と更新中断の両方へ適用できる。指定しない場合は従来の同capability間旅程。two-build manifestのdistパスは配信rootに相対の `dist/...` とする。

### Life v3 のproduction capability検査

`tools/e2e-island-life-storage.mjs` に `SANSU_LIFE_STORAGE_DISCOVERY=1` を付けると、明示Discovery=trueの固定production buildで12品の6ページを照合し、実初回3問から苗4しずくの購入・offline移動/収納/回答を検査する。6個の44pxボタンと説明/ページ数の折れ・横overflowも確認する。既存のbuild manifestとsource開始終了一致は必須。`SANSU_LIFE_STORAGE_FAIL_PROJECTION=1` では同じ旅程にLife putの明示障害と再試行の検査を加える。追加8品の全関係、two-build更新、自然X3、利用者評価の代替にはしない。Discovery未指定時は従来の4品/花購入旅程を維持する。

### 住人の短い滞在と寄り道

`node tools/e2e-island-cadence.mjs` は `SANSU_CADENCE_URL` のDEV Lifeと新しい `SANSU_CADENCE_OUTPUT` を指定する。使い捨ての本人・12 credits・花1個の明示fixtureで、390/768幅それぞれ90秒の実時計の歩行列・学習store不変・現行保存版17・同cutoverでのreloadを照合する。tabletはreduced motion。実獲得・本番SW・子どもの評価の代替ではない。`cadence.test.ts` は空/花のみの島で全3人の繰り返し歩行、滞在/運搬、30分の種別別利用積算、有限報酬、保存/描画時計を検査し、`cadenceMigration.test.ts` は旧履歴と位置・購入保持、同時刻操作、破損/降格拒否、計算cacheと非cacheの一致を検査する。配置の退避/孤立復旧はisland-isolation、本番の実購入/offline/retryはLife storageハーネスで分けて確認する。

`SANSU_LIFE_CADENCE_UPGRADE=1` をLife two-buildに指定すると、旧保存版15→新保存版16の実更新を検査する。購入前に同じ花/マスへの退避が入る場合も、退避1件＋購入1件の正確な内容を照合する。新しいcadence切替の本人と旧action prefix、placement切替、全native storeを保持し、更新完了後は版16であることを確認する。通常モードは従来どおり同じ保存版を要求する。

### 呼んだぽこもこの散歩復帰

`SANSU_CADENCE_HERO_CALL=1` をcadenceハーネスへ加えると、実UIの「ぽこもこを よぶ」後から各幅90秒を観測し、指定した花以外への歩行・指定解除・保存版17・reloadを確認する。呼出成功でメニューは自動的に閉じるため、追加の閉じる操作を送らず非表示を待つ。既存のprofile/credits/花fixtureは実獲得の証拠にしない。

`SANSU_LIFE_HERO_VISIT_UPGRADE=1` をLife two-buildへ指定すると、旧版16で実回答・花購入・実UI呼出を保存し、新版17への更新後に同じぽこもこが別の場所へ歩き出すことを確認する。全native storeと既存の購入/呼出/cadence切替を保持し、新しいheroVisit切替の本人・action prefixとoffline同じ次問を照合する。cadenceUpgradeとは同時指定しない。`heroVisit.test.ts` / `heroVisitMigration.test.ts` は旧無期限滞在の再現、到着済み/道中/30秒待機/運搬/同じ呼出/再送/cache/移行と未完利用時計を検査する。

### 購入できる柵・植木鉢（2026-09-20）

`node tools/e2e-island-decorations.mjs` は `DECORATIONS_URL`（local production）と新しい `DECORATIONS_OUTPUT` を指定する。実初回設定から6問を完了し柵/鉢を購入、回転・移動・収納・再配置、native putの一度のabort/retry、実SW offline reloadと同じ学習への復帰を390/768幅で確認。30個は別の明示credit fixtureから正式な配置commandで作り、GLB要求/bytes・テクスチャ共有・renderer draw calls/triangles・LODを記録する。app/dist/QAの開始終了hashを一致させる。rAFは実機FPS保証ではない。

現行カタログは既定6品、Discovery有効14品（7ページ）。上記の旧4品/12品という検査記述は追加前の範囲で、Life storageハーネスの期待値は14品へ更新する。既存商品の順序は保持する。
