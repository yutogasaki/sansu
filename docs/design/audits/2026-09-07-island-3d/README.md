# 不思議な島 — 3D方式と品質の再検討

実装とローカル検証を完了。[28仕様](../../../product/28_mystic_island_spec.md) のProcedural 3D qualityと、ユーザー追加の大胆な色彩・幻想性を実装した。[実装前後と全ループの比較](review.html)、[実回答の録画](evidence/actual-learning.webm)を参照。ゲーム・学習・保存を維持し、実画面で形・接触・生命反応・配置・負荷を確認した。

## 比較対象

- before: revision `aa36adad7dcc-island-learning-99d08b2a0e4c`、world `mystic-island-three-v1`、learning `mystic-island-learning-v2`。
- before実撮影: `output/playwright/island-3d/before/critical-path/` の16画面とcapture report。両サイズで通常plannerの実回答・報酬・配置・住民使用・再開を実行、PASS。
- before実装29ファイルは `output/playwright/island-3d/before/source/` に固定し、前回build-sourceのSHAとの一致を確認。実行対象との誤混在を避けるためコピーしたテストの拡張子だけ`.snapshot`を付けた（内容は同一）。
- after revision: `aa36adad7dcc-island-3d-a427ea0225cf`、source SHA-256 `a427ea0225cf302b2fc1eee0036c98856f922f080a79a6c51ef9463d228272b2`。
- after candidate: `mystic-island-procedural-v2`、art direction `moon-garden`、delivery `mystic-island-v1`、learning `mystic-island-learning-v2`。
- 実target `http://127.0.0.1:5299/#/island`、固定artifact `output/builds/island-3d/aa36adad7dcc-island-3d-a427ea0225cf`。flags: Island/BuildPlay有効、Park renderer three、Island art moon-garden。manifestと全sourceの対応は `output/playwright/island-3d-production/build-source.json`。

## 方向の継承

| 継承する | 継承しない |
|---|---|
| 海・草・砂の読みやすい大色面、暖色の木と灯り | 前版の自然色に限定すること、均一な砂の輪、継ぎ目の強い幹 |
| カワウソ/ウサギの配色と顔、広い手前の庭 | 細かな木目・葉・装飾の量で品質を上げようとすること |
| 同じ島で問題→光→対象の反応→家具→暮らし | 支柱/根元まで伸縮する反応、動物と座面が別々に動くこと |
| 既存の予約・保存座標・配置領域・歩行経路 | 地形の見栄えのために獲得済み家具を移すこと |

追加のユーザー指示を受け、ロメロ・ブリットの大胆な色面と輪郭、草間彌生の水玉を参考に、既存の島を幻想的な配色へ変更。固有の作品は再現せず、屋根の分割面と樹冠/きのこの局所模様へ取り入れた。どうぶつの顔や算数図形の意味色は保持する。

実runtimeの390×844/768×1024で3案×home/learning=12画面を比較した（`output/playwright/island-3d/palette-candidates/`）。緑・赤中心の`festival`は明快だが自然色が優勢、青緑の`prism`は海と葉が近く、紫の木/黄色とピンクの屋根/青い海/ミントの地面の`moon-garden`が最も幻想性と対象の分離を両立したため採用。これは実装者の視覚評価で、子どもの観察結果ではない。

## 部位ごとの技法判断

現候補はThree.jsのコード生成を採用し、Island用のGLB/Blenderアセット読み込みは導入していない。`geometry.ts` の寸法・断面と各部位の接触点を直接調整でき、既存の配置範囲と反応を保てることを採用理由とする。配色は `worldPalette.ts` の `moon-garden`。実phone/tablet画面で、紫の樹冠、ピンク・黄・青の屋根、青い海、ミントの地面を比較して判断した。

