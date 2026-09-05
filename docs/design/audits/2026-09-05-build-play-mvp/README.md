# ちいさな遊園地 MVP 実装監査

2026-09-05。製品仕様は [22仕様](/docs/product/22_shared_subject_build_and_play_spec.md)。この文書はローカル検証時点の証拠であり、公開承認ではない。

## Delivery truth

- Actual app targets: DEV `http://127.0.0.1:5187/#/park` / production preview `http://127.0.0.1:5287/#/park`。
- Build revision: `47831f9-park-ae795fa3049a`。base commit `47831f9` の未コミット作業ツリー。既存のユーザー変更を含む。入力ファイルのSHA-256は [provenance.json](./provenance.json) に記録。
- Delivery flag: `VITE_BUILD_PLAY_ENABLED=true`。通常ビルドの既定値は無効。デプロイは実施していない。
- Rendered game / delivery ID: `build-play-v1`。lineage: `little-park-v1`。candidate: `little-park-vector-v1`。
- [Critical-path contact sheet](./contact-sheet.html): 初回→部品見本→学習→支援→制作完了→配置による結果の差→別コース。各PNGは実アプリのPlaywrightスクリーンショット。
- Cache state: DEVは新規browser context、production checkpoint検証は新規context・Service Workerをblockし、既存PWA E2E hookで更新通知を注入。別途、既存 `e2e:pwa-update` の実Service Worker版差検証も通過。新モードのiOS/Androidインストール・実機の二ビルド更新は未確認。

## Separate gates

| Gate | Result | Evidence and limit |
|---|---|---|
| 視覚的魅力 | HOLD・未採点 | 390×844 / 768×1024の玩具プロトタイプを実装者が確認。学習前に再演でき、配置の差でジャンプ・泡の結果が変わる。新候補の承認benchmark・子どもの自発的再演観察はない。探索画像の既存スコアを転用しない |
| 無文字理解・安全 | HOLD | 操作は部品→位置のtap、44px以上の入力、無音でも泡・ベルを表示、reduced motion対応。誤答・支援・スキップで部品を失わない。字幕や仕様を知らない子どもの独立観察は未実施 |
| Runtime integrity | GO（ローカル） | 102ファイル・1,095テスト、既存smoke31件、既存PWA4件、遊園地6シナリオ・production checkpoint3件。生成・保存・支援・二重付与・プロフィール・入力を確認。実機配信のGOではない |
| Whole-app continuity | HOLD（公開） | 遊園地内の全主要画面は同一候補。既存Study・基地・Settingsは維持し、探索のactive runへ戻れる。全アプリの新しい美術承認と子どもの観察は別途必要 |

## Review findings

- Tone alignment / failure safety: OK。独力の正解を偽らず、支援を見ても同じ部品を作れる。独力確認待ちDueを残す。
- Information design: OK。初回の主操作は「あそばせる」。課題画面は制作対象・現在の問題・入力に集中し、動くコースを表示しない。
- Game feel: Attention。すべり台→ジャンプ→ゲートを越す配置と、泡→ジャンプ→着地ではじける配置を実表示で確認。子どもがその差を目的に制作を繰り返すかは未確認。
- Accessibility: OK（確認範囲内）。phone/tabletで横overflowなし、TenKey全体、選択式・分数複数欄・筆算・英単語を操作。reduced motionは軌道補助と静的反応で確認。スクリーンリーダー実機の操作は未確認。
- Maintainability: OK。配置・シミュレーション・予約学習・確定処理を分離し、既存の学習planner/writerと入力部品を利用。新規保存はDexie v6の追加テーブルのみ。

## Reproduce

1. `VITE_BUILD_PLAY_ENABLED=true npm run dev -- --host 127.0.0.1 --port 5187 --strictPort`
2. `npm run e2e:park`。接続先変更は `SANSU_PARK_BASE_URL`。
3. `VITE_BUILD_PLAY_ENABLED=true npx vite build --outDir /tmp/sansu-park-preview`
4. `npx vite preview --outDir /tmp/sansu-park-preview --host 127.0.0.1 --port 5287 --strictPort`
5. `npm run e2e:park-pwa`。接続先変更は `SANSU_PARK_PRODUCTION_URL`。build識別は `SANSU_BUILD_REVISION` で指定可能。

[DEV report](./report.json) / [Production report](./production-report.json)。テストは独立したbrowser contextのテスト用プロフィールを使う。
