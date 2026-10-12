# Stage4 全形と全景 — source-only HOLD

2026-10-12。元の通常buildの49役割時点の失敗、HOLD診断 v1〜v4、最終全形と全景1枚を保存した。**美術はHOLD。strict world geometry・全役割roundtrip・認証された接合・runtimeも未合格**。プロセスexit0は限定診断の保存終了を表し、制作候補の採用を表さない。子ども独立観察 N=0。

背景は **固定c1 shoulder35のowner-only static context**（9 plots＋26 landmarks、l33/l34/l35を含む）。frame `authored-world:66d51261fb72ffdf`。P02 v5は含まず、最新本体の証拠ではない。原入力の [extraction manifest](../extraction-attempt02/manifest.json) と [study](../study.json) が根拠。住人のlife rig・animationは無い。

## 最終出力

- [全景 PNG](v4/whole-view-v1/attempt-view-01/HOLD-source-whole.png) — SHA `6b3b71e990366dfdb76fddc3a74e81f470c99a651eaa834c1b421aff4c0eee05`。
- [128役割＋6主枝の編集可能Blender](v4/attempt-hold-01/HOLD-diagnostic-assembly-after-joints.blend) — SHA `bcaa5329e2db91398adbf1a56a66ebe2bd9df278d5bc3fafee0b870b356b1d66`。
- [接合前128役割のBlender](v4/attempt-hold-01/complete128-HOLD.blend) — SHA `d38a2c8dcb0b0b88889675b4427d0384713c17019b2f943fbec478a114f939ce`。上の6主枝ありsceneと区別する。
- [shape manifest](v4/attempt-hold-01/shape-manifest.json)、[責任範囲の照合](v4/attempt-hold-01/HOLD-diagnostic-assembly-after-joints-scope-classification.json)、[terminal summary](v4/terminal-summary.json)、[render manifest](v4/whole-view-v1/attempt-view-01/render-manifest.json)。

## 失敗の順序と分類

| 段階 | 保存した事実 | 最初の停止／終了 |
| --- | --- | --- |
| [通常full build](ordinary-full-build/attempt-full-01/first-failure.json) | 49/101変更役割まで。元442・材・owner不変。partial scene保存 | node2269のdeformed-source-oracleでworld差 `1.1455812246e-6`、元 `1e-6` guardに停止。exit1 |
| [HOLD v1](v1/terminal-summary.json) | 69変更役割、candidateのtranslation-only hold 3件 | node2289 baselineも親Float32再合成で差が出たが、当時のcandidate限定条件外。exit1 |
| [HOLD v2](v2/terminal-summary.json) | baseline/source-oracle/candidateへ同条件を適用。70変更役割、hold 5件 | node2290 baselineのlinear成分も変化し、translation-only条件外。exit1 |
| [HOLD v3](v3/terminal-summary.json) | 128役割の接合前scene保存、13 holds。後段31測定・6主枝生成 | 元128とderived6を一緒に数えたscope assertionで停止。**6主枝状態は未保存**。exit1 |
| [HOLD v4](v4/terminal-summary.json) | 元128をidentity、derivedをCREATEDのexact6、固定314を別照合。接合前・後の両scene保存 | 未知／不足役割0。診断build exit0、全景1枚exit0。採用フラグはfalseのまま |

v3の `pre-joint-whole-view-v1` は未封印・未実行の準備案として保持した。完成renderではない。v1〜v3や通常builderを後から修正しておらず、各段の分類変更は別candidateである。

v3/v4の継続条件は、有限値、評価前world差 `<=1e-6`、local/basis/parent不変、評価後matrixが同じFloat32親合成とexact一致すること。linear不変を診断継続条件から外した点を明示し、translation-only 9件とlinear-recomposition 4件を分けた。ラベル別はcandidate3、baseline5、source-oracle5。最大world差 `1.145581224567568e-6`、最大linear成分差 `1.043081283569336e-7`。閾値を広げた通常builderではない。

## 品質境界と実行記録

