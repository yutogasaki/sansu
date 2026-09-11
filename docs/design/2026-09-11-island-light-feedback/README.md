# 住人のひかり獲得通知 v1

住人が家具で過ごし終えた時に増える「ひかり」を、残高の数字だけで終わらせず、島の画面で短く知らせるようにした。通知は前回表示から増えた差分だけを一度表示し、「いろ」へ進める。しずくの学習通知と同じ帰島で発生した場合は一枚に内訳をまとめ、通常の学習操作や島の見える範囲を増やさない。

## 実装

- `replayLife(record)` の `drops` / `light` を前回表示値と比較し、正の差分だけを `rewardDelta` で通知する。
- `sessionStorage` の profile 別キーで、reload や同じ表示の再演を防ぐ。保存が使えない場合も島自体は止めない。
- 「みんなが あそんだ +N ひかり」の通知から `いろ` を開き、残高の説明とスタイル価格を同じ画面で読める。
- しずくとひかりが同時に増えた時は一つの `aria-live` カードへまとめ、二重の通知を出さない。

## 検証

`source.json` の `d22a450` を `SANSU_BUILD_REVISION` に固定し、`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true` の本番相当preview（`http://127.0.0.1:5226`）で `production-report.json` を取得した。390×844 / 768×1024 とも、空の島、実回答3問、6しずく通知、住人の好み、花購入、ひかりの意味、いろの価格、reload、実サービスワーカー制御下のoffline回答と再起動がPASSだった。DEV面は表示されず、学習と所有の保存を比較した。

動的な住人利用は、同じソースのDEV preview（`http://127.0.0.1:5223`）で実家具を置き、診断用の6時間送りを一度使って検査した。phone/tabletで `24 ひかり` の通知を実表示し、通知のタップで `いろ` を開けること、reduced motionでも同じ文言と44px以上のカードを保つことを確認した。`phone-light-cue.png` と `tablet-light-cue.png` は診断パネルを閉じて撮影し、`contact-sheet.png` に同じクリティカルパスを並べた。

**視覚**: 島全景を狭めず、通知を海上の左上へ置いた。phone/tabletで残高・通知・住人・下部タブを同時に読める。最終アート承認と実参加者の再訪意欲は未評価（N=0）。

**無説明理解・安全**: 「みんなが あそんだ」「ひかり」「いろを えらぶ」の因果を一枚で示し、回収・連続日数・正誤・失敗罰を追加していない。子どもの無説明理解は未観察（N=0）。

**runtime**: `rewardCue.test.ts` 3 tests、関連島シミュレーション/活動テスト20 tests、docs:check、typecheck、lint、build/assets:check、production harness phone/tabletがPASS。長期経済、実機iOS、実参加者の学習効果はこの証跡の対象外。
