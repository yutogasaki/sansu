# 島・家・学習のUI操作の統一

後続のユーザー指示による[main統合候補の検証](main-integration/README.md)。当初の共有checkoutと独立候補の結果を区別する。

2026-09-09。依頼はゲーム全体のUI・UXを整え、直感的に使いやすくすること。[実画面の一覧](review.html)と[コンタクトシート](contact-sheet.png)。

## 反映したこと

- メニューと画面の題名を揃えた。どうぶつとあそぶ、みつける、もちもの、きせかえ、なまえ・けしき、いりえで入口の言葉を引き継ぐ。
- 共通の `IslandPanelHeading` で、通常詳細は左の「← もどる」、集中画面は右の「× とじる」。アイコンだけの退出や、×なのに「もどる」という不一致を除いた。長い題名は折り返し、戻る領域を縮めない。
- 家の記念・お知らせは、同じ場所の「もどる」で家の先頭へ戻る。家の先頭に「しまへ」を置き、二つの退出ボタンが競合しないようにした。
- 生成り・藍・既存の押し面を再利用した。新しい演出や待ち時間は追加していない。通常の連問・採点・保存・PWA・3D造形・公開flagは変更していない。

主な操作が一定の場所・名前で見つかることで、任意の遊びから学習へ戻りやすくする仮説。子どもの自発的な再学習の増加は未検証。

正本は[親01](../../../product/01_app_spec.md)と[ナビ43](../../../product/43_island_navigation_spec.md)。表示44・UI07・MASTERの基本方針は維持し、ルールを重複追加していない。

## 対象

ローカル固定production preview `http://127.0.0.1:5386`。revision `70ad92c-ui-continuity-working`、version `70ad92c-ui-continuity-working:55862086-1db2-4189-a448-3aac9ce95ace`、`VITE_ISLAND_ENABLED=true`、delivery `mystic-island-v1`、visual `mystic-island-shore-garden-v18`、learning `mystic-island-learning-v2`。[配布物のhash一覧](artifact.json)が実際に検査したファイルを識別する。

共有の未コミット変更を含む作業ツリーからbuildした。独立コミット・本番配布済みという意味ではない。新しい家のDEV専用rendererは別の統合候補で、この固定production候補の検証に含めない。各レーンは新しいブラウザcontext、音off、reduced motion。service workerを許可したが、実offline・二版更新の合格証拠とはしない。

## 確認結果

| 確認 | 結果・範囲 |
| --- | --- |
| docs / lint / typecheck | 通過。lintには既存のIslandMilestoneのFast Refresh warning 1件 |
| 全単体テスト | 作業ツリーで318ファイル・3,423件通過。4workerで実行 |
| build / assets | 型検査と専用outDirへのVite production build、同artifactのasset checkerが通過。precache 94件・10.53 MiB / 12 MiB |
| 既存smoke | 修正したQAで31項目通過。classic DEV回帰であり、上記production候補のPWA検証とは別 |
| ナビの実経路 | [結果](navigation.json)。390×844 / 768×1024でメニュー6入口の名前と画面、家のお知らせからの一段戻り、設定からの学習・下書き、履歴戻る/進む、配置取消/保存、実写真の保存/詳細終了、直接URL、記録の更新を通過 |
| 画面寸法と実hit target | [結果](geometry.json)。360×640 / 390×844 / 768×1024 / 1024×640で15画面の退出ボタンが44px以上・画面内・遮蔽なし、アイコンと戻る/閉じるの一致、横溢れなし。家の記念/お知らせから戻ることも確認 |

ナビは2桁算数の新規プロフィールfixture。寸法確認は新規プロフィールから通常plannerの実問題3問を回答し、工作を開ける状態にした。これを長期学習成果・全家具の獲得・全教科の学習検証と解釈しない。

完全なログ・各画面はローカルの `output/playwright/ui-ux-continuity/` と同prefixのlog。掲載8画面は同じ固定artifactの実画面で、家のお知らせ・広い画面は別fixture。異なる獲得状態を一人の履歴として扱わない。

## 検証中の修正

アプリ変更後、初回のナビQAが1桁問題へ「1」を入力して下書きと扱っていた。現在はその時点で自動採点されるので、2桁問題の未完入力へfixtureを修正した。回答数はカレンダー切替にも同じ文言があり、metric領域へlocatorを限定した。合格は修正後の両幅に限定し、最初のtraceはローカルに保持した。

smokeはEscapeをスキップとして使う過去の前提で停止した。現在の明示的なスキップボタンに合わせて再実行し、31項目を通過した。アプリ側の入力・採点をテストに合わせて変更していない。

寸法QAは学習への移動直後にホームの描画完了を入力readyと扱う競合があった。`learning` の実modeを待つように直して広い画面を完走した。phoneの通過と合わせて4幅の結果を収録した。

## 独立した判定

- 視覚：実画面の情報階層・戻る操作の統一を確認。世界の造形は今回変更しておらず、既存アートのHOLDを解除しない。新しい視覚点数は付けない。
- 無説明理解・安全：音off / reduced motion / 退出と保存保持の技術確認は通過。独立した子どもの観察はN=0で未評価。
- Runtime：上記UI・ナビ範囲は通過。学習throughput、実offline/PWA二版更新、新ホーム全メニュー統合、公開の全体ゲートは今回の結果で認定しない。

本変更の公開操作は行っていない。実機での子どもの操作観察と、新ホームの世界表現の統合は別の残課題。