| 対象 | 現実装・実画面の所見 | 採用した方式と理由 |
|---|---|---|
| 島・地形・崖・砂浜 | 草の縁、幅が変わる砂浜、露出した紫系の岩断面を分けた。広く平らな庭は残る | 外周と層をBufferGeometryで生成。保存済みの配置ellipse全域を高さ0の地面で覆いながら、岸の断面だけ調整できるため採用 |
| 道 | 浅い石の輪郭と向きが不揃いになり、家から庭への道が読める | seedによる決定的な輪郭変化とbevel付き押し出し。歩行面からの高さを小さく保てる |
| 家 | 壁・土台・窓枠の角を丸め、屋根を一つの厚い断面にした。大きな分割色面と濃い縁が家の形を支える | RoundedBoxとExtrudeGeometryを採用。屋根面のUVを整え、コード生成の模様を広い面へ載せる。構造と塗りを同じ寸法で調整できる |
| 木・茂み | 根と幹を一つの断面形状にし、枝は根元を幹へ埋めて接続。6つの変形した樹冠に紫系の色面と局所の水玉を載せた。丸い塊の集合という様式は残る | 連続した根/幹のloftと変形楕円体を採用。接地・既存構図・灯りの位置を維持して形を改善できたため。茂みは既存の小さな塊を保持し、配色を合わせた |
| 橋・桟橋 | 丸い板、橋の下桁、手すりの接続を整理。桟橋の杭は水面より下まで伸ばした。橋下には土地が残る | 既存の橋の高さと歩行経路に合わせたコード部材を採用。橋下の土地は保存・歩行領域と重なるため削っておらず、GLB化でもこの制約は解消しない |
| ベンチ | amberの背板、pinkの座面/肘、navyの脚を分け、座面に厚みを持たせた | 丸い板の寸法生成と共通seat anchorを採用。住民の接触面を見た目と同じ位置から算出できる |
| ランプ | 台座、筋交い付き支柱、横木、濃色の笠と吊り灯具が一つの家具として読める | 断面回転と丸い部材で配置半径内に収めた。発光部と到着anchorを独立させ、支柱を伸縮させず反応できる |
| 花・植物 | 高さの異なるcream/pink/yellowの3株と低い葉床。厚い円形台を除き、茎の接地を残した | 花弁・葉・茎を別groupにしたコード形状。花弁と葉の短い応答を、根元や家具全体の移動から分離できる |
| ブランコ | amberのA字脚、pinkの梁、濃い座面を維持。座面とロープが住民と一緒に揺れる | 共通pivot・位相・座面anchorを採用。剛体の部材構成で接触を共有でき、skinningを必要としない |
| きのこ椅子 | 黄の丸い傘に濃い水玉。中央に小さな平らな着座面を設けた | 傘/軸の断面回転と共通seat anchorを採用。輪郭と接触高さを明示でき、模様は独立した塗りとして保持 |
| 噴水 | 厚い水盤、中央の台、短い水と波紋を分けた | 回転断面の石部分と別材質の水を採用。水/波紋だけを反応させ、水盤と接地を動かさない |
| 小石・草・小物・灯台 | 疎な配置を維持し、岩や灯台の色を新しい世界へ合わせた | 既存の簡潔なコード形状を保持。背景の役割を果たす部位へ追加の造形密度やモデル読み込みを足していない |
| ウサギ | 長耳・細身・既存の顔を維持。肩を支点にした腕と、着地/持ち上げを分けた足の動きにした | パーツごとのrigと座面接触をコードで共有。現在の短い反応と歩行に必要な関節を明示できる |
| カワウソ/キツネ | カワウソの口元・小耳・胴と先細りの尾を調整。キツネの識別色/尾を保持。球状パーツによるマスコット表現は残る | 同一性を保つ寸法調整と共通rigを採用。連続した皮膚の変形や細かな表情用のskinningは実装していない |
| 光/生命反応 | 実際の花・灯り・木のanchorへ光が届き、花弁/葉/発光部が応答。木の根・幹や家具の支柱は動かさない | 保存receiptの既存時計と局所groupを採用。次の入力と並行する因果を、家具全体の拡縮なしで維持できる |

Blender/GLBを導入しなかった理由は、今回の固定された構図・剛体の部材・短い局所反応を、寸法と接触点の共有で扱えたためである。一方、根から枝まで継ぎ目なく分岐する有機的な面、頬・肩・腰の連続した皮膚、複数姿勢のskinningや細かな表情、作者固有の非対称な有機家具には、Blenderの造形・リグ制作に利点がある。現行の根/幹一体化は、その高度な有機形状や変形まで実現したものではない。現候補の形をGLBへ包み直すだけの制作・読み込み・キャッシュは追加せず、この限界を残したコード生成版として採用した。

## 技術の根拠

