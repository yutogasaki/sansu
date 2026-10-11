# Authored全島 c2：作者による美術preflight

2026-10-11。**31/60・美術HOLD。独立児童の理解／安全確認 N=0。全M1・包括ゴールは未完。**

評価者はactorの永続visual尺度を実装した `/root/authored_world_art`。rootとは別に画像を見たsoftware美術レビューだが、制作から独立した利用者評価ではない。画像比較と少量のsource／原本GLB metadata読取りだけを実施した。アプリ・画像・repo文書・QA sourceは変更せず、新render・browser操作・tests・native composeは行っていない。この外部報告ファイルだけを作成・更新した。最終c2 reportと追加tablet画像の読取りまでを含む。

## 対象と証拠の範囲

- 採用原本：`docs/design/2026-10-10-island-final-3d/whole-island-render.png`（native05）。原本の家や植物の個数・配置を、そのまま本人の所有物として転写する比較ではない。
- 前段b6：`docs/design/2026-10-11-authored-water-garden/runtime/desktop-whole.png`、同`review.md`の作者35/60。
- 初期c1：`/private/tmp/sansu-whole-preflight-c1-runtime/initial-27-camera-scale.png`。作者36/60（世界6、愛着7、触感6、構図6、色7、出来事4）。この旧runをc2の実証拠へ混ぜない。
- 今回c2：`/private/tmp/sansu-whole-preflight-c2-runtime/` の `mature-32-whole-day.png`、`desktop-forest-close.png`、`desktop-hill-water-close.png`、`desktop-flower-close.png`、`desktop-bay-water-close.png`。
- 追加確認済み：`phone-mature-whole-day.png`、`phone-forest-close-day.png`、`phone-mature-whole-dusk.png`、`desktop-rotated-day-whole.png`、`desktop-rotated-dusk-whole.png`、`desktop-rotated-dusk-water-close.png`。
- 最終追加確認済み：`tablet-mature-whole-day.png`、`tablet-mature-whole-dusk.png`、`tablet-forest-close-day.png`、`tablet-water-close-dusk.png`、`phone-water-close-dusk.png`。tabletは768×1024、phoneは390×844のbrowser viewport captureであり、実機試験ではない。
- 最終実行記録：同dirの`report.json`。画像と実行identityを照合し、coreなど別実行の結果はこの美術レビューに取り込まない。

最終`report.json`を直接確認した。実対象は `http://127.0.0.1:5350/prototypes/place-qa/authored.html?water=wide&grow=1`。27 capture全てのactual identityが **build `authored-whole-preflight-c2` / candidate `native05-authored-whole-preflight-v1` / native `true`** で一致する。実行はPASS、focusは10、errorsは空。1578 source入力の開始／終了mapが完全一致し、両入力hashは `b15429ca69ef81e42ff8438538064945317065dc857eb89fd9d1da4ffa1f8af5`、`sourceClosureUnchanged=true`。c1のrunner defaultをc2のbuild値として使用していない。これは機能／実行identityの確認であり、美術GO・実機性能・独立児童理解の確認ではない。

今回読んだ `mature-32.frame.json` は world `native05-authored-world-m0-v2`、revision `authored-water-v2:3c5f4ee9f492cc25:eb41954202b1926a`、stateHash `0593897ea073f817fbdee7f445491ccde12b9e2c083542aa19d320454c40cd2a`。配置所有物は32、homeは8、取得siteは73。**32軒の町ではなく、M4の32軒・拡張の証明でもない。** 取得・18h自然経過・成熟の機能PASSはrootのruntime QAの範囲であり、画像レビューから再認定しない。

## 六軸

| 六軸 | b6 | 初期c1 | 成熟c2 | 実際に見える差 |
|---|---:|---:|---:|---|
| 入りたくなる世界 | 6 | 6 | 5 | 花冠の列と大きな殻が増えるが、株から育った庭より陳列台・屋根施設に見える。原本の森／花庭／入り江の空間の違いが弱い。 |
| キャラクターへの愛着 | 7 | 7 | 7 | 永続`.45`で家との尺度が整い、近景で元の顔・服・speciesが読める。全景phoneでは個体はほぼ点になるので、近景との往復と選択の実用性は別確認。 |
| 素材の触感 | 6 | 6 | 5 | 茶色い枝・厚い葉から育つ原本に対し、細い緑棒・平らな反復花冠・巨大な白面が人工的。水／紫岸／木橋は分かれるが、殻の内部と透ける層が弱い。 |
| 構図と奥行き | 5 | 6 | 4 | 初期は人物縮尺で風景を読みやすくしたが、成熟で同高さの花棚と殻が前中景を塞ぎ、家・庭・空白の優先順位を崩す。回転しても直線の棒と屋根が目立つ。 |
| 色の楽しさと焦点 | 7 | 7 | 6 | 多色はあるが、濃い紫殻、ピンクの列、虹色の串が別々に競う。原本の大きな緑／青／淡桃の色面と、その間の余白へまとまっていない。 |
| 出来事と見返り | 4 | 4 | 4 | 新しい成熟形は確認できるが、同じ株が一つの場所へ育つ過程や、その内側で暮らす見返りが画面から読めない。静止画像は実利用・歩行支持の証明にならない。 |

