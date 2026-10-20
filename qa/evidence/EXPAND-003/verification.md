# Sansu 開発ポータル展開 — ローカルcloseout

判定：**ローカル技術受入 PASS**。Hubの照合へ引き継ぐ。人の独立採用、実機、児童の理解・自発学習・再訪、利用価値、公開は未実施・未実測。

- branch: `codex/expand-003-sansu`
- HEAD: `882937581c46ec633a4e4663726385ad7e7a09f1`（未commit、開始時dirtyなし）
- branch監査：closeout時にmainへ戻っていることを検知（原因未特定）。同じHEADの既存作業branchへ戻した。reset/commitやファイルの差し替えは行っていない。
- 最終入力SHA-256: `af596a5cc9bfd3533900bdb44fb19812a0fb83cba234b2dea762e2596d9ea2b5`
- app入力SHA-256: `e7c783493631caea1778874404ef71f16ec90da17316042b38d6d9c4d79bb186`
- 詳細な日時・コマンド/exit・ログSHAは[verification.json](verification.json)、全入力/変更ファイルと保全は[candidate.json](candidate.json)、画像等のSHAは[artifacts.json](artifacts.json)。Node v24.18.0で実行した。

## 変更と正本

唯一の現行入口は `portal/index.html`。概要・企画/成長・開発/仕事・成果/評価・知識/記憶・AI開発能力を同列に置き、スマホは三本線で同じ入口を開く。通常の専門ページは同じ画面に本文・検索・図・原文を統合し、旧CSS/readerと新ナビ/相談dialogを分離した。長い仕事名の要約欄だけに限定した折り返し修正を加えた。

主なソースは `scripts/portal-workspace.cjs`、`scripts/portal-work-model.cjs`、`scripts/check-portal-workspace.mjs`、`scripts/standard-portal.mjs`。案内・契約は `docs/portal/workspace.md`、README、docs/index/maps、既存TASKS/DONE/詳細タスク・月別完了記録。旧検査は削除せず、移動先を読むよう対応し、新入口の検査を追加した。全変更/新規ファイルはchanged-tracked-files.txt/new-files.txtを参照する。

仕事はTASKSの既存親仕事リンク表、完了はDONEに明記された仕事の参照、原文Status/範囲/条件は詳細Markdownから読む。activeフォルダ全件を実行件数へ数えない。BLOCKED、backlog、durable/製品memoryはそれぞれの正本のまま。担当・期限・採否・検証を補完しない。生成JSONは読取投影で、別台帳ではない。

同期・読取専用の `load({root,repo:'sansu'})` は完全ref、内容版、原文とsourceFilesのSHAを返す。今回仕事は `sansu:work/2026-10-18-development-portal`、完了後の内容版は `e75f4cbc9c4c`。Hub側の対応API経由で、同じrefの実所見を保存・再表示した。下書きだけで正式状態や採用を進めない。

## 固定版と保持

新規pinはsite **3.2.0**、workspace **1.1.0**。コピー元はHub common-portal、由来とlock SHAを各provenance.jsonとcandidate.jsonに保持。KeepGoing形式のwork-model1.0.0はSansuへ適用せず、固有正本のloaderを使用する。既存vendorは変更していない。

製品src/publicと旧固定vendorの計1,715ファイルはHEADのGit blobと一致。旧7画面の現行正本に対し40,621棚卸し項目・15,752要素の文章/属性/CSS/JS/リンク先を保持した。元の判断/試行エンジン・承認消費・保存の意味は変更しない。旧URL、原形表示、全資料/図/比較、条件検索/原文/元データと未知フィールドを維持する。

移動した全文・ID、181統合ページの旧検索属性の値、圧縮検索payloadと最終registryの全フィールド一致を固有検査で照合。component manifestは固定部品の生成段階を表し、**最終全出力のhash正本はrecovery.jsonのbefore/restored/fresh**。原形/AI/integratedの固定元文書を通常画面の外枠で上書きしない。

## 検証結果

