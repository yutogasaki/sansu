# Snap Root 突破ループ監査

- Date: 2026-07-21
- Experience plumbing / delivery flag: `snap-root-v1`
- Historical visual contract: `ready → tug → tumble → landed`
- Status: **SUPERSEDED — SAFETY REJECT**
- Decision: **50 / 100、first-six 31 / 60、REJECT**
- Production default: `classic-v1`
- Local development safety candidate: **なし**（旧編み根版はHOLDではなくREJECT）
- Invalidated score: **87〜88 / 100**（ユーザー実機画像を確認する前の誤判定）

> **この監査の87〜88点とRUNTIME VALUE GOは失効した。** 新しいユーザー実機画像を最優先証拠として見ると、編み根が相棒の首・胴を締め付け、手足が切断されたように見え、根生物は浮遊する頭部、一本葉は舌・腸・蛇に見える。子どもの安全2 / 10、無文字理解と身体完全性を含む再採点は50 / 100である。以下の画像・テンポ・実装記録は失敗から学ぶ履歴として残すが、production / localの安全採用根拠へ使わない。この失敗直後の判断履歴は [Snap Root Bloom安全ループ監査](../2026-07-21-snap-root-bloom-safety-loop/README.md)、現行local validationは [Dig Pop Painted v2 runtime監査](../2026-07-21-dig-pop-painted-v2/README.md) を参照する。

## 結論

Root Pullの全面JPGへ装飾を足す改善は打ち切り、身体actionを `一本葉を引く → 葉が返る → 全身が半回転 → 編み根へ着地` に変更した。相棒、根の対象、葉、編み根、背景を分離したlayered rendererへ置き換え、実TenKeyと高速問題ループへ接続した。

当時は身体ギャグ、色面のポップさ、rendererの拡張性、submit後の操作復帰がRoot Pullより改善したと判断し、87 / 88、first-six 54 / 60としていた。しかし実機payoffでは身体の連続性と子どもの感情安全性が破綻しており、この判断は撤回する。10独立runの正解P95 125ms、誤答P95 443msはplumbingのテンポ証拠としてだけ有効で、旧visualの価値Goには使えない。

## 候補比較

| Candidate | 予測点 | 瞬間体験 | 64px無文字判定 | 結果 |
|---|---:|---:|---|---|
| Snap Root | 85 ±4 | 52 / 60 | 全身半回転と着地点が分離 | runtime検証へ採用 |
| Puff Plant | 82 | 49 / 60 | 花弁と相棒が結合 | 却下 |
| Loop Runner | 80 | 47 / 60 | 輪と脚が結合 | 却下 |

予測点はkeyframe段階の仮説である。当時のruntime独立ゲートは87〜88、数値価値Goとしていたが、冒頭の安全再監査により失効した。現行判断は50 / 100のREJECTである。

候補資料:

- [Snap Root候補監査](../../breakout-loop-2026-07-21/candidate-a-snap-root/README.md)
- [Puff Plant候補監査](../../breakout-loop-2026-07-21/candidate-b-puff-plant/README.md)
- [Loop Runner候補監査](../../breakout-loop-2026-07-21/candidate-c-loop-runner/README.md)

## 実装した体験契約

| 回答状態 | Stage | 世界反応 | 入力契約 |
|---|---|---|---|
| 0問commit | `ready` | 相棒が一本葉をつかみ、根の対象と編み根を予告 | TenKeyを即操作可能 |
| 1問commit | `tug` | かかとが浮く踏ん張り | 途中toastなし、追加0タップ |
| 2問commit | `tumble` | 同じ葉の返りで全身が半回転 | 途中toastなし、追加0タップ |
| 3問commit | `landed` | 編み根へ安全に着地し、対象も無傷で土から出る | 説明modal / CTAなし |

- stageはcommit済み正解数だけから決め、問題値、演算、category、assignment、SRSを変更しない。
- 正解の次gateは保存receiptから純粋投影し、成功姿勢の表示中に予約する。submit起点650msの予算に間に合わない場合はabortして通常plannerへ戻す。
- 誤答の支援予約はsubmit起点550msの予算に間に合わない、またはerrorになった場合はabortし、同じProblemとassignmentを再び操作可能にする。遅延結果で入力面を差し替えない。
- blocking discoveryを越えて次問を先読みしない。openingの1・2問目だけは途中発見toastを抑止し、保存済み発見自体は失わない。

## Rendererとasset境界

全面生成画像をstageごとに交換せず、次のproduction URL候補を同じcameraへ合成する。

