# Task: Root Tangle Observation Morph

- Date: 2026-07-19
- Owner: Codex `/root/gameplay_gap_audit`
- Status: Stopped — replaced by [Cold-open Value Loop](/docs/tasks/active/2026-07-21-cold-open-value-loop.md)
- Review By: 2026-07-26
- Related ADR / Runbooks: `docs/runbooks/pwa-release.md`（production assetを変更する場合のみ）

## Goal

- `根っこのからまり` を、保存済み算数回答による世界変化から、同じカメラの観察画、Golden Discovery Page の大発見まで一つの因果としてつなぐ。
- 現行の「4件目ならどの発見でも大発見になる」ordinal依存を止め、最初の3手掛かりを持つrunで `root-tangle` を解決した時だけ `ほたる花の ひかり道` と観察画が開くようにする。

## In Scope

- 最初の3つの通常手掛かりと、遭遇に意味付けされた最終特徴を分けるpure selector
- root-tangle receipt、world reaction、discovery、observation definitionの照合
- JSXを含まない汎用observation catalogと、root固有定義の分離
- 既存root resolved sceneと同じsource / crop / cameraを使う紙・濃線の観察モード
- `DiscoveryResearchReveal` の通常book表現を保ちつつ、root最終特徴だけを「世界 → 観察 → 保存」として見せる汎用presentation boundary
- DOMの因果文、3つの前提手掛かり、今回の最終特徴、56px以上の単一続行操作
- receipt保存中・保存失敗・mismatch・前提不足・別遭遇で観察へ進まないtest
- 390×844、reduced motion、focus、ARIA、同一camera、resource budgetの検証とremote-readable screenshots

## Out of Scope

- 発見featureのrun横断永続化、run再開、SRS / Due / weak / 学習planner接続
- 複数ページ図鑑、図鑑一覧、収集率、ホーム・きろく統合
- 新しいearly mandatory encounter、マップ全体の再設計
- root以外の全遭遇へ観察画を横展開すること
- 新しい大容量JPG / WebP、生成画像のproduction直貼り
- 最初の3通常手掛かりを完全な意味triggerへ移行すること。これはfeature永続化と合わせる次taskで扱う

