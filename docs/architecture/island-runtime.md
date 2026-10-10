# 島の実装と保存の境界

## 現行の実装

島のホームは育つ島ひとつ。[一本化の決定](../adr/2026-10-06-single-island-runtime.md)と[ゲーム仕様52](../product/52_growing_island_game_spec.md)に従う。

| 責務 | 実装 |
|---|---|
| ルートと共通ナビゲーション | `src/App.tsx`、`src/components/Layout.tsx` |
| 本人を復元するページ入口 | `src/pages/Island.tsx` |
| 共用3Dの遅延読込と描画propsの合成 | `src/components/island/IslandSessionStage.tsx` |
| 家・配置・共有展示・写真・工作・遊びの描画接続 | `src/components/island/islandSession*Stage.ts` |
| 家・本・学習と画面状態を接続 | `src/components/island/IslandSession.tsx` |
| 正本の初期読込・保存済み予約の復元 | `src/components/island/useIslandSessionState.ts` |
| 学習回答のcommitと表示receipt | `src/components/island/useIslandSessionLearning.ts` |
| 所有物の配置選択・保存と空のeditorの復帰 | `src/components/island/useIslandSessionPlacement.ts` |
| 写真の対象・保存metadataとcamera/gallery表示 | `src/components/island/IslandSessionPhotos.tsx` |
| 工作draft・保存作品の再演と操作の表示 | `src/components/island/IslandSessionWorkshop.tsx` |
| 家の挑戦・手紙・模様替えの表示 | `src/components/island/IslandSessionHouse.tsx` |
| 島の画面と操作 | `src/components/island/growing/GrowingIsland.tsx` |
| 島の描画 | `src/components/island/growing/GrowingWorld.tsx` |
| 島・家・学習の共用キャラクター | `src/components/island/three/islandCharacters.ts` |
| 共用の庭・家・光・景色の時計と描画計算 | `src/components/island/three/garden/` |
| 島の規則と保存 | `src/domain/growingIsland/` |
| 接続・成熟から育つ場所、関係、任意目標と実利用の受領 | `src/domain/growingIsland/places.ts`、`placeRelations.ts`、`placeGoals.ts` |
| 同じ地形・床・道・大形と、住人の実際の歩行と利用 | `placeTerrain.ts`、`placeGeometry.ts`、`placePaths.ts`、`growingLife.ts` |
| 家、取得済みの記念・所有と学習 | 共用の `src/components/island/` と `src/domain/island/` |

`npm run dev`と`npm run dev:growing-island`は同じport5198の育つ島を開く。旧Growing/Life/Home Journey/Nature Townの画面選択flagは別ホームの入口を作らない。`/nature-town`は通常ホームへ転送する。

2026-10-10の[育つ場所v1](../product/island-place-goals.md)は、本人の配置から6目標・15配置・4関係を導く。完成模型を固定背景へ貼らず、本・予告・実3D・歩行・利用が同じ派生結果を読む。record4/schema5の`placedIslands`へ一度コピーし、旧tableと旧writerを隔離する。[保存と空間のADR](../adr/2026-10-10-growing-place-runtime.md)と[同じ版の実画面・検証](../design/2026-10-10-growing-place-runtime/README.md)を参照。

## 残す互換性と共用素材

- `src/domain/islandLife/`は旧保存の読み込み、検証済みGrowing移行、旧所有・履歴と学習連携を支える。DB名やschemaをこの整理で変更しない。
- `src/domain/natureTown/`の純粋な計算、保存保護とテストは再利用資産として残す。旧DBは自動合算しない。
- 元のぽこもこの造形は`three/islandCharacters.ts`の`makePokomokoRig`を唯一の組立元とする。Growingの`worldScene`は同じ組立元を直接呼び、使わない旧うさぎ/カワウソの試作rigを作らない。GrowingLifeがactorの固有geometryを、worldSceneが共用材料cacheを解放する。`buildIslandCharacters`は家の互換rendererと学習actorで使う。旧Home Journeyの建物/成長コードは参照しない。利用先でmeshをrootから移した場合、そのgeometryは利用先が解放し、builderは残るrootと共用材料を解放する。
- Growingの配置予告・選択・ヒントだけが変わる場合はpreview資源を更新し、保存された建物・住人・船を保持する。保存stateの変更は全体を再構築する。`three/sharedRendererCache.ts`は登録したrendererが全て終了した時に共有DFG/sprite/wonder-paint資源の旧renderer参照を解放する。材質のshader hookを観測する際は元のhookとprogram keyを維持し、観測の有無で同じshaderの共有を分断しない。
- `three/garden/`は旧`life/fantasy/`から移した共用の庭・家・光・景色の時計と描画計算。Growingと家の互換rendererから同じ実装を使い、景色の時計を成長や報酬へ使わない。Life固有の水演出/保存済み再演のadapterもここから参照するが、保存や純粋な規則は既存のdomainに残す。
- `src/components/island/homeJourney/scene.ts`は旧予約と造形回帰用の試作建物を保持し、ぽこもこだけを共用組立元から作る。`src/components/island/life/`の家/旧所有・履歴用の描画adapterも保持する。独立したホームや旧保存の自動合算を追加しない。
- 保存済みHome Journey予約の完了・rollback・重複防止と履歴の読み込みは維持する。新しい予約に旧試作を付けない。

未実装の自然拡張を、この画面整理の完了に含めない。旧画面の検証資料は当時の範囲とGit版を参照し、現行画面の合格へ流用しない。

## 検証

`npm run verify:growing`でcore、classic smoke、Growingの実回答・配置・本・保存・offlineを確認する。本人切替は`tools/e2e-profile-switch.mjs`、一本化の実画面は`tools/e2e-single-island.mjs`を使う。後者はローカルの固定production previewと新規出力を指定する。

```bash
SANSU_SINGLE_ISLAND_URL=http://127.0.0.1:4173 SANSU_SINGLE_ISLAND_OUTPUT=output/single-island-new node tools/e2e-single-island.mjs
```

単一ホーム・家・実回答1件・同予約への復帰・旧URL転送を390/768幅で確認する。旧Townのsentinelは明示した隔離fixtureで、実利用者の移行を証明しない。旧flagを設定した別buildにも同じ検査を適用する。公開・PWA実two-build・実機・子どもの観察は別のゲート。

初期読込・学習・家の構成を分けても、同じ本人のsessionを画面往復でmountし直さない。本人切替だけ`profile.id`のkeyで状態を更新し、学習予約/表示receipt/読み上げを引き継ぐ。保存・採点・PWA checkpointの契約は変更しない。

実SWの版切替と対応writerへの復旧は[更新検証の手順](../runbooks/growing-update.md)を参照。

配置のpreviewと検索状態は専用hookが持つ。保存のrevision確認は既存repositoryへ委ね、成功時だけsessionの戻り先と家のfocusを更新する。写真・工作のpanelを分けても、cameraへ移る前の工作view・保存作品のref・draft切替・写真の戻り先はsessionに残す。panelのmountでこれらを初期化せず、任意の3D/UIは遅延読込を維持する。

共用3Dへの接続は家・配置・共有展示・写真・工作・遊びの型付き関数で組み立てる。各関数は新しいstateやwriterを持たず、sessionの保存と操作を受け渡す。IslandSessionStageは一つのSuspense/rendererへ合成し、地面の入力は共有展示のpreviewを優先する。表示条件はsessionで維持し、学習や記録の裏に旧3Dを作らない。
