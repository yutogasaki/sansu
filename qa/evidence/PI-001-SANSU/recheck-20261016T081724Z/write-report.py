from pathlib import Path
import collections, datetime, hashlib, json

out = Path(__file__).resolve().parent
root = out.parents[3]
read = lambda name: json.loads((out/name).read_text())
start, end = read('start.json'), read('end-state.json')
coverage, additions = read('asset-coverage.json'), read('additional-source-inputs.json')
direct, storage, perf = read('direct-bytes-isolated.json'), read('storage-route.json'), read('performance.json')
clean, second = read('clean-complete-assets-comparison.json'), read('clean-second-comparison.json')
local, primary, remote = read('library-browser/browser.json'), read('primary-browser/browser.json'), read('direct-browser/browser.json')
audit = read('library-audit/audit.json')
checks = [json.loads(p.read_text()) for p in sorted(out.glob('*.result.json'))]
cleanup = read('cleanup-result.json')
cleanup2 = read('cleanup-second-result.json')
entries = cleanup['plan'] + cleanup2['entries']
derived_cleanup = read('cleanup-derived-result.json')
entries += derived_cleanup['entries']
existing = [r for r in direct['resourceFailures'] if r['existsOnDisk']]
classifications = [
 {'path':'portal/index.html と主要7詳細','category':'現行に必要','action':'保持','reason':'唯一の統合入口の候補。未受入を表示し元入口を残す。'},
 {'path':'portal/integrated/・read/・folders/・ai/・data/','category':'現行に必要','action':'保持','reason':'本文・固有操作・詳細・検索から参照される生成物。人向け/原文/データの同一記録による表示。'},
 {'path':'portal/original/','category':'現行に必要','action':'保持','reason':'主要7詳細の元表示iframeから利用される。即時削除すると表示/操作を失う。独立した正式入口にはしない。'},
 {'path':'.agents/の元6HTML と docs/index.html','category':'旧URL互換に必要','action':'保持','reason':'全項目未受入。元入口と深いURLを削除・上書きしない。'},
 {'path':'docs/portal/ と仕様・仕事・判断・スキルの正本','category':'現行に必要','action':'保持','reason':'統合表示の生成元。移動/二重手更新をしない。'},
 {'path':'tools/generate-agent-index.mjs の legacyPages()','category':'現行に必要','action':'保持','reason':'新生成処理が再利用する。旧画面を書き出すCLIだけの廃止は受入後。'},
 {'path':'tools/portal-graph.mjs・flow・状態/承認エンジン・固定vendor','category':'現行に必要','action':'保持','reason':'判定・履歴・上限・承認の正本/検査。表示生成と分けて扱う。固定版を直書きしない。'},
 {'path':'qa/evidence/PI-001-SANSU/screens-stable・library-stable と独立審査/失敗記録','category':'固定した復旧保存に必要','action':'保持','reason':'同版の比較/失敗から修正までの証拠。新しい合格へ読み替えない。'},
 {'path':'Projects/.portal-recovery/PI-001-SANSU と PI-001-SANSU-library/be55eae17dcadf33','category':'固定した復旧保存に必要','action':'保持・33資源と現行READMEを補足','reason':'現存資源と元7画面の復旧保管。Git正本と組み合わせる。6欠損/単一復旧一式への整理は未達。'},
 {'path':'他作業の既存差分、portal-fix-done.md、qa/evidence/PORTAL-001','category':'保持（担当外）','action':'変更/削除しない','reason':'自身の不要物と推定しない。'},
 {'path':'portal直下の candidate/・review/・v2/','category':'該当なし','action':'新設しない','reason':'独立した現行版フォルダはない。docs内の同名の製品履歴とは区別する。'},
]
for row in entries:
 classifications.append({'path':row['path'],'category':'不要','action':'削除済み','reason':row['reason'],'files':row['files'],'logicalBytes':row['logicalBytes']})
