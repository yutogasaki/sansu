# 中央肩 SW v3 source — 独立監査

**component geometry / 支持 / 根元を含む source guard は以下の範囲で PASS。本体アプリ・実利用・全島美術は未検証。** selected SW v3 の床・35 ownersを変更せず、作者と合意したfreezeから実GLBを読み直した。新根元の経路判定を、追加前のPASSから推定していない。

静的全景sourceには既知の差がある。`source-context.glb` の `authored-water-ripples`（LineSegments3組、各160 indices）がBlender往復後の全景GLBでは消えている。本体は既存water描画を保持する契約なので、これはcomponent geometry/support/guardとは別のsource render限界。本人保存、通常土地取得・価格、preview/commit/lifecycleの本体実装は監査していない。

## 対象と主要結果

- [実GLB根元guard原結果](raw/actual-root-guard.json): fixed c4 codeに実新根元108三角形を追加。索引249,304→249,412。l33/l34/l35接近4/2/7、p3/p4=9/5、P04 p6/p7/p9=2/7/6を保持。前帯13点/12辺すべてopen/reached/clear。既知 **l14=0は追加前後とも0**。診断では既存木をeligible rootへ明示追加しており、この時点のアプリに木guardが統合済みとは言わない。
- [実GLB component原結果](raw/components-audit.json): 土壌15,184三角形/7,594 position-weld頂点、各根元36三角形/20頂点。全辺2面接続・共有辺方向一致、signed volume正。新上面6,615三角形はselected v3のFloat32 triangle multisetと完全一致。材0/1の誤割当0。
- 3根元の上cap各8三角形は、実original whole GLBの対応幹capをowner行列で変換したものとFloat32で一致。pivot、.45成熟scale、owner record、floor revisionはhandoffと一致。元樹皮PBR保持。全根元はowner ±.46内、投影床gap0、底の全投影域に対する最低埋込みは約.006（.00599994以上）。最大埋込みはl33=.04588 / l34=.06216 / l35=.06567。
- 旧32 recordsは同一、旧73の全±.46 footprintは変更領域と非交差。増分は75権利/35 ownersの診断fixtureのまま。実最高大樹boundsは追加前後一致。actorは保存済c1実rig envelope（117 meshes / 99,868 indexed vertices / .45）を再利用し、半径+.04=.28406937059140585の前帯全幅支持を再検査。未被覆面積2.37e-17、intersection面積は帯全面積と丸め内で一致。
- [静的context原結果](raw/context-audit.json): 35 owner IDs、owner/shared36群の三角形数・boundsを保持（最大bounds差4.20e-7）。metadata407件は数値の `-6` と `-6.0` を同値に扱うと完全一致。state/world/plansは原handoffのbytesと一致。54保持floorは最終worldのFloat32 triangle multisetと全件一致し、新soilは1個だけ。別構図の原本15軒は流用していない。これはcontext全頂点の厳密比較ではなく、所有群別の三角形数/boundsとmetadataの監査。

## 精度・法線・閉体の限界

GLBはFloat32のため、double world床に対する最大座標差は4.77e-7。境界missing面積4.46e-7、outside4.49e-7、保持床との重複3.27e-7は、この丸めを混ぜて比較した微小sliverであり、厳密な0と報告しない。worldのdouble床支持とGLBのFloat32一致は別々に確認した。保持床と新床を重ねて描く構造ではない。

旧componentsの原本補間NORMALとの外周979 samplesは最大L2=.00012597、下向きtop normal0。作者は新上面の全法線についてBlender書き出し差を発見し、NORMAL-only v2を別artifactに保存した。[独立byte監査](raw/normal-v2-audit.json)で、両v2はJSON/POSITION/index/material/node等が同一、変化21,223 bytesすべてが新肩の材0/1 NORMAL accessor内である。profile法線との単位ベクトル差最大4.39e-8（3,810 samples）。したがって旧版のgeometry/guard結果をv2へ引き継げる。照明下の境界や根元の見え方は未検証。

土壌の下端y=-.308999985、上面最低y=-.008999990。閉体・面向きは実GLBで確認したが、全ての埋没面同士のself-intersectionや原島全体とのvolume Booleanは行っていない。原本幹と根元capの位置接続は確認したが、レンダー上の滑らかさを数値で代用しない。

## Freeze と再実行

[audit-manifest.json](audit-manifest.json)に全raw SHAとfreezeを保存。

| artifact | SHA256 |
|---|---|
| geometry-profile.json.gz | `7b4772489932b225d7b31ced5bd53c6835a47e8e63c71eeb43d7b59af1523d3b` |
| central-shoulder-components.glb | `24f32eed46efe18cd3411220771b2b4f5266449278f00499c0917550f1a7d998` |
| central-shoulder-components-normal-v2.glb | `c79e2cd7a228b24ff526e6d78913f6a07880e35dec1532d4c278dd7cbf10411e` |
| central-shoulder-source.glb（親owner保持版） | `16ff4e1a1b31a4dcb676dbc6283ec368902f08bfba2a895a436a93845a4907b8` |
| central-shoulder-source-normal-v2.glb | `cd86121c32072053960e927866f9442b7168e281df9d8c46cf9807ce691b2ff9` |

原本whole GLB SHA `8398eda9…f68d`、original Blend/benchmarkは作者の別source出力から保持される。監査入力before/after SHAは各原結果にある。全景GLBの最初の親owner不足版は作者のhistoryで保持し、本監査は親保持版を対象とした。

実行入口は [actual-root-guard.mjs](actual-root-guard.mjs)、[components-audit.py](components-audit.py)、[context-audit.py](context-audit.py)、[normal-v2-audit.py](normal-v2-audit.py)。Node v24 / repo three・esbuild、Pythonは既存geometry venvのNumPy・Shapely2.0.7。script出力先は `/private/tmp/sansu-central-shoulder-source-audit/`。canonical c4コピーを読んでのみ動作する。再実行時は同じfreeze SHAを確認する。

最初の診断失敗もrawに保持した。asset path解決、未命名node、非triangle primitiveへの対応は監査reader側の修正。狭い床ROIに対するGEOS overlayの不整合は、同じ実三角形をC全域まで含むROIで再計算し、differenceとintersection双方を照合した。未完了の法線全探索や誤った中間値を最終PASSに用いていない。

app/c4/分離codeコピー・作者所有sourceには書き込んでいない。browser/build/core/heavy renderは起動していない。次はこのcomponentを同じworld/owner条件に統合し、本体で表示・操作・除去を別に確認する。