| Asset | 役割 | 概算サイズ |
|---|---|---:|
| `actor-sheet.png` | `ready / tug / tumble / landed` の相棒4姿勢 | 332 KiB |
| `prop-sheet.png` | 根の対象、編み根、土小物 | 313 KiB |
| `leaf-ready.svg` | 静止した一本葉 | 4 KiB未満 |
| `leaf-tug.svg` | 張った一本葉 | 4 KiB未満 |
| `leaf-snap.svg` | 返る一本葉 | 4 KiB未満 |
| `leaf-landed.svg` | release後の一本葉 | 4 KiB未満 |

runtimeは `public/assets/explore/opening-snap-root/`、生成sourceは `docs/design/breakout-loop-2026-07-21/production-sources/` に分離する。PWA precacheはPNG / SVGだけを個別globで含め、制作sourceを含めない。`prefers-reduced-motion` では移動補間、跳ね、回転、zoomを止め、同じ4姿勢を静的に差し替える。

## Runtime evidence

390×844:

- [ready](../../breakout-loop-2026-07-21/runtime-audit/390-ready.png)
- [tug](../../breakout-loop-2026-07-21/runtime-audit/390-tug.png)
- [tumble](../../breakout-loop-2026-07-21/runtime-audit/390-tumble.png)
- [landed](../../breakout-loop-2026-07-21/runtime-audit/390-landed.png)
- [landed / nest-tip](../../breakout-loop-2026-07-21/runtime-audit/390-landed-nest-tip.png)

768×1024:

- [ready](../../breakout-loop-2026-07-21/runtime-audit/768-ready.png)
- [tug](../../breakout-loop-2026-07-21/runtime-audit/768-tug.png)
- [tumble](../../breakout-loop-2026-07-21/runtime-audit/768-tumble.png)
- [landed](../../breakout-loop-2026-07-21/runtime-audit/768-landed.png)
- [landed / nest-squash](../../breakout-loop-2026-07-21/runtime-audit/768-landed-nest-squash.png)

## Tempo evidence

実ブラウザでsubmitから「新attempt、保存idle、探索idle、TenKeyの数字1がenabled」までを `performance.now()` で外形観測した。

| Path | 単発観測 | Product contract | 判定 |
|---|---:|---:|---|
| 1回目の誤答 | 444ms | 550ms以下 | 単発PASS |
| 遅延支援を注入した2回目の誤答 | 540ms | 550ms以下 | 単発PASS、same problem維持 |
| 1問目正解→次問 | 111ms | 650ms以下 | 単発PASS |
| 2問目正解→次問 | 125ms | 650ms以下 | 単発PASS |

この4値は一回のE2E runの外形例であり、次の反復統計とは分けて扱う。

10独立runで通常の正解20遷移・誤答20遷移を同じsubmit→operable境界で反復測定した。

| Path | Samples | Range | P95 | Product contract | 判定 |
|---|---:|---:|---:|---:|---|
| 正解→次問 | 20 | 110〜125ms | **125ms** | 650ms以下 | PASS |
| 誤答→同じ問題 | 20 | 430〜444ms | **443ms** | 550ms以下 | PASS |

この反復値はSnap Root cold-openのテンポ証跡である。旧高速学習との同一10問の回答数/分・中断数比較には代用しない。900ms遅延支援のbounded fallbackは別の単発race E2Eで540〜542ms、same problem維持、late swapなしを確認した。

## 自動確認

- 390×844 / 768×1024で4状態がviewport内へ収まる。
- TenKey `1 / 2 / 3` の入力順、submit、clearを維持する。
- reduced motionでactor transitionを除去し、静止stage差を維持する。
- 2回目誤答のplannerを900ms遅延させても550ms内に同じ問題へ戻り、遅延完了後もlate swapしない。
- 3問目の完了後にdialogを出さず、次の道選択へ進む。
- 既存の探索smoke scenarioを含む `npm run e2e:smoke` が通過した。

## 当時のProduction HOLD理由（失効済み）

1. 当時はruntime数値ゲートを87〜88で通過としたが、実機画像による身体安全性の見落としがあり、この前提自体が失効した。
2. 旧高速学習との同一10問の回答数/分・中断数比較は未実施。
3. actor / prop atlasは全面JPGより一貫するが、生成source由来の形をcanonical character sheetとしてまだ固定していない。

次は色や粒子を増やさず、人の無文字理解4-of-5と旧高速学習の同一10問比較を行う。それまではproduction default、固有名、図鑑、量産encounterへ昇格しない。
