# 幻想の庭 — 最初の遊べる一周

> **旧試作の履歴。** この記録の `living-fantasy-garden-v1` に含まれるぽこもこの変更モデルは、2026-09-27のユーザー指示で取り下げた。画像と数値は当時の検証記録として保持し、現行候補や承認済みデザインとして使わない。現在の入口は [index.html](index.html)。

2026-09-27。候補 `living-fantasy-garden-v1` をThree.jsの実画面へ実装した。[実画面ギャラリー](index.html)で昼・夕方・夜と操作の一周を確認できる。[包括仕様51](../../product/51_living_fantasy_island_spec.md)の初期段階であり、新経済・全画面・移行を含むv1の完成ではない。

## 実装したこと

- 曲面の地形、太く曲がった木と枝葉、小さな家、生成りと青の相棒、青緑の水面を同じ3D世界へ統合。窓とランタンの局所的な光、葉の揺れ、水面の反応を加えた。
- 昼・夕方・夜を本人ごとに保存。切り替えても財布・成長・発見条件を変えず、同じ地形と配置を保つ。
- 普通の庭の水をタッチ／キーボードで操作。条件を満たすと水に星が現れ、実際に1秒以上見えた出来事だけを思い出に保存する。背景化・遮蔽・メニュー・context lossで未表示を発見扱いにしない。
- 思い出を開くと当時の配置と時間帯を同じ庭で再演する。原本の `live` と再演の `replay` を分ける。
- 既存の学習、しずく、購入、配置、住人、土の水分、保存と接続。新しい絵を固定画像で被せる方式ではない。

現在はLife v20の二通貨と既存M4の到達距離4を使う。仕様51の一通貨化・F-D03距離2・初期セットへ移行済みではない。収納・所有・既存の学習予約を書き換えない。旧snapshotには任意の `gardenTime` を後付けせず、以前のhashを保つ。

## 対象と再現

| 項目 | 記録 |
|---|---|
| DEV | `http://127.0.0.1:5230/#/island` / `npm run dev:island-fantasy` |
| production形式のローカルpreview | `http://127.0.0.1:5330/#/island`。配信先への公開は未実施 |
| 庭の実candidate | `.life-world[data-life-visual-candidate="living-fantasy-garden-v1"]` |
| shell / learning candidate | `mystic-island-shore-garden-v18` / `mystic-island-learning-v2`。全画面の美術統一は次段階 |
| build | `development-local:656fecaa-d604-4c70-8cc5-478034eaf5a9` |
| Git基点 | `67406a186e227ef3d66983d2b5dea72739c5d1db`。未commitの共有作業ツリーを検査。基点commitそのものの検査ではない |
| build入力hash | `14d0a55ea4a4e00060943548a6c91d98b66413184deec5d511de56cdc3838aa9` |
| DEV flag | Island / Life preview / Fantasy を有効 |
| production flag | Island / Life / Discovery / Fantasy を有効。通常の公開設定は変更していない |
| 保存 | DEVは `SansuIslandLifePreviewV1`、production形式は `SansuIslandLifeV1`。すべて使い捨てブラウザcontextのテスト用プロフィール |
| 端末 | macOS上のChromium、390×844 / 768×1024。タッチemulation、動きを減らす設定も含む。実機ではない |
| cache | DEVは新規context。production形式は通常のSW制御下からoffline reload・保存を検査。2 build更新は今回未検査 |

[manifest](manifest.json)にapp/QA hash、flags、DB、captureのhashを記録し、[build入力](build-source.json)にファイルごとのhashを保持した。DEV reportの `workingSourceHash` は別のhash手順なのでbuild hashと文字列一致では比較しない。各画像の実URL、root、candidate、cache、viewportは[DEV report](dev/report.json)／[production report](production/report.json)で確認できる。

ローカルのproduction buildは `output/playwright/fantasy-first-playable/prod-dist`。次のコマンドで同じbuildを開ける。

```sh
npx vite preview --host 127.0.0.1 --port 5330 --strictPort --outDir output/playwright/fantasy-first-playable/prod-dist
```

