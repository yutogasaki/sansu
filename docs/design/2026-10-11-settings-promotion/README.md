# 設定から宣伝サイトを開く

2026-10-11 / candidate `settings-promotion-link-v1`。

設定の最後に「アプリの紹介」を追加し、同じ公開先の `/promo/` を別タブで開く。算数・英語と育つ島の紹介であること、別タブを開くことを操作前に表示する。やさしい表示と従来の設定にも同じ入口を持つ。ルーター・プロフィール書込・学習・SW・島美術のflagを変更しない。

正本は[宣伝サイト仕様53](../../product/53_promotion_website_spec.md)。検証対象は `src/pages/Settings.tsx` の通常アンカー。

## 検証

- 最新main `1069b432` にリンクを統合した source candidate `88570e47efa1af169490d98a1ad723e7020a27c6`。`SANSU_BUILD_REVISION` をこの候補へ固定し、[source/distのSHAと実build metadata](source-manifest.json)を照合した。最終Git反映では記録のみを追加する。
- [core](verify-core.txt)：docs/current-entry/lint/typecheck、571 files・5,010 tests、build/assets PASS。既存lint警告2と文書期限警告12は保持。通常Island=true・nativeOwnedArt=falseを保持する。
- [実画面と対象metadata](runtime/report.json) / [4幅の設定→紹介サイト](contact-sheet.html)：320/390/768/1440幅、実初回設定から紹介リンクを操作。タップ、1440幅のEnter、別タブとopenerなし、元URL・学習5ストア保持、再読込、390幅のやさしい表示を確認。768幅はreduced motion。新規一時プロフィールだけを使う。
- [実行コード](runner.mjs)を同じrepositoryのrootから実行する。`SANSU_PROMO_SETTINGS_URL` と `SANSU_PROMO_SETTINGS_OUTPUT` で接続先と新しい出力先を指定できる。従来の設定へも同じアンカーを置いたが、この実画面検査の対象は公開のIsland設定。
- 初回は画面外のlazy画像まで待った検査がtimeout。[最初のFAIL](history/lazy-images-timeout/report.json)と元runnerを保全し、紹介のhero画像の読込へ待機を修正。本体コードは変更しない。[旧mainのcore](history/verify-core-2861a0e0.txt)・[修正検査の診断](history/fixed-harness-original-base/report.json)を最新mainの最終結果へ流用しない。

## レビューと境界

- 視覚：既存の設定行・文字・色・アイコンと44px以上の操作面を再利用。作者がphone/desktopの実画面を読み、リンクと別タブの説明を確認した。島の美術を更新する変更ではない。
- 理解/安全：短い説明とやさしい表示を提供。子どもの無説明理解・再訪・実端末は未評価。
- Runtime：設定→別タブ→元画面の保持はPASS。保存・ルーター・学習・PWA・美術の挙動は変更せず、通常のアンカーのみ。
