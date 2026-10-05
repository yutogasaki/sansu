# 島の実装と保存の境界

## 現行の実装

島のホームは育つ島ひとつ。[一本化の決定](../adr/2026-10-06-single-island-runtime.md)と[ゲーム仕様52](../product/52_growing_island_game_spec.md)に従う。

| 責務 | 実装 |
|---|---|
| ルートと共通ナビゲーション | `src/App.tsx`、`src/components/Layout.tsx` |
| 本人・家・本・学習を接続する入口 | `src/pages/Island.tsx` |
| 島の画面と操作 | `src/components/island/growing/GrowingIsland.tsx` |
| 島の描画 | `src/components/island/growing/GrowingWorld.tsx` |
| 島の規則と保存 | `src/domain/growingIsland/` |
| 家、取得済みの記念・所有と学習 | 共用の `src/components/island/` と `src/domain/island/` |

`npm run dev`と`npm run dev:growing-island`は同じport5198の育つ島を開く。旧Growing/Life/Home Journey/Nature Townの画面選択flagは別ホームの入口を作らない。`/nature-town`は通常ホームへ転送する。

## 残す互換性と共用素材

- `src/domain/islandLife/`は旧保存の読み込み、検証済みGrowing移行、旧所有・履歴と学習連携を支える。DB名やschemaをこの整理で変更しない。
- `src/domain/natureTown/`の純粋な計算、保存保護とテストは再利用資産として残す。旧DBは自動合算しない。
- `src/components/island/homeJourney/scene.ts`は現行Growingと学習が使う元のぽこもこモデルも作る。フォルダ名が旧試作名でも、独立したホームを起動するものではない。
- `src/components/island/life/`内の共用モデル、光・時計、純粋な描画計算は現行の島・家とテストから使う。
- 保存済みHome Journey予約の完了・rollback・重複防止と履歴の読み込みは維持する。新しい予約に旧試作を付けない。

未実装の自然拡張を、この画面整理の完了に含めない。旧画面の検証資料は当時の範囲とGit版を参照し、現行画面の合格へ流用しない。

## 検証

`npm run verify:growing`でcore、classic smoke、Growingの実回答・配置・本・保存・offlineを確認する。本人切替は`tools/e2e-profile-switch.mjs`、一本化の実画面は`tools/e2e-single-island.mjs`を使う。後者はローカルの固定production previewと新規出力を指定する。

```bash
SANSU_SINGLE_ISLAND_URL=http://127.0.0.1:4173 SANSU_SINGLE_ISLAND_OUTPUT=output/single-island-new node tools/e2e-single-island.mjs
```

単一ホーム・家・実回答1件・同予約への復帰・旧URL転送を390/768幅で確認する。旧Townのsentinelは明示した隔離fixtureで、実利用者の移行を証明しない。旧flagを設定した別buildにも同じ検査を適用する。公開・PWA実two-build・実機・子どもの観察は別のゲート。
