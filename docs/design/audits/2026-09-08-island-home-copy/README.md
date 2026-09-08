# 島ホームの常設説明を減らす

[変更前後と実画面](review.html)、[build情報](manifest.json)。

## 変更

- 住民紹介の常設字幕を読み上げ用に限定。操作後の字幕は引き続き表示する。
- 区間数による報酬・成長の予告と自動保存の常設文を削除。
- 主操作の手前を20pxの余白へ整理。「ほかの あそび」の位置を保持。
- Island.tsx / Island.cssには開始前から別作業の変更あり。既存の「まなぶ」変更は本件の実装ではない。変更対象4ファイルは検証用固定コピーと一致。

## 検証

- docs:check / lint / typecheck / test:run PASS。147ファイル、1,720テスト。
- 同じsourceを凍結した隔離コピーのnpm run build PASS。assets:checkはprecache 143 files / 9.58 MiB。
- Playwright CLIで実初回設定→最初の問題→帰島→花で遊ぶ→もちもの→配置取消→同じ問題へ復帰。物理キー6で実正答を保存し、再読込後2問目を確認。
- 390×844、768×1024のホーム・遊び・もちもの・配置・学習を撮影。tabletのreduced motionと音OFFの自由遊びを確認。ブラウザconsole error 0。
- 初期字幕はcomputed width=1px、clip-path=inset(50%)。DOMの画像名・live captionを保持し、花を選ぶと実反応の字幕を表示。

## 独立した判定と範囲

- 見え方: 添付写真と比較し、常設文の重なりがなくなり、島から操作へ目線が進む。moon-gardenの家・木・住民・庭の配色と画角を保持。美術全体の新規承認ではない。
- 無説明理解・安全: 作者の画面確認のみ。子どもの理解・再遊びは未評価。
- Runtime: 本件のcopy/content範囲でPASS。routing/storage/学習/PWA契約の変更なし。二つのbuild間の更新・offline・実機・正式速度測定をこの変更で再認定しない。
- 公開デプロイなし。確認先はmanifestのローカルproduction preview。固定buildには開始前の未コミット作業も含む。

親仕様と28仕様へ反映。ADR、runbook、検証matrix、durable memoryは更新不要。
