# 学習・島・家の統合とmain反映の確認

最終照合前にmainが進んだため、実コミットの追加確認は[final](../final/README.md)を参照。以下の9検査はindex 0cf5deeb4688の結果として保持する。

2026-10-02。「やって」に対し、基点 `5987adee0b4789b16ff419d4e4dfa7a3df0f4e22` と開始時の未コミットのバランス・家/共有メニュー・ポケットメニューを統合。前回候補から除外した `island-pocket-v2` と家の本の直接入口・不足理由・別タブ同期を今回は含めた。**対象の機能チェックはPASS。公開URL・実機・子どもの評価は未確認。**

## 固定した対象

- 検証開始時のreviewed index treeは `0cf5deeb4688b3a63c57bfa9b637d4f1756c345a`。実コピーは `/tmp/sansu-latest-main.n_z3b7o1`。[対象と許可path](candidate.json)。終了時に証拠・closeout文書だけを追加し、app/build/QA入力のSHAを再照合する。
- 育つ島DEVは5280、標準Island DEVは5281、本番形式previewは5282。revisionは `main-integration-0cf5deeb4688`。本番形式は `vercel.json` と同じIsland/Life/Discovery/Fantasy/Growing有効・Preview/NatureTown無効のbuild。実build version、delivery、flag、画面candidateと各実URLは[集計](verification.json)と各reportへ記録。
- DEVだけは別作業の依存cacheと混ざらないよう、Vite configへ専用cacheDirを追加する[wrapper](vite-wrapper.txt)を使用。アプリのroute・保存・planner・問題・費用は変更していない。
- app/build/QAの1,769入力と、coreで作ったdistの214ファイルは検証前後で同じSHA。[app入力](app-inputs.json)、[dist](dist-inputs.json)。本番形式は同じ成果物を配信し、DEV fixtureとは分けた。
- 検証中に到着した2つの模型メニュー、通知から記念へ直行/本の主操作などの後続変更はこの固定候補に含めない。未ステージの保存/仕様/完了記録を保持し、この検査の結果やコミットへ混ぜない。

## 結果

| 検査 | 結果・証拠 |
|---|---|
| docs・入口guard・lint・typecheck・全test・build/assets | 517ファイル/4,593 tests PASS。[core](../latest-core.log) |
| ポケットメニュー・全数字キー・設定/記録/家/学習の往復 | 4サイズPASS。390/768/320/568、音off/reduced motion、44px/overflow、0/8人。[report](pocket/report.json)、[log](../latest-pocket.log) |
| 家の本・不足理由・目標・別タブ保存のlive反映 | 両幅2ケースPASS。直接入口とmenu入口、A6未準備/あとでやる、実flag変更、実3回答と継続。[report](house/report.json)、[log](../latest-house.log) |
| 通常学習/配置/再開・旧保存/拡張/時間 | 両幅4ケースPASS。旧保存と豊富な資源は明示fixture。[report](balance/report.json)、[log](../latest-balance.log) |
| 初回導入とA1〜A6の達成/不変記念 | 両幅6ケースPASS。[report](guidance/report.json)、[log](../latest-guidance.log) |
| 本番形式の実初回と実SW offline/reload | 両幅PASS。DB注入なし・実5回答、家の本と同じ予約/所有/記念の保持。[report](production-guidance/report.json)、[log](../latest-production-guidance.log) |
| 本番形式の現行正本保存の再検査 | 両幅PASS。DB注入なし・実5回答/有料配置/offline。[report](production-balance/report.json)、[log](../latest-production-balance.log) |
| 仕上げの見通し・実20問・進級後の学習 | 両幅14ケースPASS。保存されたmainLv16→17と「Lv17へ レベルアップ！」、次の通常学習。[report](finish/report.json)、[log](../latest-finish.log) |
| 標準Islandの全体往復 | 390/768の両幅PASS。[report](navigation/report.json)、[log](../latest-navigation.log) |
| 既存classic回帰 | 31/31 PASS。[log](../latest-smoke.log)。Islandの見た目の証拠にはしない |

[実画面の接触シート](screens.html)は仕上げの準備済みfixture、本番形式の本人、家の隔離DEV、メニューの明示資源を別々に示す。違うプロフィールを一つの自然な履歴に見せない。[順次実行したcommand/env](sequential-runner.txt)。

## 修正と中断

- 拡張検査の旧操作を現行の「しまの そうさ」を開く実UI操作へ更新。shared helperを使い、priceや学習条件は変えない。案内の拡張fixtureも同じ操作を使う。
- 本番balance検査は旧 `balancedIslands` ではなく現在の正本 `guidedIslands` を読む。saveVersionの古い固定期待を外し、実versionを記録。アプリの保存schemaは変更していない。
- 最初のbalance旅程は会話の中断でツールprocessも終了したため未完了。[途中画面](balance-interrupted/390-initial.png)、[元log](../latest-balance-interrupted.log)を保持。同じapp/dist/QAでbalanceから再開しPASS。中断をアプリ不具合や初回PASSとは扱わない。
- 既存Review By/Fast Refresh/Browserslist/precache警告は元logに残す。専有GPUのFPS/待ち時間を認定する検査ではない。

## 判定と残る確認

- **実装整合**：上記の対象機能・保存・routeの範囲でPASS。実two-build SW更新は今回の対象外。
- **見た目/情報設計**：作者が現行の実menu・家・仕上げ画面を確認。島を残す配置、数で示す不足、現在/次のLvとクリア後の進級を読める。新しい美術lineageの公開認定ではない。
- **子どもの理解/安全・学習効果**：利用者観察N=0。仕上げの条件が本人に伝わるか、戻りたくなるか、定着への効果は未評価。作者の理解とテストの成功で置き換えない。
- **実機/配信**：実iPhone Safari/PWA、公開URLでの既存の子の引き継ぎ、実音/GPUは残る確認。main pushから公開先の動作PASSを推定しない。

今回は既存のバランス/メニュー実装の統合、QAの現行化、検証記録が目的。親仕様・学習の出題/仕上げ判定・既得権・保存済み予約の追加変更は不要。持ち出した最終indexの文書検査とapp入力一致はcloseoutで記録する。
