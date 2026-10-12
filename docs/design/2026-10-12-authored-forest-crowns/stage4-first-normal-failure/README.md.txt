# Stage4 — 原枝で支える重なった冠

**未実行の source 粗形準備。app 接続・接合合格・actor 合格・美術採用ではない。** stage3 と旧失敗は変更していない。root の別 source window で build、その結果を見た別許可で全景1枚を描く。初回結果は常に `HOLD-source-coarse-shape` とする。小さな倍率違いの再試作ではなく、白樺の実枝の中腹を曲げ・太らせる構造へ変更する。

## 固定範囲と入力

`../extraction-attempt02` の固定 c1 owner context と role-separated-originals を使う。Node world 再抽出なし。原128 role中、元固定23＋spire冠4＝27 role、owner matrix/pivot/成長/セル、他31owner、床、肩3木、最高主景を固定する。元幹・根・樹皮を動かさず、元枝・冠・葉を別モデルへ置換しない。元材質名/値/slot、役割キーを保持し、旧冠を二重描画しない。

最終の配布境界を検討する場合も、**各ownerの固定role＋変更roleを含む全tree bundle** が単位。原128 roleを source index付きで出力する。材質名を変えて旧冠の除去を図る方式は採らない。まだruntime adapterは作らない。

入力SHA、owner record、source→authored matrix は [proposal.json](proposal.json)。コピーした元query/helperのSHAは [helper-provenance.json](helper-provenance.json)。全座標は authored glTF Y-up metres。Blender 内だけ `B=(x,-z,y)` を一度適用する。

## 冠と枝の具体制御

柳l14はstage3の24°旋回・移動を取りやめ、stage2と**同一の89部品共通場**へ戻す。幹先coreは中心 `(2.468,3.174249989,-4)`、半径.07m＋.30m遷移。5つの原葉塊、14茎と70葉を同じ場で変形する。stage2で得られた奥の厚みと手前に垂れる縁を保持し、白樺中層をその下へ重ねる。これは元sourceの未接合を直した証拠ではない。

白樺は下記の原3枝＋原3冠を各組で同一変形する。原枝の頂点とindexを保持したまま、根元帯から先端へC2の中心線変位を与える。中腹に追加曲がりと太さを付け、先端は原冠の内部へ戻す。冠を単独で遠くへ移し、後から棒でつなぐ設計にはしない。

| owner / branch | 冠中心・枝先の目標 `(x,y,z)` | 中腹の追加曲がり `(x,y,z)` | 先端以降の横幅倍率 |
|---|---|---|---|
| l15 / 0 | (2.70,2.70,-3.64) | (-.15,.07,-.12) | 1.42 |
| l15 / 1 | (1.78,2.50,-3.63) | (.08,.04,-.12) | 1.30 |
| l15 / 2 | (2.22,2.48,-2.95) | (-.06,.07,-.10) | 1.35 |
| l29 / 0 | (3.99,2.19,-3.37) | (.05,.07,-.10) | 1.30 |
| l29 / 1 | (3.15,2.39,-3.57) | (-.20,.09,-.16) | 1.48 |
| l29 / 2 | (3.72,2.14,-2.87) | (-.07,.06,-.10) | 1.28 |

全枝共通の中腹幅追加は最大.50。倍率は原断面に対する値で、元テーパー・曲がり・葉面の残差を保持する。根元の固定高さ帯は l15=`rootY+.08775`、l29=`rootY+.0675`。原枝の同帯のlocal頂点をそのまま保持する。固定27 role全体はnormalを含むdigest完全一致。枝のガイドは原生成recipeのroot/middle/tipを参照するが、Blender AUTO handleを再現した実中心線とは呼ばない。

