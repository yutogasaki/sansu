# 家のUIをしまに合わせる — 2026-09-20

追補: 縦画面の室内カメラを `island-home-interior-v5` に変更。以下は最初のUI整理時点の証拠で、カメラ追補の公開証拠は別途記録する。

家のoverviewを、小さな見出しと音ボタン、広い室内、下端の「アルバム／しゃしん／メニュー」に変更した。常設カードは任意のメニューへ移し、記念・おしらせ・かざりときおく・チャレンジ・撮影の入口を保持。低い横画面の記念詳細は室内と左右に並べ、見出しが操作を覆わないようにした。

仕様は [43](../../../product/43_island_navigation_spec.md#家も景色を主役にする2026-09-20)。[画面比較](contact-sheet.html)、[対象とsource hash](manifest.json)、[実操作記録](room-report.json)を参照。

## 対象と比較

- 実対象: `http://127.0.0.1:5383` のローカルproduction preview。オンラインの本番へは未公開。
- build: `house-world-first-v1-local:89223e48-4256-4366-ae91-198aa748c4d6`。共有作業ツリーの既存変更を含むビルドであり、HEADだけを変更内容の証明にしない。今回の5つのアプリsourceのhashをmanifestに記録。
- delivery: `VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_ENABLED=true`、DOMの家候補 `house-world-first-v1`。室内のモデル、材質、カメラは既存 `island-home-interior-v4` を保持。
- Chromiumの390×844（通常motion）、768×1024（reduced motion）、320×568、844×390。音off。実機iOS/Androidとは区別する。
- 新しい使い捨てprofile/contextから実SWを有効にして確認。家の表示・メニュー・アルバム・学習・家への復帰のcontact sheetはすべて同一の最終ビルド。
- TRANSFER: 仕様48で採用したLifeの小さな操作面、生成り・藍・青、物の絵と短い文字。DO NOT TRANSFER: 大きなカード一覧の常設、重なる見出し、部屋を覆う操作面。

## 独立した判定

| Gate | 今回の結果 |
|---|---|
| 視覚的魅力 | 操作面の統一と室内の見える面積を実画面で確認。室内美術は更新していない。既存美術全体の8/10以上の評価や完成認定は行わない。phoneの天井・床の余白は残る |
| 無説明理解・安全 | 独立観察N=0で未検証。作者による確認では能力の評価・叱責・危険な表現を追加していない |
| Runtime整合 | 下記の変更範囲はPASS。実機インストール、異なる2ビルドへのPWA更新、学習throughputの新規測定、一般公開の総合判定は含めない |

今回の分類はUIレイアウト・メニュー状態。学習問題・採点・入力・テンポ、所有・通貨、storage writer、URL/履歴の定義は変更していない。新規アート生成・素材配信・探索encounterの変更もない。Coreと家の該当経路を検証し、旧島全機能・旧探索を含むrelease全体の合格とはしない。

## 検証

- `npm run docs:check`: PASS（以前からの棚卸し期限警告あり）。
- `npm run lint`: PASS（既存 `IslandMilestone.tsx` のFast Refresh警告1件）。
- `npm run typecheck` / Island・Life有効の `npm run build`: PASS。PWA precache 125ファイル・11.57 MiB / 12 MiB。
- `npm run test:run`: 439ファイル・4,085件を実行。4,083件PASS、学習進行とLife repositoryの2件が同時実行中に時間切れ。失敗した2ファイルを個別に再実行して全件PASS。時間制限やassertionは変更していない。
- keepsakesコンポーネントの15テスト: 最終変更後もPASS。
- 家のedge harness: 390/320/768幅でメニュー・履歴・再読込、実初回3問から記念の展示、アルバム/写真/撮影、全16品の明示aggregate fixture、保存失敗/再試行、実SW offline/reload、直接URLをPASS。最初の3幅の結果と、同じrunで見つけた旧横画面の重なりは [元記録](portrait-edges-report.json) に残す。横画面は修正後の最終ビルドで別runをPASS。
- 最終ビルドのphone/tablet: 実床タップ、同じ住民の矢印キー移動、机上アルバムの実3Dタップ、閲覧前後の7store不変、メニューの閉じる/焦点復帰、家メニューからの学習と同じ予約への復帰をPASS。
- 44px以上の退出と54pxの下部3操作について、4サイズで実際のhitを確認。メニューのTab/Escape、詳細から見えるメニュー入口へのfocus復帰を確認。

最初のmenu検査はChromiumがnative dialogの末尾でbrowser chromeへfocusを移した際のBODYを誤って不合格にしていた。modal状態と背景操作へfocusしないことを確認する検査へ修正した。次の失敗は閉じたdialog内のrole検索を先に行うハーネスの誤りで、実際のメニューを開いてから検索する順に修正した。元の失敗ログは `output/playwright/house-overview-v1/` に保持。

関連する既存ハーネスの記念・おしらせへの入口も、新しいメニューを実操作で開く手順へ合わせた。keepsakes全資格・旧Home Journey全行程・旧navigation全体のハーネスは今回通し実行していない。DEV Home Journeyは室内領域の高さだけ互換調整し、同モードの全行程は未検証。

## 引継ぎ

未コミット・未公開。部屋を眺めながら、思い出や学びの記念を自分から開きたくなることが今回の仮説。子どもの再訪意欲は未観察。原画の作り直しや家具の追加、学習/保存の変更は行っていない。
