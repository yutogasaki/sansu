# 保存済みの粗形を全島へ接続

2026-10-12。細部の制作を先行させず、森林stage4と大樹の実階段v5を、丘・水庭・入り江と同じ `GrowingWorld`／所有物layerへ接続した。候補は `native05-whole-rough-v1`、固定buildは `authored-whole-c5`。対象はDEV `/prototypes/place-qa/authored.html?art=whole`。通常配布のnative flagはfalseで、本人保存への切替ではない。

[全景・回転・phoneと完成像の比較](review.html) · [版・flag・証拠](evidence.json)

- 森林4所有物と回廊1を実全景に表示。元の35所有物・75配置権を保持する。
- 実GLBの統合テストで、通常の移動・収納による元形への切替と再接続を確認。予告は同じ実モデルを使う。上階の床・歩行・利用は未有効。
- coreは **615 files／5,323 tests、lint・型・build PASS**。入力は前後一致。[生ログ](core/execution.log.txt)・[報告gzip](core/report.json.gz)。最初は隔離候補に参照文書が足りずdocs検査で停止し、参照先を追加した。[初回記録](core/first-docs-failure.log.txt)を保持している。
- 実画面の全景・回転・390幅を確認。編集はl14移動後もgalleryが残るとしたdriverの誤期待で停止。[原結果](runtime/report.json.gz)と[原因分類](runtime/failure-classification.md)を保存した。移動でP02が不成立になりgalleryが消えるのは現在の条件に沿う。収納・復元のUIは未到達。

**この候補に残る通行障害。** 森林だけでは35所有物すべてに到達するが、回廊を足すと入口床が既存の道を塞ぎ、22所有物へ行けなくなる。[四条件の切り分け](route-diagnosis/summary.json)と[実world／実モデルの生結果](route-diagnosis/report.json.gz)で、原因を階段入口に限定した。形を障害物判定から外して通過扱いにはしない。支持床を加える診断では改善せず、入口の第1変形案も面反転で生成前に停止した。

美術は中央の大きな余白と地区の分断が残り **HOLD**。無説明の理解・安全は独立観察 **N=0**。runtimeはcore PASSだが通行障害と編集確認が残り **PARTIAL**。包括ゴールとM1は未完。葉の微小精度・三案比較・階段全rigの局所検査を、この修正より先に進めない。

利用者の追加指摘に従い、次は固定所有ID・座標に依存する美術を通常の配置・成長へ追従させる。地区取得による輪郭差と、同じ土地内での場所の形の変化を分けて扱う。c5の固定一例はその実装の証明ではない。
