# M1 次工程・全島 preflight 草案

2026-10-11。これは採用原本と b6 の実画面を基にした **次の全島一例の制作案**。app / docs / QA / 原本 / state は変更していない。新しい compose、browser、test は実行していない。美術合格・自然成長・保存学習・将来利用の証拠ではない。M1未完、art HOLD を維持する。

## 比較した証拠

- 実画面: [desktop-whole.png](runtime/desktop-whole.png)、1280×900。
- 実画面の正本 report: [runtime/report.json](runtime/report.json)。
- app target: `http://127.0.0.1:5344/prototypes/place-qa/authored.html?water=wide`。
- build: `authored-water-garden-b6`。art candidate: `native05-authored-water-garden-v2`。landscape: `authored-floor-v1`。nativeGrowingArt / growingFeatureEnabled は true。
- 実 world ID: `native05-authored-world-m0-v2`。revision: `authored-water-v2:3f6b964a9069c5f0:eb41954202b1926a`。
- 採用原本: `docs/design/2026-10-10-island-final-3d/whole-island-render.png`、1600×1200。
- 原本3D: `docs/design/2026-10-10-island-final-3d/whole-island.glb`、SHA256 `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`。
- 既存 fixture: [authored-water-fixture.json](../../../prototypes/place-qa/authored-water-fixture.json)。b6 report の initialState と同じ27所有物を読む。合成stateであり、自然に獲得・成熟した証拠にはしない。

実画面は右に所有物操作欄があり、原本は島の鑑賞画面なので、画面全体のピクセル占有率を同じ構図の合否にはしない。まず島の中の量塊、隣同士の関係、家と住人の比率を見る。次の粗形では同一camera・昼・island canvas寸法を固定して前後を比較する。

## 主な差は三つ

| 点 | 採用原本で見えること | b6 実画面 | 次の制作判断 |
|---|---|---|---|
| 大きな塊 | 大樹の幹・上階・根、左の森、水庭、中央の花屋根、入江の建物が異なる形と高さを持つ | 大樹の冠と根、2本のwillow、水庭はあるが、幹内・gallery・大きな花庭が未成立。広い地面を細い道と小さい点が横断する | 大樹を背後の主景、横に連なる水庭を第二主景にする。左の木立と家を一つの暮らしの場へまとめ、花庭は現在の成熟条件で成立する配置を先に選ぶ |
| 尺度 | 家の周りの人物が小さい。根や花の下に暮らす感じがある | ウサギ・キツネが小さいnative家に近い高さ。benchもその関係で大きく見える | 家・地形・大樹は今のsource尺度を基準に保ち、authored世界の住人の最終尺度を永続的に校正する |
| 密度と余白 | 左の森林面と段差、前の集落、背後の水庭がポケットを作る。余白は庭・入り口・湾として読める | 所有木6つがshared hero1本＋通常willow2本となり、家も8戸が離れている。中央から右へ広い均質な草地が残る | 原本の木・家の数はコピーできない。同27IDで密度をポケットへ寄せ、森・庭・集落間の通れる余白を形として決める |

幻想的な違いは発光色だけではない。大きな根の中や上を通れる垂直の空間、幅の違う水面が下降する連続、花に覆われる場、集落と木陰の奥行きの差にある。白い小物やglowを足すだけではこの差を埋められない。

## 最終世界尺度の測定

### 方法と限定

現行factoryで実際のactor、衣装・accessory、native owned-kitの家を作り、全 `matrixWorld` を更新して `Box3.setFromObject(root, true)` で立ち姿の最終寸法を測った。esbuildはメモリ内の `write:false`、sourceやartifactの書き出しなし。world composeはしていない。

原本はGLBのindexed POSITIONに全node TRSを適用し、最後にM0 world尺度 `.45` を掛けた。3690meshの平坦化済みscene、skin / animation / morphはない。templateの未変換bboxをruntime寸法として扱っていない。下表は立ち姿であり、現実装の歩行・seat・持ち上げposeの当たり判定合格ではない。

`actors.ts` はvillagerの `rig.pose` とPokomokoの `hero` を `.7` にし、その外の `actor.root` が実床上の世界位置を持つ。`worldScene.ts` から外側に追加scaleは掛からない。従って下表の `.7` は既に最終寸法へ反映済み。

