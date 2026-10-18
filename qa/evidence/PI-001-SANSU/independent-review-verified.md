# PI-001-SANSU 現候補の限定独立見た目審査

判定は **実見した静止画の可読性・入口・状態表示に限りGO、ポータル統合全体はHOLD**。正式受入、入口切替、公開の承認ではない。

- 審査者：Codex独立審査担当 `portal_review_verified`。実装担当とは別の担当として、指定11枚を `view_image` で実際に確認した。
- 記録日時：2026-10-16 14:35 JST（05:35 UTC）。
- 対象：ローカル未commitのポータル候補。HEAD `eb4b907bdf5cb6e99c30c4ac6f28d2d3969cac50`。
- 現候補：`be55eae17dcadf330948d5261512dc0c8f20b33ea558e3aded97f77d83d4b9d5`。
- 全出力manifest SHA-256：`c212a26691b577aa9dcca1606aaa18bf03de7352810cb3870f9bb1f743f683a1`。
- 過去候補 `77cab…` の入口HOLDや過去GOを現候補の判定へ転記していない。

## 候補と証拠の照合

[integration.json](../../../portal/data/integration.json) の `currentCandidate` は、[screens-stable/browser.json](screens-stable/browser.json) と [library-stable/browser.json](library-stable/browser.json) の `candidate` に一致した。[unification-manifest.json](../../../portal/data/unification-manifest.json) の実ファイルSHA-256は上記値と一致し、library側の `manifestSha256` とも一致した。manifestの `outputs["data/integration.json"]` と実ファイルSHA-256も `deb1474e3fb8d8c1237ee693db843561873cd1da5ed5f14ee4a94a74e8b6620e` で一致した。manifestの `acceptance` は `unverified`、`original` は `.agents/index.html`。

| 証拠 | 記録内容 | この審査での扱い |
| --- | --- | --- |
| screens-stable/browser.json | 2026-10-16T04:59:12.100Z、`node tools/check-portal-migration-browser.mjs --full`、33条件・11操作群、PASS、failures/pageErrors 0 | 既存の機械撮影・操作の証拠 |
| library-stable/browser.json | 2026-10-16T04:59:12.529Z、`node tools/check-portal-library-browser.mjs --all-pages --full`、1,232条件・6操作群、PASS、failures 0 | 既存の機械撮影・操作の証拠 |

33条件や1,232条件の全画面を独立に実見したという意味ではない。既存QAは引継ぎ上、新規の匿名Chromium context。今回は追加ブラウザ操作、ユーザーのブラウザ・実保存の読取り、再撮影、npm/test/build/dev起動を行っていない。

## 実見結果

各GOは、その画像で見える範囲の可読性についての判定。静止画だけでリンク遷移・保存成功・全内容の保持を認定しない。

