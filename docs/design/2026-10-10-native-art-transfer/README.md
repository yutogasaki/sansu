# 完成した全島を先に、本体へ移す

目標は[採用したnative-05](../2026-10-10-island-final-3d/README.md)そのものの形・素材・景色。元のBlenderとGLBは変更せず、実装へ移す際に失われた構図を本体内で確認する。現在は開発用の美術転写工程。所有や成長の実装完了、配布、利用者の美術承認を表さない。

## 転写する具体物

| 移すもの | 本体で保つ性質 | この工程で決めないこと |
|---|---|---|
| 海岸、岬、深い入り江、丘、低地 | 原本の頂点、段差、連続した地形、全島の輪郭 | セルの追加購入や保存の移行 |
| 森と大樹 | 青紫と翡翠の葉面、樹冠の密度、琥珀色の中空、枝の回廊、螺旋階段 | 所有木の個数、成長時計、接続閾値 |
| 段泉 | 紫の鉱石、水源から続く3段の青い泉、滝と渡り橋 | 通水距離、浅水を歩ける条件 |
| 入り江と貝の集会所 | 青と紫を透かす厚い殻、肋、実在する開いた室内 | 本人の家を増やす、人口を増やす |
| 花庭と集落 | 大小の花、色面、低い家と主樹の尺度差、葉/傘の屋根 | 模型15軒をゲームの上限や報酬にする |
| 光と視点 | 原本の昼夕光、反射、同じ全景/近景カメラ | 白さや発光だけを幻想感として足す |

## 制作の関門

**A 全島の転写** → **B 地形・入口・実床の対応** → **C 同じ部品から各場所の成長** → **D 組み合わせと全島の暮らし**。

Aでは完成した全島と森・段泉・入り江・花庭の実画面を先に見比べる。B以降の機能を先行させて、似ていない景色を技術PASSで完成扱いしない。形の簡略化は比較してから行い、まず原本の形を保ったまま材質ごとの描画をまとめる。

## 実装の境界

- 開発用の本体内表示は`?islandArt=native05`で明示して開く。DEV、または明示した美術確認buildだけで有効。
- 既存のIslandホームと同じReactアプリ、ナビゲーション内で描く。学習画面は既存のまま。
- 美術確認ではGrowingの所有・接続・利用の書込みを起動しない。模型の人物と家は完成像を確認するための原本要素。
- `build-native-island-art.mjs`は原本の全meshを意味のある部品へ分ける。頂点、法線、UV、頂点色、材質、既存transform、布textureのbufferを変更しない。
- この表示を通常のゲームへ既定で切り替えない。次工程で、地形の対応と所有部品の置換を仕様・実画面の両方から進める。

## 現在の判定

本体v3の美術差戻しは保持。全島転写の実画面と確認結果は、この候補について別に記録する。技術の同一性と美術の魅力、無説明の理解、実機性能は別々に扱う。

## 原本と描画の対応

現在の実表示は原本のflat GLBを読み、原本と同じ順序で80材質の描画へまとめる。各meshと30部品の対応は`runtime-manifest.json`から追跡する。`native05-modules.glb`は部品単位へ接続する次工程のための編集可能なexportで、現在の全景表示が読み込むファイルと区別する。

海は原本の波形/頂点色を外側へ延長し、現在の島を反射する。透過材質の非有限値を元のphysical diffuseへ戻す処理と、独立した海の反射描画を加えた。通常の色/材質parameter、頂点や尺度は変更しない。原本viewerのpostprocess chainを移さず、direct PBRで描画するため、夕のbloom 0.13は現在の表示に含まない。原本buffer/材質一致は、全pixelの描画一致を意味しない。

## 確認の入力

固定美術確認buildはIsland ON / Life ON / `VITE_ISLAND_ART_STUDY=true`、表示は`?islandArt=native05#/island`。実画面には通常ホームのparent candidateと別に`native-05-art-transfer-v1`、実GLB SHA、部品pack SHA、全景/近景camera、昼夕と描画済みviewを記録する。模型の家/人物は完成像であり、本人の所有/人口へ数えない。

