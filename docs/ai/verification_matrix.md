# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.
GitHub Actions should mirror the same baseline for `docs:check` and `verify:core`.

## Current Commands

| Command | Purpose |
|---|---|
| `npm run docs:check` | Docs/process link and structure checks |
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
| `node tools/e2e-island-support.mjs` | 固定production buildで段階支援の下書き/カーソル保持、お手本中の物理入力停止、全筆算、支援完了/報酬、Due/独力確認の保持、再開を検査。旧slotのoptional field省略は別の明示的な互換fixtureとして記録 |
| `node tools/e2e-island-observation.mjs` | 固定productionの実DOMと前向き観測イベントを照合。誤答訂正、筆算途中の支援、同slot再入場/reload、表示/支援の観測範囲をChromiumの2 viewportで確認する。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_OBSERVATION_OUTPUT`を指定。明示profile/memory fixtureを使い、実参加者・独力・定着は認定しない |
| `node tools/e2e-island-onboarding.mjs` | 固定production buildで空DBからの初回遊び/明示設定/最初の実予約、プロフィール追加、旧Explore優先をphone/tabletで検査。保存abort/retryと実save完了callback保留/PWA更新は別の明示的診断。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_ONBOARDING_OUTPUT`を指定 |
| `node tools/e2e-island-rhythm.mjs` | 空DBの実設定から最初の3問も通常区間も自動成長/継続し、任意帰島・3Dアルバム・予約再開をphone/tabletで確認。新予約は報酬受取操作0、旧予約は保存済み契約を維持 |
| `node tools/e2e-island-subjects.mjs` | 固定productionのphone/tabletでmixの「つぎも」の選択/取消/再読込/保存失敗と次一区間への反映、初見継続、Dueによる教科選択、自動2区間上限、追加0操作の切替を実回答で確認。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_SUBJECT_OUTPUT`を指定。独立したnativeプロフィールfixtureを使い、学習効果は認定しない |
| `node tools/e2e-island-rhythm-recovery.mjs` | 初回予約・初回3問後/通常の次区間予約をnative IndexedDBで一度だけabortする明示診断。最終回答/成長の保存、次予約だけの再試行、任意帰島/reloadで同じ問題へ戻ることを検査。旧報酬の互換性はisland-pwaで別確認。通常速度・子どもの観察とは別の証拠 |
| `node tools/e2e-island-entry-timing.mjs` | 固定productionの実初回設定・ホームからの同じ予約の再開・新文書reloadをphone/tablet各10反復で補測。trusted clickとnavigation startを分け、実入力readyまでのP50/P95・操作数・保存整合を記録する。初回へ問題間650msの閾値を転用せず、実機のcold launchやPWA更新の測定とはしない |
| `node tools/e2e-island-recovery.mjs` | 島productionの誤答訂正・bridge・元skillの独力再確認と、英語Due巡回をphone/tabletの実UIと保存記録で検査 |
| `node tools/e2e-island-play.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 島productionの自由遊び・3住民の参加・通路復旧・学習再開をphone/tabletで検査。自由遊び前後の全DBテーブル不変も照合 |
| `node tools/e2e-island-sharing.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 実獲得した家具の距離・向きによる3種類の受渡し、キツネ参加、実物/手/経路/固定画角、再演・取消・全DB不変・reduced motion・表示復旧をphone/tabletで録画。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、`SANSU_ISLAND_SHARING_OUTPUT`を指定。限定実行はdiagnosticとして扱う |
| `node tools/e2e-island-interruption.mjs` | **旧おくりもの契約の履歴用。現行の自動成長には未移行。** 実獲得したベンチへの歩行中編集/取消、座面直前の中断から再出発、同profile別画面での家具移動、保存後の退避/最新選択/学習復帰をphone/tabletの実操作と位置記録で検査。`SANSU_ISLAND_INTERRUPTION_OUTPUT`で出力先を指定 |
| `npm run e2e:island-living` | 島有効の固定production buildで、空DBの実設定→各viewport25区間→4地区の成熟/有限7物→自発発見→地区表示→過去/現在の実3D→発見再演→以前の姿/移動→再読込を確認。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_OUTPUT`を指定。全app/QA入力の開始終了を照合 |
| `node tools/e2e-island-chapters.mjs` | 固定productionで、初回の花壇予約後に家を選び、両viewportで実7区間目の最初の成熟まで土地が開かず、完成時に東が開くことを確認。旧省略値0/2区間と新しい明示値7区間のsnapshotを混ぜる互換fixtureは実獲得と区別する。`SANSU_ISLAND_PRODUCTION_URL`、`SANSU_ISLAND_BUILD_SOURCE`、新しい`SANSU_ISLAND_OUTPUT`を指定。app/QAの開始終了hashと実versionを照合 |
| `npm run e2e:island-pwa` | 島有効production previewの更新checkpoint・保存hold・実SW offlineを検査 |
| `npm run benchmark:island-fixed-ten` | Study / Islandを固定10問、phone/tablet各10反復で比較。初回済みの明示fixtureで6問区切りの自動次問まで計時し、追加操作0・自動報酬面0を必須とする。初回3問は別の実設定検査 |
| `npm run benchmark:fixed-ten` | Study / Exploreの固定10問throughput、回復、中断、game-only receipt整合を比較 |
| `npm run verify:core` | Docs check + full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E + production PWA checkpoint E2E |

旧契約の履歴用と記した6ハーネスは、プロフィールだけの初期化から手動報酬を待つため、現行互換テストとしては実行できない。現在の成長・土地・配置・再演の検証は `e2e:island-living` / `e2e-island-chapters.mjs` を使う。旧ハーネス固有の受渡しや歩行途中の中断をすべて代替したという意味ではない。

## Matrix

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
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run assets:check`, `npm run e2e:smoke`, `npm run e2e:pwa-update` | Real two-build install/update/reload path; iOS relaunch | Review host cache behavior, precache size, persistence-before-checkpoint, and production-asset boundaries too |
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
