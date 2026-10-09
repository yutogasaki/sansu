# ぽこもこと不思議な島 宣伝サイト

2026-10-10。島の成長差・家・学習を、魅力的でわかりやすいWebとして紹介する依頼に対応。[仕様53](../../product/53_promotion_website_spec.md)を先に追加し、親仕様へ入口を記載した。くふう・にぎわい・愛着を伝え、「育った姿を見たら自分もはじめたくなる」を仮説とする。ゲーム自体のルーター・学習・DBは変更していない。公開buildへ `/promo/` を追加し、SWのnavigation fallbackからこのpathを除外する。

## 成果物

- ソース：`website/`。`npm run dev:website` は localhost:5199、`npm run build:website` は独立した `dist-website/` を生成する。
- 島の3段階を選ぶと、画像と説明が同時に変わる。実配置・住人と遊ぶ・成長、家、算数/英語、1日の遊び方、保護者FAQ、公開アプリへの入口を実装。
- 白と水色の大きな余白、コバルトの操作、コーラルと黄色の局所色。元モデルと明るい丸い3Dの実画像を使う。音や連続アニメーションを追加しない。
- 静的サイトが学習用IndexedDBやSWを作らないことを確認。現公開ゲームへのリンクはHTTP 200を確認したが、新しい宣伝サイトとゲーム本体の公開は行っていない。

## 実画面と素材

[実画面の一覧](contact-sheet.html) · [390幅の全ページ](390-page.png) · [1440幅の全ページ](1440-page.png)

[ブラウザー検査](browser-checks.json)と[素材・source/build SHA・ゲーム撮影元の版/flag/candidate](source-evidence.json)。サイトは `promotion-bright-island-v1`。制作済みの明るい丸い島のローカル検証素材（`docs/design/2026-10-10-bright-round-island/`）から、はじめ/育ち途中/混雑の768幅を無修整で複製。家/学習は同記録の実初回旅程から複製。CSSの表示枠だけで切り取り、生成絵をゲームの画面としない。島は合成の紹介用配置例で、実獲得・学習量・日数を保証する証拠ではない。

## 判定と確認範囲

- 視覚：作者レビューで、3段階の成長差、青い海・丸い木/屋根、家のぽこもこ、学習の問題/テンキーが見えることを確認。ユーザーの最終採用と「圧倒的な魅力」の利用者評価は未評価。
- 理解/安全：具体的な遊び方、紹介用例、ヒント、自分のペース、不在の罰なし、端末内保存を明記。実参加者の無説明理解・魅力・再訪・学習効果はNOT_EVALUATED。
- Runtime：ローカル範囲PASS。320/390/768/1440幅で3段階・FAQ・全画像・横overflowなし・44px対象・リンクを確認。キーボードEnter、reduced motion、JS無効時の代替画像も確認。SW登録0、IndexedDB0、JS例外0。
- `npm run verify:core` PASS：docs/current-ui-entry/lint/typecheck、544 files / 4,803 tests、build/assets。従来のFast Refresh、chunk/PWA glob、Review By期限の警告あり。サイトのbuildにBrowserslistデータ期限の警告あり。
- `npm run build:website` PASS。完成ビルドを localhost:5200 で配信して撮影。データを持つゲームへの変更がないため、classic smoke、ゲームの更新/PWA/固定10問は対象外。実機・独立観察・外部公開は未実施。

生ログ・途中画面は `output/promotion-core.log`、`output/promotion-browser-result.txt`、`output/promotion-first-*`。実画面チェックで画像の高さを元の比率へ修正し、家の顔と全身が切れないようにした。途中のlazy未読込の全ページ画像は最終証拠から除外した。


## mainからの公開

宣伝サイトを既存Vercelの `https://sansu-seven.vercel.app/promo/` へ追加する。rootのbuildはゲームのWorkbox生成後に、`/promo/` 用baseで独立サイトをbuildして `dist/promo/` へ複製する。ゲームのnavigation fallbackは `/promo/` を除外し、宣伝サイトの画像・フォント・HTMLをゲームのprecacheへ入れない。ゲームのIndexedDBと学習は変更しない。追加プロジェクトの作成は接続scopeの403で成立せず、既存Git配信を使用する。

公開用pathで4幅の3段階/FAQ/画像/overflow/44px/リンク、keyboard/reduced motion/JS無効を確認。ゲームSWが実制御するブラウザーから `/promo/` に移っても宣伝ページを表示し、promoのcache追加0を確認。生結果は `output/promotion-publish-browser.txt`、`output/promotion-sw-boundary.txt`。

コミット対象だけをindexから別ディレクトリへ展開してrelease回帰を実施する。先にあったメニュー移動・島の美術とその完了文書は今回のコミットへ入れない。初回の作業ツリーcoreと、今回のindexの検証を区別する。公開の成立はpush後にHTTP/実ブラウザーと公開version.jsonで照合する。

indexへ取り出した候補の `npm run verify:release` はPASS（544 files / 4,803 tests、classic smoke 32件、保護画面/更新復旧と実two-buildのSW更新・offline/cache/data保持）。classic専用回帰でありGrowingの実機・独立理解/魅力の合格とはしない。[今回の対象と結果](release-evidence.json)。文書追記後は同じindexをexportしてdocs checkerを再実行し、アプリ入力を変更せずcommit/pushする。
