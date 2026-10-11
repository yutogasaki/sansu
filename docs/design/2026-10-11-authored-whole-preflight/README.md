# 全島の尺度・購入・成熟を同じ実3Dで確認

[包括ゴール](../../product/island-construction-strategy.md)のM1制作中。住人の尺度、原本の樹種と成長、実際の高さへ寄るcameraを修正し、**27→32所有物・家8軒のまま**の全景を本体rendererで比較した。[採用原本と実画面](contact-sheet.html)を先に見る。

**全島美術31/60・HOLD／独立理解・安全N=0／runtime PARTIAL。M1と包括ゴールは未完。** 初期の作者評価36/60に対し、成熟後は花冠の直列反復、細い長茎、家を覆う殻、白い矩形床が目立ち31/60へ下がった。合格へ繰り上げず、次の制作を花庭P05へ絞る。[作者の比較](review/art-review.md)。

## 実装したこと

全authored住人の永続visual倍率を`.45`にし、rigの`.7`と顔・頭身・耳・布・服を保持した。世界位置・経路・所有を縮めず、足・座面・舟・手持ち・focusの接触を分ける。ベンチ/食卓の実座面へ名前を付け、足の接触と着座/退出を検査。素材とmeshは変更していない。実native斜面の全足頂点、全衣装の妨害、滑り台全経路、自然なposeの全評価は未実施。[専用45試験](review/actor-focused-a4.log.txt)。

cameraは選択ownerの実3D高さをground-plane aimへ変換し、authored範囲のpanと近接clippingを修正。普通の島の全景・倍率を保持した。27画面と10選択の実anchor投影を照合した。pointの中心一致だけで被写体全体の美術合格にはしない。

P02の成熟4本から育つ既存大樹は保持。非compactの森は各ownerの原本樹種・growthとbig/lord倍率を保ち、成熟して実接続した木だけを枝で結ぶ。繰り返す巨大扇葉で若木を完成させず、galleryや床・利用を仮追加しない。原本GLB/kit/地形/橋素材は変更していない。

## 取得から育成の実操作

DEV限定`?water=wide&grow=1`で、合成残高から通常`place`価格・解放・generated IDを使って5品を実購入した。苗l28/l29、ベンチl30、白花l31、泉l32。90しずくを払い9320→9230、nextId28→33。予告も実ID/樹種/growth0を使い、取消と水上の無効配置では残高・時計・履歴を保つ。[8確認/27画面](runtime/report.json)。

明示した診断`advanceNature`で18時間だけ進めた。自然時間216→234、新苗growth0→18、白花0→6。学習/まち時間は進めず、元の27owner・住人・家8軒・73権利を保持した。初期27接近/22乾燥占有面、最終32接近/27乾燥占有面。5つの水ownerの中心を乾いた床とは数えない。初期・若い32・成熟32の全世界定義をgzipで保存した。本人の取得・保存、実18時間待ち、32軒への拡張の証明ではない。

## 対象と検証

target `http://127.0.0.1:5350/prototypes/place-qa/authored.html?water=wide&grow=1`、build `authored-whole-preflight-c2`、native明示true、renderer候補`native05-authored-whole-preflight-v1`。fixtureは元のwater-v2入力で、rendered candidateと区別する。desktop1280×900・phone390×844・tablet768×1024/reduced motion。source1578入力は開始/終了一致。headless Chromiumのviewportであり実機touchではない。[identityと照合](verification.json)。

[core](core/report.json)は597 files/5199 tests、型・lint・通常false build・asset予算がPASS、1878入力の開始/終了一致。原本GLB・世界・kit・橋を通常配布へ含めない。[配布境界](core/build-boundary.json)。既存の無効化されたauthored helper JS chunkは残る。

[元の編集](baseline-regression/report.json)6確認/7画面、[水庭の編集/収納/分離/再接続](water-regression/report.json)6確認/14画面、[既存Growingの本人保存/通常回答](legacy-regression/report.json)8旅程/22画面・40回答、[classic smoke](classic-smoke/report.json)32/32を同じapp入力へ照合した。既存Growingは5351のIsland=true DEV、actual native=true / legacy-world-v1 / native05-expanding-runtime-v2（起動env falseでもDEV有効）。coreのnormal production/native=false buildと区別し、既存Growingの保存/学習回帰を新authored世界の本人取得/保存へ流用しない。[初回FAILと修正](review.md)。

## 未達と次の制作

今回だけを単独で測ったbrowser初回15.1秒、購入予告9.1〜22.7秒。成熟後のfocus約20〜35秒、全景再mount約23〜33秒が残り、操作性能は未達。別Nodeのframe proof時間とbrowser時間を混ぜない。後続回帰の同時実行時間を性能比較に使わない。

次は[花庭・森・回廊の制作順](next-production.md)。花庭を『4株が支える主花1つ＋低い周辺花＋その下の生活』として、元のID/成長/地面/接近を保って全景の粗形から作る。殻の内空間、森の厚み、大樹の実内床/階段/galleryは後続。三配置・成長/利用/分離・16/32軒以上の地区拡張、本人保存/通常配布、性能、独立観察、実機、公開も未完。

[実装indexの照合](index-verification/implementation-index.json)では外部exportの1878 app入力が固定coreと一致し、生成索引・文書・index不変を検査した。[文書log](index-verification/docs-check.log.txt)。このproofのtreeはproof自身を追加する前のreviewed indexで、最終実装treeはGit反映後のidentity追補へ記す。生ログの末尾空行を保持するため空白検査は`core.whitespace=-blank-at-eof`を明示し、その他の標準空白エラーは検査した。

実装commitは`cbb35a468e93c10a494e4a88121c2dbd76ac9cdd`、最終treeは`529e7a740a0588acd29126ef78e4e51ec9c15c24`。[証拠を含む最終index](index-verification/implementation-final-index.json)のtreeと実commit treeが一致する。[最終文書log](index-verification/implementation-final-docs-check.log.txt)。このidentity追補は文書だけで、app/モデルの1878入力を変えない。
