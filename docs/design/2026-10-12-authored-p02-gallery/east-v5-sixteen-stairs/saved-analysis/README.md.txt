# v5 保存値解析 — geometry/guard不変更

今回の範囲は保存済みsource/Float32三角形・接触記録の分類です。Blender、browser、app/world compile、geometry変更、epsilon変更、接触相手の除外はしていません。source visual/runtime HOLDのまま。次の本筋は実9rigによる踏段poseであり、今回の分類はその合格ではありません。

## 端線の長さと境界からの距離

`boundary-report.json`は実components GLBの5部品の三角形座標multisetがprofileと完全一致することを先に確認しています。元double thresholdの面積.3577636971に対し、同封印helperで再現した構築Float32面は.3577636884です。

- 元threshold端線はdouble planで未被覆0、Float32閉体の時点で.2572902908m未被覆。可視skin前後で同じです。最大区間.03506468085mは端線に**沿う方向の長さ**です。
- その各区間の端/1/4/中央/3/4/端の実面への距離は最大2.03849e−7m。診断の照会線だけ内側3e−7mへ移すと残りは両端合計2.08660e−7mになりました。移動後を採用していません。元のゼロシフト検査とHOLDは残ります。
- したがって、thresholdのcm単位の連続未被覆区間は、cm幅の空洞を意味せず、元端線と実Float32外周の一致しない境界照会として分類できます。これは全幅接合が元の閾値を通ったという意味でも、すべての距離を厳密連続最大で証明したという意味でもありません。
- plateauはFloat32閉体では未被覆0、可視skin後に.0078448801mとなり、外周とは別です。raw閉体投影から全可視owner top投影を引いた実欠けは39片/計5.94391e−8m²。各片を囲む最小回転矩形の短辺最大2.55641e−7mで、可視面をFloat32で再三角形化した際の微小な面の隙間が実在します。面積・幅が小さくても消したりPASS扱いにしていません。

`source-boundary-loss.json`は元double planとFloat32外周の差分全体も保全しています（失われる面積8.74469e−8、増える面積7.87997e−8）。一部が角に沿って曲がるため、同ファイルの回転矩形短辺は局所隙間の厚みと一致しません。この追加指標を実隙間の幅として採用しません。端線の距離は上記の具体サンプル・診断線結果で区別します。原地面全体に穴があるとの結論でもありません。

## 接触の内訳

`contact-report.json`はbox37station/2,871 triangle×station件、motion band24station/305件を保存値から分類しました。すべて新P02部品で、同l10/l11/l12/l13の共同所有。原幹・元の葉・他ownerへの接触はこの記録にはありません。途中動作・他位置まで0とは主張しません。

| 相手 | motion件数 | 意味と残る課題 |
| --- | ---: | --- |
| 実階段riser | 167 | 全16tread stationに存在。現在段と隣接段の蹴上げ。実soleの接地/離地、riser越え、脚と胴体の連続性を実9rigで解く必要がある |
| gallery終端end-cap | 13 | gallery109–115°のprobe。宣言use95°を過ぎた終端側。元rawに残す |
| 幹支持bough4 | 4 | tread13でband3、contact面から+22.50〜22.88mmの狭い高さ帯。下記の局所閉体照合で隣のtread14木材内部と分類 |
| terminal guard | 121 | gallery101–115°のprobe、contact面から約.306〜.349m。意図した終端ガードで、宣言use95°より先。取り除かず、将来の経路がここまで進むなら衝突する |

すべての階段motion面は実Float32階段の元face/roleに一致しました。180件中51件はcontact plane以下のみ、129件はそれを跨ぎます。以下だけの接触でも、帯のminYが負であることと踏段動作中の足裏位置を区別する必要があります。

`support-local-volume.json`はbough4の当たった4面を実band高さで切り、同じ階段のtop/underside区分へ投影して照合。当たる部分すべてがtread14の閉体内部にあり、天面まで最小.059373617m、下面より最小.030481382m内側でした。支持全体の自己交差やrigの非衝突を証明せず、167riser接触を解消もしません。

boxは軸に平行な半幅.284069m（角まで約.402m）、motion bandは最大半径.244069mと別々の高さ区間です。boxには側rail/postや他の支持が当たりますが、それらには保存されたmotion-band接触がありません。この形の違いを記録するだけで、一方を無条件に無視しません。boxには各station先頭6例しか実三角形が保存されていないため、全2,871件の面roleを例だけから復元したとは主張していません。全object別件数は保持しています。

## 実poseまで未解決の境界

motion bandは9rig由来のindex付き運動区間を保守的な帯へまとめたもので、各actorの同時poseによる実mesh同士の交差ではありません。今回のbody guardの中心は踏面の足対contact中心で、先のfoot-hull比較が使ったrig別足pivotに合わせたbody-root補正とは同一ではありません。実足の支持余裕をそのままbody clearanceへ転用できません。

次は同じ16段・元rigの顔/体型/scaleで、両足を別の実踏面に置くstance/swing、足裏と蹴上げの非貫通、脚と胴体の連続性、上り/下り/踊り場→95°利用点を確認する必要があります。終端115°へ進ませない経路の扱いと、元default ground/receipt/owner失効の契約も別に維持します。今回、profileや経路を変更していません。

全scriptと生JSON/log、入力before/after SHAを保存。計算は保存値のみで0.1秒級、初回例外なし。詳しい数値はrawを優先し、primarygeometryの微小修正や追加カメラへ範囲を広げていません。
