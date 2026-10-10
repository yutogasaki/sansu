# 島構築の構造監査

2026-10-10。対象は共有作業ツリーの現行Growing実装と現仕様。[再設計戦略](../../product/island-construction-strategy.md)の根拠。公開buildの挙動の完全監査、実機計測、子どもの評価ではない。U-01は利用者提供画像で、build/flag/fixtureは不明。

## 確認した事実

| 根拠 | 実際の責任 | 制作上の診断と変更先 |
|---|---|---|
| [52 §3.1/3.2](../../product/52_growing_island_game_spec.md) | 種は1マス。周囲の点数から建つ形を決め、建ったstyleは保持 | 個体の記憶と、動的な場所の造形を分ける。styleをすべて後から上書きしない |
| [environment.ts](../../../src/domain/growingIsland/environment.ts) `features/styleAt/islandCharacter` | 品・種の点数、周囲のstyle、島全体の性格 | 局所のまとまりを表す派生計算を追加する余地。全体の集計を廃止しない |
| [space.ts](../../../src/domain/growingIsland/space.ts) `landBounds/landCells/occupant/walkableCells/reachableFromHome` | 矩形の土地、所有セル、衝突、通行、家からの到達 | 地形を変えるとここを含む契約が必要。描画の輪郭だけで所有セルを削れない |
| [town.ts](../../../src/domain/growingIsland/town.ts) `build/growHomes` | まち時間で建築・家の段階成長、到達と住人条件、建築時のstyle | 成長は既にある。問題は「何も育たない」ではなく、場所全体の成長が乏しいこと |
| [types.ts](../../../src/domain/growingIsland/types.ts) `Plot/Landmark/GrowingState` | 個体ID・座標・成熟・支払い・時計・住人・未開封結果 | 派生した接続領域と、保存する節目を分ける。IDや履歴を合成で消さない |
| [objectLayer.ts](../../../src/components/island/growing/objectLayer.ts) `add/buildObjectLayer/ageTree` | 各品/種のモデルを座標へ追加。大木1.3倍、ぬしの木1.75倍と周辺装飾 | 多くの物を一つずつ積む描画。単体のscale増加から、連続した根/樹冠/足元へ |
| [plotGeometry.ts](../../../src/components/island/growing/plotGeometry.ts) `buildPlot` | kind/stage/styleから単体の家・畑・遊び場・自然モデル | 個体モデルを維持し、場所の構造と共有空間を別の描画責任にする |
| [sceneLayout.ts](../../../src/components/island/growing/sceneLayout.ts) | boundsから床の座標・桟橋・画角用の寸法。床は橋を除き同じ高さ | 将来の床高はpoint/cellAt、hit、住人の接地も同じ地形を読む必要 |
| [worldScene.ts](../../../src/components/island/growing/worldScene.ts) `setGround` | boundsのlayout.keyが変わると地面を再生成。土の湿りは生成時に読む | 接続や成熟の局所変化を地面に出すには、場所のrevisionを更新キーへ含める必要 |
| [garden.ts](../../../src/components/island/three/garden/garden.ts) `GardenGround/gardenOutline/buildGardenGround` | 地面に渡る情報はboundsとmoisture。周縁・外側の固定大枝と細部 | 所有物の接続を地形が読んでいない。周縁の背景と育てた大形を区別する |

## 確認範囲と判定

- 島の構築：**Attention**。水・到達・個体成長の意味はある。大きな場所の形を生む集約が足りない。
- 美術の方向：**Attention**。U-01では平たい広い床と模型の列に見える。光や色だけで解消する構造ではない。
- 今回の設計資料の情報構造：根本の診断→選択した方針→材料と配置の比較→具体系列→規則/保存の責任→順序、へ改訂する。
- 新runtime候補の視覚的魅力：**NOT_EVALUATED**。新しい実3D候補・同版旅程・独立評価がないため数値を付けない。
- 無説明理解/安全・全体の美術連続性：**NOT_EVALUATED**。観察者・新候補のcontact sheetがない。
- 新規則のruntime整合：**NOT_EVALUATED**。今回は規則・保存・入力コードを変更しない。

形の魅力、無説明理解/安全、runtimeを相互に埋め合わせない。既存の単体テストやcoreのPASSを、新しい接続・場所成長・美術のPASSへ移さない。