| 対象 | b6 実装 H | b6 X幅 / Z奥行 | 原本 GLB最終 H | 現行 / 原本 H |
|---|---:|---:|---:|---:|
| Pokomoko | 0.878500 | 0.553000 / 0.422100 | 0.429210（通常個体、原本個体scale .76） | 2.047 |
| rabbit friend0、accessory0 | 1.166671 | 0.475305 / 0.528340 | 0.510002（原本個体scale .68） | 2.288 |
| fox friend2、accessory2 | 1.003273 | 0.523217 / 0.827301 | 0.396115（原本個体scale .65） | 2.533 |
| otter friend1、accessory1 | 0.896000 | 0.462000 / 0.735472 | 原本にこの種なし | — |
| duck friend3、accessory0 | 0.783300 | 0.491926 / 0.645773 | 原本にこの種なし | — |
| squirrel friend4、accessory1 | 1.043000 | 0.427962 / 0.651000 | 原本にこの種なし | — |
| hedgehog friend5、accessory2 | 0.680798 | 0.462000 / 0.651706 | 原本にこの種なし | — |
| penguin friend6、accessory0 | 0.814800 | 0.488942 / 0.406000 | 原本にこの種なし | — |
| owl friend7、accessory1 | 0.833000 | 0.533774 / 0.385000 | 原本にこの種なし | — |

原本は3種7個体で、fox2個体、rabbit2個体、Pokomoko3個体。Pokomokoのbridge個体は `.72` でH `.406620`、他2体は `.76` でH `.429210`。原本の人物も生templateの等scaleではない。原本を `.45` 世界へ移した時のraw rig有効scaleは fox `.2925`、rabbit `.306`、Pokomoko `.342`（bridge `.324`）。この個体差を現在の友だちへ種別の形状変更として移植しない。

現行家の最終寸法は、mature upper/plain/flower/light H `1.554750`・X `1.132367`・Z `1.194300`、mature leaf/tree H `1.587738`・X `1.255430`・Z `1.531112`、water cap H `1.473722`・X `1.685115`・Z `1.565154`、hero cottage H `1.194750`・X `1.027839`・Z `1.040400`。leaf/capは現kitのstyle Y×1.25も含む。従って現rabbitはupper家の高さの約75%、hero cottageの約98%で、小さい暮らしの尺度が崩れている。

原本全15軒もindexed頂点と全TRSを適用して別途測った。upper家はH `1.554750`、cottageは `1.194750` で現行と一致する。一方leafは原本H `1.270190`、capは `1.178977` なので、現行は25%高い。上のactor案と併せ、authored成熟家はsourceの大人姿の縦横比へ戻すことを粗形候補にする。家を更に大きくして大きい人物に合わせる順ではない。stage/variant自体を変えず、legacyに影響しないsource-scale経路で検討する。原本のX/Z幅には配置yawの差が含まれるため、未回転kitと完全一致する幅を要求しない。原本の戸数は cottage8 / upper4 / joined upper1 / cap1 / leaf1で、現行8所有家と同数ではない。

### 次の粗形に置く尺度案

**authored世界全体のactor visual world倍率 `.45` を候補とする。** local rigの `.7`、身体・耳・顔・布・服・accessory・相対speciesサイズをそのまま保ち、それらを一緒に小さくする。Pokomoko H `.395325`、rabbit `.525002`、fox `.451473` になる。原本通常個体に対しておよそ −8% / +3% / +14%なので、共通倍率による同族尺度として粗形で判断できる。原本foxと完全一致させるためにfoxだけ体・服を作り替えない。

これはまだ未実装・未renderの候補。入口を使う時だけ縮める案ではない。authored世界のhero・全villager・visitorを常時同じ方針にし、legacy世界の `.7` は現契約を保つ。

最小の実装境界は `actor.root` の世界位置の内側にvisual wrapperを置き、rig・cloth・accessory・sparkleなどactor自身の視覚要素をまとめること。`GrowingLife.root.scale` や位置を持つ `actor.root.scale` を雑に変えると経路/feetの世界座標まで縮むので採用しない。feet/seat/boat/carry/held/focus等の現在の世界単位offsetも同じ尺度に校正し、実床の接地点を維持する。clock・state・学習・save・ownershipをscaleで変えない。

利用可能性のenvelopeは、visual最終倍率と現在の服/pose/mode transformを適用したactorのmeshに対して測る。未実装の全将来motionを囲う過大cubeで原本入口を不可能と断定しない。小さい人物でも選べるhit targetは絵の大きさと分けて整えるが、視覚meshを再び大きくして対処しない。

