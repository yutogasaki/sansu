# 紹介ページの欠落画像を配布対象へ戻す

2026-10-18。利用者のiPhone写真で、はじめの島が空欄になる不具合を確認。公開画像URLは404。画像を再生成する問題ではなく、配布対象から抜けていた。

## 原因と修正

- `.git/info/exclude` の `Images/` が `website/public/images/` にも一致し、新しく作った2枚が保存コミットに入らなかった。既存PNGは追跡済みなので影響しなかった。
- `.gitignore` に対象ディレクトリと2画像の明示的な例外を追加。ローカル限定の除外設定は変更しない。2枚は `git ls-files --cached --others --exclude-standard` に表示される状態。
- 既存検査は最終選択の画像を確認しており、途中の選択画像の欠落を見逃せた。各段階で画像のdecode成功とnaturalWidthを必須にした。

## 検証

- `npm run build:website -- --base /promo/`：PASS。公開と同じpathの静的成果物を `/tmp/sansu-promo-image-fix/promo` で配信。
- `node tools/verify-promotion-website.mjs http://127.0.0.1:5269/promo/ docs/design/2026-10-18-promotion-image-delivery-fix/runtime`：PASS。320/390/768/1440幅で3段階すべてdecode成功。キーボード・連打・FAQ・JSなし・失敗復帰も確認。
- 初期画像を一時的に配布先から除く診断で、強化した検査が `EncodingError` とともにFAILになることを確認後、画像を戻した。[欠落時のreport](missing-asset/report.json) / [診断ログ](missing-asset-check.txt)。期待した失敗であり、修正版の失敗ではない。
- `node --check tools/verify-promotion-website.mjs`、`git diff --check`：PASS。
- アプリ/学習/保存/PWAのコードは変更なし。基準commit `6dd9ab44` の全体検証履歴は既存記録を保持し、今回それらを反復していない。

[4幅の検査結果](runtime/report.json) / [入力hash](inputs.json) / [phone初期の実表示](runtime/390-start.png) / [phone村の実表示](runtime/390-village.png)。

公開反映は未実施。公開後に2画像のHTTP 200と実表示を確認する必要がある。実機iPhoneの確認は未実施。
