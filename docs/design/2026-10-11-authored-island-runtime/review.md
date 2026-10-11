# M1統合の検証と美術レビュー

対象はDEVの `/prototypes/place-qa/authored.html`、build `authored-editable-m1-a1`、world `native05-authored-world-m0-v2`、rendered art `native05-authored-runtime-m1`。native kitと海岸の実SHAは各captureのmetadataへ記録した。入力は27所有物・8軒の合成診断。詳しい版とゲートは [verification.json](verification.json)。

## 作者の美術評価 — HOLD

[全景](runtime/desktop-whole.png)は原本と同じ入り江・丘・側面を持ち、大樹も一本の幹と多色の冠になった。元所有物の選択と分離がその場で動く。ここは改善した。

一方、水庭の広い水面・岸・橋は画面に成立していない。中央と右奥の裸地が大きく、森林の密度、種類の異なる地区の連なり、入口と実利用で生まれる幻想的な景色が不足する。大樹の上を歩ける共有床も未実装。[近景](runtime/desktop-tree-close.png)は幹の形を確認できるが、カメラは足元を下端へ寄せすぎる。phone/tabletの縦長画面では余白が大きい。原本への到達、M1完了、公開の判断を行わない。

## 独立理解と安全 — 未実施

観察者N=0。説明なしで成長・結合・入口を読めるか、子どもが再訪したくなるか、実機の触れやすさは未評価。作者の目と自動操作でこのゲートを通さない。

## runtimeと履歴

- [固定したcore](checks/core-final.txt)：579 files/5,044 tests PASS。既存のFast Refresh警告2件、新prototypeの同種警告1件、Browserslist/chunk-sizeの既存警告あり。型エラーは残っていない。
- [classic smoke](checks/smoke-final.txt)：32 PASS。初回はsandboxの `listen EPERM` で起動できず、実サーバー起動を許す環境で再実行した。[初回](checks/smoke-sandbox-error.txt)はアプリの不具合とは扱わない。
- [実編集](runtime/report.json)：6項目PASS、7画像。海を選ぶと有効previewを解除し、歩行専用点は配置不可。取消、同IDの移動/収納/復元を検査。純粋計算fixtureだけの証明とは分ける。
- [既存本体](legacy-regression/report.json)：8旅程、40実回答、22画像、1,532入力のSHA一致。元の土地、保存、学習の回帰であり、新世界の本人保存の証明ではない。
- 初回coreはreceiptに必要なprofile/revisionが欠けた型エラーで停止した。[初回記録](checks/core-first-type-error.txt)。診断専用receiptへ型を揃えたが、本人repositoryのCASを検証したとは扱わない。
- [編集中のcore](checks/core-during-edits.txt)は無関係deckの反例を追加し、guard変更中に実行したため1失敗。固定候補の証拠には使わない。[狭い回帰](checks/authored-deck-focused.txt)と変更後の固定coreはPASS。
- CLIの最初のsnapshot/screenshotはsandbox内のnpxがregistryへ再試行し `ENOTFOUND registry.npmjs.org` で終了した。offline指定と実行環境を直してsnapshotと初回画面を確認した。これはアプリfreezeの証拠ではない。
- CLIのrun-codeは関数形式が必要で、ホスト側の動的importは `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`。この呼出では編集を実行していない。projectの固定Playwright runtimeへ移した。
- 初回headlessの実編集は最初のcaptureへ進まない間に中断した。PASS/アプリfreezeとは断定せず、通常Chromiumによる [最終旅程](checks/editing-headed.txt)を別条件として保持する。headlessの停止原因は未確定。

## 配置の修正と性能の残差

初期の内側の鉢は水庭へ入る通路を塞いでいた。単独の移動は、鉢自身の入口か集落の給水を失った。2水物移動の候補も不成立だった。水5件とベンチの置き方を組み直し、通常move4件で全27個への経路と主景の条件を両立した。[最終確認](history/water-bench-verified.json.gz)、[単独比較](history/bowl-relocation-comparison.json.gz)、[2水物](history/two-water-relocations-search.json.gz)、[水5件](history/full-water-search.json.gz)、[ベンチとの競合](history/water-bench-search.json.gz)を残す。条件を緩めた合格ではない。

[Nodeで測定した入力](performance/sansu-authored-perf-before-hashes.json)に対し、object layer初回10.05秒・反復約8.75秒。床と逆変換の照会約12万回が主負荷。tick中央値0.87ms、camera初回42msで、この診断では原因が別だった。[計測](performance/sansu-authored-perf-before-results.json)。実機FPSやbrowserの全待ち時間ではない。道の支持済み地点・頂点・面と泉の床照会を再利用する次の実装で、before/afterを同じ入力へ適用する。性能の未達をテストPASSで埋めない。