## 同27IDでつくる全島一例の大形

以下を **一枚の粗形** として先に見比べる。大樹単体の完成後に島の構図を決める順にはしない。現27IDと73配置権、原本terrain/siteの固定anchorは維持する。instanceの移動が必要な案は通常move commandを使い、取得地点やterrain anchorを書き換えない。

| 場所・役割 | 現owner | 次の粗形で決める形 | 実成立の条件 |
|---|---|---|---|
| 背後左の主景 | l10/l11/l12/l13、P02 cluster、p3、l25 | fan冠と大きなhollow根の今の主尺度を保ち、内側・16 stairs・木のgalleryを幹へ連続させる。階段は島中央へ人が出入りする向きに寄せ、p3の玄関を残す | 同じ4 ownerからの実内床/階段/deck。上下床identityはgallery草案のopt-in契約。支持不能なら利用targetなし |
| 背後右の第二主景 | l20..l24、l16、l26、p5 | 水面・紫岸・下降水路・鉱石洞・渡れる木橋を横に連続させ、大樹に対して低い広がりを作る | b6水庭は現在の同world geometryを基準とする。次の大樹や花配置で入口/流れを壊さない。水庭局所PASSを全景合格にしない |
| 左中段の木陰 | l14/l15、p4 | 2本の冠と枝・実地形が家/小庭を囲む木立のポケット。大樹の根からこの家へ降りる道を余白として見せる | 現6木で原本の大量のtrunksを再現しない。2本の支持・owner IDを保ち、無所有の森を背景化しない |
| 左前の小集落 | p1/p2、hero cottage、上のp4 | 2戸＋HOMEから木陰へ上がる集落。小さい人物の往来で密度を見せる。左右に散る小物を増やさず、近接と家の向きでまとまりを作る | 各玄関/全足支持/同world道。sourceの15戸を8所有家へ追加コピーしない |
| 右中段の花庭 | l17/l18/l19、l27（＋l16の条件付き普通移動） | 現3点rowを最後の美術だと思わず、四つの成熟花とbenchで実P05が成立する一つの配置を探し、その共同形で大きな花の塊を作る | P03の花も保持する配置検討が必要。条件を満たさない間は巨大なflower houseを静的に置かない |
| 前の入り江 | p6/p7、p9、p8 | 小さいcapのペアと遊び場を湾の集落として読む。p8の孤立は湾へ向かう道/向きと余白でつなぐ | 現P04 seededをgrown/貝のhall扱いにしない。既存供給条件で実成立する時にだけ共同形を使う |

大樹の冠は実source `.45` で幅 `3.73087`、奥行 `3.63733`。通常willowは幅 `1.6971`、高さ `2.6495`、奥行 `1.3452`。hero中心 `(3.5,-8.5)` と下段willow `(2,-4)/(2,-3)` は離れていて、今の6 ownerから原本の連続した森林面があると主張できない。現候補は **背後の大樹と左中段の2本木立、二つの大きさの違う木陰ポケット** とする。それらの間に実道を通し、同じfull frameで森としてのつながりが足りるか判断する。無条件に冠だけを跨がせて広い未所有林や侵入不能の影を作らない。

下段P01は現在seededであり、元のadult owned-tree `.45` が残っている。grownになったP01 fallbackが `.34` willowへ置換することと現在を混同しない。現在の希薄さをこのfallbackだけのせいにした以前の仮説は訂正した。

余白は、主景根の入口前・水庭岸への歩行・左集落の小庭・入り江の水を見渡せる隙間の四種類へ分ける。中段から右を全部均一に埋める案にはしない。過剰に広く角張ったlavender道は、原本と同じ薄い地面の帯/枝分かれ/小庭の形へ戻す候補だが、足幅・実床・現在のnavigation/ownershipを下げず、全景の可読性を先に比較する。

## 現条件での花庭の限界

domainのread-only診断は既存b4のworldに対し現在の `canPlace/placeConnected/derivePlaces` を使った。新composeはしていない。

l16 `(6,-10)` だけを右3花へjoinできる現在空きdry候補は `(7,-4),(8,-4),(9,-3),(10,-3),(9,-2),(10,-2)` の6箇所。すべてP05はgrownになりl27が所属するが、すべてP03はseededへ戻り「水のそばで 花を そだてよう」が不足する。**l16単独移動では、現在の水庭grownと右花庭grownは両立しない。** 同ownerで全島一例を作るには配置関係を改めて選ぶ必要があり、stage/receiptを注入して両方を完成扱いにしない。

