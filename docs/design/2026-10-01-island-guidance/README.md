# 育つ島の案内と記念 v1

ローカル実装・対象の検証完了。S1〜S5の任意のスターター、A1〜A6の記念、選べる遊びをまとめた「しまの あそびかた」を追加した。[実画面のcontact sheet](index.html)から確認できる。公開・実機・子どもの観察は別の状態として扱う。

## 2026-10-02 コミット対象と4点の改善

主入口を **いえ → 室内の本「あそびかた」** にした。メニューの入口も保持。しずくの実価格/所持数、空き場所/到達できる場所、対象、解放を分けて待つ理由を示し、未準備の遊びは「あとで やることにする」で目標だけ保存して家に留まる。家の本は本人のテーブルを直接購読し、別タブの達成や選択を時計同期なしで反映する。別接続・本人隔離・読書の学習/時計不変を回帰で確認した。

[最新の実画面](fixes.html)と[コミット対象の結果](fixes-checks.json)を正本にする。共有のdirty checkoutからこの機能のコード/仕様を切り出し、HEADの既存の経済・時計・地区・メニューの素材を維持する候補を別directoryで検証した。既存の保存2/境界3からの移行を受ける保存readerとtable境界は保持する。以前の4,586テストや紙のatelierの実画面は、その時点の共有入力の履歴であり今回のコミットの結果へ読み替えない。

- core: 514ファイル / 4,570テスト、docs/lint/typecheck/build/assets PASS。既存の期限警告4件とFast Refresh warning1件を保持。classic flag-off smoke31件PASS。
- DEV家: 両幅2ケース / 16画面PASS。直接入口とメニュー、閉じる/reload、未準備の目標だけの保存、別タブの実際の旗変更からの記念更新、学習3回答後の同予約再開。読書前後の7学習store/Growing record一致、例外0、入力hash一致。音OFF、tablet reduced motion。
- DEV全体: 両幅6ケース / 14画面PASS。新規の実学習6回答でS1〜S5/A1〜A4。旧保存2の保守的移行、豊かな島で実演開始A5と実拡張A6は明示fixtureで別記録。例外/console error0、入力hash一致。
- 本番形式: 両幅2ケース / 20画面PASS。初回設定→無料家→通常5回答→旗/通常種→家の直接入口→実SW offline再起動と家の本→同予約へ復帰→育成/記念/reload。DB注入なし。app/dist/QAの開始/終了hash一致。本番形式は既定音設定で、DEVの音OFFと区別する。
- stageのアプリ入力1,486ファイルと検証コピーの一致を確認。最終のindex exportで文書とリンクも確認する。主なバランス/atelier作業は作業ツリーに保持し、今回のfeature commitに含めない。

途中の診断: `fixes-first` は読書wrapperのDexie.existsが別タブの観測範囲を落とした問題（[focused診断](fixes-sync-diagnostic.json)）。直接tableを検証付きで購読するAPIへ修正した。`fixes-dev` はQAが元と同じ旗の色を選んだno-opで、異なる色の実操作へ修正。`fixes-production` は切り出しで既存resizeのカメラ初期化まで外した候補の失敗。初期化を復元。`commit-production` は家から学習して閉じた正しい戻り先を島と誤認したQA失敗。家の開閉を確認した後に島へ戻って通常学習を再開する旅程へ修正した。失敗を最終PASSへ上書きしていない。

実two-build更新、実iPhone再起動、子どもの無説明理解/翌日の再訪は未評価。今回のcore/ブラウザー旅程だけで製品全体の「完璧」や実機合格とは判定しない。

## 実装

- 新しい島では、最初の種・開く・迎える・学習から戻る・通常種の育成を一文で案内する。閉じた後や別の遊びを選んだ後は自動再開せず、本から本人が再開できる。
- 今試せる候補は最大3つ。選択目標は1つで、解除・変更できる。学習中・訪問中・保存や同期中に案内や達成通知を出さない。
- 達成時の旗・屋根・仲間・対象を固定した記念の絵を残す。色替え・収納・再配置で過去の記念を失わない。現在の対象や収納先へ戻れる。
- 採点・SRS・問題の予約・費用・育成時間・報酬は維持。無料の家を通常の育成達成として数えず、演奏は本人の島で実際に描画された開始を確認して記録する。
- Growing record版3 / DB schema4の `guidedIslands` を正本にする。旧テーブルを保持して一度だけ移行し、旧writerによる案内の消去を拒否する。旧島の不明な操作や日時は補わず、根拠のある入居・拡張だけを静かに記入する。

仕様: [採用仕様](../../product/island-starter-achievements-proposal.md)、[52](../../product/52_growing_island_game_spec.md)、[保存13](../../product/13_data_storage_migration_spec.md)。

## 家から開く入口の追加

「いえがよいかな」の依頼に合わせ、主入口を **いえ → メニュー → しまの あそびかた** に追加した。家の中で読み、閉じると同じ家に戻る。「やってみる」「この場所へ」は島の描画準備後に選んだ対象を開く。島のメニューにも入口を残す。本を読むだけではGrowingの同期・時計・学習完了の消費を行わない。

