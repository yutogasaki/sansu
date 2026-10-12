# 地区の組合せで変わる島 — c7 domain・実画面

同じ native05 の実地形2種を、入口の選択と四半回転で3通りの輪郭へ合成できた。元地区を描き替える方式ではなく、元の床・地点・配置権を保持したまま実地形と接続デッキを追加する。地形構成として確認したのはこの純 domain 診断までで、全島の完成・美術採用ではない。

候補は `native05-district-shapes-rough-v1`。2026-10-12 09:43–09:45 UTC の [3配置診断](layouts/summary.json) は main repository を実行元とした。composer・compiler・地形・参照 state の記録 SHA を、凍結 `/private/tmp/sansu-districts-c7/candidate` と照合して同一入力であることを確認した。実行ディレクトリが同じだったという主張ではない。

その凍結 candidate の c7 core と、3構成のbrowser旅程は終端 PASS。以下はそれぞれの範囲を分けた証拠で、全島美術・通常取得・本人保存の合格ではない。

## c7の実画面と編集

[原本と6実画面の比較](runtime-contact-sheet.html)、[browser report](runtime/report.json.gz)、[実行script](runtime/runtime.mjs)、[保存照合](runtime/archive-proof.json)を保存した。実targetは `http://127.0.0.1:5364/prototypes/place-qa/authored.html?art=whole&districts=1`、buildは `district-assembly-c7`、DEVで `VITE_ISLAND_ENABLED=true` / `VITE_NATIVE_GROWING_ART=true`。地形candidate `native05-district-shapes-rough-v1` と全島candidate `native05-growth-assembly-v1+source-shading-v1` を画面で照合した。

実DOM操作で、低地の予告中は未確定の台帳と編集の停止を確認し、取消で元のworld revisionと所有状態へ戻った。東連結・北連結・二方向とも同じ低地と丘を各1回確定し、元の所有状態を保持した。1440×1000の全景3例と390×844の二方向構成を撮影した。page errorは0、scriptはexit 0。renderer受領履歴だけを所有状態の比較から除外している。住人の実移動・利用は検証していない。

11工程の合計は1,245.7秒。初回表示は74.5秒、各追加の予告・確定を含む工程は113.5〜178.9秒かかり、操作性能は未達。工程時間にはassertやcaptureも含むため、純粋な入力遅延や描画時間と同一視しない。

実画面では、切り出した地形の直線的・ギザギザな断崖と、全島から離れた裸の地形が目立つ。**美術HOLD・独立理解／安全N=0**を維持する。さらに、全地区から最初のportを到着口に選ぶため、追加地区へ桟橋・旗・visitorが移動する不具合を確認した。接続デッキを二つ目の桟橋と誤認しない。後続のmainでは到着口を元地区へ限定する修正と5件のfocused testを通したが、このc7画面は修正前である。

終了時のcandidate 6,588入力はcore固定入力と一致した。browser開始時の独立した全入力fingerprintは未取得で、専用の固定candidateと実画面のrevision/candidate照合を使ったことを記録する。3構成は接続方向による違いであり、次に制作する「同じ木の配置・成熟から育つ岸」の証拠には流用しない。

## 実地形と3つの結果

[原本 whole-island.glb](../2026-10-10-island-final-3d/whole-island.glb) の `Island / continuous sculpted mature terrain` から、次の2素材領域を抽出した。[凍結 manifest](catalog/authored-district-kit-manifest.json) と [配布カタログのコピー](catalog/authored-district-kit.json.gz) に対応する。

| 同じ地形テンプレート | 元 primitive / 素材 | 元上面三角形 | 配置地点 |
| --- | --- | ---: | ---: |
| `native05-harbor-lowland-v1` | 2 / harbor・light seaside meadow | 16,973 | 7 |
| `native05-northern-hill-v1` | 1 / hill・silvery meadow | 30,988 | 26 |

原寸は `world = source × 0.45 + (5.65, -0.3645, -1.03)`。テンプレート化時は manifest の localOrigin を水平成分だけ差し引く。上面の元 indices・NORMAL・素材を保持し、露出した実境界に側面と底を作った。各取得地区の `worldOrigin.y=0` を保ち、入口の高さを合わせるため地区全体を浮かせたり沈めたりしない。

| 配置 | 接続順 | 最終 X 範囲 / Z 範囲 | 到達サイト / 全サイト | 追加配置の到達 |
| --- | --- | --- | ---: | ---: |
| [east-chain](layouts/east-chain.json) | 元島東 → 低地 → 丘 | −0.65…25.93 / −10.93…9.75 | 3,219 / 3,219 | 33 / 33 |
| [north-chain](layouts/north-chain.json) | 元島北 → 低地 → 丘 | −0.65…20.75 / −24.93…2.460312457 | 3,231 / 3,231 | 33 / 33 |
| [two-arms](layouts/two-arms.json) | 元島東 → 丘、元島北 → 低地 | −0.65…20.93 / −18.987291765…9.75 | 3,230 / 3,230 | 33 / 33 |

3配置は同じ2テンプレートを各1回使い、bounds と revision がそれぞれ異なる。実 grant の親入口・turn・logical/world 原点は各 JSON に保存した。元世界の配置地点73に33を加えた計106地点で、接続デッキの地点は歩行専用、追加配置権は0。これは診断 world の配置権数であり、通常購入や GrowingState の土地台帳更新の証拠ではない。