寸法や断面から形を作る機能はThree.jsの [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) と [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html) を参照。BlenderのglTFは [形状/骨格アニメーションを扱える](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html)。今回のstatic batchingは色面を頂点色へまとめ、模様のある材質はUVを保持するよう変更。将来のskinned GLBは独立した描画groupとして統合する必要がある。技法の採用理由は一般論だけでなく上記の現コードと実画面から判断した。

## 確認するゲート

- 視覚: phone/tabletで島・どうぶつ・各家具の識別、素材の違い、密度、接地、前後比較。
- 操作と生命反応: tap/drag/矢印/回転/取消/保存/再開、家具と住民の共通anchor、光の着地と局所反応。無音とreduced motionでも状態を保つ。
- runtime: input/P95/追加0tap、正式固定10問、既存回帰、PWA、描画呼出し/triangle/geometry数/CPU描画時間/preview作り直し数/非表示時停止。性能は実測条件を明記し実機電池の代用にしない。
- 独立した子どもの観察と公開昇格は別の未検証ゲート。技術PASSで視覚や理解を代替しない。

## 実装とレビューの記録

- UIの主操作は黄色＋濃紺、決定キーは青＋白に統一。問題/keyの寸法、全入力形式、図形の意味色は維持。主文字12.42:1、補助6.59:1、主操作9.18:1、決定6.35:1のコントラストを確保。
- 128×128の模様3種を共有し、static batchでUVと素材差を保持。水/金属のroughnessは色だけのbatchへ潰さない。家具のghostはモデルのidentityを保ち移動/回転し、共有textureは取消で破棄しない。
- 家具の元モデルを編集時に隠し、同じ物を掴んで移動する表現にした。レビューで取消/同位置保存後の住民が座面へ埋まるケースを発見し、元の家具と使用状態へ戻す処理を追加した。
- 光は花/灯り/木/噴水の実anchorを参照。花弁/葉、灯り、吊るした星、水/波紋が応答し、根・支柱・水盤のルートは固定する。
- 別担当がbefore/afterのphone/tablet実画像をレビューし、大色面・幻想性・小画面識別・幹/屋根/岸の改善を確認。カワウソの正面はまだクマ寄りで、横から見た胴/尾ほど種が明快ではない。これは今後のキャラクター表現の限界で、GLBを必須とする破綻は見つからなかった。
- `verify:core`: lint/typecheck/117 test files・1268 tests/build/assets PASS。最初の実行はbeforeテストコピーの誤収集だけで1suite失敗（当時の現行1266件はPASS）。コピーの拡張子を修正して全coreを再実行した。検査設定や本番テストは緩めていない。

## 最終sourceの正式固定10問の比較

`output/playwright/island-3d-production/throughput/latest.json` は80レーン・2サイズ・各10反復、`pass=true` / `evidence.eligible=true`。検査中のsource不変、production固定artifactとの共通434sourceのSHA一致と配色moon-gardenを `throughput/source-correspondence.json` に記録した。DEVの同じサーバーでStudy/Islandを交互に操作する固定問題・reduced motion・音offの比較であり、通常production plannerの真正性と子どもの速度を示すものではない。初回e05fの診断も別フォルダーに保全している。

| 指標 | before phone / tablet | after phone / tablet |
|---|---|---|
| 正解から入力可能 P95 | 194.2 / 195.4 ms | 193.8 / 194.1 ms |
| 再試行 P95 | 193.4 / 193.6 ms | 193.7 / 192.5 ms |
| 自動入力の問題数/分 | 274.49 / 273.89 | 274.41 / 266.05 |
| after Island / Study throughput | — | 2.235 / 2.164 |

意図した入力待ちは追加しておらず、速度は前版と同じ範囲。1分あたりの値には自動入力/観測の時間も含む。通常の問題間は追加0tap、全遷移の空入力、同問題再試行、atomic receipt、両サイズの全keyがPASS。

## 最終ビルドの3D操作と負荷

`output/playwright/island-3d-production/interaction/report.json` はphone/tablet両方PASS、32実画像、435共通sourceファイル一致、実行中source不変。native profile/memoryのみの隔離fixtureから通常plannerへ入り、ベンチ→ブランコ→花→きのこ→灯り→噴水を6区間の実報酬で獲得し、実UIで配置/使用/保存/再開した。