| 実見画像 | 判定・所見 |
| --- | --- |
| [entry-320x568.jpg](screens-stable/entry-320x568.jpg) | GO。現在の採用待ち、アプリ／紹介／ヘルプ、成果画像と元ポータルへの入口が読める。「元のさんすうポータルを開く」と確認中の説明は初期画面内に収まる。320幅で入口が画面外になるという過去候補の指摘は、この画像では再現していない。 |
| [entry-390x844.jpg](screens-stable/entry-390x844.jpg) | GO。主要入口と元入口の下に「形を比べる／停止中」「育ち方を作る／順番待ち」が見える。状態は文字でも区別され、色だけに依存しない。 |
| [after-home-1440-first.jpg](screens-stable/after-home-1440-first.jpg) | GO。現在の目的、成果、元入口、作業の流れの階層が追える。白・淡灰の面と紫のリンクで、本文や入口が画像に埋もれていない。サムネイルは表示されているが、画像自体の詳細や美術採用は判定していない。 |
| [before-overview-390-first.jpg](screens-stable/before-overview-390-first.jpg)／[after-overview-390-first.jpg](screens-stable/after-overview-390-first.jpg) | GO。同幅比較で見出し・本文が読める。統合後は「自動確認は完了（過去候補）」と、現在候補は対象が違うため未確認という注意を分けている。過去PASSを現在の正式受入と誤読しにくい。元の概要の全表示・操作への入口も見える。 |
| [search-facets-390.jpg](screens-stable/search-facets-390.jpg) | GO。「すべての資料を全文から探す」という大見出しに実行コードの漏出はない。検索欄と解除、資料分類のラベルを読める。分類・種類・結果の全領域はこの切取りの下にあるため、全体の操作性は実見判定の対象外。 |
| [document-reading-390.jpg](screens-stable/document-reading-390.jpg) | GO。「読みやすく／原文／データ」の区別と「閉じる」が読める。本文・引用枠・リンクを追える。文書内の `npm run dev` やURLは本文の技術情報として表示され、検索大見出しへ漏れていない。原文・JSONの実内容と表の表示はこの画像では未確認。 |
| [library-search-390.jpg](library-stable/library-search-390.jpg) | GO。「全ページから探す」、語句・分類・種類、件数、解除とフォーカス枠を読める。先頭結果は「概要の操作定義」という短い日本語で、実行コードが大きな見出しになっていない。「内容と操作を開く」と「原文・出典・元データ」の入口が分かれている。 |
| [atlas-edit-390.jpg](library-stable/atlas-edit-390.jpg) | GO。参考としての限界、次に確かめること、元出典、画像への判断メモが読める。「この端末のブラウザに保存。製品の採用決定とは分けて記録」と明示され、参考と採用が混ざらない。判断選択・入力・保存・削除後の文言は見える。対象画像の全体と実保存の正しさは未確認。 |
| [observer-390.jpg](library-stable/observer-390.jpg) | GO。観察目的、空欄は未観察という意味、JSON保存／開く／新記録を消すが読める。「読み込めませんでした」「今の新票・元ファイルは変更していません」「対応していない形式です」が見え、失敗と状態保持が文字で伝わる。観察記録を採点と取り違えない説明もある。実データや実保存を確認した結果ではない。 |
| [folder-390.jpg](library-stable/folder-390.jpg) | GO。保存資料一覧、件数、資料名は原文という説明、過去資料を現在の採用・確認済みと扱わない注意が読める。JSON・HTML・PNGのファイル名とbytesが区別でき、長い名前は幅内で折り返されている。リンク先ファイルの全内容は未確認。 |

指定画像の範囲では、可読性や主要入口を妨げる重なり、検索見出しへの実行コード漏出を認めなかった。本文・状態・原文への入口は読める。一方、指定画像には表の全体が含まれず、全画像・全表・全状態・全ページの網羅的な表示合格は出せない。

## 全体HOLDと未確認

統合担当からの引継ぎでは、開始時から存在する元資源6件の欠損と、hub配布copyでのbase URL解決失敗が残っている。この限定審査で再検査や修復はしておらず、全体HOLDを維持する。旧正式入口 `.agents/index.html` は保持、切替・公開なしという引継ぎ条件の下で記録する。画像でも元入口の保持を示す表示を確認したが、配布先での到達を独立に操作確認したものではない。

未確認は、全308ページの全内容・全操作の独立実見、全表・全画像・全原文／JSON、実際の保存と復元、Safari/iOS PWA等の実機、読み上げ、全フォーカス順、計測によるコントラスト、公開先・配布copy・cache更新状態。子どもの無説明理解や再訪、アプリ全体の美術連続性も対象外。

`sansu-design-review` と憲法、親仕様、UI仕様07、design review checklist、motion仕様14、design-system MASTERの関連範囲を参照。今回は内部の資料ポータルの限定審査であり、子ども向けゲームの魅力を数値採点したり、静止画のGOをruntime integrityや製品受入へ換算したりしていない。仕様・実装の変更は不要と判断し、この所見だけを新規保存する。

## 証拠の固定

- screens-stable/browser.json SHA-256：`f27e1a2f0156334e7478e2e9d5ae774b6cbbce19efc0c877fe8b3481f75c88c0`
- library-stable/browser.json SHA-256：`67ade05d113f837cb73f0a724e23795f7826d949fc295056b9627704815bf7bb`
- 実見11画像集合SHA-256：`762f682d9f8edefeaebdab6cdd81adcbb11199b3634287c1a2841f4c7a019098`
- 画像集合hashの算出：上表の画像の相対パスを辞書順に並べ、各行を `path + TAB + sha256(file) + LF` としたUTF-8全体のSHA-256。
- 実施コマンド：読取り用 `python3`（JSON identity・SHA照合）、`git rev-parse HEAD`、`view_image`。期待した候補一致・manifest一致・integration出力hash一致はすべて一致。アプリの自動検証は今回実行していない。