result = {
 'at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'verdict':'FAIL / 受入HOLD',
 'scope':'Sansuの未commit作業ツリー。ポータルの再検証と許可された不要物整理。公開版や他repoの合格ではない。',
 'head':start['head'],'branch':start['branch'],'candidate':start['candidate'],'manifestSha256':start['manifestSha256'],
 'checks':checks,'endState':end,
 'findings':[
  {'id':'coverage','severity':'blocking','detail':'元素材14,069件のうち4,815件がcore/libraryいずれの資源台帳にも個別登録されていない。原本は保持。統合先/利用条件/除外理由の整理が未完。','evidence':['asset-coverage.json','additional-resource-parity.json']},
  {'id':'clean-generation','severity':'blocking','detail':'完全な入力から出力を空にしてbuildすると3生成物が不一致。portal/index.htmlが入力に混ざり初回verifyはFAIL。2回目のbuildは1,310件完全一致。既存出力を前提とする依存を解消する必要。','evidence':['clean-complete-assets-comparison.json','clean-first-verify.result.json','clean-second-comparison.json']},
  {'id':'direct-resources','severity':'blocking','detail':f'直接経路で生成物等1,317件は同一byte。ただし登録済み資源のHEADで{len(direct["resourceFailures"])}件が404。実在する{len(existing)}件と元欠損6件。型対応または明示的な非配信案内が必要。hub共有ファイルはこの担当から編集しない。','evidence':['direct-bytes-isolated.json']},
  {'id':'original-missing','severity':'blocking','detail':'元資料の6参照先が欠損したまま。別候補の模型を代用しない。','evidence':['library-audit/audit.json']},
  {'id':'storage-origin','severity':'unverified-migration','detail':'匿名試験ではfile旧→新とHTTP旧→新の同じ文書系列は共有。一方file保存はhub HTTPには表示されず、元fileには保持。実データの移行経路は未実装/未確認。','evidence':['storage-route.json']},
  {'id':'full-core','severity':'not-passed','detail':'verify:coreはdocs/入口/lint/typecheck後、保存テスト2件が5秒で時間切れ。54ファイルPASS時点で中断して切り分けた。該当1ファイル単独12件はPASS。全体一括PASSではない。','evidence':['verify-core.result.json','verify-core.log','persistence-focused.result.json']},
  {'id':'visual-accessibility','severity':'unverified','detail':'既存42条件の横はみ出し、全308ページの全操作/独立受入、実機は未完。静的img 1,555要素/87ページでalt未設定。キャプション等との対応を確認してから判断する。','evidence':['../view-metrics.json','image-alt-review-candidates.json']},
 ],
 'policy':read('structure-policy.json'),'artifactClassification':classifications,
 'cleanup':{'entries':len(entries),'files':sum(r['files'] for r in entries),'logicalBytes':sum(r['logicalBytes'] for r in entries),'note':'論理サイズ。APFS cloneのため物理的な空き容量の増加量ではない。','revivedAfterBuild':end['cleanupRevivedAfterRegeneration']},
 'manualView':{'viewer':'implementation owner, not independent','images':['primary-browser/entry-320x568.jpg','primary-browser/after-home-1440-first.jpg','library-browser/library-search-390.jpg','library-browser/atlas-edit-390.jpg','library-browser/observer-390.jpg'],'scope':'当該5画像の可読性と入口を実見。全画面/実機/コントラスト測定/独立審査ではない。'},
 'hubConnection':{'entry':'http://127.0.0.1:47860/repos/sansu/portal/index.html','canonical':'this repository','statusData':'portal/data/project.json generated from docs/portal metadata and canonical TASKS/BLOCKED ledgers','generation':'scripts/standard-portal.mjs + local tools/portal-library*.mjs + pinned vendors','ownerCoordination':'hub direct routes/type policy/status aggregation/old copy removal remain with hub owner; no outgoing task messages or shared hub source/dist edits by this task','copyGate':'retired; old failed copy preflight retained only as history'},
 'recovery':{'canonicalGitCommit':start['head'],'baseReceipts':['../recovery-stable.json','../recovery-check.json'],'supplements':['additional-source-inputs.json','guidance-recovery.json'],'steps':['Restore the canonical Git source at the target commit into a separate directory.','Overlay both preserved source/resource sets, plus the 33 additional media and current README receipts. Keep existing originals and states backed up before replacement.','Restore only the intended version; do not reset learning stores, trials, approval consumption or user notes.','Fresh one-pass reproduction is currently FAIL; the observed second pass matches, which is a diagnostic, not an accepted workaround.','Immediate operational rollback uses the still-retained .agents/index.html. No formal cutover has been done.']},
 'limitations':['過去の1,232画面条件は同じmanifestの比較証拠として参照し、今回全308ページを再撮影したとは扱わない。','独立審査は以前の11画像の限定範囲のみ。今回の5画像実見は本人確認。','実Safari/iOS、実ユーザーの保存移行、全フォーカス順/読み上げ/全画像説明、公開/本番/PWA受入は未確認。','項目の追加・並べ替え後の深いURLの継続性は未検証。同じ候補内での再読込・URL復元のPASSから推測しない。','初回の共有直接サーバー一括取得は接続エラーになった。実サーバーでの6操作群と後続単発応答は成功。全byte/HEAD比較は同じexported APIを隔離起動して実施し、共有サーバーの稼働率は認定しない。','旧preservation-final.jsonは固定出力チェックにより最新集計へ更新した。新しいend-state.jsonを本runの保持証拠とする。'],
 'externalActions':'No commit/push/publication/deployment/production changes. No original portal deletion or state/approval reset.'
}
(out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
profiles={p['name']:p for p in perf['profiles']};baseline=profiles['baseline'];slow=profiles['cpu4-network4Mbps']
text=f'''# Sansu ポータル再検証

**結果はFAIL、正式受入はHOLD。** 候補 `{start['candidate']}`、全生成manifest SHA `{start['manifestSha256']}`。HEAD `{start['head']}`、branch `{start['branch']}` の未commit作業ツリーを対象にした。日時 {result['at']}。現行入口の正式切替・commit・push・公開は行っていない。

前回の「全件対応」は範囲の取り方が不十分だった。94,891行は登録済みレコードの照合範囲であり、素材全体の完全な受入ではない。今回、元ポータルの生成器が集計する14,069素材と照合し、4,815件の個別登録不足を確認した。原本は保持している。[追加対応表](additional-resource-parity.md) / [同じJSON](additional-resource-parity.json) に容量・hash・未登録判定を記録した。メタデータ採取を内容の人確認・採用に読み替えない。

## 検査結果

| 検査 | 今回の結果と範囲 |
| --- | --- |
| 既存出力の生成一致 | PASS、1,310件。候補とmanifestは終了時も不変。 |
| 原文/構造 | 元7画面39,938 occurrenceの再現照合PASS。全308 HTML・82,200項目の構造/文章/属性不一致0。資源6欠損・リンク7か所で全体FAIL。 |
| 全素材の網羅性 | FAIL。元集合14,069件のうち9,254件が資源台帳に登録、4,815件はcore/library両方で未登録。個別統合先か正当な除外理由が必要。 |
| 空からの再生成 | FAIL。Git正本・2保管・不足33資源を揃えた初回build後、3ファイルが不一致でverifyもFAIL。生成先portal/index.htmlが入力になる。2回目は全1,310件一致。 |
| 主要画面/操作 | PASS、{len(primary['pages'])}画面条件・{len(primary['operations'])}操作群。検索/多軸/0件/解除/URL/原文/JSON/戻りとキーボード。今回は全長再撮影ではない。 |
| 固有操作 | ローカルと実hub直接入口で各6操作群PASS。図鑑の比較・メモ編集/保存/削除/export、観察票の保存/import/export/削除と失敗入力保持。すべて匿名context。 |
| 直接経路のbyte | 生成物1,309＋元7HTML＋画像1＝1,317件一致。管理マーカー1件はHTTP閲覧対象外。exported read-through APIを隔離起動し、コピー/assembleは実行していない。 |
| 直接経路の資源 | FAIL。12,518参照のうち495件が404。元欠損6件に加え、実在489件（ts/tsx、blend、gz、log、py等）。配信型の対応または非配信理由/原本案内が必要。 |
| docs/入口/lint/typecheck/build | PASS。lintは既存warning3件。READMEの最終案内もdocs:checkを再実施。 |
| 全体テスト | verify:coreは2件の5000ms timeout後、54ファイルPASS時点で中断。該当experienceRepositoryの単独12件はPASS。全623ファイルの一括完了/PASSではない。原因は未確定で、並行負荷の影響を断定しない。 |
| 保持 | 開始26,130ファイル欠落0、担当外既存変更0。アプリ入力1,683・宣言済みポータル入力13,441の変更0。これは未宣言の4,815素材を受入済みにする証拠ではない。 |

## 表示・負荷・保存

本人が今回撮影の入口320×568/1440幅、全件検索、図鑑の編集、観察票の5画像を実見した。入口・本文・状態は読める範囲だったが、独立審査の合格ではない。過去の同manifestの[全関連比較](../library-stable/comparison.html) は1,232画面条件で、既存の横はみ出し42条件・欠損画像2条件を記録している。全ページ/全操作の独立受入、実機、読み上げ等は未完。[alt属性の候補](image-alt-review-candidates.json) は1,555画像要素/87ページに未設定があり、キャプション等との関係を確認する必要がある。

[負荷診断](performance.json) では、390×844の匿名desktop Chromiumで検索準備まで通常 {baseline['searchReadyMs']}ms、人工CPU4倍/4Mbps条件で {slow['searchReadyMs']}ms、JS heapの一時点は約 {slow['jsHeapSampleMiB']}MiBだった。検索用JS約11.49MiB、全件JSON約115.68MiB。実スマホ、Safari、本番の圧縮配信、最大メモリや多数回の性能合格ではない。

[保存経路の匿名試験](storage-route.json) は、旧file→統合fileと同じHTTP origin内の旧→新でメモが見える一方、fileメモはhub HTTP側では空欄になり、元fileには保持された。実データは読取/変更/移行していない。既存メモがある場合のexport/import等の移行経路が残る。

## 入口・正本・hub方針

Yuの元発言を確認し、hubへの別ポータルコピー/同期を現行の受入条件から外した。[方針記録](structure-policy.json)。正式な統合先は `portal/index.html`、プロジェクト固有の正本はこのrepo、共通部品はhub由来の固定版を利用する。未受入なので `.agents/index.html` を通常入口として保持し、新版は確認中と表示する。入口の完全一本化は未達。

hub起動中の直接入口は http://127.0.0.1:47860/repos/sansu/portal/index.html 。状況の読取先は `portal/data/project.json`（TASKS/BLOCKEDとdocs/portalメタデータから生成）。生成は `scripts/standard-portal.mjs` と固有tools。hubの経路・型対応・総合入口・旧コピー撤去はhub側の担当事項とし、本担当は共有ソース/distを変更していない。古いコピーpreflightのFAILは履歴として保持し、現在の合格条件に使わない。

## 整理と復旧

[保持/削除の分類](artifact-classification.json) と [削除結果1](cleanup-result.json) / [削除結果2](cleanup-second-result.json) / [同一byteの派生表](cleanup-derived-result.json)。計{len(entries)}対象・{result['cleanup']['files']:,}ファイル、論理サイズ {result['cleanup']['logicalBytes']:,} bytesを削除した。物理的な空き容量の増加量は測っていない。

- 失敗した未公開hubコピー3組を削除。
- 再現可能なGit一時展開と、検証済みの隔離作業コピーを削除。
- 同一hashでないことを確認済みの診断用モデル2出力を削除。入力模型・脚本・失敗ログ・期待/実hashは保持。
- 元HTML/旧URL、原本、状態/検証/承認エンジン、固定vendor、試行履歴、必要な復旧保管、他作業は保持。

通常生成を隔離環境で再実行して、先の不要物6対象の復活0を確認した。最後の隔離作業コピーは通常生成の対象ではなく、完了した検証専用のsource workspaceとして消去した。

復旧は固定Git commitの正本と、[元7画面の保管](../recovery-check.json)、[全関連の保管](../recovery-stable.json)、[33資源の補足](additional-source-inputs.json)、[現行README](guidance-recovery.json)を同じ相対パスへ揃える。現在ファイルは別名退避し、hashを照合してから使用する。6欠損と一度での生成一致は未達であり、完全復元/受入PASSではない。学習保存・旧trial・追加承認の消費をリセットしない。今の入口へ戻すだけなら保持した元ポータルを使える。

## 残件

個別未登録4,815件、生成出力への入力依存、元6欠損、直接経路489参照、保存origin変更、全体テストと全表示/全操作/独立受入を解決してから正式切替へ進む。旧画面専用の書出しは受入後に廃止し、新生成にも使う関数/判定エンジンは残す。

未確認は実Safari/iOS、実ユーザー保存の移行、全画像説明・表・フォーカス順・読み上げ、公開/PWA/子どもの理解。今回は製品アプリのsourceを変更せず、e2e:smoke/verify:releaseは実行していない。全コマンドの日時・exit code・raw log・未確認範囲は [機械記録](report.json)、[終了時の入力/保持照合](end-state.json)にある。commit・push・公開・本番変更なし。
'''
(out/'README.md').write_text(text)
(out/'artifact-classification.json').write_text(json.dumps({'at':result['at'],'rows':classifications},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verdict':result['verdict'],'findings':len(result['findings']),'cleanup':result['cleanup']},ensure_ascii=False))
