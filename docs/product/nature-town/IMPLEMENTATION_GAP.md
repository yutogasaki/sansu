# Nature Town v0.2 implementation gap

2026-09-16。添付仕様を新しい独立試作へ採用。旧Lifeの本番既定・作品・通貨は保持する。

| 接続 | 現物 | 方針 |
|---|---|---|
| runtime | React 19 / Vite 7 / Three 0.185 / Dexie 4 | 既存依存を利用 |
| 旧世界 | domain/islandLife、SansuIslandLifeV1 | 新DB SansuNatureTownV02、破壊的移行なし |
| 学習正本 | db.islandPlans / islandEvents | 完了済み予約の全slotと成功イベントを照合。予約1区間を1 checkpoint / 1単位として読取専用で再取得 |
| 学習支援 | supported-completion / assisted-correct | 同額。習得/SRSをゲームから変更しない |
| 学習開始 | /island?start=learn | 既存UIに接続、世界を停止。戻る導線を追加 |
| 個体美術 | LifeResidentPortrait / residentRig / buildHomeJourney | 既存3種の実モデルを再利用。新規キャラ生成なし |
| 経路 | 旧Lifeは連続座標・固定配置 | 16セル格子の純粋コアへ分離 |
| 保存 | Dexie、既存PWA critical persistence hold | 原子的snapshot＋前版、チェックサム、単一writer、明示復旧 |

既存の「1問1しずく」と新しい「完了予約1区間1単位」は別契約。過去の旧通貨を変換しない。開始時点の既存完了IDを基準として、新規の完了区間のみ反映する。開始後に完了した途中予約は対象にできる。

## 表示方針

S1のルールと操作を検証する独立した地図試作。既存美術の全面置換・本番切替はしない。世界の実在庫と座標を描画し、既存キャラの実モデル肖像を保持。正式な美術合格・無文字理解・教育効果は未判定。
