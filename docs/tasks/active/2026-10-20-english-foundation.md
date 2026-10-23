# 英語基礎F01/F02の実装

依頼：チャッピーとのv0.4.1までの協議を網羅的に実装。正本は[英語基礎](../../product/english-foundation.md)。

範囲：教材、画面、コース選択、専用保存/証拠/SRS、outboxと重複防止、削除、PWAと検証。既存英単語/算数、未commitの別作業は保持。公開/pushは範囲外。

状態：合意したF01/F02のローカル機能実装と技術検証を完了。人による教材・実機・児童の受入は未完。発音・絵の人による確認、子どもの理解/再訪、実機・公開は別の未受入。

- Review By: 2026-10-27

## Docs To Touch

親仕様01、英語03、保存13、単元31、強化34、英語基礎の子仕様、文書入口。

## Verification

対象保存/復習/報酬/予約境界テスト、docs:check、lint、typecheck、test:run、build、E2E、PWA/offline。結果と未確認は完了時に追記する。

## 実装と検証の結果

[実画面と検証記録](../../design/2026-10-20-english-foundation/README.md)。専用保存、導入/支援/独力/遅延、2単元と固定教材、次予約のコース切替、プロフィール削除復旧、受信台帳、旧writer隔離、記録面を実装。既存選択と一致する教科では従来の初見継続practiceItemIdsを保持する。

型・lint・docs・通常build・最終固定build/assets、基礎の対象35件/音声2件/受信hook7件、教科接続の最終37件、旧互換222件、Growing対象410件が各記録版でPASS。最終appの2幅で実初回設定・導入・誤答支援・通常回答・コースpending・報酬4回/8しずく・同予約・教材cache破損と復旧・実SW更新・offline・音オフ/代替を確認。classic smoke32件とPWA checkpoint4件/別々の実build更新もPASS。

初回の全体unitは647/648ファイルまでで、文言2件FAIL・native core1ファイル未確認だった。利用者の「検証」で、文言を正本42へ合わせた対象59件PASSとnative core1件PASS（458.76秒）を追加した。前回合格済みと再検証の合算は648ファイル/5,506件、失敗0・未完0。新たに全件を一回で実行した結果とは区別する。

最終buildの全ファイル/実行コードのhash一致、型/lint/docs/素材検査を再確認。実画面/SW/offlineの同版証拠を再利用した。入口/portalは、現在の正本を読んで判断状態が変わっていないことを監査し、参照hash更新・再生成後にPASS。採用や公開の状態は引き上げていない。[追加検証](../../design/2026-10-20-english-foundation/verification-recheck.json)と対応ログを証拠に保存。

## 未確認と次の受入

音声の人による発音/自然さと再配布の確認、絵の子どもの識別、実機の音とa11y、児童の理解/再訪。旧source schema9はschema10を開けるため、schema番号だけの排除は主張しない。確認済みGrowing v10 writer隔離と新しい削除tombstoneを保持する。A–Z/大小文字/phonics/発話/書字は合意した最初の2単元の外。commit/push/公開は行っていない。
