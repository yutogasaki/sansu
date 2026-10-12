# c2実画面 — 丸い共有岸と低い殻

**全島の美術はHOLD。** c1で目立った矩形の展示台は解消し、低い殻と二軒の家を草地の半島につなげた。この局所改稿を基礎として保持し、次は中央の丘と森、家の密度を同じ全景で設計する。小物で裸の地面を埋める工程へ戻らない。

| 識別 | 記録 |
|---|---|
| 日付／証拠 | 2026-10-12／実browser screenshot、作者評価 |
| 対象 | `http://127.0.0.1:5355/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner` |
| build／visual candidate | `authored-cove-c2`／`native05-authored-cove-shore-v4` |
| 殻source | `native05-authored-cove-corner-v3`。殻のbyteはv3のまま、岸の改稿をvisual IDで区別 |
| 配布 | Island=true、nativeの通常flag=false。明示DEV routeのnative=true／cove=trueを実metadataで照合 |
| 今回の採点画面 | shape診断の1280×900全景・p9近景。全旅程の回転／小画面の結果は別途記録 |
| 保存／cache | 保存済み合成32所有物／8軒、fresh DEV context、SW登録／制御なし |
| 信頼範囲 | この2構図の輪郭・素材・読みやすさ。本人保存、実機、子どもの反応を推定しない |

[採用した完成像](../../2026-10-10-island-final-3d/whole-island-render.png)と、[c2全景](shape/desktop-mature-whole-day.png)、[c2近景](shape/desktop-cove-close-day.png)、[c1の実全景](../c1/shape/desktop-mature-whole-day.png)を比較した。版と入力は[shape report](shape/report.json)、coreとの照合は[proof](shape-proof.json)に保存する。

rootの同じ六軸での全島評価は **38/60**：入りたさ7、人物への親しみ7、素材7、構図と奥行き6、色の焦点6、出来事への期待5。c1の37から構図のみ1点改善した。別agentの批評は **35/60（7／5／5／6／7／5）**。採点者の尺度差を平均せず、どちらも各軸8の条件を満たさないHOLDとする。技術テストの結果を点に含めない。

- 改善：淡灰色の直線と角が消え、入り江の岸として読める。低い殻の内側、左右の家の橙・青の屋根、入口の支持が分かれる。追加草地の色は既存の草地へほぼつながる。
- 局所の残件：殻の手前・左に旧外周に沿う細い継ぎ目が見える。新しい草地と岸壁は均一で、採用像の土・葉・浅瀬の手触りに届かない。入口前の余白も広い。
- 主な残件：中央の裸の丘、右の大きな平面、離れた樹冠、太く角張った道が格子を見せている。採用像のような重なる森林の面、段階的な高さ、家を囲む内側の空間が不足する。大樹の回廊も未完。

独立した無文字理解／安全の観察は **N=0、未評価**。作者や実装agentの批評を参加者の観察に数えない。runtimeは固定coreと2画面の限定診断がPASS。全編集旅程はp9を(4,-4)へ移した後、24 ownerへの接近が不成立でFAILし、[初回失敗](full-first-failure/report.json)を保持した。既存回帰は未開始。固定stateの再現で、検査が合法だが主路を塞ぐ移動先を選んだと確認した。c2を全runtime PASSへ読み替えず、検査修正版は別の固定候補とする。通常false buildの容量PASSは、この明示DEV候補の本人保存／offline／更新・実機性能の合格ではない。