複数ordinary movesの狭い診断では、順に `p3→(12,-9) / l25→(2,-8) / l16→(1,-7) / l17→(2,-7) / l18→(3,-7) / l19→(4,-7) / l27→(6,-7)` の7手でP01 grown、P03 grown、P05 grownが同時に成立した。全手canPlace、home moveのcanReachHomePlacement、最後の27 owner approachは既存world上で成立した。しかしP02が消え、現在のshared大樹主景が失われるので **この案は採用しない**。最少手数の証明でもない。成熟garden数だけを目標にすると全景の主景を壊す例である。

次の採用配置はP02 clusterを保持したうえで、花/bench/homeの配置関係を選ぶ必要がある。現4花＋l27だけを空けた既存dry候補にも「4個以上のjoin component＋水から2以内」の領域はなく、花だけの移動では解決しなかった。7手例にp4を戻す追加一手も、元p3位置がl25で埋まり、近傍有効home siteではP02へattachせずl11への接近を失うので採用根拠がない。

従って **次の粗形は現在の27 owner配置をまず保ち、主景の大樹の内側/galleryと全島actor尺度を足した一枚** とする。未成熟P05を巨大花庭の完成姿に置換しない。P03/P05/P02が共存する再配置は未確定として別に選び、成立したら同じ一枚の粗形へ戻す。選んだ後は現在の水切り保護・全27入口・足幅支持・HOME到達・原本73権利を新composeで検査し、粗形で比較してから採用する。既存worldだけの配置判定を、新geometryの支持PASSにしない。

## 転用範囲

| 原本から取り入れる | 同じ世界へ適応する | そのままコピーしない |
|---|---|---|
| root/gallery/内床/16階段の実面、fan leafと木の材質、柔らかい岸/水面/鉱石、水路/橋のprofile、家の屋根の色と曲面 | 所有位置・実床・玄関に沿う入口と階段の向き、床間の可視continuous strip、所有群に応じた花/木のまとまり、全authored住人の最終世界尺度 | 原本の追加trees/15houses/固定charactersを無所有backgroundへ追加、原本座標へowner teleport、source花/貝hallを条件なしで表示、glowの増量だけ |

## 制作順と未達

0. **全島の粗形を先に採る。** b6を基準に、小さい暮らしのactor尺度、大樹/木立/水庭/花庭/集落の形、入口と余白を同一cameraで一枚に置く。今は上の配置関係案のみで、大形の採用はpending。P05とP03が両立する配置未確定も隠さない。
1. **決めた全景に必要なsource部分を実抽出する。** root・内床・階段・galleryのnode transform適用後mesh/profileを採取し、入口の向きとp3保護が成立するか調べる。原本SHA、source `.45`、pivot、可視面とsupport面を対応させる。
2. **actual owner-use床とactor尺度を実装する。** 普通のground route/placementは保ったまま床identityをopt-inにする。現在のgallery interpolationをphysical waypointへ直して使い、4ownerの内床→階段→galleryだけを検証する。新lane/court/拡張へscopeを増やさない。
3. **同じ全景をすぐ比較する。** 局所deck完成だけで進まず、粗形時の量塊/scale/density/余白を保持しているか見る。近景で実衣装actorの入口通過・足支持・段差・hit/selectionを確認する。美術、理解、runtimeを別gateにする。
4. **owner編集で消える/戻ることを確かめる。** store/split/disconnectでshared root内の利用floor/route/targetが残らず、通常owner形へ戻る。再接続では同じ実床を復元する。state/save/clock/73rights/join-waterは変えない。
5. **森・花庭・湾の不足を同じM1全景へ戻す。** 局所variantを量産する前に、現在所有だけの密度が足りるか、共同形が正しく成熟しているかを判断する。原本owner数の複製はせず、M2三配置や新地区へはまだ進めない。

未実装: permanent authored actor visual尺度、actual great-tree内床/16stairs/gallery・owner-use床identity、そこへ登るactor path、現P03とP05が両立する採用配置、森林ポケットの美術調整。今回の測定と文書はこれらの完成を意味しない。新全景がまだないためart HOLD、独立silent testはN=0。