中庭中心 `(3.3,-2.65)`、bench l30 `(4,-2)` は動かさない。正面入口の中心線 `(3.2,-1.65)→(3.25,-2.7)` 幅1.05m、側入口 `(3.45,-2.85)→(4.6,-3.45)` 幅.75m、床上1.2mの抜けは**構図目標**。広く冠を切断するのではなく、その下へ明るい空間を置く。道・足場・actor clearance を追加/合格にした値ではない。

## 派生枝の制約

最大 **19本**＝柳の幹→冠5＋冠→垂れ茎14。白樺の補修枝は0。白樺の根元/先端12接合に不足が出たら、長い白い棒を足さずそのphaseをHOLDとして保存する。

柳の主枝が必要な場合は、原l14 trunkの実三角形を水平面で切った輪郭を使用する。短い垂れ茎の補修は該当する実stem断面を使用する。輪郭の単一閉loop・star shapeが取れなければHOLD。円/楕円primitiveへの置換、convex hull化、断面失敗後のepsilon retryなし。7桁のquery用graphキーは近似であり、元meshをweldしない。原断面の凹凸を保った閉じたsweepとし、原donor材質を割り当てる。

主枝は半径.055m、端部検索球はその1.5倍、最大端点span1.6m、20区間。原幹先の上向き方向から立ち上がり、冠内へ曲がって入る。Bezier handle はspan×.48を.10〜.38mへ制限。側面は途中を少し張らせ、末端半径は根元の.55倍。短いstem部は旧半径 `.012*.93*.585*.25` と最大span.15mを保持。これは新しい作者の形の指定であり、queryのinside/closure/nearest閾値を緩める変更ではない。

query64、128交点上限、球の検索、7桁closure、float32 BVH nearestは元のまま。接合は近似計測であり、certified ball・exact seam・全体Boolean・actor通路の証明とは呼ばない。新断面生成の失敗も初回記録を保持する。

## 法線・材質・変形上限

- 元roleのtopology/slot/materialと27固定role/contextのdigestは前後照合。
- 101変更roleは元split NORMALへ逆転置Jacobianを適用。根元identity帯は元local位置を保ち、元normalをexpectedとする。Blender split-normal格納後のL2残差上限.002を新たに検査。byte同一を要求する固定roleとは分ける。
- 新枝のnormalは原断面をsweepしたsideのsmooth normalとflat cap。原幹とのnormal連続は未証明。
- 元全頂点の最大変位2.0m、全sampled Jacobian determinant≥.2、最高主景より.4m以上低いことをbuild時に検査。材質の再配色やroughness変更なし。
- 白樺の純粋な場では、`det = radialScale(y)^2 × dY/dy`。staticの保守的下限は [static-check.json](static-check.json)。実Blender f32の検査を置き換えない。

## 段階と出力

[run-once.py](run-once.py) はbuild/viewを別起動し、各1回・新規outputのみ。CPU2、1 Blender、RSS3GiB（.25秒sample）、build300秒/view120秒。全景は同じ1280幅/Cycles CPU16samples、同じcamera/light/海設定。`growing-reachable-paths.visible_shadow=false` のみThree互換として一時適用し、元値へ戻す。元.blendをrender時に保存しない。

31 primary queryの前に101 roleが完成したことを記録し、以後のfirst-failureでも粗形をHOLD保存できる。完成前に失敗した場合は `FAILED-incomplete-shape.blend` を保持し、全景は描かない。失敗した枝meshが生じた場合もscene/count/manifestから隠さない。process exit0を接合合格とは扱わない。

出力予定は `attempt-01/HOLD-shape.blend`、`HOLD-shape.glb`、`owned-crown-components.glb`、`shape-manifest.json` と、別許可後の `HOLD-source-whole.png` / `render-manifest.json`。whole comparisonはcorrected stage2、stage3、native05を併用する。

純粋Python静的検査のみ実行済み。Blender、mesh診断、render未実行。70葉baseline・actor/owner approach・runtime・本人保存は未検証。住人のないstatic owner layerなので、生活感/人物親しみの評価へ転用しない。独立子ども観察N=0。
