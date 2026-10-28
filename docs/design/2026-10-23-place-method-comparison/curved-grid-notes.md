# H：初期から曲がる固定座標の格子

2026-10-23 06:04 JST。候補 `fixed-two-shear-grid-v1`。高さはF2・12分割、X/Zだけ固定座標の写像を追加する比較。srcは変更せず、pure関数・guarded source transform・診断を新規ファイルとして作成した。美術採用や配布の判定ではない。

## 設計と接続

従来のlandscape写像の後へ、`x'=x+a(z)`、`z'=z+b(x')` の二段shearを合成する。a/bは固定座標上の広い波で、land・所有物・高さ編集を引数に取らない。逆は `z=z'-b(x')`、`x=x'-a(z)` の順で直接求める。

追加写像の連続Jacobian determinantは1。初期島の追加移動は最大約0.983セルで、長い直線を見える大きさで曲げる一案とした。土地の取得でこの写像自体が既存点を移動させることはない。従来のlandscape写像は拡張部で面積比1ではないため、H全体が全領域で面積1という意味ではない。元の写像の連続面積を追加shearが保持する。

`curvedGridLandscapeTransform(source)` はブラウザの `terrainTrial=H` でのみ有効。Nodeは `{alwaysH:true}` を明示。forwardとinverseを同時に差し替える。`curvedGridWorldSceneTransform(source)` はHだけ固定cottageの絶対位置を `layout.point({x:2.5,z:.5},.035)` へ替える。通常ownerとactorのrootは既にlayout経由であり、同じ実床に従う。モデルの尺度とローカル形状は変えない。

固定家がeditableでも絶対位置にあったことは実装前の具体的な例外だった。これを修正せず床だけ写す案は不成立。桟橋はlayout.pierRootを基点に従来のworld軸offsetを保ち、接岸部を別検査した。

## Pure写像の確認

コマンド：`fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/curved-grid-pure-check.mjs`。exit 0。証拠 `evidence/curved-grid-pure.json`。

- 231,361点：逆変換の最大誤差約7.95e−15、determinantの1からの差約1.12e−16。
- 6/12分割、計90,720三角形：反転0。追加写像の三角形面積比の最小は約0.9905 / 0.9952。
- 初期6×5領域の離散面積は約29.999218 / 29.999805。連続面積30との差は−0.00261% / −0.000652%。三角形が曲線を近似する誤差であり、面積が機械的に厳密一致するとは主張しない。

## 本体統合・実モデルの確認

コマンド：`fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/curved-grid-check.mjs`。exit 0。証拠 `evidence/curved-grid-F.json` / `evidence/curved-grid-H.json` / `evidence/curved-grid-H-recipe.json`。本体の `terrainMethodTransform(...,{mode:'F'|'H'})` とHの明示projection/house transformを使用した。

入力はzero、実操作保存18、同じ通常F2レシピ後、最新実操作保存33、拡張の5つ。FとHで論理床の乾湿・Yサンプル・取得サイトは完全一致。生成された全walk edgeを実床の幅と勾配で検査。物理距離が変わるため、最新状態のedge数はF368→H372と変わる。これは経路を同一結果へ固定した比較ではない。

実三角形の反転は0。floorからlayout.pointを通りpointer逆変換へ戻る誤差は最大約1.42e−9、rayとfloorの高さ差は最大約8.83e−7m。解析写像と描画三角形の線形補間との差は最大約1.63mmあった。クリックは解析逆変換だけへ戻さず、既存の `world.logicalAt` による実三角形逆変換を使うことが重要である。

実native05キットを読み、地面近くのモデル頂点を実floorへ照合した。最新保存33では次の通り。

| 対象 | 照合頂点 | 新しい支持欠落 | Fからの差 |
| --- | ---: | ---: | --- |
| 固定cottage | 1,018 | 0 | 足元の高さ差の範囲は同じ |
| p1テント `(0,1)` | 110 | 0 | 最大の潜りは約4.7mm改善 |
| 花 `(2,3)` | 1,152 | 0 | 最大の高さgapが約9.5mm増加 |
| ベンチ `(2,4)` | 24 | 0 | 最大の高さgapが約4.6mm増加 |

近地面頂点はrootY−0.12〜rootY+0.08の範囲で選んだ。全モデル表面の連続接触の証明ではない。Fの時点にも隙間や潜りがあり、Hの絶対的な完全接地を主張しない。固定家のモデル自体を曲げず、実床から求めた位置へ移動した。固定家の実source配置経路はrendererなしのworldSceneで実行し、nativeキットの実形状も同じ位置で検査した。WebGL描画の証拠ではない。

桟橋の基点は従来と同じ相対offsetを保持。最初の板の陸側端を実幅で5点検査し、全てdryのまま。海上部分はもともと水の上にあり、地面への接触を要求していない。

F2と同じ通常コマンドのレシピをHでも実行。地形編集・Undo/Redo・花/ベンチ配置が成功し、実life controllerで次を確認した。

- pokomoko：到着880ms、利用receipt1580ms、登り0.18m。
- v2：到着2620ms、利用receipt3320ms、登り0.36m。
- 全移動stepの実床支持、到着後700ms以上の利用、domainへの利用記録、JSON往復後の床/場所/利用履歴を確認。

これは既存の診断用レシピを使った実ロジック試験。通常UIの入力・DB保存・実機WebGL・児童理解の合格とは別である。heroのレシピ用rigは簡略化されており、実hero衣服/足の全接触をこの結果で証明しない。新規6コードファイルのESLintはexit 0。

## 採否の残条件

Hは配置面積を削らず直交格子の見え方を変えることに成功した。固定カメラの全景と近景で、単に斜めに曲がった長方形になっただけなのか、大きな塊と岸・場所の関係が改善するのかを判断する。形の変化だけで採用しない。

任意の高低差、細い首、全owner種類と大型成長段階、lookout bridge全形状、実actor身体幅、全ての地形編集時の継続、安全なクリックのモバイル旅程は未確認。今回の5入力の支持が、全ての合法セーブの安全を保証するとは扱わない。fixed-space写像が取得で変わらないことと、通常ゲームの取得前後全状態が安全なことも区別する。
