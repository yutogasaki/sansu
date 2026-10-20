# Sansuの仕事場と読取契約

6入口は概要、企画/成長、開発/仕事、成果/評価、知識/記憶、AI開発能力。スマホでは三本線から同列に選ぶ。製品の挙動や承認エンジンは変更しない。

## Hub保存との境界

今回仕事の完全refは `sansu:work/2026-10-18-development-portal`。初期作業中の短いファイル名は固有docs checkerの要件により日付付きへ確定した。

`require('/Users/yutogasaki/Projects/sansu/scripts/portal-work-model.cjs').load({root:'/Users/yutogasaki/Projects/sansu',repo:'sansu'})` は同期・読取専用。既存TASKSの親仕事リンク表と、既存DONE索引の明示された完了仕事リンクだけを読む。active全件を仕事に数えない。IDは親仕事Markdownの既存ファイル名、完全refは `sansu:work/2026-09-27-living-fantasy-first-playable` のように案件を含む。短IDを別仕事へ解決しない。未知repo、重複、壊れた表、symlink、範囲外pathは拒否する。

返値は available/repo/title/tasks/sourceFiles。taskは id/title/ref/version/state/status/source/output/knowledge/planning/evidence/sourcePaths/report と原文raw、current/next、範囲・検証・完了条件を持つ。source/resourceは path/href/sha256。hrefはHubの `/repos/sansu/` 経路。versionは親仕事全文とキューの内容hashを含む。sourceFilesは読んだ根拠のSHA-256。生成時刻やmtimeは版に含めない。検証の過去PASS・activeフォルダの存在から現在の着手や受入を推定しない。

Hub側はrepo-work.parseにSansuの完全ref（小文字と日付を含むID）を追加し、loadでこの固有loaderを読む。今回、接続後の実保存・再読込・別タブ競合からの入力保持/再保存を確認した。basisには sourceFiles全件とloader自身、共通方法のhashを含める。未知ID/別repo/旧版/競合/破損の拒否、入力保持・再読込・履歴を既存保存APIで確認する。Hubコードと保存先はSansuから書き換えない。完了時の対象版でも、完了索引から同じrefを読めることと、下書きの版変更/見直しを確認する。

## 正本と保持

状態・仕事は `.agents/tasks/TASKS.md` とリンク先の詳細、確認条件はBLOCKED、後続候補はbacklog、記憶はdurableと製品memory。生成JSONとworkspaceは読取投影で、別の実行台帳ではない。依頼文は完全ref・対象版・根拠と許可を全文確認して手動コピーする。コピーで着手・送信・採用を進めない。

旧7画面・全文/未知フィールド/元データ・検索・図・比較・判断/試行エンジンと原形保存は維持する。`PORTAL_WORKSPACE=legacy npm run portal:build` で旧生成へ切り戻し、通常buildで復帰する。新入口はportalのみ。元の保存画面を現在の正本と誤認しない。

## 受入

R01〜R15は入口/企画と仕事/版付き知識/再開条件/方法/依頼/判断/成果/版変更/欠落/復旧/浅い復帰/狭幅操作/改善の所見へ対応する。具体的な最終候補・操作・必須検査・未達は `qa/evidence/EXPAND-003/` に残す。技術検証、人の独立受入、児童の理解・自発学習・再訪と利用価値は別判定。後者は未実測。

## 仕様と固有項目の対応

| 条件 | 固有の接続先と確認 | 区別して残すもの |
|---|---|---|
| R01 | 概要の目的・現在地・次の一手、企画/仕事/成果への直通 | 初見の理解は未実測 |
| R02 | 同列6入口、スマホ三本線、現在領域 | 人の独立した採用 |
| R03 | 企画→同じ仕事の範囲・完了条件・次の検証 | 仮説の正式採否 |
| R04 | 仕事のknowledge・版・明記根拠→全文 | 表示と実使用を分ける |
| R05 | 原文current/next、記憶と作業所有/branch/差分/許可 | 再開時点の照合が必要 |
| R06 | 方法ページ→検証matrix・固有契約・同じ仕事の所見 | 方法の採用と効果は未実測 |
| R07 | 完全ref/版と根拠・全文確認・確認チェック・コピー | 送信/実行/承認は開始しない |
| R08 | 判断→既存比較・推奨・影響、BLOCKEDの端末/児童条件 | 人の回答・承認消費は元エンジン |
| R09 | 実物・対象版の原文と、技術/人/利用者価値の別欄 | 過去試行と現在合格を分ける |
| R10 | 内容版とsourceFilesをHub保存basisへ接続 | 未宣言ファイル全体の影響は対象外 |
| R11 | 未知仕事の閉鎖、検索0件/解除・正本/一覧への復帰 | 全ファイル検索とは異なる |
| R12 | 競合時の入力保持・比較/再保存、旧生成切戻しとbyte復帰 | 別媒体災害復旧は未実施 |
| R13 | 通常ページの同画面統合、浅い親、同じ仕事のURL引継ぎ | 固定原画面は保存時の文脈 |
| R14 | PC1440/390/320、メニュー/キーボード/Escape/全文と図 | 実機・独立理解は未確認 |
| R15 | 実仕事の所見と次に確かめることを同じrefへ保存 | 管理量を効果と呼ばない |

SA01〜SA08は旧入口/7専門画面・原形保存・AI全文・全元データ・試行/判断エンジンを保持し、移動先の全byte/IDと従来の全条件を検査する。通常画面は共通ナビと本文を統合し、元画面の保管だけを理由に通常本文をiframeへ移さない。旧styleは本文へscopeを限定し、旧リーダーのリンク横取りは共通ナビ・相談領域を対象外にする。固定されたoriginal/ai/integratedの元文書はその保存契約のまま保持する。

## 要件レビューと改善

仕事・条件／成果・評価／AI開発能力から、選択した仕事と版のレビュー依頼を既存ダイアログへ準備できる。[進め方](../runbooks/requirements-review-loop.md)に従い、要件別判定、必須／任意の区別、対応理由、同じ版の証拠を既存の仕事詳細へ戻す。コピー前に全文を確認し、送信は人が行う。導入・実使用・検証・採用・効果は別であり、効果は未測定。
