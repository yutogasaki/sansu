# 採用した3Dを、自分の島へ

2026-10-11。全島美術native-05の家・木・大きな葉・花弁・透ける殻を、原本の頂点と材質のまま本人のGrowingWorldへ接続した。画像生成や簡略な模型への作り直しは使わない。[実装契約](../../product/island-native-owned-art.md)が表示・所有・床の境界を定める。

[本人の島を開く](http://127.0.0.1:5198/#/island) · [採用した全島の原本](../2026-10-10-island-final-3d/README.md) · [小さな島から成熟までの美術](../2026-10-11-island-growth-art/README.md)

[全島・近景の比較](index.html) · [起動・実取得・学習への帰還](critical-path.html) · [三つの独立した判定](gate-review.json)

## 今回接続したもの

| 美術 | 実際の島での対応 |
|---|---|
| 丸い軒、厚い壁、色瓦の家 | 本人の家と取得した家。同じ所有ID、成熟段階、木陰/水辺の様式、保存した屋根色から描く |
| 垂れ葉・白樺・尖った樹種 | 所有する同じ苗のIDと成長から形を決める。若い苗に完成した共同樹冠を付けない |
| 青紫と翡翠の扇葉、琥珀の幹 | 実際に成熟した木の場所。空洞と回廊は所有した幹と通れる派生経路を対応させる |
| 巨大な花弁 | 所有する花の成熟と配置で、広がった屋根と通り抜けるアーチになる |
| 青紫を透かす殻 | 実際の水辺と家から成立する共同の場所。屋根の下に実床と入口を残す |
| 丸く曲がる岸、明るい海 | 原本の岸の曲線を外周に使う。全ての取得済みセルと床高を保ち、住人の足・配置hit・道・入口は同じ床を読む |

原本の人物と15軒の家は本人の保存へ取り込まない。既存のぽこもこと住人の頂点、UV、布を使い続ける。価格、取得、人口、学習、成熟の時計、保存版4は変更しない。

大樹のcourtでは、扇葉の縦横比を原本に保ち、実際の幹の上面へ枝を接続した。**courtの空洞本体と回廊は、実経路へ対応した既存の派生造形**で、原本の空洞幹meshそのものではない。原本の空洞幹はlane/clusterで使う。courtの幹の比例にも完成目標との差が残り、原本転写の完了へ数えない。

## 原本と配布

[kit-manifest.json](kit-manifest.json)に原本SHA、12部品の元mesh名・境界・mesh数・三角形数、配布SHAを残す。[圧縮部品](native05-owned-kit.glb.gz)は5,072,476 bytesのGLBを2,554,378 bytesへgzip化したもの。228,960 triangles。元bufferと材質は損失なく転写し、geometryを共有する。保存した屋根色や移動previewの材質だけ個別に複製する。

配布kitは3 MiB以内、SW precache全体は従来の12 MiB以内とする。読み込み時にSHAを照合し、破損・context lossの再試行で本人の保存を変えない。有効な固定buildだけkitをprecacheし、通常productionの既定は `VITE_NATIVE_GROWING_ART=false`。DEVと明示した専用buildはtrue。美術確認の大きな全島GLBは通常の所有島へ配布しない。

## 到達と残る大形

この接続で、完成模型の形と材質が同じ所有物の成熟・配置・移動に対応する。原本の全島と同じ完成景になったとは扱わない。取得済み矩形の床を守る現在の方式では、**深い入り江を島へ切り込む形、高い鉱石の三段泉、地区ごとの密度と地面の余白**に差が残る。ここは小物を追加して済ませず、次の地形・実床の対応設計で扱う。

最新A6の390/768実画面を原本と比較した作者の美術評価は**41/60、HOLD**。内訳は入ってみたい7、相棒への愛着7、素材8、構図と奥行き5、焦点色8、出来事と結果6。元のキャラクターと素材は残ったが、全景の小さい人物、平たい大面積、地区の縁と前後の層、courtの幹に差がある。これは作者の画像評価で、独立観察や利用者の採用ではない。cold-openの52/60をこの島の実測値へ流用しない。

旧本体v3の `HOLD_USER_REJECTED_NATIVE05_GAP` は維持する。新しい本人島も利用者の採用、独立した子どもの無説明理解・安全、実機を技術検査から推定しない。美術、独立観察、runtimeを別々に記録する。

## 検証記録

最終固定版は `native05-owned-runtime-v1-a6:adcc5b46-df3a-4870-b18d-7f555a537252`、描画候補は `native05-owned-runtime-v1`、対象は [固定production preview](http://127.0.0.1:5316/#/island)。`VITE_NATIVE_GROWING_ART=true`、美術模型のflagはfalse。[source-correspondence.json](source-correspondence.json)でapp/QAの開始終了、固定buildの入力、配布物SHAを照合した。最終文書だけの更新はこのapp入力を変えない。

| 検査 | 最終A6の結果・原証拠 |
|---|---|
| core | 566 files / 4,984 tests。docs/current-entry/lint/typecheck/build/assets PASS。[ログ](verification-logs/core-a6.txt)。既存lint警告1件・文書期限警告12件は残る |
| 実取得 | 390/768/320幅の3旅程、各21回答・苗2つの通常取得・任意の6目標・接続/分離/再接続・同じ学習予約へ帰還。fixture書込・時計注入なし。[74画面とreport](verification-a6/report.json)、[通常旅程24画面](critical-path.html) |
| 明示成熟 | 同じpackの20配置×390/768幅＝40組。P01〜P05実利用、P06のぽこもこ/住人、元の成熟所有物の収納/再接続と履歴保持。[全画面](verification-a6/contact-sheet.html)。成熟・残高・人口は明示診断で、実時間18時間/7日成熟を証明しない |
| 故障復帰 | 両幅で破損kit拒否/再試行・実WebGL context loss/再試行/再読込、1 canvas、所有/学習不変。[report](faults-a6/report.json)。この故障診断だけSWをblock |
| 実SW更新 | 両幅×通常/worker更新中断の4ケース、18画面。OLD→NEW、NEWのkit cache/offline、同じ学習予約の続き、安全なROLLBACK/offlineを確認。[report](update-a6/report.json)。今回は保存4→4の美術flag切替で、3→4migration検査とは別 |
| 配布境界 | NEWはkitをprecacheし144 files / 10.73 MiB、12 MiB以内。falseのOLD/ROLLBACKはkitと全島/小さな島/育ち途中のGLBを含めず、143 files / 8.20 MiB。[3つの独立build](build-boundaries.json)、[入力とdist](verification-a6-manifests/new.json) |

実機、独立した子どもの理解/安全・再訪は未評価。学習loopのsourceを変更しておらず、P95/fixed-tenの全製品release合格を新しく認定しない。技術はこの範囲でPASS、美術はHOLD、独立観察はN=0を維持する。

## 途中の記録を残す

[最初のA5旅程](verification/report.json)は本を閉じた次frameのfocus復帰を早く判定してFAIL。[次のA5旅程](verification-final/report.json)は通常取得3件が通った後、成熟苗の床位置へのtapが前のbenchを選びFAIL。frame待ちと、見える幹の位置/対象sheetの確認をharnessへ加え、元のFAILを保持した。[A5の成熟40組](verification-mature/report.json)はPASSだが最後の扇葉/幹接続修正前なのでA6の証拠へ繰り上げない。[旧build境界](history/a5/build-boundaries.json)もその版のまま残す。

DEV診断は [whole-dev-01](diagnostics/whole-dev-01/report.json) と [whole-dev-02](diagnostics/whole-dev-02/report.json)。最初はsoftware rendererの実利用時間切れ、次はChromeで実際のぽこもこと住人の利用を確認した。どちらも最終camera修正前の画面なので、最終の美術・production検証へ流用しない。[court-dev-03](diagnostics/court-dev-03/report.json)は扇葉の比例と幹への接続を直した後の短い診断で、最終の取得・更新検査を代替しない。
