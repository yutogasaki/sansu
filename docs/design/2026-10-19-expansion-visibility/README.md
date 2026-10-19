# 土地拡張の入口が消える問題

2026-10-19。利用者の実画面で「ひろげる」がない指摘を受け、前回UI改善の回帰として修正。目的は一つ、通常ホームで拡張の存在と条件が分かること。既定30分・追加agentなし。

## 原因と変更

購入見積 `landQuote` は4回目/5回目の拡張で島Lv5/6に届くまでundefinedを返す。従来のホームはその時に入口自体を描画しなかった。提示画像の本人保存は読んでいないため、その保存状態まで断定していない。同じ非表示条件を明示fixtureで再現できる。

通常ホームでは条件未達でも「ひろげる／島Lv5から（または6から）」を示し、開くと現在/必要な島Lv、くらしを整える案内、正規費用720/960と残高が分かる。未解放時の方向ボタンは出さず、解放後は既存の費用・方向・購入commandに戻す。初回案内・出来事・受取待ち・情報面等の優先を保持。学習・解放条件・価格・土地・保存・routingは変更していない。

## 検証

共有working copyでの確認後、main `6a3bbf9b` に今回の差分だけを適用した別候補で再検証。別作業の海図・保存・橋開始処理・ポータル再設計を含めない。

- [型](typecheck.txt)、[lint](lint.txt)（既存4 warnings）、[build/assets](build.txt) PASS。PWA precache 8.53 MiB / 12 MiB。
- [4ファイル17テスト](tests.txt) PASS。Lv4→5とLv5→6、正規価格・方向・残高不足、実DBでの購入/再読込/二重請求防止を含む。
- [実UI report](report.json) PASS。320×568・390×844・568×320の各幅で両方の未解放条件と解放後、入口の44px/実hit・説明・横溢れなし・閉じる/Escapeとfocus復帰・土地/残高不変・正規費用の方向選択を確認。音off、横画面reduced motion。診断の本人・土地・レベル・1148しずくは明示fixtureであり、実取得とは区別する。
- [主要旅程contact sheet](index.html)、[アプリ入力](app-inputs.json)。reportのruntime markerと開始/終了のsource一致を記録。DEV modules、SW制御なし。
- 全体suite、smoke、PWA二build、児童の独立理解、実機の今回再実行はしていない。前回main統合の全体suiteは途中停止のまま。今回の対象検証を全体・公開品質の合格へ読み替えない。

最終のindexを外部の新しいdirectoryへ書き出してdocsと生成物を確認し、前回の明示されたcommit/main/push依頼の範囲内のUI回帰修正として反映する。公開revisionはpush後に別確認する。
