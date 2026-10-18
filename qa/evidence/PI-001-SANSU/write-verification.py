from pathlib import Path
import json,hashlib,datetime,re,shutil
root=Path(__file__).resolve().parents[3];out=root/'qa/evidence/PI-001-SANSU';logs=Path('/tmp/codex/PI-001-SANSU')
read=lambda p:json.loads((out/p).read_text()) if (out/p).is_file() else None
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=root/'portal/data/unification-manifest.json';candidate=json.loads((root/'portal/data/integration.json').read_text())['currentCandidate']
audit=read('library/audit.json');core=read('screens-stable/browser.json');lib=read('library-stable/browser.json');recovery=read('recovery-stable.json');preserve=read('preservation-final.json');hub=read('hub-preflight.json');independent=out/'independent-review-verified.md'
unit=(logs/'test-full-controlled.log').read_text();summary=re.findall(r'Test Files[^\n]*|Tests  [^\n]*',unit)[-2:];unitstatus='PASS' if summary and all('failed' not in s for s in summary) else 'FAIL' if summary else 'RUNNING'
if (out/'controlled-unit-stopped.json').exists():unitstatus='TERMINATED'
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'acceptance':'HOLD / 未完了','scope':'この会話の実装責任はSansu。各repoの同一依頼が並行しているため、他repoの作業を本会話の実績にしない。','targetCommit':'eb4b907bdf5cb6e99c30c4ac6f28d2d3969cac50','branch':'codex/pi-001-sansu','candidate':candidate,'manifestSha256':sha(manifest),'unificationInputHash':sha(root/'portal/data/unification.json'),'formalEntrance':'.agents/index.html','proposedEntrance':'portal/index.html','oldURLs':'受入前のため全元URL/資源を現状維持。転送・削除・旧画面の記録化・旧生成廃止は未実施。','missingResources':audit['itemIssueDetails'],'coreBrowser':core,'libraryBrowserSummary':None if not lib else {'status':lib['status'],'pages':len(lib['pages']),'groups':lib['groups'],'failures':lib['failures']},'controlledUnit':{'status':unitstatus,'exitCode':1,'summary':summary,'filesReported':len(re.findall(r'^ ✓ .*\(\d+ tests?\)',unit,re.M)),'finalFailedFileRerun':{'command':'npm run test:run -- src/domain/islandLife/repository.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism','files':1,'tests':10,'status':'PASS','exitCode':0}},'initialUnit':{'filesPassed':621,'filesTimedOut':2,'testsPassed':5381,'testsTimedOut':3,'failedFileRerun':{'files':2,'tests':22,'status':'PASS'}},'coreCounts':read('parity.json')['counts'],'libraryCounts':read('complete-parity.json')['counts'],'viewMetrics':read('view-metrics.json'),'preservation':{'initialFiles':preserve['initialFiles'],'missing':len(preserve['missing']),'outsideOwnedChanges':len(preserve['outsideOwnedChanges'])},'recovery':recovery,'hub':hub,'independentReview':'independent-review-verified.md' if independent.exists() else '未確認・全体HOLD','externalActions':'この作業ではcommit・push・公開・デプロイ・DB移行・外部送信を行っていない。'}
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# Preserve the exact completed and failed command outputs, including failed history.
dest=out/'logs';dest.mkdir(exist_ok=True)
for name in ['combined-build-stable.log','generation-stable.log','generation-closeout.log','portal-stable.log','library-stable-audit.log','docs-stable.log','docs-closeout.log','lint-complete.log','lint-stable.log','typecheck-stable.log','app-build-stable.log','tests.log','test-timeout-rerun.log','test-full-controlled.log','test-final-file-rerun.log','portal-entry-stable.log','file-browser-stable.log','hub-preflight.log','restore-v5-diagnostic.log','recovery-stable.log','screens-stable.log','library-stable.log','current-ui-entry.log','css-assets.log']:
 if (logs/name).is_file():shutil.copy2(logs/name,dest/name)