合計：**35 → 36 → 31/60**。成熟後の物量そのものでは加点しない。全六軸8以上に届かず、美術HOLDを維持。独立理解／安全N=0、runtimeは操作時間の未達を残すPARTIAL。機能数、例外0、所有32、テスト合格によって全M1やゴールを繰り上げない。

## 保持する改善

actor `.45`は戻さず、さらに入口だけ小さくしたり全人物を縮めたりしない。原本と同じ小さな暮らしの尺度が近景で成立し始めている。rig `.7`、顔・布・服・種の比率・世界位置と経路を保持する方針を続ける。家の縦横比を今回の評価だけで調整しない。近景で人物が枝と重なり、狐が枝の前に浮いて見える瞬間があるが、静止画像だけでは床・hop・奥行きの原因は断定しない。実際の足接点と歩行姿勢が見えるframeで確認する必要がある。

原本の岸・入り江の全体形、丘から水庭へ降りる配置、青い水と紫岸、木橋も保持する。これらの機能・支持を消して構図だけ作り直す提案ではない。

## 重大な未達

1. **P05花庭が長い棒の棚になった。** 地面の小さい花束から細い直線が伸び、同じ小花冠が同じ高さで多数並ぶ。下の株と上の花の間に葉・分岐・ふくらみがなく、同一の花冠を増やしたことが主な変化に見える。原本は茶色い育ったstemとbough、広い葉、厚い一つの主花、低い周辺花を重ねている。
2. **白い導線が庭の大きな四角面になった。** 花の下と殻から右庭へ白い矩形が連なり、草地・庭・通路の区別が薄い。現在のinlayが実ground上の描画でも、見た目は設置パネルに近い。支持を白い面の広さで表現しない。
3. **P04殻が家へ覆いかぶさる。** 家2軒の上に大きい濃紫の屋根が被り、細い柱と家の屋根が下に見える。原本の湾のmouth、内部の空間、水面との関係、淡く透ける殻が読みづらい。家の選択と正面玄関が機能していても、覆われた集落が美術上の完成にはならない。
4. **森林の面と大樹の内側は引き続き不足。** 新しい所有木で左の塊は増えたが、原本の複数の樹形が重なる森の厚み、巨木の共有gallery／内側は未達。静的な背景植栽を足して所有や利用を増やさない。
5. **phone／tabletでも形の問題は消えない。** 全景では大樹・花棚・殻は識別できるが、顔・家の入口・水庭の口は非常に小さい。tablet全景は右の操作paneにより世界の幅が狭まり、島の周囲の海と上方の空白が多い一方、長い花茎・ピンク花冠・紫殻・白い面が優先して目に入る。forest近景では木と家、元の人物の姿が読める一方、殻が右から大きく入り、輪郭が画角に切られる。tablet／phoneのwater dusk近景でも、前景の花列と虹色のstrip、白い床帯が強く、水庭の口と鉱石／下降水路のまとまりは弱い。phone下部の操作ボタンは手前の地面を一部覆う。これはbrowser画像上の観察であり、実機touchや独立した操作理解のPASSではない。duskで海色が変わっても、棚／白い面／殻の構図は残る。

## 操作時間と性能の限定

最終reportの計測範囲は、**headless desktop browserでの操作からworld評価と2 painted framesまで**。Nodeのframe／proof処理は別の診断時間で、実機受入の測定ではない。機能PASSとは分け、現在の操作時間は未達として扱う。

| 実操作 | c2実測 |
|---|---:|
| 初回load | 15.1秒 |
| 購入tree l28／l29のpointer preview | 9.1／16.7秒 |
| bench l30のpointer preview | 16.9秒 |
| flower l31のpointer preview | 16.3秒 |
| bowl l32のpointer preview | 22.7秒 |
| 成熟後desktopの最初の4 focus | 25.9〜34.8秒 |
| 10 focus全体 | 19.9〜34.8秒 |

