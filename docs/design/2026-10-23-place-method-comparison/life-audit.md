# 通常利用と診断fixtureの独立監査

2026-10-23。読み取りによる監査。製品コードの変更・追加テストは行っていない。`life-check.ts` の合格を通常UI、DB、完成美術の合格へ拡張しない。

## 利用記録の更新条件

利用の識別は `world.revision` ではなく、派生した **place.revision・actorId・targetId** に依存する。`GrowingLife.observeUse()` が同じ組を抑止し、`useGrowingIsland.acknowledgePlace()` が保存済み最新slotとの一致を判定する。`recordPlaceUse()` は既存履歴があればその記録を再利用し、同じ利用を水増ししない。

今回の花/ベンチの移動は `derivePlace()` の署名に含むmembersの座標を変えるため、place ID/target IDが同じでもplace revisionは変わる。移動後に実到着・700ms滞在・可視描画を経て、新しいrevisionの利用記録になる。保存時はrepositoryがprofile/islandと最新record revisionを検査する。非表示・メニュー表示・本を開いている間は新しい利用の可視確認にならないため、通常の島へ戻してから利用させる。

一方、A/B方式の切替や遠方の地形変更だけでは、placeのmembers/footprint/entrances/route/targetsが同じならplace revisionも同じになる。world revisionの変化だけで新規利用は記録されない。ground targetの署名には全地表の高さは入っていない。この契約は現在の場所利用の保持であり、「方式Bでも改めて利用した」ことの単独証拠にはならない。

通常UIでは「そだつ場所」のP05詳細が「あそぶ」「また このばしょで あそぼう」になると、保存stateの現placeに合う利用記録がある。`data-place-topology` は形態stageなのでgrownのままが正常。比較の可視パネルでは、移動前後の現place revision、最新useのrevision/targetId/actorId、履歴の組を対照する。同じ配置に戻した場合は古い有効な利用も再表示できるため、表示だけを新規利用と数えない。

## 地形と所有物

`terrainOwnerSupported()` は中心だけでなく半径.46の25点を検査し、元地形に対する追加の傾きが.13を超えるか、水に落ちると拒否する。花もベンチも同じ対象。現所有物の支持が壊れる地形commandは保存されず、履歴も進まない。移動先も `claim()` で実床・支持・占有を検査する。

全所有物への到達は移動の必須条件ではない。花/ベンチは支持された孤立地へ合法的に置けても、場所の入口条件や `visitPlace()` の実経路が成立せず利用できないことがある。これは「配置成功＝利用成功」としないための重要な反例。今回の二配置は現在の通常modulesとA/B診断で到達したが、任意の高台への配置・利用は未証明。

地形Undo/Redoも最新の所有物と人物足場に対して再検査する。後から所有物を移した場合、過去のUndoが拒否されることがある。所有物の移動自体はUndo対象ではない。terrain commandは `placeProgress` を書き換えず、過去の記録を保持する。形態が変わった場合、過去記録は現在利用の証拠から外れ、同じ形態に戻すと再び有効になり得る。

## 高さ8の意味

通常offsetは整数 **-4〜12段**、1段は.18。8は8mではなく編集寄与の基準1.44mであり、上限内。実床の高さは元地形、補間、固定足場への接合重みによる。単純に全域が1.44m上がるとは限らない。12段を超える追加操作はno-opで、履歴を増やさない。

`geometry-check.ts` の高さ8は、初期所有物を除いたstateへ直接入れた明示形状fixture。頂点・hit・支持・固定床の比較用として正当だが、所有物・人物がいる島で8回通常操作できる証拠ではない。`life-check.ts` は所有物を維持して通常commandを使うが、検査する高さは岸の-3だけで、高さ8の肩を歩いて使う検査ではない。

## life-checkの現実性と限界

