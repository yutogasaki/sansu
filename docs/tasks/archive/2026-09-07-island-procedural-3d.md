# 不思議な島の3D品質改善

## Goal

既存の島・家具・どうぶつを実画面とコードで評価し、Three.jsコード生成/Blender・GLB/現状維持を対象別に判断する。改善価値のある部分を実装し、操作・生命反応・小画面の識別性・負荷まで検証する。

## SSOT

- [島仕様28](../../product/28_mystic_island_spec.md) Procedural 3D quality
- [verification matrix](../../ai/verification_matrix.md)

## Plan

1. 固定した前版で実全ループを撮影し、各対象と方式を評価。
2. 地形/建物/木、家具/生命反応、住民rig、配置操作を所有範囲で並行改善。
3. 実画面で比較・修正。core/島全入力/配置/経路/PWA/offline/正式速度と描画負荷を確認。

## Verification

390×844/768×1024と短画面。全6家具、drag/tap/矢印/回転/取消/保存/再開、正誤/支援/reduced motion/音off。現行入力・保存・領域不変。全ループ同一候補のcontact sheet、before/after、描画呼出し/geometry/フレーム測定と正式80レーン。

## Docs To Touch

- `docs/product/28_mystic_island_spec.md`: コード生成3D、配置操作、追加の大胆な配色。
- `docs/product/07_ui_design_guideline.md` / `docs/index.md` / `docs/wiki/memory.md`: 採用した配色と最新監査への案内。
- `docs/design/audits/2026-09-07-island-3d/README.md`: 部位別方式、3配色の実画面選定、同一buildの全ループ/負荷比較。
- `docs/ai/verification_matrix.md`: 3D操作QAの実行方法。
- `docs/done/2026-09.md` / `.agents/tasks/DONE.md`: 検証完了後の結果と限界。

- Review By: 2026-09-14

## Progress

- 2026-09-07: 前goalは完了。新goalを現コード・固定productionから再評価。前版99d08b2a0e4cの両サイズ全ループ16画面を新規撮影、PASS。3担当が地形/家具/住民をread-only調査し、コード生成を継続して形と可動部を改善する価値を確認。既存の未コミット作業を保持。

- 2026-09-07: ユーザー追加指示により、自然色中心から大胆な色面/輪郭/水玉/幾何学模様のfantasyへ美術方向を更新。3配色を実runtimeで比較する。形状/rig/配置の改善と読みやすい学習面は継続。
- 2026-09-07: 3配色×2 viewport×home/learningの12実画面を比較。紫/ピンク/黄/青を使う`moon-garden`採用。家具取消で住民が埋まる回帰を相互レビューで発見し復帰処理を追加。限定形状/接触/preview testsを実行、最終固定build検証へ進む。
- 2026-09-07: 初回固定e05f53934048はcore1266/正式80レーン/production全ループPASS。さらに実報酬4家具の連続操作で、出発した家具内へ到着できて次の経路が不能になる既存の端点不具合を再現。到着点だけ全障害物で検査する最小修正を追加し、再現fail→pass・同座面復帰と橋を含む10経路testsを確認。初回の全証拠を`output/playwright/island-3d/first-e05f53934048/`へ保全し、最終sourceのcoreと実操作を再検証する。

## Outcome

2026-09-07 ローカル実装完了。最終revision `aa36adad7dcc-island-3d-a427ea0225cf`、world `mystic-island-procedural-v2`、art `moon-garden`。地形/家/木/家具と住民rigをコード生成で改善、GLBが有利になる境界は監査に記録。根元を動かさない生命反応、共有座面/揺れ、ドラッグ再利用、取消復帰、次家具へ続く経路を実装した。

最終core1268、production学習21、3D操作2サイズ/6家具、critical16画面、Island PWA4＋実offline、旧Island11、classic PWA4、smoke31、正式80laneがPASS。564 build source一致、学習/storage domain差分0。スマホ/タブレットの実画面・実録画・計測は [監査](../../design/audits/2026-09-07-island-3d/README.md) と [比較レポート](../../design/audits/2026-09-07-island-3d/review.html) へ保存。独立した子ども観察と実機の電池/熱は未評価。公開・commit・pushは含めず、既存の未コミット変更を保持した。