[家の実画面10枚](house-entry.html)、[対象旅程の結果と入力hash](house-dev/report.json)、[追加検証の要約](house-checks.json)を保存した。390×844 / 768×1024の2ケースPASS。家での開閉とreload、全学習storeとGrowing recordの読書前後一致、目標選択から実際の旗変更、固定記念から対象へ戻る操作、通常3回答後の同じ予約の再開を確認。音OFF、tabletはreduced motion、ブラウザ例外0、開始/終了の入力hash一致。対象はDEV `http://127.0.0.1:5260`、revision `development-local`、version `development-local:161389c7-0a22-466f-bdd6-3e18c30ef0be`、Growing flag=true、本candidate `growing-guidance-v1`。家の背景は共通Three rendererの既存candidateを使用する。

この追加後も明示flag-onのverify:coreは516ファイル / 4,586テスト、docs/lint/typecheck/build/assets PASS。以前の固定production/offline証拠は追加前の検証として保持し、今回の家入口のproduction検証に読み替えない。視覚の魅力と無文字理解/安全は上記と同じく利用者評価HOLD、runtimeは家の対象旅程GO。最初の試行 `house-first/report.json` はDEV server停止による接続失敗で、再起動後の結果と区別する。

closeout時のdocs再checkは、別作業の `docs/design/2026-10-01-menu-atelier/README.md` から `screens.html` / `contact-sheet.png` へのリンク切れ2件でFAIL。先行coreのdocs PASSと区別し、別作業の資料を変更していない。既存の期限警告4件も保持。`git diff --check` はPASS。

## 検証の境界

[チェック結果](checks.json)と[固定コピーのcore出力](frozen-core-output.txt)を保存した。coreは516ファイル / 4,586テスト、docs・lint・typecheck・build・assetsがPASS。既存の期限警告4件、Fast Refresh warning1件は保持している。[classic smoke](smoke/smoke-report.json)は明示flag-offの31ケースPASSで、育つ島の実操作とは分ける。[既存の育成回帰](balance-regression/report.json)も390/768幅の4ケースPASS。

初回coreで既存のIslandLife起動テスト4件が `document` 未定義で失敗したため、現在の `useGardenTime` が必要とする可視状態とイベントのモックをテストに補った。アプリの時計は変更していない。独立レビューから、訪問先で始めた演奏の出所を固定する回帰テスト2件と、同期中の案内抑止を追加した。

並行作業で共通UIの入力が変わったため、作業中の結果と固定コピーの結果を分ける。`src`・`public`・`tools`・設定を物理コピーし、最終のDEV/production旅程は同じ固定入力から実行する。これは共有作業内容の検証で、clean commitや公開済みbuildの認定ではない。

- [固定DEV](dev-frozen/report.json): 390×844 / 768×1024の8シナリオ・14画面PASS。新規プロフィールで通常入力6問からS1〜S5・A1/A2/A3/A4、閉じるの保存、選択目標・色の固定記念・同じ予約の再開を確認。旧v2島の保守的な移行と、豊かな島でのA5/A6は明示fixtureからの実操作で、自然な取得の代わりにしない。1,489入力とQAの開始/終了一致、例外・console errorなし。
- [固定production](production-frozen/report.json): 両幅2シナリオ・16画面PASS。DB注入なしの初回設定→無料の家→通常3回答→色選択→有料farm→実SWのoffline再起動→同予約の2回答→育成/記念→再読込を確認。5回答・残高・保存版3・過去の色を保持。app/dist/QAの開始/終了一致。version `development-local:ba98f68e-4fc8-4d8b-b425-28275786436e`、revision `development-local`。
- 両者とも音OFF、tabletはreduced motion。実画面のGrowing flag=true、島 `growing-island-v1`、本 `growing-guidance-v1` を記録。外側の共通Island metadataは既存のdelivery/candidateを併記し、実際に描いたGrowing worldのmarkerと区別する。

## 独立した判定

| 観点 | 判定と範囲 |
|---|---|
| 視覚の魅力 | HOLD / 未採点。作者の実画面レビューでは、絵から選べる構成・紙の面・島の余白を確認。子どもが選びたくなるか、翌日も戻りたくなるかは未評価 |
| 無文字の理解・安全 | HOLD。説明を知る作者の操作は独立した理解の証拠にしない。文言・閉じる・任意選択・音なしとreduced motionの機械的確認とは区別する |
| runtimeの整合 | GO / 対象旅程PASS。実取得・明示fixture・DEV offline・実SW offlineを分けて記録。全releaseや実機の合格ではない |
| 全体の連続性 | launchから本・学習・島への実画面をcontact sheetで照合。島 `growing-island-v1` と本 `growing-guidance-v1` を個別に記録する |

2 build間の実SW更新・実iPhoneでの再起動・子どもの無説明理解/意欲は今回の実施範囲に含めない。

## 診断を残す

- `dev-first` / `dev-final` / `dev-verified` / `dev-accepted`: 途中の入力変更を合格に読み替えない。`dev-verified` のtabletは描画境界のfallbackと学習入力待機失敗も記録した。固定コピーで再確認する。
- `production-first`: 「まなぶ」が案内と共通ナビの2件に一致したハーネスのstrict locator失敗。共通ナビを明示して修正。
- `production-final` / `production-accepted`: 実操作は成功したが、入力hashの変化で全体FAIL。固定コピーの結果を最終証拠とする。
- 固定コピーの初回coreは、コピーに含めなかった `.github` / `assets` / `art` の文書リンクで失敗した。参照を補った後の出力を保存している。

今回のcommit・push・公開は未実施。別作業のdirty変更を保持した。

2026-10-02 UX追加: [通知の対象へ直行・次の一手・本人の大きな記念](../2026-10-02-guidance-ux/README.md)。