通常buildではこのflagを有効にしない。原本GLBと美術確認のJSを含めないことを別に確認する。固定美術buildのasset量、通常buildのasset量、DEVの画面を混同しない。

## 本体の実画面と原証拠

[比較ショーケース](index.html)に全景と4地区の原本/本体を並べた。固定美術buildは`native05-art-transfer-a2-f10a43c4222a:864a0d3a-bffe-4047-a1d8-29fd59cf8a11`。[実report](verification-a2/report.json)の`version`を正本にする。対象は`http://127.0.0.1:5296/?islandArt=native05#/island`。Island ON、Art Study ON、実美術候補`native-05-art-transfer-v1`。通常ホームのparent candidateは保持され、転写する美術はchild markerで識別する。

固定buildの390×844/768×1024で、全景+4近景×昼夕の20画面、同camera/canvasの原本比較10組、通常島/学習への帰還を記録。実初回設定から作った隔離プロフィールで、完成美術表示中に`placedIslands`/贈り物/写真の読み取り内容が変わらないこと、44px操作、Home/+キー、load failure/retry、実WebGL context loss/retryを確認した。32 capture記録に48枚の画像を残している。art表示の22枚は[黒/空の描画診断](pixel-check.json)もPASSで、魅力の点数には使わない。固定時刻・資源豊富な成熟fixtureは使っていないが、本人の自然取得/動的成長の完了証拠ではない。

[撮影した入力](build-inputs-a2.json)と開始/終了のSHAは一致。[現在の描画sourceとの対応](source-correspondence.json)は1,571入力が同一で、Vite configだけが異なる。最後にdisabled studyの解決を先行hookとabsolute pathへ閉じ、普通の配布から未参照GLBも除外した。この差は有効な美術buildのmoduleを置換しない。通常buildの確認は[配布境界の記録](normal-build-boundary.json)として別のversionに残す。

最初の[美術比較run](verification-a1/report.json)は比較ボタンとstageの同名attributeを取り違えて停止し、FAILを保持。画像/条件/画角を変えず、`button`へ絞ったdriverの別runが上のA2。通常buildで未参照GLBが残った初回/中間build、classicの初回timeoutも[原log](verification-logs/classic-first-failed.txt)と診断を保持し、最終確認と混ぜない。

## 独立した判定

| 関門 | この工程の現在地 |
|---|---|
| 美術 | 原本の全島・密度・造形を本体に転写し比較可能。普通の所有島v3はHOLD_USER_REJECTED_NATIVE05_GAPのまま。新しい利用者の美術判断は未取得 |
| 理解/安全 | 44px操作、失敗時の再試行、通常島/学習への帰還を隔離QAで確認。子どもの無説明理解・楽しさ・再訪はNOT_EVALUATED |
| Runtime | 全景/近景/昼夕、同camera、所有不変、loading/実context lossの復帰、通常build除外を確認。包括成長・配布・SW offline/更新・実機FPS/iOSはこの工程の範囲外 |

次はBの地形/入口/実床の対応。Bを作るときもこの全島比較を保ち、Cの若い/接続/成熟/分離/再接続とDの関係/P06をつなぐ。完成像のread-only表示を最終ゲームとして閉じない。

## 最終のローカル検査

[確認結果の索引](verification.json)と[重要経路の実画面](critical-path.html)を保存。最終の`npm run verify:core`は564 files / 4,966 tests、docs/入口契約/lint/typecheck/build/asset budgetをPASS。既存の`IslandMilestone.tsx`のFast Refresh warning 1件は残る。

classicの最初の2runは、それぞれ3件/1件のtimeoutでFAILを保持した。coreや美術撮影と並列だった起動の失敗を、[次の単独run](classic-sequential-report.json)で32経路PASSまで確認。入力・待機上限・プロフィールを実行中に変えず、最初の起動は37.8秒だった。並列時の処理競合が影響した可能性はあるが、子どもの端末や本番の起動性能の証拠には使わない。

作者による[現在のDEV実画面](dev-current-768.png)と[metadata](dev-current-metadata.json)も別に残す。DEVは`development-local`で、固定buildの証拠に混ぜない。390/768で全景を確認し、検証用viewportは解除した。
