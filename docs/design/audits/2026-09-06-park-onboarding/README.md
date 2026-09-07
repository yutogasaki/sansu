# 遊園地の初回入口修正 — 本番実画面監査

ユーザーが提示した旧「ポッコのふしぎずかん」歓迎画面はキャッシュだけの問題ではなく、既存onboardingの表示が残っていた。本編から検証を始めたことで初回の入口を見落とした。今回は空のブラウザcontextから、実UIで名前・学年・教科・開始範囲を選び、登録後の3D遊園地・試遊・制作の学習まで検証した。

## 公開

- 実アプリ: https://sansu-seven.vercel.app/#/onboarding
- Immutable: https://sansu-qdofhflpm-yutogasakis-projects.vercel.app
- Source/main: `aa36adad7dcce77956a891e7917d6a29241ed83a`
- PWA version: `aa36adad7dcce77956a891e7917d6a29241ed83a:f7cb0312-cee7-484e-8e78-5c192e9a7f39`
- Vercel production: `9HmnZpKS1ByRKm7XVzNRgwgYwRLq`、GitHub deployment `6289519858`、2026-09-06 05:26:43 UTC success。
- `VITE_BUILD_PLAY_ENABLED=true` / `VITE_PARK_RENDERER=three`、実3D candidate `park-three-resin-v1`。manifestの既存探索metadataは `snap-root-v1` / `pokko-field-v1` のまま、遊園地有効化は `park` フィールドを参照。
- [Verify Core](https://github.com/yutogasaki/sansu/actions/runs/34013973345) / [Docs Check](https://github.com/yutogasaki/sansu/actions/runs/34013973327): success。
- 前の明示的な本番公開依頼に対する修正として既存GitHub main→Vercel連携で再配信した。

## 変更と実画面での修正

既存ParkStageの人形・すべり台・トランポリン・空き位置を初回に静止表示し、「はじめる」から既存登録へ進む。新規profileや所有部品を初回表示時に作成しない。登録と学習の処理・schema・付与条件・simulation・3Dモデルは変更しない。登録中も同じミルク色に揃え、完了時の旧キャラクターを遊具アイコンへ揃えた。PWA全体の名称・ホームアイコンの改名は今回含めない。

390pxの実画像で学年ボタンの装飾により文字が縦に折れることを発見し、遊園地の登録では装飾アイコンと矢印を省いて中央の学年名を読めるように修正した。最終本番のwelcome、tablet welcome、grade画像を実際に開いて目視した。

- [実行中本番の導線contact sheet](contact-sheet.html): 390×844、768×1024、320×640、初回→名前→学年→教科→開始範囲→遊園地→学習。
- [ユーザー提供の問題画像](user-reported-old-welcome.png): 修正前の申告資料。エージェントが撮影した証拠としては扱わない。
- [390pxの本番初回画面](390-welcome.png)、[学年選択](390-grade.png)、[登録後の3D](390-park.png)。

## 検証

- `npm run verify:release`: PASS（docs/lint/typecheck、104ファイル・1,106テスト、build/assets、smoke 31、PWA 4）。[log](verify-release.log)。
- 本番flag付きbuild、`e2e:park-pwa` 3件: PASS。
- `tools/e2e-park-onboarding.mjs`: DEV、本番flag付きlocal preview、実本番の3箇所でPASS。本番の[report.json](report.json)は3viewportすべて同じ公開revision、pageerror 0件。
- 初回はprofile 0、登録完了後1、入力した名前・学年・教科・開始範囲の保存一致、初期所有2部品と3番目の空き、再演による学習ログ非更新、学習中canvasなし、静止時400ms追加描画0、全9学年ボタンの幅・到達可能性、320px reduced motion、WebGL不可時のfallbackを確認。
- 実本番の旧 `f70d967` を2つの実SW制御contextでoffline保持し、公開後onlineへ復帰。安全な設定画面は1,582msで新版へ切替、reload 1回、profile/appData/logs/parks/parkPlans/exploreRunsとlocalStorageテスト値を保持。
- 入力中の名前は旧版に保持し、登録完了後の安全な区切りでreload 1回。登録した名前が保持されること、更新後の3D再演を確認。SW/version応答のmockなし。[PWA report](pwa/report.json)。

## 独立した判定と未確認

- 美術: 既存候補の造形を再利用。旧歓迎画面の混在を入口と登録から修正し、実画面で読める学年配置を確認。独立した最終美術承認はHOLDのまま。
- 無文字理解・安全: 実子どもの無説明観察は未実施。操作領域と登録入力・保存の技術検証は、その観察の代わりにはならない。
- 実装整合: 上記の本番導線・PWA・回帰はPASS。入力/学習/モデルは未変更。固定10問の結果は[前候補の監査](../2026-09-06-park-three/README.md)を参照し、今回再測定したとは扱わない。
- 実機: Chromium 145.0.7632.6 / Mac Metalのviewportエミュレーション。インストール済みiOS/Android、Safari、長期利用は未確認。今回FPS計測は追加していない。

## 再現と戻し方

`VITE_BUILD_PLAY_ENABLED=true VITE_PARK_RENDERER=three npm run dev -- --host 127.0.0.1 --port 5188` を起動し、空の検証ブラウザで `/#/` を開く。`SANSU_PARK_BASE_URL=http://127.0.0.1:5188 node tools/e2e-park-onboarding.mjs` で実UIを再検証できる。

rendererのみ旧版へ戻す場合は `VITE_PARK_RENDERER=legacy`、遊園地全体を既存探索入口へ戻す場合はbuild-and-play flagを無効にして再ビルド・配信する。既存profileや学習・作品データは消去しない。更新運用は [PWA runbook](../../../runbooks/pwa-release.md) を参照。
