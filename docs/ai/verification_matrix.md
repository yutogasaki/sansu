# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.
GitHub Actions should mirror the same baseline for `docs:check` and `verify:core`.

## Current Commands

| Command | Purpose |
|---|---|
| `node tools/e2e-island-direct-scale.mjs` | `SANSU_DIRECT_URL` と新規 `SANSU_DIRECT_OUTPUT` を指定。合法配置1/9/16個・長い名前・空の配置を明示native fixtureで作り、4サイズで直接操作の大きさ、実hit、眺めとの排他、7store不変、絵と実3Dの遊び、混雑時の移動入口を検査。390幅は実キツネ選択・退出/再読込・明示WebGL故障、320幅は24px文字の診断を含む。`SANSU_DIRECT_BROWSER=webkit` は390幅、`SANSU_DIRECT_WIDTH` は指定幅だけ。`SANSU_DIRECT_BASELINE=1` は旧mainのリスト/重なり再現であり修正候補のPASSではない。実取得・実機・子どもの観察とは区別する |
| `npm run e2e:island-navigation` | 島有効のDEV/productionを `SANSU_ISLAND_BASE_URL` で指定。phone/tabletでトップ訪問、5項目ナビ、設定詳細の保持、回答下書き・7store不変、履歴の戻る/進む、島再読込で自動開始しないこと、配置取消/保存、実撮影/写真拡大、直リンクfallback、学習後の記録更新を検査。出力先は `SANSU_NAVIGATION_OUTPUT`。nativeプロフィールfixtureのみを作り、学習予約・回答・写真は実UIで行う |
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
| `npm run verify:core` | Docs check + full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E + production PWA checkpoint E2E |

旧契約の履歴用と記した6ハーネスは、プロフィールだけの初期化から手動報酬を待つため、現行互換テストとしては実行できない。現在の成長・土地・配置・再演の検証は `e2e:island-living` / `e2e-island-chapters.mjs` を使う。旧ハーネス固有の受渡しや歩行途中の中断をすべて代替したという意味ではない。

## Matrix

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
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run assets:check`, `npm run e2e:smoke`, `npm run e2e:pwa-update`, `npm run e2e:pwa-two-build` | Real two-build install/update/reload path; iOS relaunch | Two-buildはclassicの異なる実buildを `SANSU_PWA_OLD_DIR` / `SANSU_PWA_NEW_DIR` で指定。実SW更新・保護フォーム・1回reload・全IDB/localStorage保持、SWを旧版に固定した復旧・検知後切断・offline再起動・cache保持を検査。実iOSとは区別する |
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

`node tools/e2e-island-life-production.mjs` は `SANSU_ISLAND_PRODUCTION_URL` と新しい `SANSU_ISLAND_OUTPUT` を指定し、本番の空所有物→実回答→しずく→花購入→reload→実SW制御のオフライン回答と再起動を390/768幅で検査する。学習後に一度だけ表示する「学んだぶん」通知の値、通知から「つくる」への導線、通知前後の島ワールドの同一サイズ、再読込での重複非表示も確認する。DEVの時間送りがなく、preview DBを作らず、保存された学習と所有が残ることを確認する。所有物移行はユーザー承認により省略。PWA保存holdの待機・完了・失敗と、プロフィール削除の所有者隔離は単体で別検査する。実機iOS、実参加者、長期の経済調整の証拠ではない。旧島専用E2Eは新flagをfalseにして残存導線の回帰として分離し、throughputは新しいホームにも対応して同じ通常学習を測る。
