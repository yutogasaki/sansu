# 家の縦画面カメラ — 2026-09-20

ユーザーの追加指示「やって」により、家の先頭で中央の住人・机を近くに見せる。縦画面で部屋の横幅全体を収めるために増えていた天井・床の余白を減らした。左右の家具は一部が画面端に入り、記念・おしらせはメニューからも開ける。選択した記念と撮影の全体収容は維持する。

[比較と旅程](contact-sheet.html) / [ビルドとsource](manifest.json) / [Chromium実操作](chromium-report.json) / [WebKit実操作](webkit-report.json) / [本番WebKit実操作](production-webkit-report.json)。最初のUI整理の根拠は[前段](../2026-09-20-house-ui/README.md)。

## 独立した判定

- 視覚: 390×844で住人と机を約1.4倍にし、余白を減らした。家具・キャラクター・材質は同じ。WebKitとChromiumの最終ビルドを参考画像と並べて作者が確認。美術全体の完成や満点評価ではない。
- 無説明理解・安全: 独立観察0人。子どもの理解・再訪意欲は未検証。既存の文字付き入口、退出、移動案内を保持。
- Runtime: phone/tablet・通常/reduced motion、実床タップ、矢印キー移動、机のアルバムの実3Dタップ、7store不変、メニューの焦点復帰、学習から同じ予約への復帰は両ブラウザでPASS。実機iOS/Androidとは区別する。

## 固定した公開候補

`15c3eafcdaa5b8102c934b9bfc7130b78b6ce5d9` の独立worktreeで最終ビルドし、対象は `http://127.0.0.1:5384`。元の共有checkoutの他タスクの未コミット変更は含めない。家候補 `house-world-first-v1`、カメラ `island-home-interior-v5`。flagsと実際のversionはmanifestに記録。最終contact sheetのcritical path画像は公開URLの同一ビルド。ローカルの元manifestは[別保存](local-manifest.json)。

基準候補のカメラ15テスト、lint、typecheck、docs、build/assetsはPASS。最終の端歩行対応後はカメラ16件＋歩行3件の計19件、対象lint、typecheck、build/assetsを再実行してPASS。PWA precacheは125ファイル、11.57 MiB / 12 MiB。既存のIslandMilestone Fast Refresh警告と文書棚卸し期限警告は継続。390/320/768/844幅の[家の境界チェック](edges-report.json)もPASS。実初回3問での記念展示、履歴/直接URL、写真入口、長い一覧の明示fixture、保存失敗/再試行、実SW offline再読込、退出・44px操作を確認。全体テストは439ファイル・4,089件すべてPASS。

基本動作のsmokeは31件PASS。別タスクのサーバーを使わないため、同じハーネスのポート候補だけを5395にした一時コピーを実行。アプリと検査内容は変更していない。家のpage-level UI/stateと室内カメラの変更であり、学習入力・採点・テンポ、保存writer、PWA更新処理は変更していない。fixed-tenの再計測やアート生成の新しい受入評価はこの変更の証拠へ代用しない。

## 検証中の訂正

最初の追加unit検査は本の内部の点に対し別表面の遮蔽まで禁止してしまった。画面内であることと、実カメラからのrayが本を選ぶことを検査する形に訂正し、15件PASS。最初のChromium旅程はローカルrevisionを付け直すビルドと重なり2つのversionを含んだため正式証拠に使わず、最終ビルドを固定して全旅程を再実行した。

## 公開

家庭内の[既存本番](https://sansu-seven.vercel.app)へ `15c3eafc` を配信。Vercelの公開成功と実versionを確認。旧公開版 `ad223e39` を開いたまま `15c3eafc` へ自動更新され、同じ予約と7storeが不変だった。公開版を新しく開いた隔離contextでは実SWによるoffline再読込後にも同じ予約・家の表示・メニュー操作をPASS。実機インストールや子どもの観察を行ったとは扱わない。

統合時にmainへ入った `e741b5c2` の島の入口CSSを保持してrebaseした。アプリ差分は `life-world-first.css` の島専用セレクタだけで、家のカメラ・操作・学習/保存のTS/TSXは同一。全体テストは基準候補01b936f9の結果を保持し、統合3519991ではbuild/assetsとWebKitの起動→家→移動→アルバム/メニュー→学習→同じ家の往復を再確認してPASS。

最終の `15c3eafc` は、寄せた画角のまま矢印キーで端へ歩くと画面外へ出るケースに対応。実住人の全身boundsから必要なときだけ画角を広げ、中央への帰還で近い画角を復元する。学習・保存・部屋の形状は同じ。基準候補の全体439ファイル/4,089件とsmoke31件は保持し、変更の影響があるカメラ/歩行と両ブラウザの実操作を追加で検証した。

公開直後の最初の自動更新windowでは、予約保持を確認した後のoffline `load` 待ちが30秒でtimeoutしたため、その[一連のreport](automatic-update-report.json)はpass=falseを保持する。続くfresh検査も初回SWのnavigationとDB読取りが重なり中断。初回SWのcontrollerとnetwork idleを待ってから実操作を始め、offlineはDOMContentLoadedと家の実DOMを待つ[再検査](production-offline-report.json)でPASSした。旧→新更新とfreshな新版offlineは別contextの証拠であり、最初のwindowでofflineまで完走したとは扱わない。

公開WebKitの初回検査は家の操作・予約保持のassertion後に、version.jsonへの一時的なaccess-control pageerrorが1件あり不合格として残した。初回SWを待ってからリロードし、bootstrap中のerrorを別記録にして以後のpageerrorも空であることを確認する検査を追加した。アプリのPWA処理は変更していない。

本番WebKitの再検査はphone/tabletともPASS。bootstrap pageerrorも0件で、通常のpageerrorを無視した検査ではない。起動→家→床/矢印/端歩行→机のアルバム→メニュー→学習→同じ予約を残して家へ戻る全行程を同じ公開buildで保存した。保存した検査scriptは相対importの位置だけを監査フォルダへ合わせている。

## CI追補

[最初のVerify Core](https://github.com/yutogasaki/sansu/actions/runs/35485910076)は4,088件PASS、写真の2件FAIL。端歩行対応で `frameKeepsakeRoom` が通常の写真構図でも不要な住人boundsを参照するようになり、住人を持たない撮影fixtureで例外になった。boundsの参照を `closeOverview` 時に限定して修正した。テストのassertionやfixtureを緩めず、写真・カメラ・歩行の3ファイル32件を再実行してPASS。15c3eafcの本番画像とPWA記録は修正前の観測として保持し、修正後の公開版を別途確認する。
