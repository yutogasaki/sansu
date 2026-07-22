# Snap Root Watering Bloom 安全・価値ループ監査

- Date: 2026-07-21
- Experience plumbing: `snap-root-v1`
- Historical visual candidate: `ready → pour → splash → bloomed`
- Runtime state: **SUPERSEDED / ARCHIVED OUTSIDE `public/`**
- Release state: **HOLD / NOT ADOPTED**
- Production default: `classic-v1`
- Supersedes: [旧Snap Root突破ループ監査](../2026-07-21-snap-root-breakthrough-loop/README.md)

> 2026-07-21追記: この水やり候補は [dig-pop-painted-v2](../2026-07-21-dig-pop-painted-v2/README.md) に置き換えた。以下は判断履歴であり、現行runtime契約ではない。旧SVGは `./superseded-watering-runtime-assets/` へ退避し、`public/`、DOM、PWA precacheから除外した。

## 結論

ユーザー実機画像で見つかった編み根版の身体破綻を最優先証拠とし、旧87〜88点を失効して **50 / 100、first-six 31 / 60、REJECT** へ訂正した。その後の一本葉Bloom版は、全身の安全性を回復したが、黄色い相棒が赤い根生物の頭の葉・髪を引くように見え、独立した花が理由なく開く。独立画像監査 **75 / 100、first-six 44〜45 / 60、HOLD** のため採用しない。

当時の最終候補は同じplanner、writer、receipt、TenKey、高速先読みを維持し、視覚因果だけを「大きな青いじょうろから同じ花へ水をやる」に作り直した。正解ごとに `ready → pour → splash → bloomed` と進み、水が同じつぼみへ届き、開きが増え、幅広い花弁が靴底を持ち上げ、最後は全身の相棒が開いた花へ横座りする。根生物の葉冠へ誰も触れない。最終独立監査は **84〜86 / 100、first-six 52〜53 / 60**。安全と瞬間体験は通過したが、リプレイ軸が5〜7、silent実ユーザー5人テストが未実施のまま撤回した。

## 撤回履歴

| 候補 | 点 | 判定 | 撤回理由 |
|---|---:|---|---|
| 旧編み根 `landed` | 50 / 100 | REJECT | 首・胸を横切る編み輪、切断した手足、浮遊頭部、舌・腸・蛇に見える一本葉 |
| 一本葉 `tug / tumble / bloomed` | 75 / 100 | HOLD | 赤い子の髪を引く読み、花との物理接続不足、最終オチの回収不足 |
| 水やり `pour / splash / bloomed` | 84〜86 / 100 | HOLD | 安全・因果・身体ギャグはPASS。Replay 5〜7とsilent 5人テストが未達 |

旧編み根assetは `../2026-07-21-snap-root-breakthrough-loop/legacy-runtime-assets/`、一本葉Bloom assetは `./rejected-leaf-pull-assets/`、舌・槍へ見えた細長い接点案は `./rejected-contact-petal/` へ監査資料として退避し、`public/` とPWA precacheから外した。

## 最終独立採点

| 軸 | 価値監査 | 厳格監査 | 最終根拠 |
|---|---:|---:|---|
| 1秒理解 | 9 | 9 | じょうろ、閉じた花、注水対象が即読める |
| 回答・入力テンポ | 8 | 10 | TenKey固定、追加0タップ、実測は契約内 |
| 入力→世界反応 | 10 | 9 | 同じ花が閉花→注水→半開花→満開へ連続 |
| 身体ギャグ | 9 | 8 | 幅広花弁の上辺と靴底が接し、22度の全身傾斜から横座りへ進む |
| ポップ魅力 | 8 | 8 | 黄・青・桃の大色面と巨大開花。汎用教材SVG感は一部残る |
| 次beat欲求 | 9 | 8 | 水量とつぼみの開きが段階的に増える |
| リプレイ性 | 7 | 5 | canonical一種だけで、意味ある再訪差分は未実装 |
| 拡張性 | 8 | 9 | actor、watering、flower、subjectを独立SVGで拡張可能 |
| 子どもの安全 | 10 | 9 | 拘束・切断・圧壊・舌・槍・刺突の読みを最終版で排除 |
| 学習との一体性 | 8 | 9 | 実問題、planner、writer、receiptを維持 |
| **合計** | **86** | **84** | **first-six 53 / 52。安全PASS、release HOLD** |

厳格監査の最終84点は、接点修正前83点から身体ギャグを7→8へ更新した値である。点の高い側だけを採用せず、84〜86の幅を現証拠とする。

## 水やりBloomの4状態契約

| Commit済み正解 | Stage | 無文字で読ませる身体・物理事実 | 入力契約 |
|---:|---|---|---|
| 0 | `ready` | 全身の相棒が大きな青いじょうろを持つ。全身の根生物と閉じた花を同じcameraで予告する | TenKeyを即操作可能 |
| 1 | `pour` | 同じじょうろが傾き、青い水が同じ閉じた花へ届く | 途中toastなし、追加0タップ |
| 2 | `splash` | 水滴が増え、同じつぼみが半分開く。幅広い花弁の丸い上辺が靴底へ接し、相棒の全身が安全に傾く | 途中toastなし、追加0タップ |
| 3 | `bloomed` | 同じ花が大きく開き、全身の相棒が花弁へ横座りする。全身の根生物が横で手を振る | 説明modal / CTAなし |

