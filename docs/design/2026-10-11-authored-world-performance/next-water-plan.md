# 次のM1制作：斜面の水庭と実床

コードを変更しない調査で特定した次工程の入力。**候補の実装順であり、現在のAPI・水庭・保存の実装済み契約ではない。** 仕様の正本は[共通世界](../../product/island-world-contract.md)、[52](../../product/52_growing_island_game_spec.md)、[13](../../product/13_data_storage_migration_spec.md)。次の制作前に必要な差分をそこへ確定する。

原本にある三段の水庭・流れは共通世界へ抽出されておらず、現在の床10面はgroundだけ。P03の5水ownerも低地のshore配置で、原本の斜面三段泉の位置と異なる。現在の取得地点はowner anchorとdry歩行床を兼用し、水で床を覆うとcompilerが拒否する。取得地点を削ると権利と接続も失われる。

1. 別candidate/versionで、同27 ownerの斜面配置・実支持・water連結・全ownerへの接近を先に小診断する。原本水庭の領域には取得点が9個だけあり、pool中心に5ownerを置くだけでは整数隣接が成立しない。73取得権を保持し、床の見た目だけで配置権を増やさない。
2. 固定の取得権・owner anchorと、現在のdry ground/deckによる支持を分ける。wetの取得権とwater/join endpointは保持し、通常配置と歩行を拒否。実deckのある点だけ通行を戻す。内陸池で海岸判定が変わらないよう外海の分類とP03高さはimmutable baseを読む。
3. raw owner・成熟・base water grantsから純粋なWaterPlanを作り、地面を切り抜き、水底・三段水面・岸・流れ・deckを一つの世界へ合成する。垂直な岸壁・滝は非支持surfaceとして扱う必要がある。最終の場所計算は合成後に一度だけ行い、成熟判定と水の有無が相互に反転する循環を避ける。
4. 地形・道・owner描画・life・配置が同じ合成frameを読む。移動・分離・収納はbaseから再合成して乾床と単品を復元する。将来previewは別frameで保持し、取消でcommitted地面・経路へ戻す。本人保存と通常navigationへ導入しない。

取得権と支持を分ける小APIは、全sitesとは別のwalkSites、固定anchor照会、水面/水底をfloor IDで照会する方法を候補とする。現在のfloorAtの「乾いた足場」という意味と旧本体の互換を維持する。既存pond maskは歩行を避ける装飾用で、実地形の切り抜きにそのまま使わない。

主な実装箇所はworldTypes/worldDefinition/space/commands、純粋な水形合成、places/placeTerrain、authoredGrowingGround/worldScene/GrowingWorldと泉・池の描画。回帰は73権利保持、wet配置/歩行拒否、実deckだけ通行、三段の高さと接続、全27 ownerの接近、収納/分離後の原本床一致、preview取消/確定のgeometry一致を中心にする。実画面では採用原本の全景と水庭近景を比較し、美術HOLDを別に判定する。