unitline=(' / '.join(summary) if summary else unitstatus+'（追加全体再実行。合格扱いしない）').replace('|','&#124;')
missingtext='\n'.join('- `'+row['source']+'`' for row in audit['itemIssueDetails'])
libline=(str(len(lib['pages']))+'画面条件、'+str(len(lib['groups']))+'操作群。撮影/操作のstatus='+lib['status']) if lib else '全308 HTMLのPC/スマホ新旧撮影は進行中。未完了を合格扱いしない。'
text=f'''# Sansu ポータル統合の検証記録

**統合全体は未完了、受入はHOLD。正式入口は元の [.agents/index.html](../../../.agents/index.html) のままです。** [新ポータル](../../../portal/index.html) は確認中と表示し、元への目立つ入口を保持しています。元7画面・全元URL・資源は削除/上書き/非表示にしていません。旧URLの転送、README/AI/hubの正式入口切替、旧生成処理の廃止は受入後の工程として保留しました。保持期限未決のURLは削除していません。

この会話の実装はSansuを担当しました。hubの tasks.md に対象、順序、分担、開始保全、判定条件と進捗を記録しています。他repoの同一依頼が別タスクで進行しており、この報告ではそれらを完了としません。commit・push・公開・デプロイ・DB移行・外部送信は行っていません。

開始時のREADMEは先行して統合版を「Standard project portal」と案内していたため、受入前であることと元ポータルを通常入口とする表示に揃えました。統合版へのリンクと生成/検査コマンドは残しています。旧URLの切替や非表示ではありません。

対象は HEAD `{report['targetCommit']}`、branch `{report['branch']}` と未commit入力です。統合候補は `{candidate}`、全生成物のmanifest SHA256は `{report['manifestSha256']}`、全件入力hashは `{report['unificationInputHash']}`。日時は {report['at']}。再生成日時を元の内容確認日へ書き換えず、比較元、旧trial、承認の消費と過去の失敗は保持しました。製品アプリの公開版、実機、子どもの理解や再訪の合格はこの記録から主張しません。

証拠のファイル名・容量・hashは [evidence-manifest.json](evidence-manifest.json)。元の失敗ログも [logs](logs) に保持します。Node.js 24.18.0と既存node_modulesを使用し、依存やlockは変更していません。`nvm use` はこのshellで利用できず、`npm ci` は未実行です。

[全関連項目の対応表](complete-parity.md) / [同じJSON](complete-parity.json) は94,891行です。元HTML 308（docs 302、.agents 6）、784文書、82,200項目、12,518参照資源とCSS間接参照のフォント2件、171フォルダ一覧を区別します。元7画面を細かく分けた39,938 occurrence・15,488要素の照合は [parity.md](parity.md) / [parity.json](parity.json)。数え方と対象の重複があるため合算しません。主要資料の本文検索820文書との和集合で docs の全775 Markdownへ到達できます。

人向けの短いラベル、原文、属性、識別子、出典、同じレコードのJSONを往復できます。CSSの間接依存2件も [補足JSON](css-assets.json) に入力hash・容量・参照元と開始時不変を記録し、同hashの復旧コピーを保管しています。主要7画面の本文検索は語句＋分類＋形式を組み合わせ、件数・0件・解除・URL復元・資料の形式復元・Escape・フォーカス復帰を備えます。追加全件の検索でも原文を保持し、コードを検索結果の大きな見出しへ出さず「操作定義」等の人向け表示を使います。図鑑の比較、メモ追加/編集/保存/削除/export、観察票の保存/import/export/削除と失敗表示を元のエンジンのまま統合しました。試験は新しい匿名ブラウザcontextだけで行い、実際の児童/家族/本人メモ・端末の写真・保存内容は読み取っていません。.env・秘密鍵・Git内部・非公開領域は本文へ取り込みません。

| 検証 | 結果と範囲 |
| --- | --- |
| 再生成一致 | `node scripts/standard-portal.mjs verify` PASS、1,310ファイル。全manifest入出力hashも照合。内容確認/受入の合格とは別です。 |
| 元7画面 | 全39,938 occurrence・15,488要素、CSS/JS/文章/属性と参照先を保持。元7HTMLは開始保全とも一致。 |
| 全関連機械照合 | 82,200項目の原文/属性/構造の不一致0。参照資源6件欠損、リンク7 occurrence欠損。全体FAIL。 |
| `npm run portal:verify` | 欠損参照でFAIL。固定vendor、元7画面、流れ14項目のschema/依存/停止条件/根拠の一致まではPASS。 |
| docs/lint/typecheck/build | PASS。lintの既存warning3件。buildと資源検査はPWA145件・8.51 MiB/12、Explore27件・2.97 MiB/8を確認。未使用の依存更新はしていません。 |
| 全アプリtest | 初回623ファイル、5,381件PASS・3件時間切れ。該当2ファイルの単独再実行は22件PASS。追加全体実行はFAIL: {unitline}。最後の該当1ファイル単独再実行は10件PASS。全体一括PASSへ読み替えず、時間切れの履歴を保持。製品テスト/実装は本変更で編集していません。 |
| 新入口の局所テスト | 5件PASS。 |
| 主要画面HTTP | [browser.json](screens-stable/browser.json) PASS、33画面条件・11操作群。同内容の1440/390幅の新旧全長と入口320/768/195幅、320×568/390×844冒頭を確認。 |
| file:// | [36条件](file-browser-stable.json)、[候補とhash照合](file-browser-stable-meta.json)。[匿名保存の旧新URL照合](file-storage.json) PASS（Chromiumのみ）。他の実ブラウザ保存全組合せは未確認。 |
| 追加HTMLと操作 | {libline}。撮影処理PASSを全画面の見た目受入にしません。[新旧の表示計測](view-metrics.md) は横はみ出しが各42条件、欠損画像が各2条件。新規悪化0でも未達/未確認を合格にしません。 |
| 独立審査 | [独立記録](independent-review-verified.md)。指定11画像の可読性・入口・状態表示に限りGO。全308ページ・全操作の独立受入は未確認で、全体HOLD。 |
| hub配布copy | [preflight](hub-preflight.json) FAIL。現行hub配布器が元資料baseと同じcontextで画像を解決せず、`portal/integrated/assets/island-planter-v1/design-v2/back.png` を欠損扱いしました。repoでは元画像が存在しhash/表示を照合済み。公式distとhub主入口は変更していません。 |

[主要画面の比較一覧](screens-stable/comparison.html) と [追加HTMLの比較一覧](library-stable/comparison.html) に同幅の前後を置きます。具体的な改善は、旧主要画面のページ内検索から、全820文書の本文＋分類＋形式の横断検索へ進めた点です。「学習／仕様／文章」は同じ正本から91件を導き、同じ件数、原文/JSONの同一性、再読込復元をブラウザで照合しました。独立審査で不合格だった320×568の冒頭も、旧入口の下端717.23pxから566.06pxへ改善し、16pxの本文を保って枠全体を初画面内へ収めました。これは初期候補からの修正前後であり、元ポータル自体の数値と混同しません。

残る資源欠損は旧候補 `native05-landscape-owned-art-v5` の `history/draft-05/index.html` に開始時から存在しました。GLBの期待SHAは `73ba35788ffe12472655ec0183108769f431ecd44249f3010350322f682797ce`、blendは `5c53320a567d1fb8c05f43c3408ff1f51b32874e0b8c2fcbca36e8a7fa83f7c0`。開始時26,130ファイル、該当Git履歴、関連/tmpの同容量GLBでは同じものを確認できませんでした。[隔離した再構築診断](restore-v5-diagnostic.json) もサイズは同じでしたがhashが一致せず、採用していません。別候補の素材を過去の候補へ流用しません。保存場所をYuへ質問中です。

欠損6件（画像はリンク2か所から参照されるため欠損リンクは7件）:

{missingtext}

現存資源の復旧保管は [recovery-stable.json](recovery-stable.json)。Git外 `{recovery['root']}` に13,441ファイル・3,958,321,539 bytesを保管し全内容hashを照合しました。6欠損は保管できないため全体はPARTIALです。開始時の元7画面と資源2,142件・1,702,277,803 bytesも `/Users/yutogasaki/Projects/.portal-recovery/PI-001-SANSU/` に別保全しています。[保持検査](preservation-final.json) では開始26,130ファイルの欠落0、担当外既存ファイルの変更0です。元画面へ戻すだけなら入口切替前なので `.agents/index.html` をそのまま使えます。ファイル復旧時は現ファイルを別名退避し、manifestの同じ相対パスの内容を戻してhashを照合してから再生成します。正本・旧trial・承認消費・学習保存はリセットしません。完全再現には欠損6件の同じ対象版も必要です。

保持した生成処理は `legacyPages()`、旧 `portal-graph.mjs` の状態/検証/承認/履歴、標準とflowの固定vendorです。固有のreader/検索/全件ライブラリ合成とフォルダ一覧を追加し、portal出力を同じ正本から作ります。固定標準の直書き改変はせず、統合vendorは追加版1.0.2をlock/SHAで固定しています。受入前のため旧画面生成は廃止していません。通常生成で旧画面を復活させない切替後の確認も未実施です。

残る完了条件は、欠損資源の復旧、既存の横はみ出しを含む追加全画面/全操作/独立審査の受入、全アプリテストの時間切れの解消、hub配布のcontext・資源・公開選別の整合です。Safari/iOS、読み上げ、全表/全フォーカス順と実保存の全組合せは未確認です。アプリ配布・routing・PWAは変更しておらず `e2e:smoke` / `verify:release` は実行していません。合格後にREADME/AI/hubの入口統一、旧URLと深いリンクの移転案内、旧表示生成だけの廃止、切替後の再生成/復旧を行います。他repoとhubの作業は各担当の記録を正とし、このSansuの結果へ合算していません。
'''
(out/'verification.md').write_text(text)
print(json.dumps({'acceptance':report['acceptance'],'candidate':candidate,'controlledUnit':report['controlledUnit'],'libraryBrowser':None if not lib else {'pages':len(lib['pages']),'status':lib['status']}},ensure_ascii=False))
