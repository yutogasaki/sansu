# 花の成長段階フィードバック v1

置いた花が、学習のあとも島で少しずつ変わっていく実感を持てるようにした。持ち物で「めが でた」「つぼみ」「さいた」の3段階と次の段階までの目安を確認でき、時間が段階を越えた時だけ島の通知カードで知らせる。子どもが行う操作は学習と、必要な時の持ち物確認・模様替えに限り、島の全景と下部の「まなぶ」タブはそのまま残している。

## 実装

- `lifeGrowthStatus` が花の段階、3つの成長ドット、次の段階までの時間を表示用に計算する。花以外は「おいてある」、収納中の花は時間の約束を表示しない。
- 前回観測した段階との差分だけを `growthTransitions` で通知する。初回表示で既に育っている花は知らせず、同じ段階の再読込でも再演しない。
- 成長通知は既存の学習・ひかり通知カードへまとめ、タップで「もちもの」を開く。成長値、学習量、所有物の保存境界は変更していない。
- 大物5段階・小物3段階へ広げる前の代表花の見える化として扱い、成長の速度や価格はこの実装で確定しない。

## 検証

`source.json` の `2550a14` を元に `growth-stage-v1` をビルドし、`VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_ENABLED=true` の production preview（`http://127.0.0.1:5226`）で本番ハーネスを実行した。390×844 / 768×1024（tablet は reduced motion）とも、空の島→実回答3問→花購入→持ち物の成長マーカー→reload→実サービスワーカー制御下の offline 回答と再起動が PASS だった。結果は `production-report.json`、画面は `phone-growth-inventory.png` / `tablet-growth-inventory.png` と `phone-earned.png` / `tablet-earned.png` に残している。

DEV preview（`http://127.0.0.1:5223`、`VITE_ISLAND_LIFE_PREVIEW=true`）では、花を置いてから診断の24時間送りを一度だけ使い、段階3への「おはなが さいたよ」通知、通知から持ち物への遷移、ページエラーなしを確認した。結果は `diagnostic-report.json` に記録した。

- **視覚**: contact sheet で、島を縮めずに成長段階と次の目安を読めること、通知と下部ナビが同時に残ることを確認した。最終アート承認と子どもの再訪意欲は未評価（N=0）。
- **無説明理解・安全**: 成長段階と時間の目安を同じ花カードに置き、収納中や初回表示に誤った約束を出さない。罰、回収、連続日数、正誤による減衰は追加していない。子どもの無説明理解は未観察（N=0）。
- **runtime**: `growthStatus.test.ts` 3 tests、`growthCue.test.ts` 3 testsを含む `npm run verify:core`（344 files / 3,623 tests）、typecheck、lint（既存 warning 1 / error 0）、フラグ付き build/assets:check、production harness phone/tablet、DEV段階遷移診断が PASS。実機iOS、長期の経済調整、実参加者の学習効果はこの証跡の対象外。
