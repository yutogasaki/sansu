# Task: Cold-open Value Loop

- Date: 2026-07-21
- Owner: Codex `/root`
- Status: Active
- Review By: 2026-07-28
- Related ADR / Runbooks: `docs/runbooks/pwa-release.md`

## Goal

- Sansuの最初の3問を、説明や固有名に頼らず「解く → 即世界反応 → 同じ規則の拡大 → 3問目の身体オチ」と読める高速cold-openへ作り直す。
- 自動採点、実測、無文字テストで価値を確認し、合格した体験だけをproductionへ昇格する。

## In Scope

- 旧高速学習と現Exploreの同一10問ベースライン計測
- delivery / feature-flag ID `snap-root-v1` のlocal validationへ載せるvisual candidate `dig-pop-painted-v2` の無文字4状態 `ready / dig-one / dig-two / popped` と、REJECT / HOLD済み旧candidateからの比較差分
- locked background、承認済みcharacter / prop reference、state overlayでauthoringし、質感を保つUI文字なしflattened frameをruntimeへ渡す制作契約
- validation flag内のpresentation catalog / renderer境界
- 実問題、TenKey、Study共通planner / writer、保存receiptを通す3問graybox
- 非補償の視覚的磁力、無文字理解・安全、runtime整合の三ゲートと、390×844、reduced motion、sound off、200%文字、answer leak監査
- 最大2回の改善と、Go / action変更の判断

## Out of Scope

- Root Pullのproduction採用、Snap Rootの固有名・永続図鑑登録・探検基地への固定
- 本番actor rig、sprite量産、最終背景、音声量産
- 9〜12問run、複数encounter pack、図鑑永続化、run再開、基地全面改修
- planner / writer / SRS / Due / weak / assignment / receiptの再設計
- 既存 `root-tangle` domain、observation provenance、legacy保存IDの削除や移行

