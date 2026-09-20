# 家のUIと室内カメラ — 2026-09-20

家を小さな見出しと「アルバム／しゃしん／メニュー」の1列にそろえ、縦画面では中央の住人・机に寄せた。端へ歩くと全身が見える画角へ広がり、中央へ戻ると近い構図に戻る。詳細・撮影は従来の全体収容を保つ。低い横画面の詳細は室内と左右に並べる。

[本番](https://sansu-seven.vercel.app) / [実画面の比較と旅程](contact-sheet.html) / [実target・build・source hash](manifest.json)。初期のUI整理は[前段の証拠](../2026-09-20-house-ui/README.md)。

## 実際の公開対象

家の最終アプリ変更は `b6d62216`。公開の最終contact sheetは、並行公開された島の飾り更新を保持した `7ac24419` の同一ビルドでphone/tabletを撮影した。manifestは観測した実revisionと家の実装revisionを分け、対象source hashを実際の7ac24419のtreeから取得している。家候補 `house-world-first-v1`、カメラ `island-home-interior-v5`、Island/Life有効。後続の文書だけのcommitはアプリ入力を変えない。

元の共有checkoutの他タスクの未コミット変更を混ぜず、独立worktreeで実装・検証。先行する島の入口CSSと後続の飾り公開は保持した。ローカル対象は `http://127.0.0.1:5384`、[ローカルmanifest](local-manifest.json)と[基準候補](baseline-manifest.json)を別保存。

## 検証

- 最終アプリ変更の[GitHub Verify Core](https://github.com/yutogasaki/sansu/actions/runs/35486506197)は439ファイル・4,090件、docs/lint/typecheck/build/assetsまでPASS。[集計](ci-final-summary.json)。既存のFast Refresh警告と文書棚卸し期限警告は継続。
- 基準候補のsmoke31件PASS。別タスクのサーバーを使わないため、同じハーネスのポート候補だけを5395へ変更した一時コピーで実行。
- 390/320/768/844幅の[家の境界チェック](edges-report.json)はPASS。実初回3問での記念展示、履歴/直接URL、写真入口、長い一覧の明示fixture、保存失敗/再試行、実SW offline再読込、退出・44px操作を確認。
- [本番WebKit](production-webkit-report.json)のphone/tablet、通常/reduced motion、音offで起動→家→実床タップ→矢印/端歩行→机のアルバム→メニュー→学習→同じ予約を残して家へ戻る全行程をPASS。bootstrapを含むpageerrorは0件。[ローカルChromium](chromium-report.json)と[ローカルWebKit](webkit-report.json)もPASS。
- [修正版への実自動更新](final-update-report.json)は `15c3eafc` → `b6d62216`、その同一windowでのoffline再読込までPASS。同じ学習予約と7storeを保持した。実機のインストールとは区別する。
- 撮影のCI修正後は写真・カメラ・歩行の3ファイル32件もPASS。Chromiumの本番では[実PNGの撮影・保存](photo-chromium-report.json)を確認した。WebKitの保存は下記の未解消事項。

今回の分類は家のpage-level UI/stateと室内カメラ。学習入力・採点・テンポ、保存writer、PWA更新処理は変更していない。fixed-tenの再計測や新しい美術の受入評価を行ったとは扱わない。

## 独立した判定と未解消事項

- 視覚: 390×844で住人と机を約1.4倍にし、天井・床の余白を減らした。家具・キャラクター・材質は同じ。参考画像と実画面を並べて作者が確認。美術全体の満点・完成認定ではない。
- 無説明理解・安全: 独立観察0人。子どもの理解・再訪意欲、実機iOS/Androidは未検証。文字付き入口、退出、移動案内は保持。
- Runtime: 家の表示・歩行・アルバム・メニュー・学習復帰・更新保持はPASS。**WebKitでの写真保存は未解消**。PNGプレビューは作れるが保存がerrorになり、再試行案内を表示する。[現在の公開版](photo-current-webkit-report.json)と[カメラ調整前の旧ビルド](photo-before-camera-report.json)の両方で再現し、Chromiumは成功した。写真の保存writerは今回変更していない。IDB putのエラー観測だけでは原因を特定できず、実機Safariでの再現も未確認。保存まわりの別の調査事項として残す。

## 途中の失敗をどう扱ったか

- 初期の追加unit検査は本の内部の点に対し別表面の遮蔽まで禁止していた。画面内であることと実cameraのrayが本を選ぶことへ訂正し、assertionを実際の操作に合わせた。
- 初回のChromium旅程はrevisionを付け直すbuildと重なり2versionを含んだため正式証拠に使わず、固定したbuildで全行程を再実行。
- 公開直後の最初の自動更新は予約保持後にofflineのload待ちでtimeout。[元report](automatic-update-report.json)のpass=falseを保持。初回SWのcontrollerとnetwork idleを待ってから実操作を始め、offlineではDOMContentLoadedと実DOMを待つ検査へ訂正。上記の最終実更新は同一windowで完走した。
- 公開WebKitの初回旅程はversion.jsonへの一時的なaccess-control pageerrorが1件あり不合格として保存。起動時のSWを待つ再検査ではbootstrapも通常操作も0件で、pageerrorを無視してPASSにしていない。
- [最初のCI](https://github.com/yutogasaki/sansu/actions/runs/35485910076)は写真2件で、住人を持たない撮影fixtureから不要なboundsを参照して例外になった。参照をcloseOverview時に限定して修正。テストやfixtureを緩めず、最終CI全件PASS。

保存した検査scriptは相対importの位置だけ監査フォルダへ合わせている。生の失敗・診断と正式な公開旅程を分け、旧版・別context・実機の証拠へ置き換えない。
