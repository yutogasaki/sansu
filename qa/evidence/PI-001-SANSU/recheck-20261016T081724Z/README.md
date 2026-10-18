# Sansu ポータル再検証

**結果はFAIL、正式受入はHOLD。** 候補 `be55eae17dcadf330948d5261512dc0c8f20b33ea558e3aded97f77d83d4b9d5`、全生成manifest SHA `c212a26691b577aa9dcca1606aaa18bf03de7352810cb3870f9bb1f743f683a1`。HEAD `eb4b907bdf5cb6e99c30c4ac6f28d2d3969cac50`、branch `codex/pi-001-sansu` の未commit作業ツリーを対象にした。日時 2026-10-16T09:20:19.664707+00:00。現行入口の正式切替・commit・push・公開は行っていない。

前回の「全件対応」は範囲の取り方が不十分だった。94,891行は登録済みレコードの照合範囲であり、素材全体の完全な受入ではない。今回、元ポータルの生成器が集計する14,069素材と照合し、4,815件の個別登録不足を確認した。原本は保持している。[追加対応表](additional-resource-parity.md) / [同じJSON](additional-resource-parity.json) に容量・hash・未登録判定を記録した。メタデータ採取を内容の人確認・採用に読み替えない。

## 検査結果

| 検査 | 今回の結果と範囲 |
| --- | --- |
| 既存出力の生成一致 | PASS、1,310件。候補とmanifestは終了時も不変。 |
| 原文/構造 | 元7画面39,938 occurrenceの再現照合PASS。全308 HTML・82,200項目の構造/文章/属性不一致0。資源6欠損・リンク7か所で全体FAIL。 |
| 全素材の網羅性 | FAIL。元集合14,069件のうち9,254件が資源台帳に登録、4,815件はcore/library両方で未登録。個別統合先か正当な除外理由が必要。 |
| 空からの再生成 | FAIL。Git正本・2保管・不足33資源を揃えた初回build後、3ファイルが不一致でverifyもFAIL。生成先portal/index.htmlが入力になる。2回目は全1,310件一致。 |
| 主要画面/操作 | PASS、33画面条件・11操作群。検索/多軸/0件/解除/URL/原文/JSON/戻りとキーボード。今回は全長再撮影ではない。 |
| 固有操作 | ローカルと実hub直接入口で各6操作群PASS。図鑑の比較・メモ編集/保存/削除/export、観察票の保存/import/export/削除と失敗入力保持。すべて匿名context。 |
| 直接経路のbyte | 生成物1,309＋元7HTML＋画像1＝1,317件一致。管理マーカー1件はHTTP閲覧対象外。exported read-through APIを隔離起動し、コピー/assembleは実行していない。 |
| 直接経路の資源 | FAIL。12,518参照のうち495件が404。元欠損6件に加え、実在489件（ts/tsx、blend、gz、log、py等）。配信型の対応または非配信理由/原本案内が必要。 |
| docs/入口/lint/typecheck/build | PASS。lintは既存warning3件。READMEの最終案内もdocs:checkを再実施。 |
| 全体テスト | verify:coreは2件の5000ms timeout後、54ファイルPASS時点で中断。該当experienceRepositoryの単独12件はPASS。全623ファイルの一括完了/PASSではない。原因は未確定で、並行負荷の影響を断定しない。 |
| 保持 | 開始26,130ファイル欠落0、担当外既存変更0。アプリ入力1,683・宣言済みポータル入力13,441の変更0。これは未宣言の4,815素材を受入済みにする証拠ではない。 |

## 表示・負荷・保存

本人が今回撮影の入口320×568/1440幅、全件検索、図鑑の編集、観察票の5画像を実見した。入口・本文・状態は読める範囲だったが、独立審査の合格ではない。過去の同manifestの[全関連比較](../library-stable/comparison.html) は1,232画面条件で、既存の横はみ出し42条件・欠損画像2条件を記録している。全ページ/全操作の独立受入、実機、読み上げ等は未完。[alt属性の候補](image-alt-review-candidates.json) は1,555画像要素/87ページに未設定があり、キャプション等との関係を確認する必要がある。