## 証拠を混同しない

| 経路 | 実施範囲 | 該当画像 |
|---|---|---|
| DEVの実獲得 | 初期プロフィールのみfixture。3問は実UI回答、6しずく、花の購入で4、配置・再読込・同じ学習予約へ復帰 | `dev/390-initial`〜`dev/390-placed` |
| 庭の診断 | 別プロフィールへwriter経由のcreditと24時間送り。8品の配置、昼夕夜、実表示、水の星、本人保存、残す／再演／再読込、現在の庭への復帰 | `dev/*-populated`、`*-water-stars`、`*-memories`、`*-memory-replay`、`*-return` |
| productionの実獲得 | fixture書込なし。初回設定、実UI回答4問、購入・配置、SW制御下のoffline起動、4問目のoffline保存、再読込後の履歴4件・credit4件・所有保持 | `production/*` |
| 故障注入 | 水反応の最初の1秒以内にhidden、DOM遮蔽、context loss、メニューを発生させ、偽の思い出が増えないことを検査 | DEV report内の `hidden-overlay-context-loss-menu` |

8品の画像は自然な数日利用や実学習だけで育てた庭の証拠ではない。逆にproduction実獲得経路は初期の花1個であり、多数配置の負荷検査ではない。画像は実ブラウザcaptureをそのまま保存し、ギャラリーでは表示サイズだけを変えている。

## 三つの判定

### 美術 — HOLD、初期prototype

[B方向](../2026-09-27-world-direction-rethink/directions-abc.png)と390pxの実画面を比較した。曲がった枝、暖かな家、青緑の水、生成り／青の相棒は移せている。Bの素材の豊かさ、前景から奥へ続く空間、相棒の表情、出来事の大きさにはまだ差がある。庭以外の家・学習・shellも現行の表現を残すため、全体の美術統一は未完了。

実装者による実画面の仮採点（2026-09-27、390×844の昼夕夜・水反応、確信度は中。利用者評価ではない）:

| 軸 | 点 / 10 | 実画面での判断 |
|---|---:|---|
| 入ってみたさ | 7 | 場所と暮らしは見えるが、奥へ続く景色が少ない |
| 相棒への愛着 | 7 | 同じ造形と動きは保てる。顔が小さく細かな表情は弱い |
| 素材 | 6 | 木・葉・水・壁の色と形は分かれる。木肌・葉・地面の質感は簡素 |
| 構図と奥行き | 7 | 枝と家で枠を作り、配置の余白は残した。海の空き面積が大きい |
| 焦点となる色 | 8 | 屋根・青緑・生成り・小さな琥珀色が読み分けられる |
| 出来事と結果 | 6 | 水の星はその場で起きるが、390pxでは現象の面積が小さい |
| 合計 | **41 / 60** | 52以上・全軸8以上の公開基準は未達 |

生成画像の点をruntimeへ転記していない。次の美術作業は粒子を増やすことではなく、前景・遠景・素材と相棒／水の見える大きさ、家／学習を含む全体の画面整理に置く。64pxシルエットと全画面の固定領域比較は最終候補で行う。

### 無説明の理解と安心 — HOLD、独立観察0人

子どもの無説明理解・続けたいという反応はまだ測っていない。作者の見た目の確認、ARIA、E2Eのクリック成功を4/5人の理解の代わりに数えない。

### Runtime — 今回の範囲はPASS、v1全受入はHOLD

| 検査 | 結果と範囲 |
|---|---|
| `npm run verify:core` | PASS。472ファイル、4,218 tests、docs/current-entry/lint/typecheck/build/assets。既存の `IslandMilestone.tsx` のreact-refresh warning 1件 |
| `npm run e2e:smoke` | PASS。classicの回帰確認。幻想の庭の合格証拠には流用しない |
| `npm run e2e:island-fantasy` | PASS。上記の実獲得、2サイズ、実表示と保存、再演、4故障条件 |
| production専用E2E | PASS。2サイズ、初回設定から実獲得、実SW offline reload、追加回答と所有保持 |
| 8品の描画 | 最大118 draw calls / 140,740 triangles / 83 geometries / 6 textures。120 / 150kの制作予算内。30品負荷・実機FPSの合格ではない |
| 配信素材 | PWA precache 159 files、8.28 MiB / 12 MiB。新しい画像・外部3Dモデル・依存packageの追加なし |

