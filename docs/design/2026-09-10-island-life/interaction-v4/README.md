# 島の自動更新と配置操作 v4

自動更新とタップが重なると選択が消える不具合を修正したDEV試作。[比較画面](review.html) / [通常の一周](contact-sheet.jpg) / [仕様48](../../../product/48_island_life_spec.md)。見た目は配置v3を維持する。

## 直した動作

- 自動更新中も、商品と置き場所を選べる。確定した操作だけが先行の更新を待つ。連打しても一件だけ保存する。
- 自分の自動更新で進んだ版だけを引き継ぐ。別画面による変更は既存の競合判定で止め、選び直す。
- 学習へ移った場合、まだ保存を始めていない購入を取り消す。退出して戻る間に更新が失敗しても、取り消した購入を再試行で復活させない。
- 画面に残ったままの失敗は、同じ操作を再試行する。成功後は選択表示を閉じて住人のいる景色へ戻る。保存済みの操作を重ねて購入しない。

保存形式、価格、住人の行動規則、通常の学習writerは変更していない。

## 再現と診断の境界

旧固定v3で、実際のmousedown/upの間に登録済み15秒更新を呼び出し、学習事実の読み込み入口を保留した。phone・tabletとも、ボタンが途中で無効になり配置画面が開かないことを再現した。[修正前の結果](baseline.json)。前回v3の画面が採取されなかったタイムアウトと、原因が同一だったとまでは確定していない。

診断は新しい一時プロフィールと試作DBだけに4creditを明示投入し、読み込みの待ち時間・一回の失敗を注入する。実際の学習による獲得とは別の検査である。[最終の診断結果](interactions.json) / [実行した診断コード](interaction-harness.txt)。

最終見直しでは「退出して戻る→先行更新が失敗→再試行」で購入が復活する抜けを発見した。追加した回帰テストは修正前に失敗し、所有物が0件のはずで1件になることを確認した。[最初の失敗](diagnostics/canceled-purchase-repro.txt)。待ち合わせ失敗時にも画面の所有を確かめる一条件を加え、単体・実画面の両方に同じ条件を追加した。

## 版と対象

最終実画面は `http://127.0.0.1:5250/`、固定コピー `/tmp/sansu-island-life-v4-closed`。候補は `island-life-placement-v3`、実装は `interaction-v4-closed`。`DEV && VITE_ISLAND_ENABLED=true && VITE_ISLAND_LIFE_PREVIEW=true`。[source.json](source.json)のhashは `100de24714efa14643bf4504f02fe167f0256fe276e178ba80969a88168fa387`。元HEAD `70ad92c15a976ae9be2c9513cd4825ea961e4dc0` と共有作業内容からの固定コピーで、単独コミットではない。

最初の統合候補 `0730258f…` も保存している。[そのmanifest](prior-v4/source.json)。既存島・smoke・PWA・80走行はこの版で検査した。最終版との違いは上記一条件と対応する単体・診断コードの3ファイルだけ。[差分境界](source-boundary.json)。最終版はcore、両幅の診断、通常学習からの一周、production guardを再検査してPASS。既存回帰を最終版で再実行した結果とは表記しない。

既存島・throughputの対象は `http://127.0.0.1:5248/`、同じ初回統合入力で試作flagをOFF。[manifest](legacy-source.json)。島PWAは同入力を両flag trueでbuildした `http://127.0.0.1:5249/`、classic PWAは別のclassic build。[島production版](prior-v4/island-production-version.json) / [classic版](prior-v4/classic-production-version.json)。最終production guardは `http://127.0.0.1:5251/`。[最終島production版](island-production-version.json)。DEV、島production、classicを同じ配布buildとして扱わない。

## 検証結果

[集約](verification.json)。[最終docs検査](docs.txt)もPASS。最終版はcore 327 files / 3,478 tests、操作hook 11ケース、診断2幅、通常学習からの一周2幅、production guardがPASS。診断には二重確定、退出で取消、更新失敗後の取消保持、同じ操作の再試行と配置終了、既存7storeの不変性を含める。

通常の一周は新しいブラウザプロフィール、phone 390×844とtablet 768×1024 reduced motion。[結果](report.json) / [ログ](life.txt)。実学習→購入→拡張→成長→住人の反応と接触→色変更→収納→同じ学習の再開が両幅でPASS。成長は明示DEV6時間送りで、実際の一晩の再訪ではない。

初回統合候補の既存回帰は、既存島11、smoke31、classic PWA4、島PWA8と実SW offline、固定10問80走行がPASS。throughputはeligible=true。正答/誤答/区間境界P95はphone 209.3/216.4/209.0ms、tablet 218.9/228.9/216.1ms。自動キーボード操作の計時で、子どもの速度ではない。[既存島](island-report.json) / [smoke](smoke.txt) / [classic PWA](classic-pwa.txt) / [島PWA](island-pwa-report.json) / [throughput](throughput.json)。

検査準備の失敗も保持する。最初の単体はfake IndexedDBの初期化順を修正し、最初のlintはテスト用hook呼び出し名を修正した。旧サーバーが停止していた最初の接続失敗は再起動で解消した。[単体の準備](diagnostics/initial-test-setup.txt) / [lint](diagnostics/initial-lint.txt) / [接続](diagnostics/inactive-server.txt)。これらをアプリの修正証拠とは扱わない。

## 三つの判定

- **視覚：HOLD。** v3の25/60という作者評価を継承する。今回アート・構図・動作表現の変更はなく、機能修正で点数を上げない。比較画面に基準と最終実画面を併記する。
- **無説明理解・安全・再訪意欲：HOLD、子どもN=0。** 操作を失わないことと取消の保存境界は確認できたが、子どもがまた学びたくなるかの証拠ではない。
- **runtime：今回のDEV操作範囲はPASS。** 各検査の結果と版は集約に記録する。公開判定や本番データ移行の合格とはしない。

後続は、見た目の仕上げ、子どもの短い操作観察、通常時間での価格・閾値・減衰の確認、本番データ移行。住人への世話・報酬回収や新しい日課は追加していない。