v4は101の変更表現と27固定役割を構成したが、`all101DeformationsComplete=false`、`strictWorldGeometryGate=false`、`roundtripAll128Passed=false`、`terminalSuccess=false`。GLB roundtripは **NOT RUN**。変更101のNORMALはraw accessor由来、固定27はBlender import baselineの不変を比較する。全128をraw NORMAL照合済みとは呼ばない。70 laminaの派生表現は元152面から寄与ゼロのexact-zero 4面を明示除外した148局所非ゼロ面を保持する。元原本bytesは不変で、元topology完全保持という意味ではない。world Float32へ平坦化すると微小4面が潰れる限界も残る。

全有限値・raw由来NORMAL `.002`・局所非ゼロ面・owner・材・固定442はhard stopのまま。元128＋derived6＋固定314＝active mesh448。31接合測定は継承した7decimal weldとFloat32 BVH nearestによる近似で、厳密な全断面接触、70 leaf接合、全actor幅の合格ではない。固定27のraw→import差は本体採用前の別課題。

| 実行 | UTC | 所有PID | 経過／sampled peak RSS | 終端 |
| --- | --- | --- | --- | --- |
| v4 build | 07:39:57.040053–07:41:00.704734 | 74004 | 63.664秒／1,091,567,616 B | exit0、group消失、333入力不変 |
| v4 whole | 07:43:26.758475–07:43:40.661898 | 75353 | 13.903秒／2,526,314,496 B | exit0、group消失、344入力不変 |

CPU2・build300秒/render60秒・RSS3GiB上限。rootのcoreとの機能検証の重複を許可して実行したため、性能合格には使わない。全景はstage3と同じwhole camera/material/light、1280×925、Cycles CPU16 samples、AgX。変更は名前で限定した `growing-reachable-paths.visible_shadow=false` のみで、描画後trueへ復帰した。本体ThreeのcastShadow=falseに合わせる互換設定であり、rootの別比較が黒い点列への寄与を確認済み。全artifactの原因を説明するものではない。mesh geometry・NORMAL・matrix・材の描画前後digest一致、sourceの保存や画素修正なし。

## 美術の判断と次の範囲

[承認native05](../../2026-10-10-island-final-3d/whole-island-render.png)、stage3、今回全景を [rootの比較](../stage4-review.html) と作者の表示で並べて確認した。冠量と白樺のまとまりは増えたが、**奥の巨大な帽子＋前の独立した2葉塊**という階層が強い。家・ベンチ庭を包む林内空間と明るい幹下入口には達していない。枝の細部や数値成功でこの不足を埋めない。

次は同じ4幹・owner・材で、低い重なりのアーチ／前後にずれた2層／左右の厚みと中央庭という3つの大きな構成差を準備する。元27役割、owner/pivot/年齢、床、肩3木、最高主景、家扉、他31ownerを保持。既存5 willow lobesと白樺の実3枝＋3冠を連続する弧として組み替え、無所有木や装飾を足さない。まだ追加source制作・Blender実行・runtime接続は行っていない。

## 保存と再現

[archive proof](archive-proof.json) のSHAは `b6ef5742b0c9afe8ef19d4ccdecae2f5c4296326b61717d37dcbeb78534de9df`。2,928ファイル、保存bytes 119,829,259。全source-before/source-after/保存先decoded SHA一致。339の外部入力は同じproof内に絶対元path→durableまたはrepository pathを対応付け、現在の元入力と保存先decoded SHAを照合した。古い192-file tip-recenter archiveと元proofは変更していない。

歴史的Markdown/codeは内容を変えず `.txt`、未圧縮JSONの256KiB超はmtime=0のdeterministic gzipとし、既存 `.gz` は圧縮bytesもそのまま保存した。実行時の絶対pathは歴史として保持しているため、そのままdocsからrunするpackageではない。再現にはproofの対応表に従って元basename/pathを復元する。`__pycache__` と `.pyc` のみ除外。更新前forest READMEも [byte保持](history/forest-README-before-stage4.md.txt)。root review/TASKS、app、原GLB/Blender、固定candidateには変更なし。
