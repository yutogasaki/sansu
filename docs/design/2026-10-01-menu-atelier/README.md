# 家と揃える、島のメニュー

ユーザーの「他のメニューとかも」に合わせ、[家の紙のアトリエ](../2026-10-01-house-atelier/README.md)の素材・既存の玩具アイコン・目的別の強弱を島と共有Utilityへ広げた。愛着と自分で選ぶ柱に効く表示変更。ローカル実装、今回のcommit・push・本番公開は未実施。

## 変更した面

- 育つ島：いえ・なかま・みせる・はなずかんを大きな絵の入口へ。本・なぞる・もちもの・設定は短い入口。回転/土地の既存操作は下段。スクロール中も見出しと44pxの閉じる操作が残り、キーボードで閉じると元のメニューへfocusが戻る。
- たね/めじるし/収納、仲間、みせる、図鑑、物の詳細：同じ紙の縁・短い影・価格の独立した表示へ。実カタログ・価格・未解放・種選択・保存のcallbackを保持。
- 標準Islandのnativeメニュー：同じ紙の見出し、主入口の色、整理の折りたたみへ。Escape/focusの既存契約を保持。
- 設定：プロフィールを大きく、学習と表示を対に、保護者を独立した入口へ。説明を省略せず折り返し、320pxで題名の一文字残りを避ける。tabletは既存のsidebarと詳細の構成を保つ。
- 5タブ：現在地は薄い緑と形で示し、学習は安定した青。44pxの操作と既存の学習/Utilityの復帰先を保つ。

仕様は[UIガイドライン07](../../product/07_ui_design_guideline.md)の「家と揃えるメニューの素材」を更新。新しい遭遇美術やキャラクター生成は使っていない。学習の出題/テンポ、通貨/解放、保存schema、routing/PWAに新しい規則を導入しない。親仕様01・遷移43・保存13・ゲーム52の規則を変更する必要はない。並行する案内機能の実装を今回のUI変更へ帰属させない。

## 実画面と識別

[実画面の一覧](screens.html)、[接触シート](contact-sheet.png)、[島のメニュー](growing-390-menu.png)、[設定](growing-390-settings.png)。画像は実アプリのbrowser screenshotのみ。モックや生成画像で置き換えていない。

全体のstyle candidateは `shared-paper-atelier-v1`、島メニューは `island-paper-atelier-v1`。既存の家 `house-paper-atelier-v1`、育つ島 `growing-island-v1`、学習v8のlineageは維持する。[実行report](report.json)は各captureのURL、viewport、共通rootのIsland=true/NatureTown=false/configured delivery `snap-root-v1`、revision/version、世界の実flag/candidate、共有Utilityの該当なしを記録する。DEV module cacheであり、本番SW/cold startの証拠ではない。

共有checkoutで案内機能が更新されているため、`/tmp/sansu-menu-atelier.XBc5IM` の固定コピーを使用。育つ島は5272、標準Islandは5263で、通常のflag-on入口 `/#/island` を検査。DEVのrevisionだけではdirty sourceを識別できないため、[source snapshot](source-snapshot.json)と対象4実装の開始/終了SHAを併用する。最終の小幅向け題名のCSS調整は、core後にlint/build/assetsと全UIを再確認した。

固定版の1,491 source/asset/configファイルの最終UI開始/終了SHA一致を確認。共有checkoutのLayout/共通CSS/標準メニューは同一、GrowingIslandのメニュー境界も同一。GrowingIslandのその他の部分には後続の案内機能の更新がある。現在のDEV5260でも[390pxの統合往復](integration-current-report.json)をsource一致・全操作PASSで追確認し、[現在のtypecheck](typecheck-current.log)と[関連15 tests](focused-current.log)もPASS。[統合ログ](integration-current.log)。固定コピーの全core結果を共有checkout全体のrelease結果へ置き換えていない。

## 独立した判定

- **見た目**：作者が実画面でカードの強弱、紙/布の連続性、価格と説明の読める間隔を確認。320pxの題名の孤立した改行を修正。世界最高や子どもの好みを実証した評価ではない。
- **理解・安全**：偽の通知/報酬/緊急性、未解放を開いて見せる表現を追加しない。未説明の観察者N=0、子どもの理解/再訪は未評価。これをruntimeのPASSで埋め合わせない。
- **動作**：標準/育つ島の6ケース、390×844/768×1024/320×568/568×320、音offとreduced motionを確認。native Escape、追加closeのkeyboard/focus、種/収納tab、仲間/見せる/図鑑/なぞるの往復、実案内から旗の詳細、設定4項目、家/記録/学習へ復帰、全数字キーを確認。主要入口44px、横overflowなし。実機/本番PWA/公開は別ゲート。

DEVの隔離プロフィールに200しずく・2住民・収納ベンチ・解放カタログを注入した表示fixture。学習memoryの任意の派生 `isWeak` はfalseへ明示初期化し、記録の初回正規化とUI変更を混同しない。実取得・実学習効果を認定しない。旗の詳細は既存の本でA3を本人選択する通常操作を使うため、その任意目標だけは意図した保存変更。7つの学習/Island/Explore正本storeとしずく残高の不変を照合し、ゲーム設定全体の不変とは扱わない。

## 検証と診断の境界

- [core](core-final.log)：docs、入口guard、lint、typecheck、516ファイル/4,586 tests、build/assets PASS。既存の期限warning4件、Fast Refresh warning1件、precacheの未一致glob2件を保持。
- [最終lint](lint-final.log)、[最終build/assets](build-final.log)：狭幅の題名調整後PASS。
- [classic smoke](smoke.log)：31/31 PASS。現行Islandの見た目の証拠へ流用しない。
- [Island navigation](navigation.log)と[report](navigation-report.json)：390/768両幅PASS。入力の下書き/同じ予約、設定詳細/履歴/写真、scrollと学習への復帰、現在地/44pxを検査する。
- [最終UIログ](ui-final.log)と[report](report.json)：上記6ケース、対象source開始/終了一致でPASS。
- [終了時の文書check](docs-final.log)：共有checkoutのdocs:check PASS。既存の期限warning4件を保持。

最初のnavigationは `変更` という表示文字に対し、実buttonのaccessible nameが「算数のレベルを変更」になっているため待機に失敗した。[元ログ](navigation-first.log)を保持し、実際のrole/nameに検査側だけを修正した。最初のメニューfixtureは記録の既存処理が未初期化 `isWeak` をfalseへ保存し、正本不変の比較がFAILした。[元report](ui-fixture-first-report.json)と[元ログ](ui-fixture-first.log)を保持する。修正版はfixture初期化を明示し、状態差分を無視する比較には変更していない。

identity補助の初回はUtilityに残る非表示のIslandキャッシュを現在画面と取り違え、世界markerがないことに失敗した。[元metadata report](ui-metadata-first-report.json)を保持。修正版は現在のURL/routeを判定し、共有Utilityの候補を該当なしとして記録する。最終の実世界flag/candidate gateを省略していない。

初期のcapture補助には、存在しないGrowing menu markerを待つ25秒の余分な待機があった。countを確認する補助へ修正。中断した診断captureは `output/playwright/menu-atelier-*diagnostic*` / `menu-atelier-final` に保持し、最終接触シートに混ぜない。browser環境はMac Chrome/Metalで、実機の描画速度測定ではない。
