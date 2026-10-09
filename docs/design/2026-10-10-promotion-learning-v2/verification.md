# 検証の境界

対象は宣伝サイトのページUI・内容・実画面、およびローカル撮影/確認CLI。ゲームのrouting、storage、learning、PWA実装とbuild pipelineは変更しない。

- ブラウザー：320/390/768/1440px、JSなし、reduced motion、画像・選択・FAQ・キーボード・CTAとページ内導線、横溢れ・44px操作、SW/DBを確認。`browser-checks.json` の `pass: true`。
- 撮影：main `4db3e1a397bd8905a1bb6698861a0ec994423592` の隔離production buildで実行。紹介用データを用いる。実学習で成熟した島という検証ではない。
- コード：対象変更だけをコピーした隔離mainで `npm run verify:core` を実行し、最終結果を記録する。共有の未コミット美術コードをこのコミットの検証結果に含めない。
- 公開：コミット後にmainの配信と `/promo/` の実HTML・画像・JS/CSSを確認する。ゲームの実利用者の保存・実機・参加者評価とは別。

実行結果は完了時に追記する。

## 最終結果

- 隔離したmain＋今回のサイト/CLIだけで `VITE_ISLAND_ENABLED=true npm run verify:core` **PASS**。docs/current-entry/lint/typecheck、544 files / 4,803 tests、ゲームと宣伝サイトのproduction build、assets checkを含む。ゲームprecacheは142 files / 8.04 MiBのまま、宣伝用画像は含まれない。
- 最終production preview `http://127.0.0.1:5301/promo/` の4幅検査 **PASS**。build versionは `development-local:19abb2a7-edf8-41c4-85b8-29c2fa255648`。完成ページの画像・CSS/JS・フォント・3段階/連続切替・keyboard・FAQ・リンク・JSなし・reduced motion、SW/DBなしを確認。ここに保管したページ写真はこのbuildのもの。
- 撮影CLIの非loopback URLは、ブラウザー起動・出力作成前に `Loopback capture only` で拒否することを確認。
- 参考診断：最初に並行実行した共有checkoutのcoreでは `learningProgression.integration.test.ts` の「preserves legacy next range practice evidence without auto promotion」1件が15秒timeout（4,802 passed）。共有checkoutでは別作業のゲーム変更も進行中だった。ソースを固定した今回の候補の全4,803 PASSと混同せず、学習コードへ変更を加えていない。
- routing/SW/保存/学習のコードは変更しないため、以前の公開境界検証を今回の新しいPWA更新合格として扱わない。実機・参加者評価は未実施。
