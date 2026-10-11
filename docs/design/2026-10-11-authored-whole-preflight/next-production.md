# 全景で判明した次の制作順

## 先に花庭P05を作る

現P05はl17黄/l18青/l19赤/l31白とl27席。l16赤はP03水庭に保持する。成立条件・成熟・useを弱めない。長い棒と同冠列の原因は、同じ直列4株の距離≤2の5pairに、原本flower-crownを一組ずつ同じ高さで並べ、旧actor clearanceを基に細い茎を伸ばすことにある。各pairに5組ではなく、この直列fixture全体で5組の主花冠。

1. 原本主花冠15meshを一組使う。太株/根/葉は原本flower-gardenの必要な部品だけ抽出し、モジュール一式や未所有の花を背景へ置かない。
2. 4株の既存anchorと成長から、一本の主花冠を支える量塊を先に全島で作る。各根元に色・ID・growthを残す低い花を置き、共有冠にmember IDsを持つ。株を消費せず、空いた通路に新しい中央幹を立てない。
3. 永続actor`.45`の実foot/head、既存bench、地面と接近に高さを合わせる。花冠をwalk floorへ数えない。白い矩形の反復は既存ground上の通路と集まりの見える床へ再構成し、土地/床/経路を減らして解決しない。
4. l31開花前後・全ID選択・地面への接地・通行幅、分離/収納/preview取消/復帰を同じworldで検査。P01/P03・73権利・原本anchor・元27ownerを保つ。先に全景/phoneの粗形、後から素材と細部。

P04の殻は続く別制作で、家を覆う形から湾の内空間と入口が見える形へ直す。その後に森の厚み、大樹の内床/階段/galleryを全景へ合わせる。単体詳細の完成から全島到達を推定しない。

## 大樹galleryの契約を先に揃える

原本great-treeの84mesh/71,536 trianglesには内床・入口3段・螺旋16段・連続galleryがある。小さなsurface profileとvisible skinを同じ`.45`/pivot/yawへ移す。上下を既存x/z一意のwalkSitesへ重複登録しない。

opt-inのowner-use `floorId`/物理waypointsを同じworldへ加える。default最高dry floorへ上床を追加すると、下の所有物・道・岸が浮くため不可。実足幅/段差/入口から支持を検査し、現在成熟4ownerからのみ有効なgallery routeを返す。実到着がuseの根拠で、地面の高さ差だけではgalleryを使った扱いにしない。分離/収納は実入口へ退避する。現時点は提案のみ、galleryは未実装。

## 操作性能の診断

`authoredWaterFrame`は全stateをcache keyへ入れるため非水growthでもmissする。immutable baseと、active water owner(id/kind/cell/growth)、全placed owner(id/cell/home識別/配列順)、原本床/権利/anchor/明示辺/造成scope、profile/recipe版を保った射影が最小の候補。水ownerだけでは保護足元を失う。

ただし購入開始や確定・全景remountにも長い待ちがある。全部をcompose missのせいにしない。compiled水形状の再利用は切削/橋/岸支持descriptorが同じ場合のみ検討。主花一組でmesh数を減らす効果、renderer再生成/shader/shadowの寄与は未測定の推測。実browserの内訳を測ってから変更する。
