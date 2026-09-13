# 木肌と枝の終端：DEV限定の実画面試作

状態: 制作中。視覚HOLD、無文字理解はHuman N=0。本番には採用しない。

対象はC3背景の枝だけ。木肌候補2をbatchより前からmapとして扱ってUVを保持し、葉へ続く上側2本の終端を細くした。地形、カメラ、家具、住民のモデルと動作、入力、行動保存は変更していない。元画像を参照するDEV限定試作であり、配信素材の容量最適化は未実施。

`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true VITE_CANOPY_MATERIAL_STUDY=true` で起動する。対象は `http://127.0.0.1:5233`、実DOMの `data-life-visual-candidate` は `canopy-bark-runtime-study-v1`。この最後のflagを外すと従来のC3描画、本番buildでは常に無効。通常の世界版・保存版を更新する変更ではないため、採用時は過去のC3 snapshotを含む描画版の契約を別途確定する。

木肌は最初に1pxの代替色を保持し、画像が届く前のbatchでもUVを失わない。読込失敗では代替色を保持し、破棄後に届いたtextureで古いsceneを復活させない。両textureはsceneの所有物として破棄する。原画像はdocsに置いたままで、public/precacheへの追加はない。

## 比較と判定

基準は [C3](../references/2026-09-13-canopy-dots/reference-c3.png)。葉の曲面と大きな水玉、色瓦、暖かい木肌と根奥の局所陰、住民の余白を移す。生成された住民、固定配置、カメラ、細部の完全複写は移さない。静止画の目的は「大きな木に包まれた場所で、既存の住民の暮らしが見える」。新しい行動や報酬を追加する試作ではない。

最初の実画面診断では390×844/768×1024の両幅で木肌を確認。上の枝の断面は葉の下へ収まる。一方、草地と海の大きな平面、根元と背景の層の不足が残る。木肌だけでは基準に届かない。次の世界美術は地面・背景・樹形の奥行きを一体で検討し、細部や粒子を足すだけで補わない。

- 視覚: HOLD。暫定実画面評価は入ってみたい6、愛着7、素材6、構図/奥行き4、色7、出来事3の33/60。基準52/60・各8以上に未達。
- 無文字理解/安全: HOLD。独立観察0人。作者の画面点検ではキャラの再設計はないが、利用者の理解を証明しない。
- Runtime: 下記の固定source検査と両幅の対象旅程はPASS。通常の連問、PWA更新/オフライン、性能、全配置の総合合格へ拡張しない。

初回診断 `/tmp/sansu-canopy-runtime-study-1` は両幅の旧おもいで保持、現在観察、再読込、島全体、学習入力復帰がPASS。ただし旧harnessがreportの候補IDを固定していたため、候補同定を含む正式証拠にはしない。最終harnessは実DOMとの一致をassertする。

## 固定sourceの検証

- app source: `514104be2523771d08cb81279d9cf9e8cc9cd2893f5483ecbc393a86e2ce7d8f`。core後のUI開始/終了で一致。元のmainは `b8d2970`、独立worktreeの試作差分を含む。
- [core出力](runtime/core-output.txt): docs/lint/typecheck、404ファイル・3,934テスト、build/asset check PASS。PWA precacheは98ファイル・10.88 MiB。既存の期限/Browserslist警告あり。
- [最終UI report](runtime/report.json): phone390×844通常motion、tablet768×1024 reduced motionの2旅程PASS。明示QA花3個と旧世界のsimulated snapshotを使う。元snapshot、行動列、credits、学習正本の不変と学習入力への復帰を照合。実取得や自然な初発見とは区別する。
- [配信同定の追加診断](runtime/delivery-probe.json): 同じ5233のDEV、build `development-local:c4829bae-9066-4a2f-87d5-ee8097f24539`、外側 `snap-root-v1`、Island `mystic-island-v1`、world `canopy-dots-c3-v1`、実候補 `canopy-bark-runtime-study-v1`、木肌応答200。別のfresh QA contextで行った同定診断で、UI旅程の同一プロフィールとは主張しない。
- [coreのproduction build](runtime/core-build-version.json) は上記DEVとは別物。本番出力に木肌候補のURL/候補名/読込処理は含まれず、素材のproduction配信はない。
- [実画面の導線シート](runtime/contact-sheet.png): 現在の島→旧おもいで→現在観察→全体→学習。旧おもいでだけ旧世界を保持する意図的なモード差。tabletでは上側の葉のcropも残り、統一した完成世界としては未合格。
- [初回診断のraw report](runtime/first-diagnostic-report.json) は候補ラベル不足を訂正せず残す。最終結果で初回の出所を上書きしない。

自然X3の別検証がmainの固定sourceを使っているため、試作は独立worktreeで検査した。mainへの統合と本番採用は別の判断であり、視覚HOLD・Human N=0は継続する。
