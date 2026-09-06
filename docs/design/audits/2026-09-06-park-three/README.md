# ちいさな遊園地 — Three.js 実画面監査

2026-09-06。実装候補 `park-three-resin-v1`、配信ID `build-play-v1`。本番公開は行っていない。

## 確認する

- 実アプリ: `http://127.0.0.1:5188/#/park`。
- 旧表示: `http://127.0.0.1:5188/?parkRenderer=legacy#/park`（DEV）。
- [起動・ライブラリ・変更ファイル・座標](../../park-three-runtime.md)
- [初期・配置・A/B・制作経路と動画](contact-sheet.html)
- [Aの録画](A.webm) / [Bの録画](B.webm)

## 対象と証拠の種類

実際のアプリのHTMLボタンで再演。A/Bの画像は、同じテストプロフィールの所有部品を配置UIで交換して撮影した。動画はそれぞれ新規のテスト用ブラウザコンテキストで、同じsimulationとモデルを再生したもの。Aは約7.4秒、Bは約9.4秒。完成イラストや別の紹介ページの録画ではない。

DEVのbuild revisionは `4102126-park-three-review`。`VITE_BUILD_PLAY_ENABLED=true`、`VITE_PARK_RENDERER=three`。実際のstageの `data-art-candidate=park-three-resin-v1` を検査。新規ブラウザコンテキストから起動し、画像とJavaScriptを読み込んだ後に撮影。WebGL fallbackはstage自身の旧候補属性で区別する。page属性は要求された表示候補を表す。

元の作業ツリーは未コミットのまま保持。検証用のdetached worktree commit `095a158` とアプリのsource/public/config 507ファイルが一致するSHA-256を [provenance.json](provenance.json) に保存。通常ビルドとflag有効のローカルproduction previewを区別して検証した。公開サイト・インストール済み実機の変更を意味しない。

## 三つの判定

| ゲート | 判定 | 根拠・残り |
|---|---|---|
| 視覚的魅力 | 候補として実装・自主確認済み。最終承認HOLD | 実在するref-01の色・顔・素材を参照。厚い曲面、開口、木、可動関節、薄い泡を実装。独立した美術承認はない |
| 無文字理解・安全 | 観察HOLD | 実装者はA/Bの通過・飛び越し・着地・泡を確認。子ども等5人の無説明観察は未実施で、4/5達成とはしない |
| 実装整合 | 検証したローカル条件でPASS | 下記のdomain、UI、学習、保存、PWA、offline、lifecycle検証。実機の性能・耐久は未判定 |

実画面を用いた実装者の美術自評: 世界8 / 人形8 / 触感8 / 構図と奥行8 / 色9 / 出来事8 = 49/60。作者の自己評価であり承認の代用ではない。画像参照にある微妙な成形面・柔らかな接地影・関節の一体感には磨く余地がある。別の探索cold-openで使った52/60はこの遊園地の承認済みbaselineではない。技術PASSで美術HOLDを解除しない。

## 実画面を見て直した点

1. 初回の光が強すぎて樹脂・木が白っぽかった。照明、樹脂色、木の反射・grainを調整。
2. 踏む面が白く穴に見えた。面の色を分け、複数の半径リングで沈む曲面にした。
3. 人形の基準高をphoneで約61.5pxから約64.3pxへ調整。目も拡大。泡は中心をほぼ透明に保った。
4. React StrictModeのeffect再実行でcontext lossが発生していた。接続中canvasをforceContextLossしない破棄へ修正。
5. 配置中は舞台を低くし注視点だけ下げ、3部品と3位置をスクロールせずタップできるようにした。角度・人形尺度を維持。試遊中はジャンプの余白を戻す。

## 実行した検証