## SSOT References

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/10_exploration_game_spec.md`
- `docs/product/11_learning_integration_spec.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/14_ui_world_motion_spec.md`
- `docs/product/15_mvp_rollout_verification_spec.md`
- `docs/design/audits/2026-07-20-score-benchmark/README.md`

## Docs To Touch

- Must update: 上記product specs、本task、`.agents/tasks/TASKS.md`
- Intentionally unchanged: `docs/product/13_data_storage_migration_spec.md`、Dexie schema、学習skill定義、done log（task完了前）。PWA runbookはSnap Root precache契約へ更新する

## Safety And Truth Invariants

- 問題値、演算、`Problem.categoryId`、planner assignment、`affectsSrs` を演出都合で変更しない。
- 保存成功receipt前にstage、energy、発見、学習状態を進めない。同じattemptを二重記録しない。
- `discovery-page:jabarapon` / `discovery-feature:jabarapon-*` は再読互換のlegacy IDとして維持し、candidate選択や子ども向け名称へ使わない。
- `snap-root-v1`、`root-pull-v1` / `root-pull-v2` と既存 `root-tangle` のencounter ID、receipt、観察、保存状態を共有しない。
- 対象の個数、長さ、目盛り、scaleから正答を推測させない。子どもや対象が痛がる、拘束される、能力を責められる表現を使わない。
- payoffでは相棒と根生物の頭・胴・両腕・両脚を一つの連続した身体として残し、前景を首・顔・胸へ重ねない。浮遊頭部、舌・腸・蛇に見える葉、身体を横切る編み輪を禁止する。
- validation flagを切れば既存の問題生成、入力、保存、run終了を変更せず戻せること。

## Plan

1. P0: マキモドンの承認済み固有仕様を撤回し、cold-open一般契約、価値ゲート、legacy互換、停止taskを正本へ同期する。
2. V1: 旧高速学習と現Exploreを同じ10問で計測し、回答数/分、正答率、正解後P95、誤答後P95、操作中断回数を保存する。
3. V2: Root Pullの4状態を無文字・同一camera・同一身体規則で作り、1秒理解、64px silhouette、安全な接触、answer leakを監査する。
4. V3: `classic-v1 | root-pull-v1 | root-pull-v2 | snap-root-v1` のvalidation flagとpresentation境界を追加し、runごとにasset setを固定する。Bloom案はpayoff variantを持たず、一つのcanonical安全姿勢を先に証明する。planner / writer / receipt / reducerは既存境界を再利用する。
5. V4: 実テンキーで3問を通し、1・2問目650ms、誤答550ms、追加0タップ、3問目の身体オチ、reduced motionを自動・実機で確認する。
6. V5: 10軸を再採点して無文字5人テストを行う。未達軸を1回に一つ直し、2回改善しても未達なら身体actionを変更する。
7. V6: Go候補だけをproduction昇格taskへ渡す。採用前に名称、図鑑、asset、9〜12問runを広げない。
8. V7: 旧編み根版Snap Rootを50 / 100のREJECTとして撤去し、一本葉を引くBloom版も独立監査75 / 100のHOLDとして撤回する。同じplumbing内のactionを `ready → pour → splash → bloomed` へ変更し、青いじょうろから同じ花へ届く水、段階的な開花、全身相棒の横座り、横で手を振る全身の根生物をlayered rendererで実配線する。`classic-v1` production fallback、submit起点の期限、途中toast抑止、blocking discovery境界は維持する。
9. V8: 水やり版をHOLDかつ非採用とし、別visual candidate `dig-pop-painted-v1` を `ready → dig-one → dig-two → popped` で作る。source v1の視覚的磁力50 / 60を受け、locked-background / overlay v2がsource gateを通るまでruntimeへ切り替えない。production defaultは `classic-v1` を維持する。
10. V9: `dig-pop-painted-v1` の50 / 60 HOLDを承認継承せず、locked background、固定character / prop、state overlayで別candidate `dig-pop-painted-v2` を作る。source Gate A通過後、mobile / tablet flattened 4 frameを `snap-root-v1` local validationへ配線する。
11. V10: 実problem panelの390×844 / 768×1024を4状態ずつ再採点する。tablet `dig-two` がanswer shelfで足とスコップ刃を隠して50 / 60となったためaction overlayだけを再配置し、最終53 / 60へ修正する。顔、作用する手・道具先端、接地・露出した足、payoff propのsafe zoneを恒久ルール化する。

## Definition of Done

- 視覚的磁力52 / 60以上かつ6軸すべて8 / 10以上。source通過後も実runtime screenshotで再採点する。
- silent / textlessで5人中4人以上が同じactionとpayoffを説明し、4人以上が続きを望み、危険解釈0件である。
- 1・2問目の正解から次問入力可能までローカルP95 650ms以内、誤答から再入力までP95 550ms以内、追加0タップ。
- answer leak 0件。旧高速学習と同一10問で問題処理量が低下しない。
- 実planner / writer / receipt / reducerで二重保存、SRS差し替え、legacy ID移行を発生させない。
- 390×844、768×1024、200%文字、reduced motion、sound off、keyboard、offlineで同じ原因と結果が成立する。
- 未達の場合も、採点、実測、次に変更する身体actionが記録され、未承認candidateがproductionへ漏れない。
- Relevant docs updated or explicitly declared unchanged。Goした場合だけdone logとproduction昇格taskを作る。

## Verification

- Commands: target Vitest、`npm run docs:check`、`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run e2e:smoke`
- Automated: variant固定、stage進行、誤答維持、forged / duplicate receipt拒否、answer leak fixture、timing instrumentation、reduced-motion状態差
- Manual: 390×844 / 768×1024、silent textless 4-of-5、sound off、200% text、keyboard、offline、3秒テスト
- Evidence: candidateごとの4状態画像、プレイ動画、視覚6軸表、無文字回答原文、P50 / P95 timing、旧高速学習との差分。sourceとruntimeの点数を分ける

## Progress

### Now

- 水やり版は身体安全と因果を改善したが、承認済み絵本調referenceより材質、奥行き、キャラクター性、出来事性が弱いためHOLDかつ非採用とする。旧混合採点84〜86や全自動テストPASSをvisual承認へ流用しない。
- delivery / feature-flag ID `snap-root-v1` と現行visual candidate ID `dig-pop-painted-v2` を分ける。旧 `dig-pop-painted-v1` は視覚的磁力50 / 60のHOLD履歴で、背景・相棒・根生物・スコップのstate driftと弱い `dig-one → dig-two` を理由に現行runtimeから外した。v2はlocked background / overlayで別candidateとして0から採点した。
- `dig-pop-painted-v2` はmobile / tabletのflattened 4 frameを実problem panelへ配線済み。runtime Gate Aは390×844が **52 / 53 / 52 / 53**、768×1024が **52 / 53 / 53 / 53** で全軸8以上。最初のtablet `dig-two` 50 / 60 HOLDをanswer-shelf safe-zone違反として止め、背景を変えず作用overlayを上へ移動して53 / 60へ直した。
- 正解20件P95 **124ms**、誤答20件P95 **440ms**、追加0タップ、answer leak 0、完全TenKey、asset / PWA / required regressionはruntime技術サブゲートを通過した。旧高速学習との同一10問throughput比較は未実施のためGate C全体はHOLDとする。
- 証跡は `docs/design/audits/2026-07-21-dig-pop-painted-v2/README.md` と `docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/` に保存する。production defaultは `classic-v1` のままである。
- 旧編み根版 `snap-root-v1` の87〜88点は、新しいユーザー実機画像を最優先にした再監査で失効した。相棒が編み輪に締め付けられた身体、根生物が浮遊する切断頭部、一本葉が舌・腸・蛇へ見えるため、子どもの安全2 / 10、first-six 31 / 60、総合 **50 / 100** のREJECTとする。productionとlocal developmentのどちらでも安全候補とは呼ばない。
- 一本葉を引く `ready → tug → tumble → bloomed` は安全性を改善したが、「赤い子の髪を引く」「独立した花が理由なく開く」と読めるため、独立監査75 / 100、first-six 44〜45 / 60のHOLDとして撤回した。同じ `snap-root-v1` plumbing内へ `ready → pour → splash → bloomed` を実装し、誰の身体も引かず、大きな青いじょうろから同じ花へ届く水で因果を一本化した。最終独立監査は84〜86 / 100、first-six 52〜53 / 60。安全と身体ギャグはPASS、Replay 5〜7とsilent 5人テスト未実施のためreleaseはHOLDとする。
- 旧版で実TenKey、途中toast 0、説明modal / CTA 0、reduced motionの4状態差を実装したplumbingは再利用する。ただし旧landed assetと旧variantは再利用しない。
- 正解後は保存receiptから次gateを投影してfeedback中に予約し、submit起点650msに間に合わない場合はabortして通常plannerへ戻す。誤答後の支援予約はsubmit起点550msに間に合わない、またはerrorならabortして同じ問題へ戻し、遅延結果によるlate swapを拒否する。blocking discoveryは越えない。
- 水やり版の10独立runで正解20件・誤答20件を反復測定し、submit→operable P95は正解121ms、誤答445msだった。この値はplumbingのテンポ証拠として有効だが、visualの価値や安全性の代替にはしない。旧証跡はsupersededとして `docs/design/audits/2026-07-21-snap-root-breakthrough-loop/README.md` に残し、新契約は `docs/design/audits/2026-07-21-snap-root-bloom-safety-loop/README.md` に記録する。
- 水やり版は `verify:core` のdocs / lint / typecheck / 672 tests / build / assetsと全22 E2E scenarioをPASSした。旧編み根・旧landed・引っ張る一本葉・細長く舌や槍へ見えた接点案は監査資料へ退避し、runtime、`public/`、precacheから外した。
- 独立再採点でv1の自己評価87を撤回し、**75 / 100（±4）、HOLD** とした。弱点は身体ギャグ7、ポップ7、次beat7、リプレイ6、テンポ7、拡張性7である。
- v1をrollback用に残し、`root-pull-v2` をlocal developmentの比較候補として追加した。v2は1問目の葉先visor、2問目の「足がぴーん」、run identityから決まり同一UI sessionの直前variantを除外する土帽子 / 葉っぱ帽子の2payoff、3問目後のinline完了を持つ。production fallbackは `classic-v1` のままである。
- 誤答feedbackをローカル判定直後に出し、stage / energy / attempt / SRSはreceiptまで進めないまま、再入力待ちをsubmit起点420msの総予算へ変更した。2回目以降の誤答はreceipt確定後のstateから支援assignmentをfeedback中に予約し、既存guardを通して適用する。保存・先読み失敗時はそれぞれ同じfrozen attemptの再試行、通常plannerへ戻る。
- 390×844の実問題・実TenKeyでv2を3問通した。数字 `1 / 2 / 3` を含むTenKey維持、1問目の葉先visor、葉っぱ帽子payoff、payoff後のdialog 0 / 説明CTA 0、次の道選択まで確認した。誤答復帰のブラウザ外形観測は単発474msで550ms内だが、P95ではない。
- `verify:core` はdocs / lint / typecheck / 656 tests / buildを通過した。v2 runtime JPGを視覚差が出ない品質60で再圧縮し、PWA precacheは10.89 / 12.00 MiB、Explore画像は6.63 / 8.00 MiB。E2Eで即時誤答feedbackより先にenergy更新を読む旧期待を検出し、receipt後のenergyを待つよう契約を修正した。さらにv2専用の390×844 / reduced motion / TenKey / 3 beat / inline payoff scenarioと、合成問題の見えているfilled / empty枠を数えるsolver契約を追加し、ランダム出題を含む全19 scenarioを通過した。既存planner / writer / SRS / receipt / pure reducer / root-tangle domain / legacy保存IDは変更していない。
- 同じ10軸でv2を **77 / 100（±3）** と再採点した。身体ギャグ8、次beat8へ上がった一方、テンポ7、ポップ7、リプレイ7、拡張性6でHOLD。payoff anti-repeat、誤答中の支援assignment先読み、v2専用E2E、count-slot solverまで反映した独立再採点でも77、最初の6軸46 / 60のままとした。証跡は `docs/design/audits/2026-07-21-root-pull-v2-loop/README.md` に保存した。

### Next

- runtime候補を意図未共有の5人へ無文字で見せ、主動詞・payoff一致4/5、続行希望4/5、危険解釈0件を回答原文で確認する。
- 旧高速学習と同一固定10問を比較し、回答数/分、正答率、正解後待ち、誤答後復帰、操作中断回数が低下しないことを記録する。
- production昇格前に200% text、sound off、offline、critical-path contact sheetとcold-cache / PWA updateを最終確認する。
- 三ゲートをすべて通るまで `classic-v1` production default、固有名、永続図鑑、量産encounterを変更しない。

### Decision Notes

- visualの魅力、安全、runtime品質は別々の非補償ゲートとする。旧100点満点の混合採点は履歴・診断にだけ残し、強い技術点で弱い絵を合格させない。制作はlayered / locked、配信は質感を守るflattened frameを許可する。
- Root Pull v2は75点の不足軸を検証した比較案で、最終77点のHOLDだった。全面JPGの形状・材質漂流と弱い2問目を装飾で直さず、Snap Rootの身体actionとlayered rendererへ切り替えた。
- 旧編み根版 `snap-root-v1` のruntime数値価値Goは失効した。自動採点とテンポだけで身体安全性を代替しない。一本葉Bloom版も75 / 100のHOLDとして退ける。水やりBloomは旧visualと同じexperience IDとplumbingを再利用するが、別候補として0から採点し、無文字4-of-5が終わるまでproduction default、固有名・永続図鑑・量産assetへの不可逆な拡張へ進めない。
- 土クッション候補は「受け止めた土盛り」の輪郭が読めず却下した。土帽子runtimeは比較用に残すが、異なる身体方向のオチができるまでリプレイ8とはしない。
- 最初のroute選択後に共通入口gateとしてRoot Pullが出る。production化する前に、route選択前へ置くかroot-labelled routeへ結び付けるかを決める。
- 比較ボードは静止案だけで結論を出す道具ではなく、4状態、プレイ動画、実測値、採点理由を同じ条件で比べる道具にする。
- root観察visual polishは本taskのGo後まで停止するが、完了済みpure domainとreceipt provenanceは再利用する。

### Risks

- Root Pullが引き抜きや強制に見えると安全軸を落とす。対象側の同意・自発的な踏ん張り・無傷のreleaseを無文字で読ませる必要がある。
- 世界反応を大きくすると問題UIを隠しやすく、問題を見せ続けると身体オチが弱くなりやすい。1・2問目と3問目でstage占有率を分けて検証する。
- 静止画のポップさだけで採用すると650msと問題処理量を落とす。production判断は実配線後に行う。
- 明るい色、効果音、コピーで身体損傷に見えるsilhouetteを安全にできない。payoffの首・顔・胸を前景で横切らせず、相棒と対象の全身、接地、回復を無文字静止画で先に証明する。
