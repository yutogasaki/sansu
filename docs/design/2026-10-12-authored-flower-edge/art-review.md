# 花庭の枝先と席の縁：c6実画面評価

2026-10-12、制作経緯を知るエージェントによる内部評価。**36/60・美術HOLD**。最終の12実画面を確認した結果で、c6-shapeの2枚による暫定評価を全旅程の受入へ読み替えたものではない。独立した理解／安全の観察は **N=0**。全島M1と美術の包括受入は未完である。

採用目標は[native05原本の全景](../2026-10-10-island-final-3d/whole-island-render.png)。[前候補の近景](../2026-10-11-authored-flower-garden/runtime-c4/desktop-flower-close-day.png)と[全景](../2026-10-11-authored-flower-garden/runtime-c4/desktop-mature-whole-day.png)、[今回の比較と全12枚](contact-sheet.html)を画像として比較した。前候補と今回の成熟画面は同じ合成32所有物／8軒の入力を使う。採用原本は所有数・構図・照明が異なる完成目標であり、同一条件のpixel比較ではない。

## 評価対象と実画面の識別

| 項目 | 確認値 |
| --- | --- |
| 実target | `http://127.0.0.1:5353/prototypes/place-qa/authored.html?water=wide&reference=preflight32` |
| build revision | `authored-flower-edge-c6` |
| visual candidate | `native05-authored-flower-garden-v3` |
| 配布条件 | DEV authored診断。`VITE_ISLAND_ENABLED=true`、全12枚の実rootは`nativeGrowingArt=true`、`growingFeatureEnabled=true`。通常buildのnative artはfalse |
| 実renderer | 本体のGrowingWorld。単独のasset viewerではないが、通常製品の起動・学習・本人保存の経路ではない |
| world definition | `native05-authored-world-m0-v2` |
| 原本source SHA-256 | `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` |
| 花庭support | `native05-owned-flower-support-v1` |
| 固定入力 | 保存された合成32所有物／8軒。`mature-32.frame.json`のstate hashは`0593897ea073f817fbdee7f445491ccde12b9e2c083542aa19d320454c40cd2a` |
| browser／cache | ローカルの新規headless browser context。service worker・offline・更新経路は未検査 |
| 一次証拠 | [実manifestを含むreport](runtime-c6/report.json)、[sourceと画像の照合](runtime-c6-proof.json) |

全12枚のbuild、candidate、delivery属性は一致している。原本sourceとruntime入力のhashは別の識別値である。runtimeの開始／終了入力hashはともに`e26e7d77e8d9050b5fc54b4a7b64887d3b832086501421f497dbe7c2cf80dcec`。

## 六軸の評価

以下の各点は **candidate `native05-authored-flower-garden-v3`／2026-10-12／証拠種別：実runtime PNG／確信度：中**。viewportは各行のリンクと次表で特定する。コード・テスト・到達可能性を美術の加点に使わない。

| 六軸 | 点／10 | 実画面での判断と主な証拠 |
| --- | --- | --- |
| 入りたくなる世界 | 6 | 大きな一輪と、その下から席へ伸びる植物の関係は現れた。原本のように森・家・道・入り江が連続する生活空間には届かず、中央と右の斜面が広く空く。[全景1280×900](runtime-c6/desktop-mature-whole-day.png)、[全景390×844](runtime-c6/390-mature-whole-day.png) |
| キャラクターへの愛着 | 7 | 人物と家の尺度は安定し、近景では住人の違いが見える。全景では顔や住人同士の関係が小さく、今回の葉の変更による新たな演技は確認できない。[近景1280×900](runtime-c6/desktop-flower-close-day.png)、[近景768×1024](runtime-c6/768-flower-close-day.png) |
| 素材の触感 | 6 | 株上端の葉が露出した端を覆い、枝先も植物としてつながった。淡い平面の葉と細長い枝がまだ支柱の印象を残し、葉の厚み・重なり・陰影は原本より弱い。[近景1280×900](runtime-c6/desktop-flower-close-day.png)、[回転近景1280×900](runtime-c6/desktop-rotated-flower-close-day.png) |
| 構図と奥行き | 5 | 席の上の小さな庇は回転時にもつながる。一方で直列の株、長い枝、中央の空白、前面の大きな紫殻が目立ち、殻の内側や家を見通す構図が弱い。[全景1280×900](runtime-c6/desktop-mature-whole-day.png)、[回転全景1280×900](runtime-c6/desktop-rotated-whole-day.png) |
| 色の楽しさと焦点 | 6 | 一輪と低い四色の花は読める。虹色の高い板列、紫殻、角張った白い道が主花と競合し、小画面では追加葉が地面の色に溶ける。[全景768×1024](runtime-c6/768-mature-whole-day.png)、[近景390×844](runtime-c6/390-flower-close-day.png) |
| 出来事と見返り | 6 | 席へ伸びた枝と葉により「花のそばで休む場所」が前候補より見える。young／分離／再接続で共有冠の有無も読める。ただし席は植物の塊の外側にあり、花庭の内側で暮らす見返りは弱い。[回転近景1280×900](runtime-c6/desktop-rotated-flower-close-day.png)、[分離](runtime-c6/desktop-flower-split-whole-day.png)、[再接続](runtime-c6/desktop-flower-reconnected-whole-day.png) |

