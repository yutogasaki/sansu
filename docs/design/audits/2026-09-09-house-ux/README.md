# 家の中のUX・室内デザイン修正

2026-09-09。ユーザー依頼「いえのなかのUXやデザイン」を対象にしたローカル修正。本番デプロイ・新しい学習ルールの採用ではない。

## 観察と変更

[修正前](before-phone.png)では空の棚が強く、家の入口が大きなチャレンジ説明の後ろへ押し出されていた。家の中へ戻る操作と島へ出る操作も「もどる」だけでは区別しにくかった。

- 部屋→アルバム・写真・かざり・記念・お知らせ→チャレンジの順。実在する入口だけを表示し、44px以上の操作領域を保つ。
- チャレンジの開始は直接表示する。詳しい遊び方と賞の説明を任意の開閉欄へ整理し、二重の説明を減らす。
- 現在地を見出しへ、退出先を「しまへ」へ明示。0個の強調を次の行動の案内へ変える。
- 紫の壁、青い棚、木の床、桃色の椅子、青緑のラグに役割を分ける。椅子の背もたれ、クッション、棚の3つの曲面を追加。ラグとクッションへ大きな縞を限定する。
- 家の位置、四壁内のPerspective camera、賞の資格・配置座標・保存・16品の展示を保持。追加の静止形状を材質別に結合し、既存の180 mesh未満・28,000 triangle未満の制限を維持する。

## 憲章からの転用

| 転用 | 転用しない |
| --- | --- |
| 形で区別できる家具、座る・本を開く用途、色面の主従、広い無地、物に限定した模様 | 全面模様、架空の賞、常時発光、学習への追加操作、未採用キーアートの採用扱い |

根拠は[デザイン憲章](../../../product/design-charter.md)と[家の仕様42](../../../product/42_island_learning_keepsakes_spec.md)。同じ島のmoon-garden配色を起点とする。承認済み室内ベンチマークとの同等性や子どもの再訪意欲は認定しない。

## 実行対象と証拠

- ローカルのproduction build: `http://127.0.0.1:5253`
- revision: `house-ux-v4-local`
- version: `house-ux-v4-local:2b936d67-d4de-4b85-a291-91a5d43e4c22`
- delivery: `mystic-island-v1` / `VITE_ISLAND_ENABLED=true`
- 室内candidate: `island-home-interior-v4`。島自体は既存 `mystic-island-shore-garden-v18`。
- [manifest](manifest.json)に固定srcのhashを記録。対象5実装ファイルは最後の作業コピーと一致。
- Chromium、390×844・768×1024、音off・reduced motion、独立したブラウザcontext。プロフィールと5区間完了は明示的な診断fixture。展示・収納・まとめて展示・再読込は実UIとIndexedDBで確認し、実学習による獲得証拠とは呼ばない。
- [画面一覧](contact-sheet.html)。PNGは実ブラウザの画面をそのまま保存。

## 検証

- 実装時のdocs:check、lint、typecheck、最終build、assets:check: PASS。lintは別ファイルのFast Refresh warning 1件のみ。証拠追加後のdocs:checkは、並行追加された `docs/tasks/active/2026-09-09-tablet-problem-fit.md` のReview By / Docs To Touch / Verification欠如でFAIL。本変更のリンクエラーは報告されていない。
- 家UI・室内モデル: 15 tests PASS。家cameraの11 testsは先行固定コピーでPASS。実物の当たり判定も限定再検証でPASS。
- 全体テストは先行固定コピーで3354 / 3358 PASS。3件の保存テストtimeoutは同じコピーで23件を再実行してPASS。室内のtriangle超過1件は形状を軽量化し、上記15件で解消。全体の初回FAILログを上書きしない。
- 390px・768pxで家の全入口の最初の画面内収容・44px target、0件掲示板、実3Dアルバムtap、展示・収納・一括展示・再読込・島への退出を検証。
- 初期ブラウザ確認の失敗は、mode rootの可視判定と起動中のプロフィールfixture投入によるハーネス側の問題。実際の遷移先・可視操作を確認し、初期化後に投入する手順へ修正した。
- smoke: 31 scenarios PASS。詳細な両幅の確認範囲は[browser summary](browser-summary.json)。
- PWA容量・precacheはbuildで確認。今回の家UIを対象とする実SW更新/オフライン、独占環境での正式throughput、実参加者観察は未実施。

