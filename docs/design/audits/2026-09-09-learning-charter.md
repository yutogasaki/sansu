# 学習面とデザイン憲章

対象は島の学習画面。ユーザーの「質素な学習シーンをデザイン憲章に基づいて改善する」という依頼に対応する。

## 方針と変更

[憲章](../../product/design-charter.md)の色面・模様の役割・読み取り面の原則と、[レイアウト44](../../product/44_display_layout_spec.md)を適用。単色だった外周へ共通の静止した大きな水玉を戻し、ラベンダーの進行帯と入力台座、生成りの無地の問題面を分けた。入力選択は既存の青、ヒントとお手本には文字に添えるアイコンを使う。教材図形の意味色、島の景色を隠す集中配置、入力寸法・予約・採点・保存は変更対象外。

実装は `IslandLearningTheme.css` と `IslandLearningPanel.tsx`。新しい世界画像・住民・報酬・演出・待ち時間は追加しない。

## 実画面の証拠

- ローカル実アプリ: `http://127.0.0.1:5217/#/island`、`VITE_ISLAND_ENABLED=true`。
- revision: `development-local`、version: `development-local:cd81d825-32c6-4230-b92a-c38b78bee728`。
- world: `mystic-island-shore-garden-v18`、learning: `mystic-island-learning-v2`。本変更はその操作面のCSS調整で、世界画像の候補変更ではない。
- 明示的な別プロフィールfixtureから通常plannerで開始。sound off、reduced motion。新規browser context、SW未制御のDEV検査。production/PWA・実参加者・固定版の速度測定とは区別する。
- 比較画像・操作report: `output/playwright/learning-charter/before-*.png`、`after-*.png`、`after.json`。
- 390×844、768×1024、1024×640の数値入力、360×640の筆算、390×844の英語選択と位取り図で、問題・回答・ヒントを実操作した。
- 全テンキーの並び、44px以上のtap領域、画面内収容、中央へのhit、回答とヒント後の操作領域を既存 `assertControls` で確認。6ケース合格。

## 独立した判定

- 視覚的な魅力: 作者の実画面比較では、外周の青緑と大きな水玉、進行・入力のラベンダーで無地面との階層が明確になった。短い画面の筆算ヒントも問題とキーを隠さない。学習面の局所改善であり、世界アート全体の最終承認ではない。
- 無文字理解・安全: 実参加者の独立観察なし、未評価。既存の操作名・意味色を保持した作者の確認を子どもの理解と同一視しない。
- Runtime整合: 上記DEV6ケースの回答・ヒント・配置は合格。全体品質ゲートと公開ビルドの結果は下記に分ける。

## 全体検証

`npm run test:run` は295ファイル・3244テストが合格。共有作業ツリーで他タスクの入力修正も進行中のため、固定公開版や今回の変更だけを切り出した結果とは扱わない。

`npm run verify:core` はdocsとlintを通過したが、別変更の未追跡 `LearningAnswerForm.defer.test.tsx` の3箇所で `toHaveBeenCalledExactlyOnceWith` が現在のVitest型に存在せずtypecheck停止。`npm run build` も同じ型エラーで停止した。元のテストを今回の見た目調整のために変更しない。ログは `output/playwright/learning-charter/core.log` と `build.log`。

その後、並行して進む別タスクが当該テストを修正したことを確認し、`npm run build` を再実行。TypeScript・production build・assets checkが合格した（`build-recheck.log`）。全体の最終結果はdocs/lint/unit/build合格。固定productionの視覚・PWA・速度検査は今回の局所的な見た目変更の証拠には含めていない。

既存の `e2e-island-learning.mjs` は学習中の非表示stageに対する旧section-id待ちで停止したため、合格とは扱わない。今回の6ケースは既存fixture・通常planner・回答helper・操作寸法assertionを再利用した別の局所診断であり、旧ハーネス全体の代替合格を意味しない。

## 追加改善: 学習台のまとまりと手触り

ユーザーが余白・台座の素材感の改善を指示。`IslandLearningTheme.css` で学習台を最大680pxにし、利用可能な高さが小さい場合は既存flexで縮める。短い式を無地の淡い面へまとめて36〜48pxで表示し、解答欄とテンキーへ続くまとまりを強めた。台座の外縁だけに静止した縫い目を置き、キーは無地の丸い押し面と小さな陰影で表現する。教材図形・支援・保存・問題生成のコードは変更していない。

