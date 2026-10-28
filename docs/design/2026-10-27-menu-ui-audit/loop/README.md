# メニュー監査・修正ループ

2026-10-27 14:25 JST開始。依頼「チャッピー監査ループ」「修正実装もループにいれて」。一単位は家・手紙・花の読む量。既定30分、追加エージェントなし、commit/push/deployなし。

## 対象と実装

開始HEAD `2e06dc9a1f0c83bda700fc3b8caf115693d044b4` の共有dirty checkout。既存の国語・camera操作など他作業を保持。親仕様01と画面仕様44へ局所的な表示契約を追記した。保存形式・採点・routingは変更していない。

- 家：副題と室内操作の重複文、案内本の定型補足を削減。カード間隔を短縮。直接入口、空/件数、チャレンジ既存detailsを保持。candidate `house-paper-atelier-v2`。
- 手紙：差出人＋本文先頭24文字の一覧から、同じ領域で一通だけ全文。本文は内部scroll、よみあげ/停止/一覧へ戻る。閉じる・一覧へ戻る・unmountで所有音声を止める。既読は既存どおり明示的な読み上げ時に記録し、開いただけでは更新しない。閉じた後は一覧へ戻る。
- 花：既知は元の絵/色、親色が分かる未知は元のヒント、無ヒント未知は個別の?枠。合計11対象を保ち、未知色名を露出しない。ヒント枠がある場合は残りを「ほかにも」と呼び、未発見総数と混同しない。非操作表示なので?枠36pxはtap targetではない。
- 実画面で家の閉じる等が44pxと判明し、既存48px宣言が他のCSSに負ける点を補正。以後390幅の対象buttonは48px以上。模様替えswatchも48px幅へ。

[修正後の家](04-house-after.jpg)、[0通の手紙](05-letters-empty-after.jpg)。後者は48px優先度修正前の途中証拠。

## 相談ループ

[既存会話「メニュー配置を評価」](https://chatgpt.com/g/g-p-6ad58d0857b881918e46e346350848e7-hokomoko/c/6ad7323d-c320-83e8-99cd-c681ca893617)を使用。consult-chatgptスキルに従い同じプロジェクトと会話を確認した。

1. [監査票全文と依頼](round1-prompt.txt)→[反証回答](round1-response.txt)。家の全実見本化を断定しない、11未知枠を保持、海図の星を説明と混同しない、写真原因調査を先行、と補正。
2. 利用者の実装追加依頼を伝え、実装案と現行コードの再確認を送った。[送信と回答](round2-transcript.txt)。音声停止・未読・既存入口を重点化。
3. 回答の「花ヒントは従来どおり選択可能」は不採用：現行は非操作div内のヒント表示。44px一般論は家仕様48pxへ訂正。localStorage失敗時の既読は元から一時便宜状態なので、保存成功を偽装する新機能は作っていない。実保存失敗の新設仕様は本修正外。

変更後画像の再送・最終回答は未完。viewport切替後にブラウザ接続が応答せず、接続再初期化後もtimeoutした。最後に取得した回答は実装案への監査で、変更後実画像の合格ではない。

## 写真の追加切り分け

[現在島](01-current-island.jpg)→[カメラ](02-current-camera.jpg)→専用匿名originのUIで1枚撮影→[再読込後の写真棚](03-saved-photo-reloaded.jpg)。表示不一致が保存画像にも残ることを確認。既存写真の破損/削除や本人混入は実証していない。現在島のrendererと旧camera/albumの接続は独立した高リスク修正として残す。ユーザーの5198 originには触れていない。

## 検証の現在地

- `npm exec vitest run -- src/components/island/growing/LettersPanel.test.tsx src/components/island/growing/FlowerBook.test.tsx`：5件PASS。未読/音声停止/一通表示、0/既知親色/全発見の11対象を確認。React hooksの明示診断であり実ブラウザ音声/自然獲得の証拠ではない。
- typecheck：初回と最終ともPASS。最終ログ（ローカルログ：`typecheck-final.log`）。
- lint：初回0 error / 既存5 warning。最終の変更6TSXファイルはPASS。対象lint（ローカルログ：`lint-focused.log`）。全体再実行は長時間未完のため停止し途中ログ（ローカルログ：`lint.log`）を残した。
- 全体unit：変更外の保存テスト3件で5000ms timeout、中断。初回ログ（ローカルログ：`full-suite-partial.log`）。2ファイルを1workerで再確認しても同じ3件timeout。単独再検査（ローカルログ：`recheck.log`）は31件中28件PASS/3件FAIL（うち今回追加5件はPASS）。原因未確定、全体PASSとはしない。
- docs:check：最終PASS、既存期限警告20件。ログ（ローカルログ：`docs-final.log`）。
- build：FAIL。ログ（ローカルログ：`build.log`）。TypeScript・アプリVite・PWA生成・販促Viteの段階は完了したが、assets:checkで `dist/sw.js` がENOENT。同時に別の通常 `vite build` が同じcheckoutで実行されており、ログ上は生成されたsw.jsが検査時には消えていた。共有出力競合が疑われるが断定せず、隔離出力での再検証を残す。
- agent:index:check：初回は概要/タスク索引がstale。元Markdownから索引を再生成したが、再検査では `docs/index.html` がstale。最終ログ（ローカルログ：`entry-final.log`）。共有文書更新のある作業treeで、入口全体のPASSは未取得。portal検査へは到達していない。
- DEV390×844：家の直接入口と0通の一文案内、閉じる焦点復帰、対象buttonの48px以上を確認。
- 複数通/長文/0・1・親色2色の明示fixtureを `output/menu-audit/harness.html` に作成。初期3通入口表示まで到達。その後viewport切替中にブラウザ接続timeout、画面操作の合格は未取得。手紙を開いた際の入口消失に対し、パネル見出しへのfocusも追加したが、これは再接続不能後の変更で実画面再確認は未実施。
- 320・tablet・短横・実文字200%・実音声・保存失敗・実機・児童の無説明理解/再訪・本番形式/PWAは未確認。ブラウザ実行の復旧状況をcloseoutで追記する。

美術はbenchmark比較なしHOLD、子どもの理解は実測なしHOLD、runtimeは上記範囲PARTIAL。全メニューの全問題修正・公開受入完了とはしない。続きは写真接続、模様見本、住人/海図の情報接続と戻り方。

## 入力の識別

[manifest](manifest.json)は最終対象sourceのhash。撮影はDEV/HMRで、固定buildの開始/終了同一性を保証しない。主画面DOMの記録は[rendered-home.json](rendered-home.json)。今回の手紙/花は明示診断とコード検証、家の写真は390幅の実画面証拠として扱う。

## Closeout

- この実装単位はローカルに残した。全メニュー修正完了でもチャッピーの修正後画面合格でもない。commit/push/deployは行っていない。
- 専用DEV5299と自分が起動した未完の全体テスト/全体lintは停止。ブラウザ接続が応答しないためviewport解除と会話tabの保持操作は未確認。ユーザーのChrome全体や別作業の検査プロセスは停止していない。
- 次の最小手順はブラウザ接続復旧後、修正後の家・0/複数/長文手紙・花0/1/親色を390/320/横画面で確認し、同じ相談会話へ実画像を送って反証レビューすること。全体buildは隔離出力で再確認する。写真renderer接続はその後の独立変更として扱う。
- 正本は親仕様01/画面仕様44を更新。長期memory・ADR・運用規則は局所UI整理のため追加しない。親タスクと共有キューは現在地だけ更新した。
