# 成長・有限ひかりの経済checkpoint

## 対象と出典

DEV `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true`、preview専用DB、fresh context、sound off。HEAD `2c75aa38d577fff9648597e3b0f18f76092f6b5b`＋実装差分、candidate `island-life-economy-checkpoint-v3`。phone390×844 / tablet768×1024（reduced motion）。明示した旧版の花1個・20時間前の6creditを使い、実学習による取得や本番切替の証拠とは区別する。

## 実画面と保存DB

両画面PASS。[report](report.json)、[critical-path contact sheet](contact-sheet.html)。source開始/終了SHA-256 `6c27e4b8743690ed2b7ac4911ce8d7769a7595be52c5a9e5ba94ae36f3c56693` 一致。

- 生の旧recordが原本backupと完全一致し、残高/個体/成長/price receiptを保持した版3へ切替。
- 6時間のDEV時間送りで、加速の残り4時間＋失効後2時間を積分し、有効約5時間になる。目安は単純な現在速度の割算ではなく、残る実約2時間を表示。
- 収納→6時間は成長量が同一。再配置→6時間で成熟、ID/しずくを保持。
- 有効利用のひかりは8で止まる。色を買って4へ減った後、24時間送っても4のまま。再読込でも予算0/色/成熟を保持。
- checkpoint原本/hash、credit、学習storeの不変と学習画面への復帰を確認。

## 単体・全体検査

`npm run verify:core` PASS: 366 files / 3751 tests、docs/lint/typecheck/build/assets、PWA precache10.79MiB/12MiB。既存Fast Refresh warning1件、error0。ログ `/tmp/sansu-v3-economy-core1.log`。

単体は0/3/6/12問の速度、24時間失効の積分/目安、収納、成熟、旧残高/外観/土地/実支払返金、遅延した旧区間の終端の補正、原本/hash/旧prefixの改変拒否、将来時刻の保存済みcredit、ID重複、transaction中断/全rollback/同一checkpoint再試行、同時購入/再送、owner分離を含む。初回の対象検査は旧「版3が未知」のassertionで1件FAILし、新版3対応・未知版4拒否へ更新した。回帰を隠すための閾値変更はない。

## 別々の判定

- 視覚: 成長の実モデルと目安/収納の表示を実画像で確認。世界は既存の表示で、C3への美術更新は次の作業。C3との視覚同等性や新世界の完成は主張しない。
- 無文字理解/安全: Human N=0。子どもの理解・意欲・教育効果は未評価。
- Runtime: このDEV経路とcore/transaction検査がPASS。土地追加/上限拡大、GP3巡回、B、production/PWA/offline/throughputを含む全releaseは未完。