- `ready` の時点でじょうろ、閉じた花、根生物を見せ、原因と結果を後付けしない。
- 水はじょうろの散水口から同じ花へ連続して届き、正答値や演算を個数で漏らさない。
- 根生物の葉冠は身体に接続した平たい葉として保ち、相棒が引っ張らない。
- `bloomed` は相棒の顔、胴、両腕、両脚、花弁への接地を同時に見せる。
- payoff variantは作らない。一つのcanonical姿勢で因果と身体完全性を先に証明する。

## 非交渉の安全・理解ゲート

1. コピーを隠した1秒提示で、じょうろ、水、同じつぼみ、開花の順が読める。
2. 64px黒シルエットで、相棒と根生物の頭・胴・両腕・両脚がそれぞれ一つの身体として連続する。
3. じょうろ、水、花弁、前景、UIが相棒の首・顔・胸を横切らない。
4. `bloomed` の相棒は腰・尻の横座りと両脚の位置が読め、押し潰し、拘束、切断、気絶へ見えない。
5. 根生物は全身と接地を持ち、浮遊頭部や引っ張られる髪へ見えない。
6. 390×844、768×1024、通常motion、reduced motionの全状態で同じ因果と身体安全条件を通す。
7. silent / textless 5人中4人以上が「じょうろで花へ水をやり、花が開き、相棒が安全に座った」と説明する。
8. 「髪を引く、痛い、締め付け、捕まった、食べられた、ちぎれた、気絶した」の解釈が1件でも出たpayoffは不採用とする。

## テンポ・学習契約

- stageはcommit済み正解数 `0 / 1 / 2 / 3` だけから決める。
- 問題値、演算、`Problem.categoryId`、planner assignment、`affectsSrs`、receiptをvisual都合で変更しない。
- 1・2問目は追加0タップ、正解submitから次問入力可能までローカルP95 650ms以内。
- 誤答はstageを進めず、同じ問題へP95 550ms以内で戻す。
- 先読みtimeoutでは正解後に通常plannerへ戻り、誤答後はabortして同じ問題を操作可能にする。期限後のlate swapを拒否する。
- opening途中発見toast、3問目の説明modal、説明CTAを追加しない。
- sceneの個数、長さ、目盛り、順序、scale、水滴数によるanswer leakを作らない。

最新の実E2E単発測定は正解 **117 / 127ms**、誤答 **443 / 539ms** で契約内だった。水やり版10独立runの正解20件P95は **121ms**、誤答20件P95は **445ms**。これらはテンポ証拠であり、visualの価値や安全性の合格証拠には使わない。

## Historical renderer / PWA境界

当時のruntime assetは次だった。現在はすべて `./superseded-watering-runtime-assets/` にあり、precacheしない。

- `actor-water-sheet.svg`
- `root-whole.svg`
- `flower-closed.svg`
- `flower-watered.svg`
- `flower-opening.svg`
- `flower-open.svg`
- `watering-ready.svg`
- `watering-pour.svg`
- `watering-splash.svg`

上記水やりasset、旧 `actor-sheet.png`、`prop-sheet.png`、`leaf-ready / tug / snap / landed.svg`、一本葉Bloomの `actor-bloom-sheet.svg`、`leaf-bloom-*.svg`、`flower-tug.svg` はruntime import、DOM、`public/`、precacheへ戻さない。

## Runtime証拠

- [390px ready](../../breakout-loop-2026-07-21/runtime-watering-audit/390-ready.png)
- [390px pour](../../breakout-loop-2026-07-21/runtime-watering-audit/390-pour.png)
- [390px splash](../../breakout-loop-2026-07-21/runtime-watering-audit/390-splash.png)
- [390px bloomed](../../breakout-loop-2026-07-21/runtime-watering-audit/390-bloomed.png)
- [768px ready](../../breakout-loop-2026-07-21/runtime-watering-audit/768-ready.png)
- [768px pour](../../breakout-loop-2026-07-21/runtime-watering-audit/768-pour.png)
- [768px splash](../../breakout-loop-2026-07-21/runtime-watering-audit/768-splash.png)
- [768px bloomed](../../breakout-loop-2026-07-21/runtime-watering-audit/768-bloomed.png)

自動検証はstage、TenKey、actor / subject / flower / watering属性、旧asset DOM不在、390 / 768 viewport fit、reduced motion、storage seam、rapid submit、正解・誤答raceを検査する。`verify:core` はdocs / lint / typecheck / **672 tests** / build / assetsをPASSし、全22 E2E scenarioもPASSした。独立画像安全監査はPASSしたが、意味ある再訪差分とsilent 5人中4人テストが終わるまで、production default、固有名、図鑑、探検基地の顔へ昇格しない。
