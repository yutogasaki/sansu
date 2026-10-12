# 花庭の枝先・席の縁：検証記録

## Summary

Result: **PARTIAL**。M1の花庭の局所変更を扱う。全島の美術、独立理解／安全、本人保存・offline／更新・性能・実機・公開の合格ではない。

## 固定した対象

- revision: `authored-flower-edge-c6`
- visual candidate: `native05-authored-flower-garden-v3`
- actual DEV target: `http://127.0.0.1:5353/prototypes/place-qa/authored.html?water=wide&reference=preflight32`
- server: `VITE_ISLAND_ENABLED=true`、`VITE_NATIVE_GROWING_ART=false`。このDEV明示画面はnativeを有効にし、実rootの`nativeGrowingArt=true`とcandidateを確認する。通常productionの既定falseは維持。
- source: 別作業の内部ポータル変更が検証中に混ざらないよう、watch対象外の固定copyでcoreとbrowserを実行。coreの1,987入力は[完全なsource archive](core-c6/inputs.tar.gz)と[SHA](core-c6/archive.json)に保存。
- 同じ32所有物・8軒・73取得権の保存済み合成young/mature入力。新取得、本人保存、自然時間の成熟、32軒拡張の検証ではない。

## Commands

| 対象 | 結果 | 証拠と範囲 |
| --- | --- | --- |
| `npm run verify:core` | PASS | [core report](core-c6/report.json)、[log](core-c6/execution.log.txt)。601 files／5,232 tests、lint／typecheck／build／asset budget。開始終了の1,987入力一致 |
| 花庭の実座席・通行・利用focused | PASS | [3 files／25 tests](focused-c6.log.txt)。実座面上の葉、移動予告と確定、収納／復元、実rigの歩行／座位／退出を対象とする |
| 枝先と株上端の原本接合focused | PASS | core内8 tests。剛体変換・元の長さ・源頂点、4方向の座面投影、届かない／高い／若い／未接続の除外 |
| `node tools/e2e-authored-flower.mjs` | PASS | [12画面・4canvas選択・4編集](runtime-c6/report.json)。実株タップ、予告取消／分離／収納／再接続、回転、390／768幅、若い／成熟の同じ合成入力。[1,888入力の開始終了とcore部分集合一致](runtime-c6-proof.json) |
| 元27所有物の全島編集／水庭・通常Growing・classic | PASS | [4回帰のsource照合](regressions-c6-proof.json)。元編集6項目／7画面、水庭6項目／14画面、通常Growing8旅程／22画面・40回答、classic32。全段階でcoreの1,987入力が開始終了一致 |
| `npm run docs:check`／`git diff --check` | PASS | 固定c6の結果・共有キュー・完了履歴を同期後に実施。既存activeタスクのReview By超過はWARNのまま残す |

通常native=false buildは[配布境界](core-c6/build-boundary.json)を確認。precacheは145 files／8.33 MiB（上限12 MiB）、原本全島・native kit・authored worldの配布ファイルは含まない。このbuild検査を新世界の実SW更新の証拠にはしない。

## 先行候補と失敗の保存

c5は候補v2の2画面だけの粗形診断とcore（601 files／5,230 tests）。枝先の方向と株上端の露出をc6で変更したため、[c5-shape](c5-shape/report.json)と[c5-core](c5-core/report.json)を現候補の最終PASSへ流用しない。c6にも短縮したshape診断があり、全browser旅程とは別の証拠である。

前作c4の未収蔵だった12画面と4回帰は元の[花庭資料](../2026-10-11-authored-flower-garden/c4-recovered-inspection.json)へ回収した。水庭の外側の集計FAILは文字列stepを辞書として扱ったエラーであり、元FAILと個別PASSの両方を保持した。過去sourceによる結果で、c6の合格に代用しない。

## 未達

美術は最新実画面を[別評価](art-review.md)し、庭に包まれる構図と全島の完成を技術PASSから推定しない。独立観察N=0。headless software描画の待ち時間は実機のP95／FPS合格にならず、操作性能も未達である。

花庭の固定c6は対象runtime PASS、美術36/60 HOLD、独立理解／安全NOT_EVALUATED。既存回帰の収蔵時にrootの全1,987対象入力も固定版と一致した。以降のP04本体接続は別候補とし、このc6のPASSを新しい殻・共有床の検査に流用しない。

学習／TenKey／保存処理は変更していない。通常Growingとclassicの回帰は通過したが、今回の変更で新しいfixed-tenの全製品性能合格や本人保存の新世界移行、offline／two-build更新を認定しない。三配置、成長と編集の全系列、旧地区を保持した16／32軒以上の拡張、配布までの包括ゴールは継続する。