## SSOT References

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/10_exploration_game_spec.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`
- `docs/design/research-library-2026-07-19/benchmark-yoshi-fukashigi.md`
- `docs/design/research-library-2026-07-19/concept-state-grammar-v3.png`（同一cameraの論理メモだけを参照。画風は不採用）

## Docs To Touch

- Must update: `docs/product/01_app_spec.md`、`10_exploration_game_spec.md`、`12_screen_flow_spec.md`、`14_ui_world_motion_spec.md`、`15_mvp_rollout_verification_spec.md`、本task、完了時done log
- Intentionally unchanged: `11_learning_integration_spec.md`、`13_data_storage_migration_spec.md`、Dexie schema、SRS / PWA runbook（production asset不変の場合）

## Safety And Truth Invariants

- 保存成功前はworld reaction、energy、発見、観察を一切進めない。観察はcommit済みattempt key、node、encounter、last discoveryが一致した後だけ成立する。
- 最初の3手掛かりがない、root以外、古いworld reaction、別node、重複receipt、保存失敗では最終特徴と観察を付与しない。
- 4件目の通常発見だけでは大発見にしない。rootを選ばなかったrunは未完成のまま帰還する。
- 現MVPではrun横断保存を暗示しない。特徴永続化は次のMVP-2b taskに残す。
- 観察画は既存resolved sceneと同一cameraを使う。別構図へ切り替えて因果を捏造しない。
- 観察の状態、因果文、続行操作はDOM / ARIAで成立し、filter、SVG、音、motionだけに依存しない。
- 既存作品のcharacter、egg motif、book face、固有UI、animationを模倣しない。

## Plan

1. 仕様へ「通常手掛かり3件 + root-tangleだけが開く最終特徴」と現MVPの一時境界を固定する。
2. observation definition / selectorと大発見付与条件をpure domainへ追加し、ordinal 4件目の自動大発見を削除する。
3. receipt済みworld reactionへstable attempt keyを持たせ、state / discovery / observationの一致を検証するpresentation selectorを追加する。
4. world reactionへ `attemptKey / gateId / attemptNumber / nodeId / encounterId / recordedSkillId / result` の完全tupleを渡し、selectorがreducer所有のsourceと照合できるようにする。
5. `resolved → 観察 → 保存` を単一のblocking presentation lifecycleにまとめ、last-light救助、帰還、退出、入力、focus、背景inertを同じ状態から制御する。
6. encounter presentation registryへ同一camera observation layerを追加し、big discovery revealへ汎用descriptorで接続する。不一致時は観察をfail-closedしつつ、通常発見として閉じられる経路を残す。
7. 390×844で保存中、失敗、world reaction、observation、reduced observationをE2E・スクリーンショット監査する。
8. full verification、独立レビュー、task archive、done log同期を行う。

## Definition of Done

- 通常4件目は大発見にならず、3つの前提特徴 + receipt適用済みroot-tangleだけが `firefly-flower-light-path` を1回開く。
- observation selectorはuncommitted / save failure / mismatch / stale reaction / wrong encounterを拒否する。
- root correct sceneからobservationまで、画像source、camera key、object position、主要bounding boxが一致する。
- 観察画で「だれが動いた」「何が変わった」「次にどこを押す」が3秒で読める。
- 主操作56px以上、補助操作44px以上、意味文字12px以上。390×844で横overflowがなく主操作へ到達できる。
- dialogはfocus初期化・trap・Escape終了・背後inertを満たす。Enterはfocused buttonのnative動作を使う。
- reduced motionで反復移動、zoom、filter animation、stamp popを止めても内容と順序を省略しない。
- root production scene assetは既存3件のまま増えず、PWA / asset checksを維持する。
- Relevant docs updated or explicitly declared unchanged. Done log entry created if the task ships.

## Verification

- Commands: target Vitest、`npm run docs:check`、`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run e2e:smoke`
- Domain: ordinary fourth / prerequisites / root receipt / wrong encounter / duplicate / mismatch / optional-root incomplete
- UI: same-camera source/crop/bounds、observation descriptor、DOM copy、56px CTA、focus trap、Escape、background inert、reduced motion
- E2E: root commit failure retry中は観察なし、retry成功後だけ `complete → resolved → observation`、event / feature / energy各1回、既存learning logs不変
- Manual: 390×844 action / reaction / observation / reduced observation、sound off、200% text、3秒テスト

## Progress

### Now

- 2026-07-21: visual polishとactor / sprite制作を停止した。current cold-openの価値未証明のまま後半のroot観察を磨いても、アプリ全体の「解き続けたい」価値を改善できないため、実装優先度をcold-open価値ゲートへ戻す。
- pure selector、receipt provenance、`root-tangle` domain、既存テストは保持し、巻き戻さない。停止対象はvisual alternative、actor rig、observation visual polish、production asset化だけとする。
- pure domain checkpointを完了した。通常発見は3手掛かりまで、4件目の通常発見はfeatureなし、前提を満たした `root-tangle` だけが最終featureとstable observation IDを付与する。
- discovery sourceとattemptへ `attemptKey / gateId / attemptNumber / nodeId / encounterId / skill / result` を結び、観察selectorがreducer所有の完全一致provenanceを要求するようにした。
- target Vitest 3 files / 41 tests、targeted lint、`npm run typecheck` はPASS。
- 再ベンチマークは、v2/v3を画風として不採用にし、旧 `不可思議70 : ポップ30` と後続の `明るい異変劇場` をともに撤回した。現行方向は `いびつ生態ポップ` とし、数量変化が対象の一芸になり、その返しで相棒の姿勢まで崩れる掛け合いを核にする。

### Next

- なし。このtaskは再開しない。cold-open候補がproduction価値ゲートを通った後、残るroot観察作業を新しい単目的taskとして再評価する。

### Decision Notes

- visual polishの停止は `root-tangle` のdomain、学習接続、receipt、legacyデータを廃止する判断ではない。
- 後続の優先順位とGo条件は [Cold-open Value Loop](/docs/tasks/active/2026-07-21-cold-open-value-loop.md) と [15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) を正とする。
- A「意味付けされたroot最終特徴 → 観察」を先に実装し、B「feature永続化 → 任意遭遇をrun横断で回収」を次taskにする。
- C「別のearly mandatory encounter」は初回ラン完結が家族テストで必須と判明した場合だけ再検討する。
- 最初の3特徴の通常ordinalは今回だけscaffoldとして残すが、4件目の自動大発見は廃止する。次taskでは3特徴もdata-driven triggerへ移す。

### Risks

- rootは任意経路なので、選ばないrunはページが未完成になる。これは現行replay teaserと整合するが、feature永続化前は次runへ持ち越せない。
- observation overlayがresolved sceneと別レイアウトを持つとcamera continuityが崩れるため、shared scene definition / crop tokenを単一sourceにする。
- receipt integration直後のため、raw answerやUI booleanだけからobservationを作らない。
- 現行root JPEGは写実・生成画像調で、新しい `いびつ生態ポップ` 契約と一致しない。同一cameraとpresentation lifecycleの検証用に限り、final art、palette、crop、character referenceとはみなさない。相棒6姿勢、root behavior set、Habitat kitを承認済みassetへ置換する。
