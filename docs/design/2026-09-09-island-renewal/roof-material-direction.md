# 屋根の面と継ぎ目 — 素材試作

2026-09-09。固定33の[tablet近景](grass-v13/tablet-after-near.png)では、屋根の実継ぎ目geometryと面のpatchworkに黒線が重なり、家の大きな色面を分断している。[source A](shore-garden-a.png)の黄を中心とした丸端瓦と穏やかな境界を参照し、既存の家を見やすくする。`sansu-art-direction-loop` の既存構図修正として扱い、新しい生成画像や家モデルを追加しない。

| 対象 | 受け継ぐ性質 | 持ち込まない性質 |
| --- | --- | --- |
| 瓦の面 | 黄主体、淡桃と青緑の大きな面、約3段の丸い下端 | 黒い斜線・点・縞、細かなタイルの密集 |
| 継ぎ目 | 面につながる暖かい黄土とクリーム | 屋根の面と縁の二重の黒輪郭 |
| 家のidentity | 既存shell・UV・座標・door・窓・旗・名札 | 生成画像の家への置換、個々の瓦の実立体化という主張 |

## 狭い描画契約

候補は `island-roof-surface-v1`。対象styleを **`legacy-v1:moon-garden:houseRoof`** に限定する。面の入力色 `#c24f3e` にだけ128²・mipmap付きのSRGB mapを使い、約3段×4枚の大きい丸端瓦を描く。暖かい下地と控えめな陰影で分け、黒い線・点・斜線は描かない。これは既存shellへ貼る静止した色mapで、凹凸geometry・displacement・時間uniform・毎frameの処理は作らない。

継ぎ目の入力色 `#eb8a5a` / `#ed9967` / `#de7956` / `#e58259` の4色だけを暖かい黄土/クリームに置き換える接口を用意する。粗さ・金属度は呼出元の値を保ち、発光の要求は従来材質へ戻す。他の色、他slot、他theme、本人の明示した `parts-v1` は対象外。worldPalette、地形、歩行、保存、成長、学習入力、カメラ、既存のdoor/flag等を変更しない。

## 接続と資源所有

`createIslandRoofSurface(styleId)` は対象styleでだけpoolを返す。`pool.surface(sourceColor, roughness, metalness = 0, glow = false)` は対象色だけ材質を返し、対象外はundefinedとして既存材質へ戻す。面の初回要求でtextureを1枚だけ生成し、色/粗さ/金属度ごとに原材質を共有する。`pool.texture` は生成済みtextureの読取用参照。

poolが原材質とtextureを所有し、`dispose()`で一度だけ解放する。退役後に再生成しない。呼出元が材質をcloneする場合、cloneの解放は既存の `islandOwned` / `disposeGeometry` に属し、共有textureはcloneから解放しない。接続先は `IslandPartMaterials`。芝のmain保存地点 `7e533d3` の後、全体candidate v14として専用poolを接続した。geometryを作るsceneryは変更しない。

## 固定34の局所確認と残る検証

固定34 `workshop-20260909-193b42164378`、全体candidate `mystic-island-shore-garden-v14` を固定33と同じphone/tablet画角で比較した。[局所監査と前後4画像](roof-v14/README.md)では両幅×前後4行PASS、全capture152 draw、camera一致、全store/source/QA保持、error 0、browser終了。rootの実画像確認で二重の黒線が消えて家の色面がまとまる改善を確認した。明示成熟fixtureの比較で、実獲得や子どもの行動の証拠ではない。

guard・丸端の色面・texture連続性・実builderへの到達・clone復元/pool退役を含む関連4 files / 28 testsと型/build/assetsはPASS。34の全unit・lint・正式80run・通常smoke・CIは未実施で、33やcommit `7e533d3` の合格を転用しない。実立体の丸端瓦にはしておらず、source A全体の素材/構図、砂帯/崖、横長に増える島の見え方は残る。局所改善の確認と公開品質を分け、source A全面parity HOLD・独立した理解/動機の観察 N=0・Full Goal Activeを維持する。
