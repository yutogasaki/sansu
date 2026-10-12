# P02 v5 東寄り3/4近景

準備時点: 未描画。同じ粗形sceneを無補修、source visual/runtime HOLD。旧入口画像は保存済み。カメラとview名だけを変更し、geometry/material/可視mesh/道のshadowfalse設定をv5と揃えます。

実GLB433 meshes/589 nodesのPOSITION accessor min/maxを完全な階層world行列で変換し、各mesh primitiveの保守的boundsを投影。旧entryはl14/l28等の前景boundsとnear面が交差しました（camera原点が内部と判定されたmeshは0なので、原点内包とnear切断を同じ扱いにしていません）。最初の東側案も別木/地面のboundsとnear面交差があり、静的結果をhistoryへ保全。最終案は少し見下ろす東寄り方向[7.6,5.8,-6.7]→[3.6,2.3,-8.45]を定め、正投影の見え方を変えずその視線上でcameraだけ後方へ移動。全sceneの最前bounds深さ.5、near.1なので、全meshの保守的boundsよりnear面が.4手前です。camera内包0/near面交差0。正投影4.7、1280×925の枠にstairs/支持/rails全boundsが入ります。

これはexactな遮蔽可否や絵の読みやすさの証明ではありません。見える前景を削除・非表示にする処置はしません。枝支持・実踏面・入口・galleryの読みやすさは1枚の実物画像で判断します。原本source/material/mesh/影設定の許可外変化があれば停止します。CPU2/60sec/RSS2560MiB、Cycles16samples、fresh1回、retryなし。
