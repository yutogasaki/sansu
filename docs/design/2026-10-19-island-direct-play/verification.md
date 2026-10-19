# 島を直接触って遊ぶホーム

2026-10-19。利用者の追加改善依頼とChatGPT「島画面再設計案」の評価を受け、メニュー中心の操作を島へ戻す。くふう・愛着に効き、弱める柱はない。島の美術・住人・成長・所有・価格・学習・routing・保存形式は変更しない。公開・commit・pushは行っていない。

## 変更

- 「おく／もちもの／メニュー」を島の下端へ。新規配置と所有品を1タップで開く。
- 島名としずくは上端、そだつ場所は小さな絵と短い一文。対象編集・配置・情報面と重ねない。
- ながめを独立させ、土地拡張は費用と可否を島で見てから方向を選ぶ。入口・取消では購入しない。
- メニューは暮らしと補助機能へ縮小。実在の住人模型と既存の玩具アイコン、14pxラベル、44px以上の操作を使う。縦画面は高さ60%以下、短横は右側。320幅は本文をスクロールできる2列。
- 5タブの選択表示を統一し、まなぶの常設色が現在地に見える曖昧さを減らす。Escapeと各入口へのfocus復帰を確認する。

[ホーム390](home-390.png)、[補助メニュー390](menu-390.png)、[最終390/768の主要旅程](contact-sheet.html)。これらは実アプリのDEV診断保存で、自然取得や本人の実データではない。

## 対象と入力

- URL: `http://127.0.0.1:5198/#/island`、Island=true、NatureTown=false。
- Revision: `development-local`、version: `development-local:028c538b-2401-4a0b-8da7-b248ce432c25`。
- Delivery: `mystic-island-v1`、世界: `mystic-island-shore-garden-v18`、ホームとメニュー: `island-direct-play-v2`。
- Cache: DEV modules、service worker controlled=false。実production配布/SW更新の証拠ではない。
- 最終app入力は [全srcのSHA](app-sources.json)。path順JSONのSHA256: `f635d3f38692914ab5821af164b3ef78ab3dfb08aff4da3e18f9df5aa0fb5149`。
- コマンド・時刻・各captureのruntime metadataとsource前後は各reportに保存。生成物は下記のローカル出力を使用する。

## 検証

- 関連unit: `GrowingHomeTools / GrowingIslandMenu / GrowingTray / e2e-growing-places`、4 files / 21 tests PASS。価格境界、busy、利用可能な方向、主操作と補助メニューの分離、13記念品の保持を含む。最終TSXのeslintとtypecheckもPASS。
- `npm run build`: PASS。最終CSSも `build-final.log` の再buildでPASS（precache 8.54 MiB / 12 MiB）。
- `npm run e2e:smoke`: classic 32件 PASS。島の実画面証拠とは分ける。
- `output/island-direct-20261019-d/report.json`: 320×568 / 390×844 / 768×1024の配置・新規品分類・13記念品・無料再配置/再読込・価格通りの土地購入と不足・取消・focus復帰がPASS。768幅はreduced motion、全幅sound off。568×320の最初の配置確定ではtouchが保存へ届かずFAILを保存した。
- `output/island-direct-20261019-f/report.json`: 最終app入力の568×320で同じ旅程PASS。既存の検証済み `confirmStoredPlacement` により、busy/未到達の確定を監視し、元の所有者・価格・成長・実セルを照合する。
- `output/island-direct-nav-20261019-a/report.json`: 390×844 / 568×320で実在住人の模型、補助5機能の往復、5タブ、全TenKey、同じ未回答予約への再開、学習store不変をPASS。実住人は明示fixture。
- `output/island-direct-nav-20261019-b/report.json`: 最終app入力の390×844 / 768×1024で上記の補助機能・5タブ・全TenKey・同予約を再確認しPASS。768幅はreduced motion。両幅のホーム→メニュー→家→学習を実画面に保存。

初回失敗は削除しない。aは土地の方向数を3と固定したharness誤り、bはrAF前のfocus即時assert、cは購入touch後の保存未到達、dは横画面での配置確定未到達。eは保存済みセルの符号付きゼロをdeep equalityで別値としたharness誤り。fでは非ゼロの有効セルと既存の監視helperを使い、同じ所有IDの保存を確認した。これらを実取得や実機の入力品質へ読み替えない。

## 未解決と判定

- [320幅のメニュー背後の黒い帯](menu-320-diagnostic.png)を確認。DOM hit検査ではcanvas層で、700ms後にも残る。住人なしの不要な模型描画を省き、menuのcomposite境界を分けても残ったため、原因は未確定。操作と保存のPASSをこの描画不具合の解決へ読み替えない。実機/GPU差と描画原因を次の小さな診断へ残す。
- `verify:core` 内の既存 `tools/portal-entry.test.mjs`「hiding the recommendation or choice consequence fails the inspection」が `Missing expected exception`。このファイルは開始時から別作業の未commit変更で、島の修正に混ぜない。
- 子どもの独立理解・自発的な学習/再訪、実機の音・GPU性能・PWA更新・production公開は未評価。

情報整理と対象操作は改善。数値による美術の最高評価は付けない。無説明理解と配布品質はHOLD。世界の山場・キャラクター・ゲーム因果を変更せず、通常時の操作階層だけを整理した。全体の包括美術R3は自動再開していない。

## Closeout

全体suiteは628 files中627 PASS / 1 FAIL、5,411 tests中5,410 PASS / 1 FAILで完了（07:47:56開始、876.81秒）。失敗は上記の開始時から別作業だったportal検査だけ。docs/入口guard/lint/typecheckはPASS、最終変更後の関連21件とeslint/typecheck、buildは別に再確認した。suite中の小さなUI修正は全体PASSで包まず、最終app SHAと対象結果へ帰属させる。公開の合格ではない。

生成索引・portalと最終docsの結果はローカルcloseoutログに記録。最終アプリsrcのSHAは上記manifestと一致する。既存差分・初回の失敗・別作業のportal実装を保持し、全体suiteの失敗を隠すための修正は行わない。