追加改善の証拠は `output/playwright/learning-tactile/`。同じ6ケースのbefore/after、回答・ヒント操作と全入力の44px・画面内・hit検査が合格。390×844と768×1024の数値、360×640の筆算ヒントを作者が画像確認した。比較上、タブレットの解答面の過剰な高さが減り、式と台座の横幅が揃い、入力部分の輪郭と外縁に手触りが生まれた。

対象URL・flagは前回と同じ。DEV versionは `development-local:24c765fe-295c-46cf-95b4-b39295b14ad9`、world `mystic-island-shore-garden-v18`、learning `mystic-island-learning-v2`。既存画像の再制作・世界候補の変更ではなく操作面の追加改善。共有作業ツリーのDEV検査で、SW未制御・sound off・reduced motion。独立した子どもの理解・意欲は未評価、固定productionのPWA・速度は未検査。

追加改善の全体検査はdocs/lint/typecheck、298ファイル・3254テストが合格。最後のbuild時に並行変更の `IslandProblemPrompt.tsx` で任意の問題文を正規表現へ渡す型エラーが出たが、別タスク側でnullish fallbackが入ったことを確認し、buildを再実行して合格した。ログは `core.log` と `build-recheck.log`。当方は式の装飾から `data-problem-prose=true` の文章題を除外して、新しい文章題表示と両立させた。

## 追加改善: 文章題・ワッペン・進行タグ

ユーザーの実装指示により、採用済み `/icons/icon-192.png` を進行帯の左端に24〜28pxの非操作・読み上げ対象外のワッペンとして再利用した。進行帯は台座と同じ縫い目・淡いラベンダーのタグとし、小さい画面でも教科選択・6個の進行印・問題数を保持する。360pxで問題数が折り返された初回案を修正し、問題数は一行、ワッペンは24pxとした。

`IslandProsePrompt` は保存された文章の文字・空白を保持し、空白と文の区切りで折り返す。数字と単位（km/h、km、じかん等）は同じinline-blockへまとめ、画面より長い語句だけ内部で折り返せる。分数を含む問題は既存MathProblemPromptへ戻し、分数の縦組みを保持する。元の問題文一致・単位のまとまりを3ケースのunit testで検証した。

証拠は `output/playwright/learning-patch/`。以前の6ケースの実回答・ヒント・全入力寸法に加え、通常plannerによる速さの文章題と、mixプロフィールから実回答で次の6問区間へ進んだ360px画面を確認。`prose-prose.png` では数字と「じかん。」が同じ行に保たれた。`mixed-final-mixed-six.png` は教科選択・6問表示の修正後。DEV対象・version・既存候補IDは直前の追加改善と同じ、sourceやfixtureの固定production証拠ではない。

全体検査ではdocs/lint/typecheck、300ファイル・3258テストが合格。その後のbuildが並行変更された `writtenInput.ts` の狭い配列型推論で停止したため、`values: string[]` の型注釈のみ補正した。筆算処理の意味は変更せず、該当3テストとbuildを再確認した。Reactレビューでは表示を派生値で構成し、追加の状態・effect・学習イベントを導入していないことを確認。無文字理解と子どもの意欲は引き続き独立観察なし・未評価。

## main反映前の独立検証

ユーザーのcommit/main/push指示に対し、`f81046b`を基準に学習デザインと必要な仕様・憲章・監査の8ファイルだけを別indexへ抽出し、リポジトリ外へ全入力をexportした。並行変更のヒント入力・compactレイアウト・筆算処理と型補正・旧モード削除はこのコミットに含めない。上記の共有作業ツリーの検査と区別する。

独立exportに対する `verify:core` はdocs/lint/typecheck、307ファイル・3379テスト、build、assets checkが合格。さらに `http://127.0.0.1:5219` の島有効DEVで6ケースの通常回答とヒント、文章題、mixの実3問から次の6問への進行とタグ収容を確認。最初のQAはヒント保存完了前にdisabledを評価したため停止し、実hint表示とinput-readyを待つようQAだけを補正した。変更後のスマホ実画面も作者が確認した。独立した子どもの理解、production PWAと速度の合格を意味しない。

ログは `output/learning-publish/core.log`。公開するdocsは最終indexから新たにexportしてdocs checkerを再実行する。