六軸すべてが8点未満である。前候補の35/60からは、席へ向かう葉の庇が見えることで「出来事と見返り」を1点上げた。c5の暫定36/60からは据え置く。株上端と席の葉の接続は改善したが、全景・回転・小画面で主要な構図と植物の面の不足が残るためである。

## 確認した12実画面

| viewport | 画面 | 見えたこと |
| --- | --- | --- |
| 1280×900 | [成熟全景](runtime-c6/desktop-mature-whole-day.png) | 主花は読めるが、紫殻の占有と中央の空白が強い |
| 1280×900 | [花庭近景](runtime-c6/desktop-flower-close-day.png) | 株上端の葉と、実席へ伸びる枝の接続が改善 |
| 1280×900 | [分離全景](runtime-c6/desktop-flower-split-whole-day.png) | 共有冠と虹色の関係部分が消え、残る3株と低い単独花の差が見える |
| 1280×900 | [再接続全景](runtime-c6/desktop-flower-reconnected-whole-day.png) | 主花と関係部分が戻る。成熟全景と同じ造形へ戻ったことを視認 |
| 1280×900 | [回転全景](runtime-c6/desktop-rotated-whole-day.png) | 直列の株・枝と、殻の大きな面が別角度でも目立つ |
| 1280×900 | [回転花庭近景](runtime-c6/desktop-rotated-flower-close-day.png) | 席上の葉の重なりは見えるが、小さな庇にとどまる |
| 768×1024 | [成熟全景](runtime-c6/768-mature-whole-day.png) | 大きな色面が優先され、花庭の内部は小さい |
| 768×1024 | [花庭近景](runtime-c6/768-flower-close-day.png) | 主花・葉・席の位置関係は残るが、細い枝の間が空く |
| 390×844 | [成熟全景](runtime-c6/390-mature-whole-day.png) | 主花は識別できる。追加葉や住人の暮らしは全島の縮尺で弱くなる |
| 390×844 | [花庭近景](runtime-c6/390-flower-close-day.png) | 席の場所は残るが、葉の面が地面と同化し囲まれた場所に見えにくい |
| 1280×900 | [young全景](runtime-c6/desktop-young-whole-day.png) | 共有冠のない状態の差は明確。若い状態の庭としてのまとまりは薄い |
| 1280×900 | [young花庭近景](runtime-c6/desktop-young-flower-close-day.png) | 3株と単独の低い花が見え、成長前後の高さ・量の連続性が課題として残る |

静止画は住人が実際に着席して立ち去った証拠ではない。席への造形上の接続と、実rigによる利用の検証は分けて扱う。

## 残る美術上の限界

葉の向きと取り付けは直ったが、主花から席までの間を細い長い枝が占めている。席は花庭の縁に近づいたものの、植物に包まれた内側の場所にはなっていない。淡い葉の面も全景と390幅では弱く、さらに葉を数枚増やすだけでは原本との構図の差を縮めにくい。

全島では紫殻が前面を塞ぎ、その内側の家・遊び場・入り江が見えにくい。森の厚み、大樹の実内床とgallery、道の曲がりと家のまとまりが不足する。次のM1工程は[次の制作](next-production.md)に従い、P04の実入口・床・中庭と殻の関係を造形し、同じ入力の全景と回転画面で判断する。これは次工程の方針であり、その未撮影成果への承認ではない。

分離した成熟花が低い単独花へ戻る一方、残る成熟群は高い株を保つ。画像上の成長・単独／群の連続性は未解決として残す。今回の葉・席の改善で、三配置、成長の造形連続性、16／32軒以上への拡張まで完成したとは扱わない。

## 三つの判断を分ける

| 判断 | 結果 | 証拠と範囲 |
| --- | --- | --- |
| 美術 | **HOLD：36/60** | 上記12PNGの内部評価。原本に届かず、全島M1の美術受入は未完 |
| 独立理解／安全 | **NOT_EVALUATED：N=0** | 独立観察の逐語回答はない。制作意図を知るエージェントの見え方や実rig検査を、児童の理解・安全・再訪意欲の観察数へ含めない |
| 固定DEV旅程のruntime | **PASS** | [生report](runtime-c6/report.json)は12captures、4canvas selections、4edits、errorsなし。予告取消・分離・収納・再接続を記録 |
| 製品全体のruntime受入 | **PARTIAL** | 新取得、本人保存、実機性能、offline／更新、製品の全経路、最終全島は今回の証拠の範囲外 |

[照合証拠](runtime-c6-proof.json)ではruntimeの1,888入力が固定coreの1,987入力の該当subsetと一致し、両検証内の入力変更はない。アーカイブ時の作業ツリーとの差分も空である。これは範囲を定めた一致であり、二つの検証が同じ全入力集合を使った、あるいは別作業を含む現在以降の全ツリーを保証した、という意味ではない。

実reportの各captureはlive pose検査を記録し、退避・配置不能は0、全ownerの到達可能な接近位置を確認している。歩行に関するこの固定状態の検査は、実席の利用を画像で確認したことや、独立した安全観察の代わりにはしない。headless診断の待ち時間も実機FPSや性能合格へ読み替えない。

