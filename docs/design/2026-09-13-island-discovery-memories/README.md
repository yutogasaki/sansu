# 思い出の一覧・再演・解除

[仕様50](../../product/50_mysterious_island_discovery_spec.md)の本人保存と自動履歴を画面で分離。「あのときの すがた」は元snapshot、「いまの島でみる」は現在の同じ個体を使う。M2の再演を接続した段階であり、他ルールの再演は本体描画とともに継続実装する。

## 対象と来歴

- 実target `http://127.0.0.1:5223`。`VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV`、fresh Chromium context、音off。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb` ＋未commit変更。Candidate `island-life-discovery-a-memory-v1`。
- source/public/package/viteのpath/NUL/content/NULによる開始終了hashは[report](report.json)。固定production/SW cacheの検証ではない。
- phone390×844とtablet768×1024（後者reduced motion）。各3問の実完了で得たしずくで花を購入。開花は明示的DEV24時間clock。保存満杯だけは独立した13イベントの明示的journal fixture。

## 実画面と検証

[参考画像とcritical pathの比較](contact-sheet.html)。現在の島の画角と家/住人/材質を保持し、本人保存は植物の小さな像で選ぶ。再演には当時の姿であることを表示し、原本の写真として扱わない。

- verify:core PASS: 356 files / 3693 tests、docs/lint/typecheck/build/assets。選択タブの未定義色tokenをmintへ修正した後に最終lint/build/assets PASS。
- 実UI: 学習3問→購入→若い葉の保存→開花→元の葉を再演→現在の花びら→収納→思い出保持/現在入口なし→解除取消/確定→学習/再読込。replay出典/元eventID、現在個体の育ち、actions/credits/firstPresented不変を照合。
- 満杯fixture: 12件を表示し、13件目の本人保存を拒否。既存12件不変を確認後、明示選択した1件だけ解除して13件目を保存する。
- 最初の実UIは両幅PASS。2回目は全体検証と並行中にM2の「のこす」待ちがtimeout。主要部分の可視1秒が不足した可能性はあるが、原因は未確定。しきい値を緩めず、診断履歴 `/tmp/sansu-v3-memory-runtime-2` を保持して全体検証終了後に再確認。
- ログ `/tmp/sansu-v3-memory-core.log`、`/tmp/sansu-v3-memory-runtime-3.log`。

## 非補償ゲート

- 視覚: 作者がphone/tabletの実画面を確認。全体美術の新規承認ではない。
- 無説明理解/安全: Human N=0。理解・意欲・学習効果を自動認定しない。
- Runtime: 単体/DEVの範囲の証拠。フルsmoke、production PWA/offline、throughputを含む全体release判定は未完。

残る仕様: R1/R3の視線と現在利用、集まりの表示記録、M2以外の再演、配置undo、24h成長/有限ひかり/土地checkpoint、B追加8品と残る魔法/出会い。

最終実UIは両幅PASS、開始/終了hash `af3b13d5679a5d575cf8347c5e0140dedfcc5b9386a26f2aa8ed789297d66b21` が一致。reportの `saved: 0` は実取得フローでの解除後の件数。後続の明示的満杯fixtureは12件→13件目拒否→指定1件解除→13件目保存で最終12件を照合する。