## 非補償ゲート

| 領域 | 判定 |
| --- | --- |
| 視覚的魅力 | 色の主従・家具の用途・操作の読み順はローカル改善。承認済み画像との同等性は未認定 |
| 無文字理解・安全 | 作者の画面確認のみ。実参加者N=0、正式ゲートはHOLD |
| Runtime整合 | 上記の家操作・保存・両幅はPASS。正式PWA/速度を含むrelease判定は未実施 |

全体の技術テスト合格を、視覚的魅力や子どもの意欲の証拠として扱わない。

## mainへ含める範囲

コミットでは室内家具・配色、家の入口の寸法と読み順、現在地と退出先、空の展示案内を分離して採用する。上記画像とブラウザ記録は並行開発中のチャレンジ・写真入口も含む固定ローカル統合buildの証拠であり、mainの完全一致画像ではない。チャレンジ機能本体とその説明整理、写真入口・保存中操作の拡張は別作業に残す。新しいコミット対象は最新origin/mainから独立させて検証する。

分離したmain候補のDEV実操作は390/768ともPASS。[phone](main-candidate/390-house-empty.png)・[tablet](main-candidate/768-house-empty.png)・[操作記録](main-candidate/report.json)・[source](main-candidate/source.json)。起動、空の家、掲示板、実3Dアルバム、診断資格からの展示/収納/一括展示/再読込、島への退出を確認。production・PWA配布の証拠とは区別する。

## 室内歩行の追加と最新mainへの統合

「キャラクターを歩かせる」の追加依頼により、室内のカワウソを床タップで動かす。固定視点は維持。椅子・卓・棚・鉢・壁の余白を含む経路、移動中の行き先変更、矢印キー、近景/退出/学習での終了を実装する。reduced motionは有効な目的地へ即時移動。保存や資格判定には接続しない。独立した室内表示を用い、島側の住民の進行中の行動は変更しない。

並行作業のチャレンジ・写真入口・説明整理がmainへ入ったため、その後のmainへ統合した。上記「別作業に残す」は切り分け時点の記録。`main-candidate/`は歩行追加前の候補、最新のDEV画面は[phone](walking/390-house-empty.png)・[phone移動後](walking/390-walk-arrived.png)・[tablet](walking/768-house-empty.png)・[tablet移動後](walking/768-walk-arrived.png)。[操作記録](walking/report.json)と[source](walking/source.json)を参照。

`tools/e2e-island-home-walk.mjs`の床タップ・到着・矢印キー移動と既存の家の往復を390/768でPASS。phoneは通常motion、tabletはreduced motion、両方音off。初回runは途中のrebaseでDEVモジュール取得が失敗したため、統合後の固定srcで新しい出力へ再実行しpageerror 0を確認した。実学習による資格獲得はこのfixture検査の対象外。

mainの既存160 mesh/25,000 triangle制限に合わせる過程で、161 meshと、index有無の不一致で結合できない問題を検出した。入力geometryをnon-indexedへ統一し、薄い壁/床/棚板だけ細分割を減らした。既存の上限テストは変更していない。歩行rigは静止室内とは別のライフサイクルで確保・解放する。

最終検証: docs/lint/typecheck、build/assets、smoke31はPASS。最新main統合後の全体は3,487/3,502 PASS、15件は2つの手組みruntime fixtureに新規homeResidentが未設定だったため失敗。fixtureへ実HomeResidentの生成と解放を追加し、該当2ファイル＋歩行＋室内模型の23件を再実行して全件PASS。全体suiteの初回結果は保持し、最終フルsuite再実行とは表現しない。新しいappコードのブラウザ確認は両幅でPASS、技術合格を実参加者の理解・意欲の認定には使わない。