source読取りでは、P05がlegacy rabbitのclearance値を使い、4個の同列flowerの対象pairから**5組のnative crown**を生成することを確認した。この反復は画像の棚状の形と一致する。複数crownがdraw callを増やし遅延を悪化させる可能性はあるが、このレビューではrenderer draw count／CPU／GPUの因果を測っておらず、性能の主因とは断定しない。clearanceの高さ問題も、描画遅延の原因と同一視しない。次unitは全景の一つの冠と株の連続を成立させる制作であり、性能改善の採用判定は固定候補で別に測る。

## 次の最小一制作：P05花庭の量塊・株・実床を一緒に作る

次はP05を一つの全島unitとして作る。P04殻や全島の道を同時に広範囲で修正せず、P05の形とその下の必要な通路を先に成立させる。現在のP05主ownerは既存 `l17/l18/l19` と購入後に成熟した `l31` の4花。所有ID・取得73site・成熟条件・時計・保存・隣接を保ち、原本5株や原本の小花の数を新ownerとしてコピーしない。

### 0. 全景の量塊を先に決める

同じ成熟32owner・8家・固定地形を使い、P02大樹を最高点に保つ。P05は中景の一つの丸い主花と、低い周辺花／葉の塊にする。原本のshared crownの `.45` 後の概算boundsは幅約2.49、厚み約.49、深さ約2.48。これはGLB nodeTRSとaccessor boundsから読んだ制作目安で、歩行支持の証明ではない。

長いlaneだから同じcrownを隣接pairごとに連打する方式をやめ、中心のまとまった花と端の低い株を明確にする。4ownerの長さ方向と横幅は別々に適応し、主花そのものを長い板へ伸ばさない。枝・葉の分岐でowned anchorと主花の間をつなぐ。全景で水庭・湾・家の屋根との高さ順と余白を比較してから詳細化する。

### 1. crownだけでなく原本の株と枝を最小抽出する

現kitの`flower-crown`抽出は主花のpetal／heart中心で、原本の株・枝・葉は含まない。次のsource範囲は `Flowers / canopy-reaching stem`、`joined lateral bough`、`supporting grown branch`、`broad growing leaf`、`shared giant petal canopy`、`scalloped upper petal`、`joined blossom heart`、必要な`small peripheral bloom`。

原本のcanopy-reaching stemは5partで**茶色い木質材**（baseColor約.509/.287/.156）、`.45`後の全体高約.969。bough／branchも同じ木質材、広い葉は別の緑材。これを緑の細い直線の柱へ置き換えず、4ownerへ適応した株・曲がる分岐・葉の面として作る。抽出時に元mesh名／source SHA／実寸／接合点を残す。原本の個数そのものではなく現在の所有anchorに必要な部品だけを使う。

### 2. 実actor尺度と床から成長する構造を合わせる

現在のP05 heightはlegacy rabbit高 `1.166671391 + .10` を直接clearanceに使っている。authoredでは永続`.45`を適用した実衣装actorの寸法／歩行poseでclearanceを校正し、入口の利用時に人物だけ縮めて逃げない。原本の主花厚みとstem比率を保ち、必要な入口区間だけ実足幅・頭／衣装の通過を検査する。

株の根元は各既存owner anchorの実floorへ置く。幹／太い根を必要な通路や別ownerの玄関へ広げず、上部の枝葉だけを通路上へ通す。見た目の枝・葉を実床や通行権として数えない。source枝に実歩行を追加するなら、その床identityと支持を同じworldへ構成し、別工程のgallery実装として証明する。今回の最小P05 unitでは既存ground上の入り方と既存bench利用を先に使い、新しい葉階段を成熟の見返りに数えない。

### 3. 花下の道と庭の床を同じ実groundへ収める

白いquarter-cell矩形の面を庭の輪郭として並べない。実際に通る細い道と小さな集まりの空間を、既存groundのtriangle／open footprint／玄関を使って連続した控えめなinlayへまとめ、残りは元の地面と草の余白に戻す。inlayを描画床として足して土地・walk edge・heightを増やさない。benchへのHOME接近、全所有物の接近、地面の穴／海／水、人物の足接点は共通worldで保持する。

### 4. 同じ全景で早期比較し、操作と接点を閉じる

粗形の段階から今回と同じwhole day、phone whole、flower close、回転の画角で原本と並べる。主花がまとまった丸い塊になり、株→枝→葉→花の連続が読め、家と水庭の余白が残るまで細部を増やさない。その後に、若い花→成熟、同じownerの選択／移動／収納／分離／再接続、preview／cancel／confirm、実bench poseとground歩行の接点を閉じる。利用receipt・時計を注入して美術の完成形を作らない。

このP05 unitが全景で成立した後にP04殻を、原本mouth／内部空間／湾との位置関係から別unitで再構成する。大樹gallery／森林の面は残りのM1課題として保持する。どの一つが技術PASSになっても全島の美術GOや包括ゴール完了にはしない。