[実行済み proof script](layouts/prove.mjs) は各追加の前後で、既存全サイトの ref・座標・支持・placement と既存全 floor の内容を比較している。初回の元2,063サイト／10床を保持し、2回目には最初に追加した地区も含めて保持した。参照した [shoulder35 state](inputs/authored-shoulder-reference-mature.json) の全 state と owner ledger（9 plots＋26 landmarks、住人8、keepsakes0、nextId）も不変。所有物の移動・成長・描画・実mesh障害物判定を実行した結果ではない。

## コード境界と証拠の範囲

- [composer の凍結コピー](source/authoredDistrictWorld.ts.txt)（[現モジュール](../../../src/domain/growingIsland/authoredDistrictWorld.ts)、概ね120–211行）：入口は幅0.44の実上面・側面を生成する。歩行辺だけを足す方式ではない。端の0.51区間を除く帯と既存床三角形の交差を logical/physical 両方で検査し、端では既存床をサンプルして既存 walking sites/edges を再利用する。復元 grant の距離も1–64に制限する。
- 同コピーの概ね184–253行：対向ポート・四半回転・整列を検査し、以前の grant の変換を固定したまま追加する。[composer tests のコピー](source/authoredDistrictWorld.test.ts.txt) には、過大な偽 grant とサンプル間の小さな無所有床の回帰例を含む。このアーカイブ作業では再実行していない。
- [kit builder の凍結コピー](source/build-authored-district-kit.mjs.txt)（[現 builder](../../../tools/build-authored-district-kit.mjs)、概ね99–202行）：原本素材領域の抽出、境界側面・底、支持地点とポートを作る。[kit tests のコピー](source/authoredDistrictKit.test.ts.txt) と原本の対応は保存したが、ここでは追加検証を実行していない。

到達判定は `HOME_CELL` から compiled world の歩行グラフを辿った結果。実際の木・家・gallery・住人全幅を含む障害物判定、実アプリの移動、renderer の見え方はこの証拠に含まれない。美術は **HOLD**、独立観察 N=0。通常の取得価格・操作・履歴・本人保存への接続も未完了。今回の3例の差は「新しい土地をどの方向につなぐか」の選択であり、同じ所有物の並べ方・成長過程から林、庭、地形や海岸線まで変わる最終目標を達成した証拠ではない。次の優先課題は、その可変構成を通常操作と本体表示へつなぐこと。

低地は原本に境界次数4の pinch を1か所持つ。側面2扇が垂直線で接し、閉包の辺は均衡しているが manifold solid ではない。丘は manifest 上 manifold。両方とも元素材領域の直線的な内部切断を残し、追加側面・底の法線は renderer 計算で、原本 NORMAL の保持対象は上面である。これらを閉じた高品質地形の合格と扱わない。

## c7 core 終端結果

[core report 原バイトの gzip](core/report.json.gz) と [execution.log.txt](core/execution.log.txt) を保存した。`district-assembly-c7`、`npm run verify:core`、PID 30349 は **exit 0 / PASS**。09:43:56.364840–09:51:59.611221 UTC に実行され、6,588入力の前後 SHA が一致（`sourceFixed=true`）。617 test files／5,337 tests が通過し、Vitest の記録時間は431.46秒。これはテストランナーの所要時間であり、製品の性能合格を意味しない。

`verify:core` の docs、current UI entry、lint、typecheck、tests、build が終端まで完了した。[凍結 overlay](core/overlay.json) と [保存・現在ソース照合](core/archive-and-closure.json) により、今回の地区合成、UI入口、world frame/cache、木・gallery配線、配布地形／モデル、関連設定を含む45ファイルで、core開始／終了・凍結 candidate・照合時の main が同じ SHA であることを確認した。現在の全ドキュメントを含む repository 全体との一致を主張するものではない。

core の合格は上記の domain 証拠と合わせても、実mesh歩行・全島美術・通常取得／本人保存の合格を補わない。core report は決定的 gzip（mtime=0）、log と overlay は無変換コピーで、元ファイル前後と展開後の SHA が一致する。新しい検証コマンドは実行していない。

## 保存と同一性

[archive-proof.json](archive-proof.json) は23コピーの元パス・保存先・バイト数・コピー前後と保存先の SHA256 を記録する。全コピーが一致し、対応する当時の live ファイルも凍結 candidate と一致した。[source-provenance.json](source-provenance.json) に原本・入力・新 composer／builder／tests と関連モジュールの SHA をまとめた。原本 GLB は既存 durable ファイルの実 SHA を確認してリンクし、重複保存していない。

| 対象 | SHA256 |
| --- | --- |
| 原本 native05 GLB | `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` |
| 凍結 composer／全3 proof 共通 | `49ddc14789f0b66a1905718ebcb2b4cd74b14fbf91bbe1960090853e5f58d8e6` |
| 凍結 catalog gzip | `5ec00efb522247797fd8f269174901b2fba888cdd64c9c0bcd730db083c3a38f` |
| 原基底 world gzip | `9ff265c4c62477230f3e6dff14903f10c8b4be0953a1fa02bc61abc4f37e4921` |

`layouts/` の9ファイルは既存 proof・集約・実行 script・実際に使った3 bundle の原バイト。raw JSON 内の当時の `/private/tmp/` パスは書き換えていない。`source/` は凍結コードを `.txt` として保存したもので、live 実装を置換しない。今回の作業は読取り・コピー・SHA照合・説明文の保存のみで、domain再実行、core、browser、build、docs検査の二重実行はしていない。
