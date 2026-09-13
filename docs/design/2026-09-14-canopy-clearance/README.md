# 樹冠下の高さ — DEV比較

C3の家を包む巨木の尺度を、既存の木と葉の縦圧縮だけで比較した。[比較前の契約](transfer.md)。ぽこもこの顔・輪郭・頭身・耳・配色・布、家、カメラ、光、地形、歩行/配置/保存/学習は変更しない。幹と葉を同じ親Groupで変形するので両者の接続は保持される。根元の原点とXZ座標は変えず、Y方向だけ0.67から比較値へ変える。元のmesh/UVや材質は同一だが、描画上の縦横比は変わる。

## 3案と選定

[C3・既存0.67・3案](comparison.png)。[porch 0.82](comparison/porch/report.json)、[vault 1.00](comparison/vault/report.json)、[grove 1.12](comparison/grove/report.json)を同じ明示QA記録・元profile・住民活動割当・論理時刻で撮影した。realAtだけ撮影開始へ接続。両幅reduced motion。自然取得/利用者検証ではない。

vaultを次の試作基準に選ぶ。家の上に幹が渡る空間が明確になる。porchは低い樹冠の圧縮感が残り、groveはphoneでも葉が上へ出すぎる。vaultのtabletは上端が画面外へ続く。全景でも右側の葉の端にcropが残るため、「全景」の操作名を全造形が収まる証拠とはしない。参考画像のcropを契約として採用したわけではなく、住民・家・枝のつながりと全景への切替を実画面で評価する。背景は海のままで、この比較では増やさない。

## 対象と検証

`VITE_CANOPY_CLEARANCE_STUDY=porch|vault|grove` はDEV木肌/turf/lagoon/buttress/shelterの全条件が揃う場合だけ有効。実候補 `canopy-clearance-vault-study-v1`、実対象 `http://127.0.0.1:5250`。外側delivery `snap-root-v1`、島delivery `mystic-island-v1`、world `canopy-dots-c3-v1`。基底revision `bf28fd63bbb861ce56de5ea93e247c8db7c3ea9d`＋この差分。buildと実DOMは各reportに記録する。

最終app source `d78b25fdd6c46ceaa056bf4883b84cb470a7562e7b049efc035f177119ac1bac`。比較とcore後のUI開始終了は同じsource。docsにあるatlas/meshのSHA-256はreportで別途照合する。

- [core](runtime/core-output.txt): docs/lint/typecheck、410ファイル・3,955テスト、build/assets PASS。precache98件・10.88 MiB。既存期限/Browserslist/fast-refresh警告あり。
- [両幅のUI](runtime/report.json): phone通常motion/tablet reduced motion。simulated旧memoryの旧照明とsnapshotを保持し、現在観察へ戻る。拡大/リセット、全景、配置の4,4を実タッチで選択し取消、reload、学習入力復帰を確認。actions/credits/native学習正本を保持。試作なしの5244と全景/配置のprojection/view行列が完全一致。console/page errorなし。
- [導線シート](contact-sheet.png): 現在→旧memory→現在観察→拡大→全景→配置プレビュー→学習。学習throughputや全配置受入の代用ではない。

最初のtypecheckではenv値のany推論をindexに使って失敗したため、候補を明示union型にした。比較撮影前の修正であり、実画面の不具合とは扱わない。production JSではclearance候補文字列が除去されている。候補限定CSSは残るが、productionで候補は発生しない。素材のpublic/precache追加もない。production既定は変更しない。過去のC3 snapshotへ適用する正式素材/造形版の移行契約は未完で、今回の旧memory検査はmoon-gardenのsimulated記録に限る。

## 独立した判定

- 視覚: **HOLD、37/60**。入ってみたい7、愛着7、素材6、構図/奥行き7、色7、出来事3。作者によるC3/両幅画面の比較、確信度中。枝の下に空間ができたが、背景の層、地面の質感、板状の岸が残る。52/60・各8以上に未達。
- 無文字理解/安全: **HOLD、Human N=0**。既存キャラを保持した画面点検を、独立した理解/継続意欲/危険解釈の利用者結果へ読み替えない。
- Runtime: 上記の限定検査は **PASS**、全releaseは **HOLD**。自然X3、最大配置/混合配置性能、固定10問10反復、実機とこのDEV候補のPWA更新は今回の検証外。

次はこの高さを基準に、島の奥に見える空間と背景の層を比較する。樹冠を高くしただけで世界表現の完成とはしない。元の仕様全体の残件は継続。
