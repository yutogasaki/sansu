# 島を開くまでの読み込み表示

2026-09-29。一括で進める依頼と読み込み表示の追加に対応。アプリ本体取得前のHTML、保存読込、画面module、庭/家の3D初回描画、学習の準備、思い出の待ち状態を共通の表示へ接続。既存の布配色と道具アイコンを使う。偽の進捗率・強制待機・自動reloadを追加せず、準備完了で外す。動き抑制は回転なし。8秒を超えるReact待機には短文、HTML起動待機は12秒で再読込入口も表示する。

庭はWebGL context loss/作成失敗を読み込みと区別し、同じ保存を使ってその場で再試行する。家は既存のretryを維持し、最初の実frameまで表示を残す。ぽこもこのモデル、庭/室内の美術、学習規則、所有、保存21は変更しない。

自然の残件は[次期水源・時計の導入単位](../../product/island-nature-integration.md#次期の水源時計の導入単位2026-09-29)へ整理。北岸外の固定水源、旧所有と水ばちの保持、二つの保存時計と景色の時刻、復旧を含む切替順を定義。次期時計/水源の本番実装とは区別する。

## 検証の経過

- 初回core4,300 testsとbuild通過。再試行時に同じstateを新rendererへ直ちに渡す依存を補強した最終版も、[core](core.txt)の4,300 tests・lint/typecheck/build/assets/docsを通過。既存Fast Refresh警告1件とchunk/Browserslistの案内は残る。
- 遅延診断の最初のrunは、entry moduleを保留したままPlaywrightがfonts.readyを待って撮影できなかった。標準のsystem fontで表示するHTMLの診断ではこの待機を省く。rawは `output/island-loading-20260929/loading/`。
- 次のrunは庭/家の遅延・描画後の表示解除・実WebGL喪失/retryと保存保持まで進み、記録画面の見出しを「きろく」に固定したハーネスで停止。実画面の「記録」も受け入れるrole locatorへ修正。元のreport/screenshotは `output/island-loading-20260929/loading-retry/`。
- HTMLの12秒待機を追加したrunは、保存読込から世界moduleの要求までの間にハーネスが先回りして停止。要求を実際に捕捉してから遅延を検査する待機へ修正。元記録は `output/island-loading-20260929/release-loading/`。アプリの待ち時間は追加していない。
- 旧横断ナビ検査は現行Life canvasを待てず停止。共通ready helperに現在のcanvasを追加した後も旧「しまのメニュー」を要求して停止した。現行の「つくる」等とは契約が異なるため、旧全経路の合格は主張しない。元記録は `output/island-loading-20260929/navigation/` と `navigation-current/`。今回の現行往復は下記4サイズの実初回旅程で別に検査する。

## 固定候補と実画面

[manifest](candidate-manifest.json): 本番形式5481、Island/Life/Discovery/Fantasy ON、Life Preview/NatureTown OFF。庭living-fantasy-garden-v2、室内house-world-first-v1、学習pokomoko-pop-live-v8。[実画面一覧](index.html)と[遅延/再試行/保存](loading.json)。390×844・768×1024 reduced・320×568・568×320でPASS。entry/庭/室内moduleの保留、HTMLの12秒待機と再読込入口、Reactの8秒待機、first frame後の解除、実WebGL喪失/retry、同じ所有/学習、記録/設定への往復、実SW offline再開・同予約への追加回答、entry module失敗からのHTML retryを確認。app/dist hash一致、pageerror 0。credit/profile/保存の注入なし。

## 追加の回帰確認

[写真操作](photos.json): 390×844・320×568・768×1024・844×390で撮影/保存/一覧/戻る/削除確認/読込失敗からのretryをPASS。実SafariのOS保存は別。旧ハーネスが閉じた家メニュー内の撮影ボタンを要求した初回FAILを保持し、実際の「いえの メニュー」を開く手順へ更新して再検査した。

Classicの`e2e:smoke`31シナリオPASS（[結果](smoke.txt)）。現行の島の全経路を検証したとの主張には使わない。

[PWA実2ビルド](pwa-two-build.json)はclassicの異なる実bundle/SW間の更新、保護入力、保存保持、切断/旧workerからのoffline復旧をPASS。[PWA更新4項目](pwa-update.txt)も同じ入力から生成したclassicのnew buildでPASS。現行島のoffline確認は上記loading.jsonの実初回旅程で分けて行った。

差分確認: 待機中の未表示frameを発見として計上しないよう、庭の提示判定をready後に有効化。描画再試行は同じstateを新rendererへ渡し、以前のrendererを破棄する。所有/学習の書込み経路と保存schemaは変更なし。

## 判定の境界

外観: 同じ道具アイコン/布配色の待機表示。キャラクターや庭/家の新しい美術採用ではない。390/768幅の最終実画面で、待機文言・戻る入口・描画後の庭/室内を確認した。

理解/安全: 読み込み・失敗・再試行を文字で区別。子どもの無説明理解・意欲の実測は未実施。

Runtime: 遅延/障害は明示診断。実iPhoneの30秒待ち解消、電池・音・実Safari写真保存は自動検査から合格にしない。公開版は下記の2サイズで追加検査済み。

## mainと本番

main `c1e3bebfae32098569a1cbfda0f74f8beeb61b34` をpushし、Vercel READYと公開`version.json`の同SHAを確認。[公開版](https://sansu-seven.vercel.app/#/island)の390×844通常/768×1024 reducedで、起動HTML/庭/室内の遅延、WebGL喪失/再試行、同じ所有と学習、記録/設定との往復、実SW offline追加回答、entry module失敗からの再試行をすべてPASS。pageerror 0。[公開検査](public/report.json)・[配信版](public/version.json)。実機や実速度の測定ではない。

[index検査](index-verification.json)でコミット予定の全1,371 app入力が最終検証候補と一致し、リポジトリ外へexportした同一indexのdocs checkを通過。公開確認後は証拠とポータルだけを更新し、app入力を維持する。