- 初期花とベンチは実際の `newIsland()` が与えるもので、成熟の手動上書きや資源追加はない。以後の移動・掘削・利用記録・Undo/Redoは通常の `applyIntent()`。
- 歩行は実 `GrowingLife` と実world。開始時teleportなし、歩幅、足元、経路、700ms後のreceiptを検査する。ただしactorは空のThree Groupなので、native実rigの身体干渉・可視pose・画面内描画は対象外。
- 当初の二配置検査は配置ごとにlifeを作り直していた。後述の追試で、同じ実体が利用中に移動されたときのtarget解除、実位置保持、再訪を追加した。
- 追加の同時刻delta=0 tickは到着直後のposeを取得する診断用。使用時計は進めないが、本番のフレーム列そのものではない。
- `applyIntent()` はrepositoryのrevision競合と永続化transactionを通らない。receipt command内のexpectedRevision=0はこの純domain診断では未検査。JSON復元もDB再open・SW・offline・保存失敗・再試行の代用ではない。
- 復元後のlifeは再び実receiptを出すが、同じplace revisionの保存記録は正しく再利用される。これを新たな利用件数として数えない。

## 次の検証計画

1. rootの通常UIで同じ所有物の二配置を作り、移動前後のplace revision差、新配置での到着、利用記録との一致、再読込保持を撮る。A/B切替だけによる既存記録の保持は別記する。
2. 高さ8を比較の主要形状にする場合、同じ所有物を残した通常command列を別に検査し、どの段/足場で拒否したかを保持する。到達可能な利用地点を恣意的に付与しない。
3. 実体を使い続ける連続syncのfocused検査は、監査後の担当指示により追加した。下記の追試結果を参照。
4. repository保存はUI再読込証拠と既存 `terrainPersistence.test.ts` のtransaction検査で分担する。今回のA/B変換版に以前の通常版テストPASSを流用しない。

## 型検査と製品検証の穴

`npm run typecheck` のapp includeは `src`、node includeはroot Vite config等に限定される。今回のdocs配下TS/TSXは直接の対象でなく、esbuild/Viteのbundle成功も型検査ではない。Vite transformで生成したコードは通常のtscから見えない。`geometry-check.ts` の第三引数castも通常APIへの型証明を意図しない。

候補を固定して、比較folder専用の一時tsconfigでTS/TSXと実importを型検査する必要がある。変換後APIは一時sourceへ展開して型を照合するか、明示mode APIの型を検査対象として追加する。通常appのtypecheck/coreはrootが別途担当し、比較buildの成功だけで代替しない。今回の変更は物理床へ接続するため、standalone美術の軽量検証だけで製品採用を宣言できない。採用/配布にはverification matrixのGrowing/保存/PWA境界へ戻る。

## 監査後の追試

担当指示を受け `life-check.ts` に連続sync診断を追加。既存ぽこもこが花へ実到着して300ms過ごした時点で、通常moveにより花とベンチを別配置へ移す。同じlife/actorへsyncし、旧target解除・実足位置不変・旧receiptなしを確認した。新targetへの通常visitは87歩で到達し、その700ms後に新revisionのreceiptが発生する。旧revisionを後からdomainへ渡す反例も拒否された。通常未変換版および固定足場＋A/B/C変換版でPASS。軽量actorとNode診断の境界は変わらない。

`typecheck.mjs` と `tsconfig.trial.json` を追加した。srcをtmpへコピーし、試験Vite configの実transform hookを呼び、物理床・terrain command・worldScene・GrowingIslandを変換してからTypeScript `tsc --noEmit` を実行する。比較TS/TSXと変換済み4入口、その実importをstrict/noUnused条件で検査。2026-10-23のA/B/C対応sourceでPASS、対象入力に検査中変更なし。検査overlayとJSON報告は `/private/tmp/sansu-place-trial-types-48uIlF`、原本srcは不変。これは全repo core・production配布の合格とは別。

## 実UI再読込の利用時刻の見かけの逆転

`evidence/07-B-moved-state.json` と `10-B-reloaded-state.json` を比較したところ、useHistoryは17件すべて完全一致し欠落0。最新slotのtargetが、ぽこもこはbench→garden、v2はgarden→benchへ切り替わった。各slotのatは、そのtargetの履歴内の初回factと完全に一致する。

`recordPlaceUse()` は同じrevision/actor/targetを再利用したとき、既存の初回factをslotへ再代入する。そのため別targetを使うとslotのatは単調増加しない。読み込み時のvalidatorはこの選び直しを行わない。再読込でlifeの観察cacheが初期化され、自然利用が再び既存factを選んだという経路がコードと証拠に合致する。保存欠落の兆候ではなく、履歴の完全保持と現revision一致で判断する。
