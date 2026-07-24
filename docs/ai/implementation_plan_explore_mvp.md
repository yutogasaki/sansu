# docs/ai/implementation_plan_explore_mvp.md — Codex実装計画

> 段階名は [15_mvp_rollout_verification_spec.md](../product/15_mvp_rollout_verification_spec.md) の **MVP-0〜4** を正とする。

## 現在地（MVP-2b + cold-open再検証）

- 仕様書10〜17と親仕様を追加済み
- 純粋な探索domain、`/explore` 画面、既存問題アダプター、テンキー再利用を実装済み
- run、回答event、終了statusを保存し、Study共通planner / writerが予約したassignmentだけをSRSへ接続済み
- 冪等receipt、pure reducer、問題再現性、legacy保存ID、既存 `root-tangle` domainは維持する。発見図鑑の永続化とrun再開は未接続
- 固定cold-openとしていたマキモドンは承認済み仕様から撤回した。現行の価値契約は「解く → 即世界反応 → 3問目に身体オチ」であり、`opening-root-pull-v1` はproduction未採用の検証器とする
- 現行の開始導線は次のとおり

```text
探索から退出 / 下部「基地」 → /battle（探検基地）
通常起動 / onboarding完了 → / → /explore（説明CTAなしでrun開始）
```

以下のMVP-0〜4節は実装順の履歴と残作業の境界を示す。現在のproduction採用判断は [15_mvp_rollout_verification_spec.md](../product/15_mvp_rollout_verification_spec.md) のcold-open価値ゲートを優先する。

## MVP-0: 仕様と独立探索ループ

