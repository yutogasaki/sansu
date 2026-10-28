# 高台の庭：同一入力 A / F / H の独立監査

2026-10-23。`high-garden-audit.ts/mjs` は `42-H-redone-state.json` と保存済み高台recipeを使う。まずFで通常commandを再生して最終stateを作り、同じ最終stateをA/F/Hへ投影する。各方式で通常recipeを最初から再生できるかも別に記録する。本体src、元recipe、DBは変更していない。

## 操作の成立と、その限界

F/Hは収納→地形編集→Undo/Redo→再配置の通常25操作が成立した。Aは11操作目の(1,2)+1をp1の足元保護で拒否する。Fで作った最終入力をAへ投影するとp1と花が不支持になる。そのA状態でもgardenとbenchの実利用は成立したため、「利用できる」だけでは作成可能・足元合法とは判定しない。

F/Hでは家具を置いた後の直前Undo→Redo、花のセル(2,3)を1段下げる→Undo、遠い(5,0)を上げる→Undoも所有物の支持を維持して成立した。A同入力では既存不支持ownerにより全て拒否し、元stateは不変だった。この診断には実actor位置snapshotを渡しておらず、住人がその場にいる編集を許可した証拠ではない。

## 本物の体とベンチの利用

元recipeのheroは空のGroupで、経路とreceiptを検査していた。独立監査では本物のPokomoko rig、通常v2 rig、実object layerを使った。gardenは通常 `visitPlace`、benchは固定乱数seedで通常の自発選択を進めた。ルートや利用receiptを注入していない。両住人は全方式でgardenとbenchの実receiptを発生させた。garden到着→receiptは880→1600ms / 2640→3360ms。40ms刻みなので待ち時間は720msで、700ms以上を満たす。

benchは `visitPlace` の指定対象ではない。自発選択の本物の着座を確認したが、このseedでの待ち時間を子どもへの操作性保証とはしない。bench receipt時の体に床貫通は検出されなかった。

移動中は200msごとに下半身の実頂点を間引いて床と比較した。経路中心の支持失敗は0、乾床のない下半身サンプルは0。v2の最悪地中量はA=1.33cm、F=1.37cm、H=2.29cmで、該当meshは `resident-tail` のしっぽだった。足底支持の失敗と混同しないが、斜面でしっぽが埋まる可視上の限界は残る。これは連続時間・全三角形の衝突証明ではない。

## 足元の実モデル

native05 kitを実際に読み込み、sceneの所有モデルと固定cottageのnear-ground頂点を測った。この入力のp1はstage1のテント、花とbenchは通常のprocedural modelであり、native05へ置き換わる所有物ではない。native05モデルの検査は固定cottageにも行った。

論理支持判定はowner中心から半径.46だが、p1テントの実near-ground範囲はFで約.55、Hで約.532まで広がる。入力42ですでにp1にF=6.1cm / H=5.63cmの地中頂点があり、高台化後も同じ値だった。今回の高台操作で増えたものではないが、「既存だから合格」とは扱わない。

(1,2)を1→0へ戻す1操作はF/Hで受理されるが、最悪の埋まりは改善しない。p1自身の(0,1)を−1→0へ戻す通常1操作はF/Hで受理され、p1の地中頂点がなくなった。床とのgapはF=4.0〜5.4cm、H=3.967〜5.4cm。既定root余白.04を含むので完全密着という意味ではない。花・benchの支持と実footprintは変わらない。この修正は診断枝であり、保存済み実島やexpanded fixtureへ勝手に適用していない。

同じ修正後stateで本物のrigを再実行し、F/Hとも両actorのgarden・bench利用を保持した。経路支持違反0、下半身の乾床欠損0、(0,4)の開口維持。しっぽの最大貫通はF1.37cm/H2.29cmで変わらない。別途rootが実UI53で修正を確認したが、この監査の数値はCPU診断の証拠として扱う。

## 入り江と場所の違い

(0,4)=−3は湿地のまま維持。一方、recipeは東の(5,1)/(5,2)を−3から−1へ戻しており、全方式で床高さ−.18の乾いた低地になる。「反対側の入り江を維持した」とは言えない。負の保存値と水中であることは別である。

庭は同じ `P05:starter-flower`、同じflower-path、同じgarden/seat対象で、花とbenchの位置も同じ。上面の高さや近づき方は変わるが、独立した別の場所や新しい遊び能力が増えた証拠ではない。高低差が子どもに「別の居場所」として読めるか、美術として何が改善したかは実画面での比較が必要。

## 証拠

`evidence/high-garden-audit.json` は方式別の通常再生結果、同一最終state、所有物の物理頂点、両actorの経路/実receipt、編集後Undo、開口、修正診断、入力hash・日時を含む。自動検査をWebGLの見た目、子どもの理解、DB保存の合格へ読み替えない。

`expanded-fixture.ts/mjs` は別診断。実入力49から明示的な残高fixture10,000を与え、F＋現行seamでeast→west→southを通常取得後、新取得セルだけ通常編集した。取得3＋編集46の49操作が全て成功し、指定高台・肩・東低地の高さに一致した。旧30セルの高さと全owner/住人のID・成長・配置を保持、残高9,160。`evidence/expanded-fixture.json` は `{state,...metadata}` で凍結しており、p1修正を含まない。実プレイヤーの学習収入、購入、保存証拠ではない。

rootの明示依頼後、別ファイル `expanded-fixture-v2.ts/mjs` でv1へ通常(0,1)+1のみ追加した。`evidence/expanded-fixture-v2.json` は親v1のSHA256、親から続く50操作trace、F/H同一stateと実モデルの足元結果を記録する。v1は上書きしていない。

**拡張後v2では物理足元が未達。** 全論理支持はtrueでもp1の実near-ground頂点はFで8.01cm、Hで8.21cm地中に残る。花・bench・native cottageはこのサンプルで地中頂点なし、(0,4)の開口維持。初期30セルでの1操作修正を拡張後へ外挿してはいけない。v2のstatusは `PHYSICAL_FOOTING_REMAINS` としており、表示・反例調査用のfixtureであって採用合格ではない。

当該新規診断・builderのTypeScript検査とESLintはPASS。物理反例がないという意味にはしない。
