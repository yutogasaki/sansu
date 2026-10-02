# 島を眺めながら選ぶメニュー

「考えて」への提案と「やって」に基づく、島のメニューの再設計。機能を同じ大きさのカードで並べる構造から、島を見ながら次の遊びを選ぶ小さな紙へ改めた。愛着・自分で選ぶくふうを支えるローカル変更。commit・push・本番公開は未実施。

[実画面と変更前後](screens.html) · [縦画面](growing-390-menu.png) · [小さい画面](growing-320-menu.png) · [横画面](growing-568-menu.png) · [一続きの接触シート](contact-sheet.png)

## 実装

- 縦は下側の紙、横は右側の紙。縦の高さは世界の60%以下、568×320では右側の幅62%まで。暗幕を敷かず、世界の描画・色・カメラを維持する。320×568でも畳んだ入口が途中で切れない密度へ調整。
- 仲間は実際のモデルの顔と保存人数。入口で生成/表示する顔は最大3人。0人の島は0人として示し、実在しない住人や報酬を装飾に使わない。仲間の一覧は既存の全住人へ開く。
- たね・なぞる・もちものと、いえ・みせる・はなずかんへ直接入る。あそびかたは独立した短い入口。回転・拡張・設定は「しまの そうさ」に畳む。開くと実際の操作列が見える位置へ即座にスクロールする。
- 44pxの入口と閉じる操作、stickyの見出し、押下の短い反応、音off/reduced motion、Escape/元ボタンへのfocus復帰。世界に触れると紙を閉じ、既存の対象操作へ進む。
- たねの既存トレイへメニューからも入る。既存のpause・close・音のunlock・価格・拡張side・保存callbackを維持。拡張は残高不足/処理中に無効。学習・報酬・保存schema・PWAの規則を追加しない。

仕様の正本は[07](../../product/07_ui_design_guideline.md)と[52の画面](../../product/52_growing_island_game_spec.md)。新しい世界美術・キャラクター生成は使用せず、既存のtoy SVGと実モデルを使う。案内・保存の並行作業は今回の変更へ帰属させない。新しいADR・保存/学習仕様の改訂は不要。

## 実画面の対象と証拠

menu candidateは `island-pocket-v2`。共有紙の `shared-paper-atelier-v1`、家 `house-paper-atelier-v1`、世界 `growing-island-v1`、既存学習のlineageを維持する。各captureでURL/route・viewport・revision/version・Island=true/NatureTown=false・delivery `snap-root-v1`・実世界のflag/candidateを記録。共有Utilityはroute固有candidateの該当なしとして区別する。DEVの表示fixtureで、本番SW/cold startの証拠ではない。

固定コピー `/tmp/sansu-pocket-final.IlyFk6`、DEV5272、Chrome/Metalの実アプリ画面。元のvite configを使い、依存キャッシュだけ専用directoryへ分けたQA wrapperを併記。実装・public・tools・configの1,769ファイルを開始/終了で照合する。dirty checkoutをrevision文字列だけで固定版と認定しない。

- [全旅程](full-journey-report.json)、[ログ](ui-final.log)：390×844、768×1024、320×568、568×320の4ケース、source一致PASS。種/めじるし/収納、仲間/みせる/花/なぞる、既存本から旗の詳細、設定4項目、記録/家/学習、0〜9の入力キーを確認。390では追加の0/8人も実一覧と照合。
- [最終操作表示](report.json)、[ログ](ui-tools-final.log)：実画面レビューで見つけた折りたたみの位置を直した後、4サイズの開閉/操作列の可視領域/回転/Escape/focus、種への入口、学習復帰を再確認。全旅程と最終の小さな変更の検査範囲を区別する。
- [現在の共有作業への統合](integration-current/report.json)、[ログ](integration-current.log)：現在のDEV5274でも390幅の全旅程と0/8人を確認。固定版との後続の差は案内/保存の別作業として[source照合](integration-source.json)に列挙。メニュー実装の一致と全体sourceの一致を別に扱う。折りたたみの最後の修正後も、[最終共有版の390幅](integration-tools-final/report.json)と[ログ](integration-tools-final.log)で操作列の可視領域・開閉/回転・種/学習をsource一致で追確認。

2人/200しずく/収納ベンチ/解放済みカタログは隔離DEV profileへの明示fixture。学習memoryの任意派生 `isWeak` はfalseへ初期化。7つの学習/Island/Explore正本storeと200しずくの不変を確認する。本のA3の目標選択と、終了後に追加した0/8人の状態は意図した変更として区別し、実取得・学習効果の証拠にしない。

## 独立した判定

- **見た目**：作者の実画面レビューで、世界の可視面積、顔と紙の素材、主入口/小さな入口の強弱、320pxの切れ、横の折りたたみ表示を確認。対象の配置改善はGO。世界の美術の新しい採点や「世界最高」、子どもの好みの実証はしていない。
- **理解・安全**：架空の通知・報酬・緊急性を追加せず、実人数・題名・価格・無効状態を保持。作者以外の無説明の観察N=0。子どもの理解/再訪意欲の判定はHOLD。
- **動作**：上記の対象旅程GO。44px以上・横overflowなし・操作列の可視領域・source安定性を記録。実機Safari/iPhone、音/電池/大きな島の性能、本番PWA/実two-build更新は別ゲート。

## 検証と途中の診断

- [core](core.log)：docs/入口guard/lint/typecheck、517ファイル/4,592 tests、build/assets PASS。core後のhook依存と短い画面/折りたたみの仕上げは[最終lint](lint-final.log)、[typecheckを含む最終build/assets](build-final.log)、[関連5 tests](focused-final.log)で再確認。既存のFast Refresh warning1件、文書の期限warning4件を保持。
- [classic smoke最終](smoke-final.log)：31/31 PASS。最初の[ログ](smoke-first.log)では旧アルバムの記録画面の待機1件が失敗。共有DEVを終了した後の再実行で通過した。classicは現行Islandの見た目の証拠へ流用しない。
- [初回DEV](diagnostic-first-report.json)：作業中の共有DEVの記録routeで `useContext` error。固定版・専用依存cacheと現在の専用cacheの統合旅程では解消。根本原因の確定や本番の障害修正とは扱わない。
- [初回横の診断](diagnostic-landscape-report.json)：閉じたdetailsの非表示buttonまでbounding boxだけで測定していた。最終driverでは `checkVisibility()` で実表示を判定。44pxの基準を緩めていない。
- [小画面調整前](before-short-phone-report.json)：320pxの入口の下端が切れる状態を保持。最終画像は調整後。
- [終了時文書check](docs-final.log)と差分空白checkでcloseoutする。全体coreと現在の別作業の後続変更を、全体releaseの認定へ置き換えない。
