# Sansuの開発ポータル展開

- ID: EXPAND-003
- Status: 完了（ローカル実装・技術検証。Hub側の最終照合待ち）
- Review By: 2026-10-25
- Owner: Codex（ローカル実装）、Yu（採用）
- Scope: portal固有生成、6入口、同じ仕事の根拠と依頼、Hub保存との読取契約、既存操作/復旧のQA。製品・DB・公開・commit/push・他repoは対象外。
- Dependencies: Hub site 3.2.0 / workspace 1.1.0と案件別保存。KeepGoingのwork-modelはSansuへ適用しない。

実行キューは共有TASKS。これはこの一件の詳細であり別台帳ではない。

## 完了条件

1. 正本・全文・未知フィールド・既存URL/固定原画面と判断/試行エンジンを保持する。
2. 同じ仕事の目的/条件/知識/結果/記憶/方法、完全refの全文確認コピー、Hub保存・失敗復帰を確認する。
3. 必須検査、同候補のPC/390/320操作、旧生成の切戻しと全byte復帰を証拠へ残す。
4. 人の受入・児童の価値は未実測と分離し、Hub側照合へ残す。未接続の保存を完了としない。

## Verification

verify:core、agent:index:check、portal:verify、固有loader/保持検査、実操作、切戻し/復帰。証拠はqa/evidence/EXPAND-003。

## 停止条件

Hub保存接続が未確認の場合は完了にしない。他repoやHub共通ソースは変更しない。人の採用・公開は別許可。

## Docs To Touch

docs/portal、scriptsの固有adapterと固定vendor、既存案内・TASKS、portal生成物、qa/evidence/EXPAND-003。製品src/publicは変更しない。

## ローカルのcloseout

正本と仕事の意味を維持し、site3.2.0/workspace1.1.0とSansu固有loaderで6入口へ接続。旧7画面と原形・全文・未知フィールド・条件検索・比較/図・試行/判断エンジンを保全した。通常画面のCSS/検索/readerと新ナビ/相談dialogの干渉を実操作から修正した。

verify:coreは625ファイル/5,397テストとbuildまで完走。旧入口のテスト条件は保持先で継続し、新入口の検査を追加した。共通固定部品のNode検査12件、固有loaderの異常系と全文/ID照合、portal生成一致、実操作、最終の切戻し・初回生成と復帰はqa/evidence/EXPAND-003のコマンド/対象hash/ログ/画面で照合する。

Hubの同じ完全refへ実所見を保存・再読込し、別タブ競合の入力保持・比較・再保存を確認。完了後も明示されたDONE索引から同じ仕事を読む。古い版の下書きを自動で現在版へ採用しない。

技術の完了とHubの照合、人の独立採用、実機、児童の理解/自発学習/再訪、利用価値、公開は別。後者は未実施・未実測。製品src/public・学習/所有/DB・判断/承認消費の意味は変更せず、commit/push/公開/外部送信は行わない。
