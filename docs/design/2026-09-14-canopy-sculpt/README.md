# 根と幹をつなぐ一体メッシュのDEV試作

状態: 視覚HOLD、無文字理解/安全HOLD（Human N=0）。限定runtime検査はPASS。本番採用ではない。

[前回の不採用造形](../2026-09-14-canopy-relief-rejected/README.md)では、独立したtubeを足しても根が帯状に見えた。[事前の転用範囲](transfer.md)に従い、木の曲線状の体積を滑らかにつなぎ、オフラインで一つの閉じたmeshへ変換する方式へ変更した。実行時に体積計算は行わない。

対象は木の幹/枝/根だけ。葉のgeometry、キャラの顔/輪郭/頭身/耳/色/布/動作、地形上面、歩行/配置の正本、学習/保存は変更していない。既存の木肌と芝、lagoonの浅瀬を使う。新しいraster画像や住民設定は作っていない。

## 比較と選択

[C3と3案・最終案の実画面](comparison.png)。比較は390×844/768×1024、同じQAの3住民・割当・論理時刻・地形・カメラで行い、realAtだけ開始時へ合わせる。実取得や自然発見、利用者観察とは別。

| 案 | 実画面report | 判断 |
|---|---|---|
| traced | [比較](comparison/traced/report.json) | 既存の枝構成を一体化。継ぎ目は減るが根元の広がりは弱い |
| buttress | [比較](comparison/buttress/report.json) | 中程度の接続と2本の根。強い丸みより幹の奥を残せるため、次の試作用に選択 |
| recess | [比較](comparison/recess/report.json) | 接続を強めて後方の根を追加。木の量感が増えるが奥の余白を埋める |

3案とも参照C3の完成度へ届いていない。採用判断はDEV試作の選択に限定する。元の枝にあった細かなうねりを完全復元する方式ではなく、連続した量感の候補として比較する。

## 生成と最初の失敗

[曲線入力](spines.json)、[生成元と環境](provenance.json)、[最終mesh manifest](meshes/manifest.json)。生成scriptは `tools/export-canopy-sculpt-spines.mjs` と `tools/build-canopy-sculpt-study.py`。Nodeで曲線をサンプリングし、NumPy/scikit-image/SciPyで距離の滑らかな和とmarching cubesを計算する。Python側の依存はアプリへ追加しない。二つのscriptへ順に入力JSONと新しい出力directoryを渡す。

- 最初は細い枝先に10頂点の孤立片ができ、[接続検査が失敗](diagnostics/first-unit-failure.txt)。各案の葉の下にある格子より小さい同じ破片を除去する。12頂点を超える、または本体の0.1%以上の分離は生成失敗とし、大きな欠落を隠さない。[修正前manifest](diagnostics/first-mesh-manifest.json)と[旧generator](diagnostics/generator-before-cleanup.py.txt)を保存した。
- 次は最も強い接続案で、前方の表面が最大約0.00019ずれ、[前方一致検査が失敗](diagnostics/foreground-unit-failure.txt)。補間の隣接格子を含む2セルの余裕を持って基準体積を保護した。[比較時manifest](diagnostics/comparison-mesh-manifest.json)と[修正前generator](diagnostics/generator-before-halo.py.txt)を保存した。
- 最終3案は全辺が2面を共有する閉じたmeshで、連結成分は1。前方 `z > -2.5, y < 1.2` の頂点集合はtraced候補と一致する。これは元のTubeGeometryとの完全一致や全配置の安全を証明するものではなく、追加の根で比較基準の前方を増やさない検査である。

比較画面はgeneration 2の候補v1、最終は2セル保護後のgeneration 3・候補v2。最終buttressは12,860頂点/25,716三角形、JSON 1,893,684 bytes。実行時は既存の親groupの中心移動とy倍率.67を適用する。UVは接続部分で切れない連続した座標を使うが、C3の木肌の流れを完全に再現したとはしない。

## 読み込みと配信

`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true VITE_CANOPY_MATERIAL_STUDY=true VITE_CANOPY_GROUND_STUDY=turf VITE_CANOPY_SHORE_STUDY=lagoon VITE_CANOPY_SCULPT_STUDY=buttress`。sculpt値はtraced/buttress/recess。DEV・木肌・turf・lagoonが揃うと有効になる。原木は読み込み完了まで残し、meshが届いた時だけ隠す。失敗時は原木を表示し続け、破棄後に届いたgeometryは破棄する。表示中のgeometryと既存materialは親sceneの所有。

実target `http://127.0.0.1:5244`、DEV build `development-local:2e1fcb2a-bf09-47a2-984e-1dca1adc3633`、元revision `60fabeb`＋試作差分。外側delivery `snap-root-v1`、島delivery `mystic-island-v1`、world `canopy-dots-c3-v1`、実候補 `canopy-sculpt-buttress-study-v2`。現在観察の実sceneも読み込み完了を待って撮影した。比較用5243/5245 serverは撮影後に停止。

production JavaScriptにmesh URL/新candidate/新mesh名が不在。CSSには候補限定の背景selectorが残るがproductionで候補は発生しない。public/precacheへのmesh追加はない。正式な描画/素材版や過去C3 snapshotへの適用、配信容量最適化は未完契約。

## 固定sourceの検証

app source `c793eff6948d238d53fe2e1eac9420287ab509055a09bd17f1dbd864a2c5108d`。core後のUIと取得失敗診断の開始終了で一致。docs素材はapp hashに含まれないため、最終reportでatlasと選択meshのSHA-256も記録する。

- [core](runtime/core-output.txt): docs/lint/typecheck、409ファイル・3,953テスト、build/assets PASS。precache98ファイル・10.88 MiB。既存の期限/Browserslist/fast-refresh警告あり。
- [最終UI](runtime/report.json): phone通常motion/tablet reduced motion。QA花3個・simulated旧memoryを使い、旧snapshot/行動/credits/native学習正本を保持。現在観察→reload→全体→学習入力への復帰、実候補、下部背景を確認。両幅PASS、console/page errorなし。
- [mesh取得失敗](fallback/report.json): 選択meshの取得だけを明示abort。両幅で既存の木とfallback状態を確認。productionのoffline/PWA更新の代用ではない。
- [導線シート](contact-sheet.png): 現在→旧memory→現在観察→全体→学習。旧memoryの旧背景は意図した保存契約。新しい物語や承認済みの統一世界を意味しない。

## 独立した判定

- 視覚: **HOLD、35/60**。入ってみたい6、愛着7、素材6、構図/奥行き6、色7、出来事3。2026-09-14の最終両幅runtimeの作者評価、確信度中。接続の量感は改善したが、C3の光・木肌・空間の層、板状の岸、tablet上部のcropは残る。52/60・各8以上に未達。
- 無文字理解/安全: **HOLD、Human N=0**。独立した理解/継続意欲/危険解釈は未測定。作者の画面点検と幾何検査を利用者検証へ読み替えない。
- Runtime: 上記の生成/寿命/限定導線は **PASS**、全releaseは **HOLD**。最大配置の性能、固定10問10反復、実機/PWA更新、正式C3素材や自然X3の受入へは拡張しない。

次はこの造形を見せる構図と光を実画面で検討する。既存キャラは維持し、静止画の不足を新しい動作や粒子だけで補わない。元の仕様全体の残件は継続。