| コマンド・確認 | 結果 |
|---|---|
| `npm run verify:core` | exit0。625ファイル・5,397テスト、docs/入口/lint/typecheck/build/asset予算が成功 |
| `npm run agent:index:check` | 最終の案内・索引とportalの再生成一致、旧保持条件、固有異常系、共通Node12件が成功 |
| `npm run portal:verify` | 最終候補は321,976のローカルリンク/アンカー、全文/属性/ID、生成一致、保存参照の読取契約を成功 |
| 旧生成→復帰→生成先なしの初回生成 | 6コマンドすべてexit0。旧1,332/new1,712。復帰と初回生成の全1,712ファイルが同一bytes |
| 実際の旧入口表示→復帰 | 通常URLで旧入口を撮影。旧index hashは最終rollbackと一致。復帰全ファイル一致 |
| PC1440/390/320 | 主画面・下層・長文資料20画面×3幅＝60表示。実innerWidth/内容幅/現在領域/6入口を記録。横はみ出し0、実エラー0 |
| 保存/依頼/失敗復帰 | 完全ref/版・全文/確認後コピー、未知/別repo拒否、前選択破棄、保存/再読込、別タブ競合/入力保持/比較/再保存、根拠変更拒否と旧版見直し、完了後の同ID再保存・再表示を確認 |
| cleanup | 一時viewport解除、今回の4 QAタブを閉じた。自身の5273テストserverを停止 |

core中のapp入力はcloseoutまで同一。後続の変更はポータル組立と限定CSSで、同じ最終入力のportal/UI/復旧で検証した。新規固定部品のNodeテストは専用runnerで実行し、その2ファイルだけをVitestから分離した。既存製品テストを除外していない。lintは既存React refresh警告4件、型/テスト/buildの失敗なし。

[60表示と実測](browser-cases.json)、[実操作と最終保存版](browser-actions.json)、[復旧6コマンドと全hash](recovery.json)、[通常URLでの切戻し](rollback-live-result.json)、[runtime同一性](runtime-equivalence.json)を参照する。

## 再現した失敗と修正

最初のportal検査は既存の生成済み索引と正本の要素数不一致で停止。正規generatorで再生成した。新タスクのファイル名/必須項目は固有契約へ修正。旧概要のテスト2件は条件を保持して移動先へ対応し、新入口検査を追加。対象6件の再検査後、全coreが成功した。診断中の旧候補・重複runは中断してexit130を残し、最終成功に数えない。

旧readerのrename後の自己script参照、data-searchの衝突、deferデータの読込順、dialogのCSS scopeを実エラーから修正。320幅のbrief overflow 50pxは要約内のchip/min-widthへ限定して修正した。最初のエラー/画像/実測はbrowser-first-errors.json、browser-width-first-failure.json、constitution-320-overflow.pngに残す。

切戻しで派生project.jsonの旧hashと、前回portal/index.htmlを含む検索payloadの自己入力を再現した。同じ正本投影・最終registryから本文/検索/出典hashを整合させた。verifyは書込まず、二度buildを初回生成合格にしていない。最初の失敗はrecovery-first、修正前の比較はrecovery-before-brief-fixに保持する。

コピー故障は**API未提供の明示fixture**で全1,507字の選択と手動復帰を確認した。IABのpermissions-policy診断では実際の拒否を起こせなかったため、その診断を拒否時の合格に流用しない。通常画面のコピー成功とfixtureを区別する。

## 保全・引継ぎ・未確認

開始時生成物はローカル `output/expand-003-recovery/before.tar.gz`、最終固有ソース41ファイルは同source-final.tar.gz、復旧時の候補も同output配下へ保存。SHAと対象はverification.json/source-archive-files.txt。固定元画面や唯一の復旧資源を撤去していない。commit・push・公開・製品DB変更・外部送信はなし。他repo/Hubソースへの書込や別タスクへの送信は行っていない。

[Hubへの具体的な材料](hub-followups.md)は、長い日本語仕事名のbrief、main属性とlegacy依存の統合、registry最終化の順。Sansuの必須接続は完了しており、これらは共通部品の次版への提案。人の独立採用、実機、児童の理解/自発学習/再訪、利用価値、別媒体災害復旧・公開は今回未確認。技術成功をその受入へ読み替えない。