| 検証 | 結果 |
|---|---|
| `npm run verify:core` | PASS。docs/lint/typecheck、104ファイル・1,106テスト、build、assets |
| `npm run e2e:smoke` | 31 PASS。既存のStudy、Explore、設定、保護ルート等 |
| `npm run e2e:park`（candidate指定・Metal） | 6 PASS。初回、制作、誤答、支援、中断と再開、保存、プロフィール分離、分数multi、算数choice、筆算、英語4択、reduced motion |
| `npm run e2e:pwa-update` | 4 PASS。実Service Worker版差とcheckpointの回帰 |
| `npm run e2e:park-pwa`（5288 preview） | 3 PASS。未完学習のcheckpoint、保存hold、旧active run優先 |
| `node tools/e2e-park-three.mjs`（Metal） | PASS。両viewportのA/B・実UI交換・スクロール不要の44px以上の操作域・停止と再演・reload・制作見本から学習・6位置保持 |
| 同3Dスイートの失敗系 | PASS。WebGL2不可、実context loss、module読込失敗で旧表示。700msのメインスレッド停止後も泡の最終状態・学習非更新を維持 |
| `choreography.test.ts` | 6 PASS。64配置の境界連続性、Aのgate clearance、Bの泡と接地、同位置hop、連続ゲートと地上終了の泡保持、着地先の反応、未対応のfallback |
| モデルのcamera frustumサンプル | A/Bの通常・制作見本・編集、phone/tabletで5,252サンプル。人形と泡の画面外0。幾何監査であり独立した美術評価ではない |
| `node tools/e2e-park-three-offline.mjs` | PASS。実SW制御下でoffline reload、Three.js chunk、47個のUI/fallback素材、再演、学習。学習画面canvas=0 |
| `npm run benchmark:fixed-ten`（clean worktree） | PASS、`evidence.eligible=true`、`pass=true`。全4条件×10反復、必要サンプル各20 |

固定10問はStudy / 旧Exploreの回帰検証であり、遊園地学習の実測や通常planner真正性の代わりではない。Study中央値125.7問/分、Explore中央値264.9問/分、比2.108。Explore冒頭正答→次操作P95 140.5ms、同問再回答P95 447.4ms。最初のdirty treeでの実行は技術条件のみPASSで正式採用せず、最終clean worktreeの [fixed-ten-report.json](fixed-ten-report.json) を採用。

初期のSwiftShader実行は高負荷で時間切れになった。成功扱いせず、実GPU名を確認してMetal条件で再検証した。また再演テストが前回の「もういっかい」を完了と誤認したため、新しい停止ボタンを待ってから完了を判定するようharnessを修正した。

## 性能の実測条件

Apple M4、ANGLE Metal、Playwright Chromium 145.0.7632.6、headless、音OFF、CPU throttleなし、1回ウォームアップ後にBコースを3回測定。計測中の録画・スクリーンショットなし。端末エミュレーションのDPR=2、rendererの実DPR上限1.75。実際に増加するrenderer frame counterをRAFで観測した更新間隔で、GPU timer queryや実ディスプレイの表示完了時間ではない。

| viewport | 描画バッファ | 3回の平均更新fps | 最大のP95間隔 | 人形基準高 |
|---|---|---|---|---|
| 390×844 | 682×612 | 74.97〜74.98 | 14.3ms | 64.25 CSS px |
| 768×1024 | 1050×787 | 約74.97 | 14.1ms | 98.85 CSS px |

各測定で33.34msを超えた観測間隔0。静止状態500msの追加描画0。代表の終了フレームは148 draw calls、107,114 triangles（shadow passを含む）、33 geometries、5 textures。3D bundleは約573kB、gzip約149kBで遅延読込。PWA precacheは135ファイル、10.41MiB / 12MiB。

[performance.json](performance.json) に各反復の値。[report.json](report.json) 内の1回測定はDPR=1の補助値なので、上表と混同しない。iOS/Androidの30fps達成を意味しない。SwiftShader・古い端末・発熱後の性能保証はしていない。

## 未確認事項・改善余地

- iOS/Android実機の30fps、Safari/WebKit、インストールPWAの長時間使用・発熱・2ビルド更新。
- 子どもが自発的に配置を変えるか、無説明でA/Bを理解するか、学習を挟んで再訪するか。
- 最終美術承認。今回の候補は参照未承認として残す。
- 指定の26添付本体の照合。実装契約は依頼本文。
- Three.jsだけで今回の造形・曲面・可動部・薄い泡・規則の演技・組替え・接続は成立。人形の頭、手、靴、関節をさらに繊細に整える場合はBlender製の人形だけを差し替える余地がある。全素材GLB基盤は未導入。

公開反映、remote push、ユーザーの部品付与や作品変換は行っていない。
