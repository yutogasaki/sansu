# 島・家の道具アイコン

2026-09-09。ユーザーの「しまもいえもアイコンがたのしそうじゃない。デザイン憲章で修正」に対応。

## 変更範囲

ナビの島と家、島メニューの道具、家の入口5件を `island-objects-v1` のSVGへ変更。曲がる屋根、うねる木、厚い本、レンズ、記念杯の輪郭と局所的な色面を使う。無地の文字面、操作名、focus、disabled、操作領域を保持する。戻る/閉じるなどの操作記号は既存線画を使う。

UIガイドライン6.1を先に更新。親仕様の操作・保存・学習契約に変更なし。世界のアートや住民の置換、生成画像、リリースは対象外。既存の多数の作業中差分はこの変更の成果には含めない。

## 判断

- 視覚的な魅力: 憲章の形・色面・局所模様を小さな道具へ適用。作者による実画面レビューであり、独立した子どもの好みの評価ではない。
- 無文字理解・安全: 文字ラベルを維持。独立参加者の無文字テストは未実施。
- Runtime: ローカルDEVの390×844、768×1024を対象とする。保存と学習速度の変更はなく、この確認をPWAや本番配布の証拠にはしない。

ローカルのスクリーンショットと実行記録は `output/playwright/island-icons/`。プロフィールのみの明示fixtureから実UIで島・メニュー・家・アルバムを開く。

実画面: [phone 家](phone-house.png)、[phone 島メニュー](phone-menu.png)、[tablet 家](tablet-house.png)。DEV `http://127.0.0.1:5198`、revision `development-local`、delivery `mystic-island-v1`、アイコン候補 `island-objects-v1`。音off・reduced motion、SW制御なし。既存世界候補は `mystic-island-shore-garden-v18` のまま。

家の入口は390幅で160×84px／アイコン34px、768幅で299×74px／アイコン40px。全入口で横はみ出しなし。島→メニュー→家→アルバムが開き、両viewportのpageerrorは0。初回検証で既存Camera参照のimport欠落を検出し修正後に再確認した。

## 検証結果

- docs:check PASS。lint PASS（既存IslandMilestoneのFast Refresh warning 1件）、typecheck PASS。
- build / assets:check PASS。precache 10.52 MiB / 12 MiB。
- 全体test:runは3361 PASS / 7 FAIL、306ファイル成功 / 6ファイル失敗。学習/保存系6件のtimeout（5秒/15秒）、`learningKeepsakeScenery.test.ts`のmesh数181 < 180というassertion 1件。これらの実装は今回の変更対象外で、共有作業中checkout全体の結果。アイコンの合格で全体FAILを相殺しない。
- 全体gateはPARTIAL。ログは `/tmp/sansu-icons-verify.log` と `/tmp/sansu-icons-build.log`（ローカル一時記録）。本番デプロイは実施していない。
