# Blender 遊園地 — 実画面監査

作業候補: `park-resin-blender-v1` / 配信ID: `build-play-v1`。

## 対象

実アプリ: `http://127.0.0.1:5187/#/park`。DEV、`VITE_BUILD_PLAY_ENABLED=true`。画面のbuild revisionは `4102126-park-resin-088562a6cc48`（4102126からの未コミット作業版）。末尾は遊園地のコンポーネント・画面・本番画像のSHA-256先頭12桁。既定の本番flagは無効のまま。

390×844と768×1024、新規テスト用ブラウザーコンテキスト、音声無効。美術比較の配置は専用のテストプロフィールへ投入し、再演自体はアプリのボタンで実行した。学習・制作・保存の利用経路は別のpark E2Eで検証する。

## 3つの判定

- 見た目: Blenderから書き出した同じモデルを舞台・部品棚・制作・学習見出しへ使用。見本の厚い樹脂、顔、材質、接地を継承した実装候補。独立した最終美術承認は未実施。
- 無文字理解・安全: B/Cの違いを実画面で確認。独立した子ども観察4/5等の結果はないため、観察ゲートは未判定。
- 実装整合: B/C、3〜6位置の同尺度と最終着地の実画面テストPASS。学習・保存・PWAを含む検証結果は下記。

## 素材

44 WebP、合計約193 KiB、全素材展開時約29.7 MiB。透過alphaはPNG原本と変換後WebPでbyte一致を確認。制作原本・参照画像はpublicへ含めない。

## 実行結果

- `verify:core`: PASS。docs/lint/typecheck、103ファイル・1,100テスト、production build。PWA precacheは131ファイル、9.77 MiB / 12 MiB。
- `e2e:park`: 6 PASS。初回再演、制作、誤答、支援、中断・再開、配置、別コースへの明示移動、6位置、筆算・複数入力・英単語、reduced motion。
- `e2e:smoke`: 31 PASS。最初の実行は開発ファイル更新と重なったため、変更固定後に再実行。
- `e2e:pwa-update`: 4 PASS。実Service Workerの版差回帰を含む。
- `e2e:park-pwa`: 3 PASS。`http://127.0.0.1:5287`、同じrevision・flag有効のproduction preview。更新checkpoint、保存hold、旧run優先。
- `node tools/e2e-park-art.mjs`: 390 / 768 の両方PASS。人形の基準尺度64.1 / 88.8 CSS px、6位置でも誤差0.01px未満。色替え後の末端着地で足元のalpha境界まで画面内。
- `node tools/e2e-park-offline.mjs`: PASS。実Service Workerの制御下で通信を切り、全44素材を読み込み、再演と学習画面を使用できた。
- `benchmark:fixed-ten`: PASS、`evidence.eligible=true`、`pass=true`。検証専用コミット `afef301` のclean worktreeで全4条件×10反復、各必要サンプル20件。Study中央値123.0問/分、旧Explore中央値261.7問/分（比2.128）、旧Explore冒頭正答→操作可能P95 134.5ms、同問再回答P95 453.8ms。Study / 旧Exploreの回帰検証であり、遊園地固有の学習速度や子どもの理解の実測ではない。`fixed-ten-report.json` に全条件・集計を保存。`build-provenance.json` に実アプリと検証worktreeのコード・画像が一致するSHA-256を保存。

[contact-sheet.html](contact-sheet.html) は実素材の再合成画面と制作・学習の重要経路。`report.json` / `offline-report.json` は実画面とオフラインの実測。先行する変更中・dirty treeでの固定10問検証は正式判定に採用していない。

実機iOS/Androidでのインストール・二ビルド更新と子どもの観察は未検証。技術検証の成功を美術承認・観察の代わりにしない。
