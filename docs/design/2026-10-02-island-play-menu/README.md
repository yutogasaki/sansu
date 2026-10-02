# 島と同じ模型で選ぶ、2つの遊び

「世界一のデザイナーの仕事になってる？」への見直しと「やって」に基づくローカル変更。機能を同じ強さで並べるメニューから、本人の仲間と島づくりを大きな2つの入口に変えた。新しい生成美術やキャラクターへの置換ではなく、島の実モデルを再利用してUIと世界を揃えた。今回のcommit・push・公開は行っていない。

[変更前後・3案・全実画面](screens.html) · [最終390幅](growing-390-menu.png) · [320幅](growing-320-menu.png) · [横向き](growing-568-menu.png) · [一続きの接触シート](contact-sheet.jpg)

## 構成と実装

- 「なかまに あう」は実住人の全身・服・外見を最大3人だけ描き、人数は全員分を文字で示す。「たねを おく」は実際の建築前の家の種の模型。未取得の人物や成長済みの家を装飾として足さない。0人は人物なしの輪郭アイコンと0人を示す。
- 主入口は大きな絵と短い動詞を布の縁でまとめる。家・もちもの・なぞる・みせる・はなずかん・あそびかたは枠のない補助列。回転・拡張・設定は既存の折りたたみ内へ維持する。
- 世界の同じrendererで別render targetに最大2枚のPNGを作る。透明な余白を詰め、足・土台を残して文字とは別の領域に収める。先頭3人の外見が同じなら再利用し、失敗時は機能を残す輪郭アイコンへ戻し、次の開き直しで再試行する。render target/clear状態はfinallyで復元し、共有materialを破棄しない。
- 世界のカメラとcanvas寸法、人数/価格/拡張条件、既存の移動先とpause/close/unlockを維持する。44px以上、Escape/focus復帰、音off、reduced motionに対応。新しい学習・報酬・保存schema・PWA規則は追加しない。

仕様の正本は[07の模型入口](../../product/07_ui_design_guideline.md)と[52の島画面](../../product/52_growing_island_game_spec.md)。保存・案内・学習の並行変更はこの美術作業へ帰属させない。メニュー固有の構成変更のため、汎用UIライブラリ、保存ADR、学習仕様の追加は不要。

## 実画面の対象

実アプリ `http://127.0.0.1:5274/#/island`。DEV、Island=true、NatureTown=false、Growing=true、fantasy/life preview=true、root delivery `snap-root-v1`。元のvite configを使い依存cacheだけ `/tmp/sansu-menu-diorama-vite-cache` に分けた。メニューcandidateは `island-play-diorama-v3`、世界 `growing-island-v1`、共有UI `shared-paper-atelier-v1` を維持。

[report.json](report.json)は各撮影の実URL・viewport・root/runtime version/revision・delivery・世界/メニューcandidateを記録する。revision `development-local` だけで固定版と扱わず、src/public/tools/configの1,771入力の開始/終了SHA一致を確認した。4ケースPASS、84撮影、pageerrorなし。SW非制御のDEVであり、公開buildやcold-cache/PWAの証拠ではない。後続の別作業を含む全体release認定へ転用しない。

390×844・768×1024・320×568・568×320で、メニュー/操作列/回転/閉じる、世界タップ、種/めじるし/収納、仲間/みせる/花/なぞる、既存本から旗の詳細、設定4項目、記録・家・学習と0〜9の入力キーを確認した。模型画像がslotに収まり文字と重ならないこと、世界canvas寸法不変、44px/横overflow、短い横画面の全入口/開いた操作列の可視領域も検査した。

2人/200しずく/収納ベンチ/解放済みカタログは隔離DEV profileの明示fixture。学習memoryの任意派生isWeakはfalseで初期化し、7つの学習/Island/Explore正本storeと200しずくの不変を照合する。本のA3の目標選択と、終了後の0/8人fixtureは意図した変更として区別する。実取得・学習効果・子どもの行動の証明には使わない。

## 比較と独立した判定

[前のv2](../2026-10-02-island-pocket-menu/growing-390-menu.png)と最終実画面を並べて作者がレビューした。3つの実runtime CSS probeは[記録](directions.json)と[A](direction-A.png)・[B](direction-B.png)・[C](direction-C.png)。Aの布の入口を採用した。Bの開いた棚は押す境界が弱く、Cの縦の記録帳は機能一覧の印象が残った。比較は作者判断であり、独立した利用者評価ではない。

- **見た目**：対象UIの階層・素材・絵と文字・小画面の修正は作者レビューでGO。世界全体の最終美術や「世界最高」の実証ではない。
- **無説明の理解・安全**：実人数/価格/保存境界を保持し、架空の通知・報酬・焦りを追加しない。子どもの観察N=0。とくに建築前の模型から「たね」を理解できるか、好みと再訪意欲はHOLD。
- **動作**：上記ローカルDEV旅程はGO。実機Safari/iPhone、大きな島でのGPU/電池、本番SW/実two-build更新は別ゲート。

## 検証と診断

- [core](core.log)：docs/入口guard/lint/typecheck、519ファイル・4,603 tests、build/assets PASS。末尾のassets PASSまで実行完了。CSSの最終画像slot修正後は[lint](lint-final.log)と[typecheckを含むbuild/assets](build-final.log)を再確認。既存Fast Refresh warning1件、文書期限warning4件、既存buildのglob/Browserslist warningを保持した。
- [関連9 tests](focused-final.log)：実住人最大3人、透明余白と足/土台のbounds、実建築前模型、描画失敗の状態復元/共有material保持/再試行、実人数、移動先、回転・価格・無効条件を確認。
- [4サイズの実操作](ui-final.log)と[入力/実対象](report.json)。描画余白を詰めた途中でCSS gridの画像サイズが文字へ侵入した[診断画像](diagnostic-model-label-overlap.png)を保持。flexの独立slotへ直し、最終は実画像と幾何検査の両方で確認。途中の自動PASSを最終見た目のPASSへ流用しない。
- [classic smoke](smoke.log)：31/31 PASS、exit 0。旧Exploreの回帰検査。現行Islandの見た目や本番PWAへの認定には使わない。
- [終了時文書check](docs-final.log)と差分の空白checkでcloseoutする。現在のチェックアウトとステージされた別作業のcommitを混同せず、この作業ではステージを変更しない。