- 初回で、ベンチ(.25,.5)から灯り(-1,.25、90°)へ移る際、到着点が元のベンチ内になり、次のきのこへ出発できない不具合を再現。出発側の家具を通過できる処理を維持し、到着点は他の全家具から離れていることを検査するよう修正。同じ座標の操作で灯り→きのこへ進むことを最終ビルドでPASS。
- 家具のtap/drag/矢印/4回転/無効位置→復帰/取消/同位置保存/移動保存/reload、元模型非表示、保存前のDB完全不変と保存1receiptがPASS。ドラッグ各23実フレームで模型UUID、geometry/texture数が一定。
- 正解の光が花と灯りへ届く実フレームで、対象の花弁/葉/発光だけが変わり、家具root scaleは1のまま。誤答と支援は成長反応を発生させない。次のキー入力は反応中にも可能。
- ブランコは住民と同じ位相で座面/ロープが揺れ、reduced motionで同じ座面に静止。画面外では描画増分0。
- 噴水の自動候補(-2,2.5)は動物の通路が不足したため、到達可能な(2,2.5)へ実タップして配置。合法な家具配置すべてが動物の通行可能性を保証する仕様には変えていない。理由・候補・経路をreportに保存した。

| 状態 | draw calls | triangles | geometry / texture | 計測窓の描画 |
|---|---:|---:|---:|---|
| 初期島 | 83（before 80） | 79,304 | 83 / 5 | 静止1.4秒で0frame |
| ベンチ＋ブランコ使用 | 97 | 98,024 | 104 / 5 | 1.4秒で27frames |
| 6家具・拡張・灯台 | 129 | 117,068 | 136 / 6 | 1.4秒でphone28/tablet25frames |

Chrome/ANGLE SwiftShaderのソフトウェア描画。active描画処理のCPU P95は0.5msだが、これはGPU完了を待ったframe時間ではない。CDP TaskDurationは最終島1.4秒窓で873/957ms（QA観測・ソフトウェア描画を含む）。30fps上限とオンデマンド停止、資源の再利用は確認できた。モバイル実機のFPS・電池・熱の保証には扱わない。

## 最終の回帰と独立ゲート

- `verify:core`: 117ファイル/1268テスト、docs/lint/typecheck/build/assets PASS。PWA precache 10.55MiB / 12MiB。
- production学習: 21ケース/127実画像/実回答動画、算数の数値・選択・小数・分数・筆算・英語、全キー、支援、連打、短画面、WebGL復旧PASS。最終source/manifestと一致。
- production critical path: 起動→home→学習→光→実報酬→配置→住民使用→次の学習、2サイズ16画面PASS。各画像のbuild/delivery/candidate/artを照合。
- Island PWA: 更新保護4ケースと実Service Workerのoffline reload・回答保存・同plan再開PASS。Classicのflag無効別buildもPWA4ケースPASS。
- 既存Island DEV: 全11ケース/54画像PASS。112実経路sample、4/6区間の実成長、プロフィール分離、復旧を含む。
- 共通smoke: 最終単独実行31/31 PASS。並行中の別実行ではRoot Pullの入力前とpending attempt直後の離脱で2件timeout/disabledを検出し、最初の実行ではroot-tangle再試行待ち1件が失敗した。単独ではすべて再現せずPASS。新attemptのDOM出現と保存/キー有効の待ちが一致しないraceがコード上の原因候補だが、確定した原因として扱わない。検査を緩めず、app/tool sourceも変更していない。初回のログは保持。
- 最終sourceは564 build入力ファイル一致。前版との差分は島の3D/島専用CSSとUI/表示candidate metadataのみで、学習・保存のdomainファイル変更0（[差分一覧](evidence/source-diff.json)）。

| ゲート | ローカル判定 | 根拠と限界 |
|---|---|---|
| 視覚の魅力 | PASS | 作者と別担当が実phone/tabletを確認。大胆な色面、疎な柄、読める顔/家具、根/幹/屋根/岸の改善。作家性を完全再現したという判定ではない |
| 無音での操作・理解・安全 | 操作契約PASS / 子どもの観察は未実施 | 色以外の形/輪郭、全キー、支援、reduced motion、取消/保存、接地を検証。自発的再遊びや無説明理解をAIレビューから推測しない |
| Runtime | PASS | 同一候補の実planner、atomic保存、全6家具、経路、全入力、PWA、正式80lane、資源再利用。実機電池/熱は未評価 |

公開先への配布はこの作業の対象に含めていない。ローカル完成物を確認できる状態で保持した。