[負荷診断](performance.json) では、390×844の匿名desktop Chromiumで検索準備まで通常 697ms、人工CPU4倍/4Mbps条件で 26518ms、JS heapの一時点は約 101.16MiBだった。検索用JS約11.49MiB、全件JSON約115.68MiB。実スマホ、Safari、本番の圧縮配信、最大メモリや多数回の性能合格ではない。

[保存経路の匿名試験](storage-route.json) は、旧file→統合fileと同じHTTP origin内の旧→新でメモが見える一方、fileメモはhub HTTP側では空欄になり、元fileには保持された。実データは読取/変更/移行していない。既存メモがある場合のexport/import等の移行経路が残る。

## 入口・正本・hub方針

Yuの元発言を確認し、hubへの別ポータルコピー/同期を現行の受入条件から外した。[方針記録](structure-policy.json)。正式な統合先は `portal/index.html`、プロジェクト固有の正本はこのrepo、共通部品はhub由来の固定版を利用する。未受入なので `.agents/index.html` を通常入口として保持し、新版は確認中と表示する。入口の完全一本化は未達。

hub起動中の直接入口は http://127.0.0.1:47860/repos/sansu/portal/index.html 。状況の読取先は `portal/data/project.json`（TASKS/BLOCKEDとdocs/portalメタデータから生成）。生成は `scripts/standard-portal.mjs` と固有tools。hubの経路・型対応・総合入口・旧コピー撤去はhub側の担当事項とし、本担当は共有ソース/distを変更していない。古いコピーpreflightのFAILは履歴として保持し、現在の合格条件に使わない。

## 整理と復旧

[保持/削除の分類](artifact-classification.json) と [削除結果1](cleanup-result.json) / [削除結果2](cleanup-second-result.json) / [同一byteの派生表](cleanup-derived-result.json)。計9対象・54,328ファイル、論理サイズ 12,355,813,588 bytesを削除した。物理的な空き容量の増加量は測っていない。

- 失敗した未公開hubコピー3組を削除。
- 再現可能なGit一時展開と、検証済みの隔離作業コピーを削除。
- 同一hashでないことを確認済みの診断用モデル2出力を削除。入力模型・脚本・失敗ログ・期待/実hashは保持。
- 元HTML/旧URL、原本、状態/検証/承認エンジン、固定vendor、試行履歴、必要な復旧保管、他作業は保持。

通常生成を隔離環境で再実行して、先の不要物6対象の復活0を確認した。最後の隔離作業コピーは通常生成の対象ではなく、完了した検証専用のsource workspaceとして消去した。

復旧は固定Git commitの正本と、[元7画面の保管](../recovery-check.json)、[全関連の保管](../recovery-stable.json)、[33資源の補足](additional-source-inputs.json)、[現行README](guidance-recovery.json)を同じ相対パスへ揃える。現在ファイルは別名退避し、hashを照合してから使用する。6欠損と一度での生成一致は未達であり、完全復元/受入PASSではない。学習保存・旧trial・追加承認の消費をリセットしない。今の入口へ戻すだけなら保持した元ポータルを使える。

## 残件

個別未登録4,815件、生成出力への入力依存、元6欠損、直接経路489参照、保存origin変更、全体テストと全表示/全操作/独立受入を解決してから正式切替へ進む。旧画面専用の書出しは受入後に廃止し、新生成にも使う関数/判定エンジンは残す。

未確認は実Safari/iOS、実ユーザー保存の移行、全画像説明・表・フォーカス順・読み上げ、公開/PWA/子どもの理解。今回は製品アプリのsourceを変更せず、e2e:smoke/verify:releaseは実行していない。全コマンドの日時・exit code・raw log・未確認範囲は [機械記録](report.json)、[終了時の入力/保持照合](end-state.json)にある。commit・push・公開・本番変更なし。