仕様更新:

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/10_exploration_game_spec.md` 〜 `17_open_questions.md`
- `docs/index.md`
- `docs/ai/ownership_map.md`

実装:

```text
src/domain/explore/types.ts
src/domain/explore/generator.ts
src/domain/explore/reducer.ts
src/domain/explore/rewards.ts
src/domain/explore/__tests__/generator.test.ts
src/domain/explore/__tests__/reducer.test.ts
src/pages/Explore.tsx
src/components/explore/ExploreMap.tsx
src/components/explore/ExploreProblemPanel.tsx
src/components/explore/DiscoveryReveal.tsx
src/components/explore/ReturnSummary.tsx
```

受け入れ条件:

- 生成マップに開始地点と進行可能な終点がある
- ノード選択で問題ゲートが開く
- 正解でノードが開き、発見を得る
- 不正解で設定済みの短期ペナルティを適用する
- エネルギーが0未満にならない
- 任意帰還またはエネルギー切れでランを終了できる
- 発見を見て、同じ画面からもう一度開始できる
- 探索状態を永続化しない

## MVP-1: 既存問題アダプターと入力UI

対象:

```text
src/domain/explore/problemAdapter.ts
src/components/explore/ExploreProblemPanel.tsx
src/components/domain/TenKey.tsx
```

責務:

- 現在のプロフィールの算数レベルに応じて既存ジェネレーターへ問題を要求する
- 探索MVPで扱える単一数字入力問題へ限定する
- 回答結果を探索reducerへ渡し、ラン中の履歴だけを更新する
- SRS、解放、昇格、weak、永続回答ログは更新しない
- 3問束はまだ統合しない

MVP-0/1では学習リポジトリへの書き込み経路自体を探索から呼ばず、SRSを更新しない。

## MVP-2: 永続化と学習統合

完了済み:

- 探索用Dexieテーブルを後方互換なversion追加で導入した
- run、回答event、終了statusと冪等receiptを保存した
- Study共通planner / writerでSRS、Due、weak、解放、昇格、3問束へ接続した
- 学習回答イベントとゲームイベントを別データとして保持した

残り:

- 発見図鑑と完了ランの要約を保存する
- active runを安全に再開する

受け入れ条件:

- 発見ノートと完了ラン要約が再起動後も残る
- 探索回答が既存学習仕様どおりに反映される
- 既存プロフィールと学習履歴に移行データ損失がない

## MVP-3: 探検基地・いきもの・きろく統合

- `/battle` の探検基地から1タップで再出発できる導線を維持する
- cold-open価値ゲート通過後にだけ、承認済みactorの探索リアクションを追加する
- きろくに発見ノートを追加する
- 既存 `/study` と2人ゲームURLは維持する

2026-07-19の起動面判断により、旧ホームCTA経由は廃止し `/` から `/explore` へ直結した。MVP-3の探検基地・相棒・きろく統合は、起動ルートとcold-open検証を分けて後続実装する。

## MVP-4: 主導線の判断

- `/study` の独立した学習導線を残したまま、探索を通常起動面として検証する
- `/study` を復習・テスト用として残す
- `/battle` と下部 `Game` の名称・役割を確定する
- 探検基地ホームへ全面再設計するか判断する

## MVP後のゲーム拡張

基本ループの観察結果を確認してから追加する。

- 鉱脈チェーン
- コンボ音
- レア部屋
- 相棒リアクション
- 帰還要約の拡張
- 橋イベントのバリエーション

## 現在のループエンジニアリング順序

1ループを「仕様1件 → domain契約 → 縦切りUI → 自動テスト → Browser実機確認 → 振り返り」の小さなgreen単位にする。

| Loop | 目的 | 完了条件 | 状態 |
|---|---|---|---|
| V0 | 価値契約のリセット | マキモドン固有仕様を撤回し、既存学習・保存・root-tangle境界を凍結。新active taskへ一本化 | 完了 |
| V1 | 高速基準値 | 旧高速学習と現Exploreを同じ10問で計測し、回答数/分、正答率、正解後待ち、誤答後復帰、操作中断を記録 | **未実施 / production blocker** |
| V2 | source art gate | `dig-pop-painted-v2` の `ready / dig-one / dig-two / popped` をlocked backgroundと承認済みcharacter / prop referenceで作り、視覚的磁力52/60かつ全6軸8以上を通す | **完了**。旧v1は50/60 HOLD、別IDのv2は52/60 GO |
| V3 | 実配線graybox | source gate通過後だけ `snap-root-v1` slotへflattened frameを載せ、実問題、TenKey、planner、writer、receiptへ接続する。1・2問目650ms、誤答550ms、追加0タップ、answer leak 0を満たす | **完了**。mobile / tablet 4 frame、完全TenKey、正解P95 124ms、誤答P95 440ms |
| V4 | runtime三ゲート | `15_mvp_rollout_verification_spec.md` の非補償三ゲートで判定。runtime screenshotの視覚的磁力、無文字4/5・続行希望4/5・危険0、runtime整合を別々に通す | Gate A GO。runtime技術サブゲートGO。Gate BとV1未実施のため全体HOLD |
| V5 | production判断 | Go候補だけをdefault opening、名称、図鑑、production assetへ昇格し、旧高速基準以上を実機で確認 | `classic-v1` の既知mixed-lineage FAILを止めるcontainmentとしてdefaultを `snap-root-v1` へ変更。Gate BとV1完了までformal採用はHOLD |
| V6 | 遭遇pack展開 | 合格した契約を3遭遇へ展開してから、9〜12問run、図鑑、基地との接続を検証 | 待機 |

既存の型付きregistry、skill-first resolver、共通入力、問題seed、pure reducer、Study共通planner / writer、冪等receiptは作り直さずvalidationへ再利用する。`root-tangle` のpure domainと保存由来の観察条件も保持するが、観察画のvisual polishはV4のGoまで停止する。

## 検証コマンド

```bash
npm run docs:check
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run e2e:smoke
```

## 停止条件

次の場合は実装範囲を広げず、状況を報告する。

- Dexie移行で既存データ損失の危険がある
- ルーター変更が既存 `/study` または `/battle` を壊す
- MVP-2のSRS接続が親仕様の学習順序を守れない
- スマホ縦画面に大幅な再設計なしで収まらない
- candidateが2回の改善後も86点 / 52点 / 全軸8点 / textless 4-of-5を満たさない
- 1・2問目650ms、不正解550ms、answer leak 0、旧高速学習以上の問題処理量を同時に満たせない
- validation candidateをlegacy保存ID、図鑑、通常起動へ接続しないと検証できない設計になっている
