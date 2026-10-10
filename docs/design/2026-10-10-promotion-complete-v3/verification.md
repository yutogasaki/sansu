# 検証

変更種別：静的宣伝サイトの内容/画像/表示と既存検査CLIの候補ID/出典期待値。ゲームのrouting・保存・学習・PWA・build pipelineの変更なし。

共有checkoutの他タスクを含めず、main 7a66929cへ今回のwebsite/仕様53/検査CLI/証拠を重ねた隔離sourceを検証する。最初の撮影は`[data-view]`がmainとbuttonの両方へ一致して停止。buttonに限定した撮影を使用し、画像に制作UIを含めない。

## 最終結果

- 隔離main 7a66929c＋今回の変更で `npm run verify:core` **PASS**。docs/current-entry/lint/typecheck、544 files / 4,803 tests、ゲームと宣伝サイトのbuild、asset予算を含む。ゲームprecacheは142 files / 8.04 MiB、宣伝画像は含まれない。既存Review By警告とBrowserslistの古さは変更外。
- `http://127.0.0.1:5301/promo/` の本番形式の静的成果物で **4幅PASS**。320/390/768/1440、3選択の画像と出典同期、連続切替、keyboard、FAQ、anchor/ゲームCTA、JSなし、reduced motion、44px/横溢れ、画像、SW/DBなし。完成したgame buildの `dist/promo/` と検証対象 `dist-website/` の全bytes一致も確認。
- 画像取得をabortする明示診断で、alt/説明が残り、別の選択へ復帰できることを確認。[故障検査](image-error-check.json)。これは実障害の発生率を測るものではない。
- ローカル撮影は全4視点とも `whole-island-native-3d-05` / `8398eda9ac084a6e` / day。全景は1000×780、近景1440×780。image-genや加工で物を追加せず、実canvasを撮影。
- 作者レビューでは添付の3D案との一致、全景の森/水庭/入り江、近景の焦点とmobile cropを確認。独立した参加者の理解/安全はNOT_EVALUATED。ゲーム本体の成長ルール・保存・学習・PWA・実端末への新しい合格を主張しない。
- 公開後のrevision・画像bytes・4幅確認は実行後に報告する。

- 入力manifestの初回診断は未追跡の古い `website/dist/` まで拾い、index exportの照合が停止。Viteの入力ではない生成物を除外し、実際のsource/public/CLIを照合する。buildの全15files bytes照合は別に保持。
