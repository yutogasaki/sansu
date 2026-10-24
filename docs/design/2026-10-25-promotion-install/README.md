# 紹介サイトのホーム画面追加案内

2026-10-25。利用者の依頼でKeepGoingの図付き手順を参考に、紹介サイトへiPhone/iPad・Android各3ステップを追加。島へ戻りやすくする「愛着」の補助。島・学習・保存の実装変更はない。仕様は[53](../../product/53_promotion_website_spec.md#ホーム画面への追加)。

## 対象と入力

- 紹介サイトの静的build。candidate `promotion-cove-growth-v4`。ゲームruntime/delivery flagは対象外。
- [入力hash・revision・日時](source.json)。既存の未commit変更を保持した作業ツリーで実行。commit/push/公開は行わない。
- Nodeは`.nvmrc`の22。nvmがないため既存fnmの22.23.3で実行。

## 変更と確認内容

- 紹介ページから公開アプリを開いて追加する流れ、LINE/BANDから通常ブラウザーを使う案内、保存先が変わる可能性を記載。
- 既存の白・明るい青と青い操作を使用。両手順はnative detailsで開閉でき、JavaScriptなしでも読める。
- 320/390/768/1440px、768pxのreduced motion、キーボード開閉、44px操作、画像読込、全アンカーとアプリリンク、ゲームDB/SWの非作成を検査。従来の成長切替・FAQ・画像失敗復旧も保持。
- 初回の実画面で図中アイコンの寸法を修正。production検査初回〜v4は、native detailsの閉開に伴うlazy画像の読込中断でdecodeが失敗。全図へ実際にスクロールして読込完了してから操作するharnessへ修正し、v5でPASS。初回結果は `output/promotion-install-2026-10-25-production/` 、v2/v3/v4の各出力に保持。

## 検証結果

- `fnm exec --using 22 npm run build:website`: PASS。
- `fnm exec --using 22 node tools/verify-promotion-website.mjs http://127.0.0.1:5201/ output/promotion-install-2026-10-25-production-v5`: PASS。期待どおり4幅・図6枚/各3手順・no-JS・reduced motion・画像/リンク/保存境界が成立。[結果](report.json)、[phone実画面](390-install.png)、[desktop実画面](1440-install.png)。
- `npm run docs:check` / `npm run lint` / `npm run typecheck`: PASS（`fnm exec --using 22 npm run verify:core`内）。
- `fnm exec --using 22 npm run build`: PASS（紹介サイトの `/promo/` 組込みとassets:checkを含む）。
- 全体unitはPARTIAL。今回変更していない `src/domain/island/experienceRepository.test.ts` のレイアウト保存2件が5000msでtimeout。他の重い地形検査も含む全体実行は、その失敗を保持して明示停止。全件完走・全体合格とはしない。[コマンドと結果](checks.json)。
- `fnm exec --using 22 npm run e2e:smoke`: PARTIAL。31旅程PASS後、既存の `/parents` 直リンク検査の「range confirmation requires no arithmetic answer」で失敗。紹介サイトを使わないclassicアプリの検査であり、今回のHTML/CSS/画像追加の失敗ではない。`output`とは別のローカルログ `/tmp/sansu-install-smoke.log` に初回失敗を保持。

## 未確認

実機iPhone/iPad/Androidでの実インストールと既存記録の保持、保護者/子どもの手順理解・再訪は未検証。公開サイトへの反映は未実施。案内ページの自動検査を実機PWAの合格にはしない。

## 参考

[AppleのiPhone手順](https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios)、[iPad手順](https://support.apple.com/ja-jp/guide/ipad/ipad8f1f7a29/ipados)、[GoogleのAndroid手順](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ja)。KeepGoingの `public/website/index.html` と `styles.css` を参照。親仕様01/子仕様53を更新し、保存・PWA更新の契約や長期memoryは変更不要。
