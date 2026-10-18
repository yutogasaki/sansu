# Sansu 内部ポータルの限定検証契約

外部の親依頼: `portal-reference-and-rules`。今回の個別依頼: `sansu-common-portal-application`。Pecoの既存タスクUIと相談導線を使い、人がこの結果を読み、必要な報告を貼り付ける。具体のPeco URLは未取得。自動送信・同期は未実装。repo実行状態は既存の `.agents/tasks/TASKS.md` / BLOCKED / DONE が正本。本契約と局所runは二重の業務キューではない。

通常入口は[概要](../../.agents/index.html)。計画／仕事／知識・仕様／役割・手順／運用を共通ナビでつなぎ、旧タスク・文書索引・mapのURLとanchorを保持する。紹介サイトのアプリURLを読み取り参照し、存在未確認のヘルプ・配布版・管理URLを補作しない。全島M1と親依頼の完了をこの作業で宣言しない。

## 範囲と版

契約 `sansu-portal-local-v1`。開始HEAD c1e7b5350ee167c30644f45b87ab9133f017ecc7。島P05の開始差分を保全。内部文書・既存生成器・内部検証だけ変更し、アプリ・保存・認証・配布・依存・他repoを変更しない。commit / push / PR / deploy / スクリーンショットの外部送信は対象外。

## 仕事の依存

scope → generate → machine → browser → review → accept → report。

| 段階 | 入力 | 出力・証拠 | 担当と開始条件 | 合格条件 |
| --- | --- | --- | --- | --- |
| scope | HEAD・差分・正本・契約 | 開始manifest | 統合担当、固定run初回 | 範囲と保全hashが記録されている |
| generate | 同じ候補の正本文書・生成器 | 整合検査log・7 HTML | 統合担当、scope合格 | 再生成一致、旧URL/anchor保持 |
| machine | 同版の候補 | 原logと機械receipt | 検証担当、generate合格 | docs/core・内部fixture・リンク・公開境界が合格 |
| browser | 同じ7 HTML | 4幅画像と原receipt | 検証担当、machine合格 | 320/390/768/1440、nav・戻る・検索・Enter開閉反復・横溢れなし |
| review | 全差分・同候補・全履歴 | 独立所見原文 | 独立担当、browser合格 | 重大指摘なし、保全・証拠・条件を照合 |
| accept | 同trialのmachine/browser/review | 限定AND結果 | 統合担当、3合格 | 全原証拠hashと版を再照合 |
| report | 限定AND結果 | closeout | 統合担当、accept合格 | 入口・範囲・証拠・未確認・人の判断を報告 |

不合格は条件・原因・証拠を必須にし、input/specificationはscope、implementationはgenerate、environmentはmachine、unknownはscopeへ戻す。原因段階の入力修正と候補版更新後は全段階を再検証する。permissionは修正せず人へ停止。先行不合格、自己レビュー、空原因、旧token、旧trial、旧候補、欠けた原証拠、履歴リセット、別run、親completeを拒否する。

試行は最大3回、修正は最大2回、同原因は2回、開始から60分で人の判断へ移る。固定runの回数・開始時刻・失敗履歴を保持する。別runで上限を回避しない。局所CLIは `node tools/portal-graph.mjs`。原run/log/画像は `/tmp/sansu-common-portal-application/` に固定してローカル保管する。別環境で原物がなければ未取得。actor名は宣言であり、自由shellによる直接編集を防ぐ認証sandboxではない。

CLIは開始tokenを発行し、結果のstage・trial・候補・tokenと原log SHAを束縛する。receiptはtoken発行後に取得し、原logを参照する。次段階で全終了attemptの原証拠を再読込照合。候補は生成器・契約・チェック・全docs/.agents Markdown・憲法・紹介HTML・7 HTMLの内容hash。token専用原logのidentity・mtime・保存先と全履歴での同原log再使用を検査する。局所journalとrunの一致で履歴リセットを拒否する。原証拠の内容そのものの虚偽申告を認証する基盤ではない。既存CIは変更tools/docsを対象にverify:coreを実行するが、この局所グラフと画面検証は手動。hook実発火は未確認。

## 検証と教訓

AYAMIのリンク指定失敗を受け、browser開始前に実hrefとページ構成を照合し、名前だけの完全一致を使わない。生成漏れを実失敗として残し、公開アプリを壊さず同runで再生成・回復する。過去の5,199テスト・作者採点を新候補のPASSへ転用しない。

生成物は共有Markdownを読み取り、内容SHAを詳細で表示。再生成だけで美術や機能を合格へ変えない。正式な実行順は共有キューとバックログ、M0〜M5は全島美術制作の工程。知識、仮説、作者比較、独立観察、runtime証拠を区別する。利用者理解・実機・保存/PWA受入・公開版・親全体受入は別判断。
