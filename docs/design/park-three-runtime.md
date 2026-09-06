# Three.js 遊園地表示候補

候補ID `park-three-resin-v1`。参照未承認（実在する参照画像は確認したが、今回の候補の独立した美術承認はない）。2026-09-06の追加ユーザー依頼により本番公開の対象となった。公開許可と独立美術承認は区別する。

## 開く・戻す

- 本番対象: `https://sansu-seven.vercel.app/#/park`。VercelのbuildCommandで両flagを有効化する。公開版のrollbackはrendererを `legacy` にして再ビルド・配信する。詳細は [PWA release runbook](../runbooks/pwa-release.md)。

リポジトリで `nvm use`、必要なら `npm ci` の後、次で起動する。

```sh
VITE_BUILD_PLAY_ENABLED=true VITE_PARK_RENDERER=three SANSU_BUILD_REVISION=4102126-park-three-review npm run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

- 実アプリ: `http://127.0.0.1:5188/#/park`。既存プロフィールがなければ通常のonboardingへ進む。
- 旧表示: DEVでは `http://127.0.0.1:5188/?parkRenderer=legacy#/park`。逆に `?parkRenderer=three#/park` で候補を選べる。URL overrideはDEV限定。
- ビルドでの切替: `VITE_PARK_RENDERER=three`。未指定または `legacy` で旧表示。`VITE_BUILD_PLAY_ENABLED` は既存の起動先flagで、表示候補とは別。
- ローカルproduction preview: 同じflagを付けて `npm run build` 後、`npm run preview -- --host 127.0.0.1 --port 5288 --strictPort`。ルートは `http://127.0.0.1:5288/#/park`。
- 3位置かつslide/trampoline/bubble/nullのみが3D対象。4〜6位置、mat/bell/paintを含む作品、WebGL2不可、context loss、lazy module読込失敗では旧表示に戻す。保存内容を削除・変換しない。
- 初期所有は既存どおりすべり台1個・トランポリン1個、3位置目は空き。A/B監査のgateは新規テストプロフィール専用fixture。ユーザーデータに付与するDEV機能は追加していない。
- 遊園地を起動先にする場合、未登録の初回画面も「ちいさな遊園地」と同じstageになる。「はじめる」→名前→学年→教科→開始範囲→自分の遊園地を実UIで確認する。歓迎画面は静止し、登録フォームへ進むとrendererを破棄する。profile/開始レベル/学習保存の処理は変更しない。旧探索を起動先にする汎用buildは従来の歓迎画面を維持する。

## 参照と採用判断

`art/park/reference/ref-01.png` を実際に開いて確認。23〜25資料は既存の制作資料として読み、今回の表示方式は2026-09-06ユーザー依頼本文で上書きした。指定された26添付本体はworkspace・Downloadsで見つからず、本文を実装契約として用いた。

| 項目 | 採用 | 採用しない |
|---|---|---|
| 人形 | 豆形の青紫の頭、片側の丸い突起、クリーム顔、低い目線、丸い靴 | ポッコ、既存黄色キャラ、球に目だけ |
| 遊具 | 厚いコーラル滑面、青緑枠、黄ゲート、木の支柱 | 余分な虹色、足を遮るゲート下辺 |
| 材質 | 半艶樹脂、柔らかい踏む面、明るい木、薄い泡 | 全体ベージュ、白濁、重い屈折、大量の泡 |

現行SVG/画像合成は機能監査資料。3Dの人形・遊具・台座は画像の板貼りを使わない。HTML用の静止アイコン3枚だけを同じThree.jsモデルから生成し、学習中はcanvasを置かない。

## 座標・接触・画角

旧BlenderのZ-upや画像pivotを流用しない。Three.jsの **+Xが進行、+Yが上、+Zがカメラ側**。台座の上面Y=0、`doll-path`原点は足元。1Uは人形の全高ではなく共通の造形単位。人形基準高1.296U、位置間隔1.75U、開始X=-1.35、終点X=4.72。台座はX=-1.745〜5.105。全3位置を固定の平行投影で表示する。

カメラは注視点から(4.5, 4.8, 9)方向。水平回り込み約26.57°、俯角約25.50°、ロール0°。表示幅7.1U。通常の注視点(1.68,1.25,0)、配置中のみ(1.68,.85,0)。人形尺度と角度を保ち、HTMLの部品棚を同一画面へ収める。通常stage高はphone350px/tablet450px、配置中240px/330px。制作見本の再生は通常の注視点を使う。

- すべり台: 入口は位置X−.55、Y=.88。出口は位置X+.72、Y=.07。厚さ約.07Uの押出曲面、太い縁、座る入口、4段、支柱。腰を局所ポーズで座面へ下げる。
- トランポリン: 足の接触Y=.23、最大沈み.105U。膜を半径に応じた曲面へ変形し、接触中の足の高さを同じ沈み量にする。腿・膝の2関節で足裏を保つ。
- ゲート: 実開口を持つアーチ、外高1.69U。XY面のアーチをY軸50°回して、穴と厚みを見せる。下辺はなく足が通る。
- ジャンプ: 高い軌道の追加高2.18U、弱い跳躍は.43U。同じ位置のhop、高いジャンプの飛び越し先・着地先はsimulationが決める。
- 泡: 半径.73U、中心は足元+.65U。Fresnel輪郭、中心alpha .009、少数の反射。depthWrite=false、屈折用の追加レンダーなし。着地以外の終了で勝手に消さない。