`npm run benchmark:island-fixed-ten` は10反復×2サイズ×2経路×2シナリオの**80 runでPASS、eligible=true**。[結果](throughput.json)と[入力manifest](benchmark-source.json)を保持した。実施前後のsource不変、問題間の追加操作0、遷移後の入力消去、section境界、ブラウザerror0も確認。固定fixtureの自動キーボード入力であり、子どもの解答速度・学習効果・本番plannerの問題選択の証明ではない。

| 幅 | 正答→入力可能 P95 | 誤答→再入力 P95 | section境界 P95 | 自動入力の全問正答 throughput / Study |
|---|---:|---:|---:|---:|
| 390×844 | 213.9ms | 208.4ms | 205.5ms | 2.293倍 |
| 768×1024 | 211.5ms | 208.1ms | 206.1ms | 2.285倍 |

各サイズで正答200・誤答20・section境界20 sample。正答とsection境界650ms以下、誤答550ms以下、Study以上のthroughputを満たす。これは同時点のStudyとの比較であり、今回の美術変更が学習を2倍に速めたという因果比較ではない。学習runtimeは既存candidate `mystic-island-learning-v2` を維持する。

今回は全旧schema移行、全バックアップ復旧、2 buildの更新、実機の起動・FPS・電力、30品と1,000収納、全読み上げ動線、仕様51の全26ケースは完了扱いにしない。共通検査の実ログは[core](verify-core-final.log)と[smoke](smoke.log)。

DEVの再実行は `SANSU_FANTASY_URL` と新しい `SANSU_FANTASY_OUTPUT` を指定する。productionは実buildと一致するmanifestを用い、以下を実行する。

```sh
SANSU_FANTASY_PRODUCTION_URL=http://127.0.0.1:5330 \
SANSU_FANTASY_PRODUCTION_OUTPUT=output/playwright/fantasy-production-new-run \
SANSU_FANTASY_MANIFEST=docs/design/2026-09-27-living-fantasy-first-playable/build-source.json \
node tools/e2e-island-fantasy-production.mjs
```

## 検出して修正したこと

- Three.js shaderの予約語によるcompile errorを実ブラウザで検出し、名前を修正。
- 地面が足元と踏み石を隠す高さを修正。土の水分textureと既存配置anchorを接続。
- 葉と光をまとめ、不要な分割を減らして制作予算内に収めた。
- 診断用の存在しないtable参照、作成時刻より前のfixture、描画中のwriterとfixtureの競合を修正。保存本体の不整合と誤認せず、最初の失敗記録を残した。

最初の失敗はローカルの `output/playwright/fantasy-first-playable/first-harness-failure.json`、`shader-failure.json`、`fixture-clock-failure.json` と候補別reportに保持した。旧 `e2e-island-life-production.mjs` は廃止済みwallet tooltipのlocatorで失敗し、合格へ書き換えていない。[旧実行ログ](production-pwa.log)を保持し、現行DOMに対する専用production経路を別に記録した。旧scriptの全favorites・growth検査まで代替したという意味ではない。

## 次の実装

1. この庭を基準に、素材・前景と遠景・相棒の表情、水の出来事の大きさ、家と学習を含む画面を整える。
2. 仕様51の初期セット、一通貨化、住人招待・成長・新発見を、互換と全保存復旧を伴う段階で実装する。
3. 30品・実機・更新と子どもの独立観察を行い、三ゲートを別々に判断する。

今回のローカル実装は公開設定へ自動反映しない。現在地は[実装タスク](../../tasks/active/2026-09-27-living-fantasy-first-playable.md)と仕様51の冒頭に集約する。