## 演技と状態の境界

`choreography.ts` は既存の `simulateCourse(layout)` が出すbeatを正規化した再生時間でサンプルする。A/B名の条件分岐や動画選択はない。64種類の3位置組合せでbeat境界の経路連続性をテストする。

`doll.ts` のpath rootとhips/body/head/arms/thigh/knee/feetは分離。歩く、段を登る、座る、しゃがむ、踏み込む、手足を開く、着地で沈む、立ち直る、手を振るを持つ。全身の上下動だけにしない。

| 動作 | 長さ | 接触・反応 |
|---|---|---|
| walk | 1200ms / 勢いあり760ms | 入口へ歩き、slideでは後半に登って座る |
| slide | 1450ms | 前半82%で座って滑り、最後に立つ |
| jump | 2100ms | 0–16%予備動作、16–23%押し返し、23–76%飛行、76%接地と泡消失、85%から回復 |
| hop | 1450ms | 同じ段階で小さく跳ぶ。位置は変わらない |
| bubble | 1050ms | 中央通過52%で付着。既に泡がある場合は継続 |
| finish | 700ms / 歩行あり1150ms | 立ち止まって収まる。地上で運んだ泡は残る |

アニメーションは正答・習得・部品付与を保存しない。planner、Due、weak、採点、支援、予約問題、所有・コース編集・学習transactionは既存実装を再利用。変更した親側処理は表示候補に応じた再生時間と表示属性だけ。再演完了の既存telemetryは学習とは別。

## ライブラリ・描画管理

- `three` **0.185.1**、`@types/three` **0.185.4**。React/Vite等の一括更新なし。React Three Fiber、物理演算、GLTFLoaderは導入していない。型パッケージの推移dev依存にRapierが含まれるが、アプリからのimport・物理実行・production bundleへの追加はない。
- WebGLRenderer、OrthographicCamera、MeshPhysical/StandardMaterial、ExtrudeGeometry、TubeGeometry、SphereGeometryの局所変形、RoundedBoxGeometryを使用。
- 影を作るDirectionalLightは1灯、1024²、PCFShadowMap。HemisphereLightと一度だけ生成するRoomEnvironmentを補助に使う。ポストエフェクトなし。
- DPRは1.75以下、描画バッファ最長辺1200px以下。Three.jsはstageでlazy import。
- 再生中だけRAF、静止中はresize等の要求時のみ。非表示・画面外では描画を止め、学習遷移時はstageごと破棄。
- geometry/material/texture/environment/shadow/rendererを解放し、observer・RAF・イベントを解除。StrictModeで接続中のcanvasを再利用する際にはforceContextLossしない。
- 正本API確認: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html)、[GPU cleanup](https://threejs.org/manual/en/cleanup.html)。

## 変更ファイル

| ファイル群 | 内容 |
|---|---|
| `src/components/park/three/{config,choreography,materials,toys,doll,bubble,scene}.ts` | 対象判定、純粋な演技、造形と材質、薄い泡、描画と破棄 |
| `src/components/park/three/ThreeParkStage.tsx` | 時間ベースの描画、reduced motion、可視性・失敗処理 |
| `src/components/park/three/choreography.test.ts` | 境界・A/B・弱いhop・泡保持・未対応保存の回帰 |
| `src/components/park/{ParkStage.tsx,PartArt.tsx,PartWorkshop.tsx,playback.ts,Park.css}` | 既存画面への候補接続、静止サムネイル、再生時間、タップ配置用レイアウト |
| `src/pages/Park.tsx` | 候補情報・編集状態・表示用の再生時間 |
| `src/components/park/ParkWelcome.tsx`, `src/pages/Onboarding.tsx` | 公開された遊園地に揃えた初回表示、既存登録処理への接続、全学年を選べる配置 |
| `package.json`, `package-lock.json`, `vite.config.ts` | Three.jsと型の固定版、3枚のUIアイコンをoffline packへ追加 |
| `public/assets/park/three-v1/*-icon.png`, `tools/park/render-three-icons.mjs` | 同じモデルからの静止UIアイコンと再生成手順 |
| `tools/e2e-park-three*.mjs`, `tools/e2e-park.mjs`, `tools/e2e-park-pwa.mjs` | 3D・録画・性能・offline検証、候補と出力先を実際の実行条件へ合わせる |
| `docs/product/{01_app_spec,22_shared_subject_build_and_play_spec}.md` | 表示候補の範囲と旧制約の上書き |

既存の未コミットBlender原本・画像・表示・監査は保持。`simulation.ts`、`ParkEditor.tsx`、`ParkAnswerForm.tsx`、learning/repository/commit/schemaは変更していない。

## 確認資料と残る判断

[実画面監査](audits/2026-09-06-park-three/README.md) と [比較・制作経路・動画](audits/2026-09-06-park-three/contact-sheet.html) を参照。

Three.jsだけで遊具・実際の組替え・曲面と膜変形・泡・演技・学習復帰を実装できた。Blenderは着手条件ではない。今後、人形の頭の微妙な非対称、手や靴の一体感、関節の見え方を彫刻的に詰める場合は、`createDoll` のroot/pose境界から人形だけGLBへ置換する価値がある。現時点ではGLB基盤を先回りして作らない。

iOS/Android実機・Safari/WebKit・長時間の発熱・子どもの無説明観察・独立美術承認は未実施。技術のPASSやユーザーの公開許可でこれらを合格扱いしない。
