# 原本床の法線・材質を保持する候補

2026-10-12。**固定c1で原本抽出・物理データの同一性と、実画面5組のA/Bを確認。全島美術はHOLD。** [元の監査](../2026-10-12-authored-whole-massing/floor-normal-audit/README.md)を受け、床を同じまま原本NORMALとroughness／metalness／両面性を保持した。分離作業コピーで準備した変更は[肩の候補c1](../2026-10-12-authored-shoulder-runtime/README.md)へ取り込み、固定した入り江c4は変更していない。

[新しいworld](native05-world.json.gz)は10床／50,180頂点の法線を保持する。[物理比較](physical-parity.json)では追加した描画属性と描画revisionだけを除くと、元のWorldDefinitionと全項目が一致した。89,488三角形、73配置地点、全歩行点／辺／地区／原本SHAを保持する。これは抽出データの結果で、切削後の陰影や実画面の評価ではない。

[抽出時のmanifest](world-manifest.json)に原本と実行入力のSHA、新gzip／展開後のSHAを保持する。[実行したextractor](source-extractor.mjs)は分離コピーの `tools/build-authored-island-world.mjs` と同byte。[stdout](source-extraction.log.txt)は実行toolが返した出力を同じ改行で保存したもので、独立したterminal logのコピーではない。exit 0 を確認した。[archive manifest](archive-manifest.json)に保存時のSHAと、保存用heredocが実行前に文字コードエラーとなった最初の記録も残す。入力は固定c4から作った次工程のコードコピーであり、未実行のcoreをPASSとは扱わない。

描画側は元法線を読み、水切削の新頂点へ線形補間する。新しい水底・岸へ原本草地の法線をコピーせず、属性なしの既存床は再計算と現在の材質を保つ。法線の修正で床・indices・権利・通行を変えず、殻の物理profileはcell／point／三角形を照合する。描画cacheは新revisionを使う。[全樹木guardと組み合わせた草稿検査](focused-draft/README.md)は10 files／94 tests、対象eslint error 0でPASS。その後の固定c1のcoreは610 files／5,296 tests、typecheck／buildまで通過した。

## 同じ32所有物の実画面A/B

[生report](../2026-10-12-authored-shoulder-runtime/c1/regressions/01-floor-shading-ab/actual/report.json)は1280×900の全景・回転・l14近景、390×844と768×1024の全景をlegacy/sourceで各1枚、計10枚／5組。肩を無効にした同じ32所有物・73権利・昼・reduced motionで、camera、所有・成熟・時計、物理的な歩行／全owner接近、app versionの一致を確認した。実versionは `authored-shoulder-c1:3fd164b9-6f32-4502-9ca5-dde6c5c1cbd7`、明示DEVのnative／coveはtrue、通常配布native=false、fresh contextでSW登録／制御なし。人物の時間に応じた描画位置は同一に固定しておらず、画像のpixel一致試験ではない。

[原記録13ファイルの保存証明](../2026-10-12-authored-shoulder-runtime/c1/regressions/01-floor-shading-ab/archive-proof.json)は9,064,759 bytesをbyte同一で保持。driverの1,909入力はcoreの6,398入力と同byteのsubset、外側runnerは全sourceと6つのinstalled dependencyの前後一致を確認した。

作者が5組を視認した。[近景legacy](../2026-10-12-authored-shoulder-runtime/c1/regressions/01-floor-shading-ab/actual/1280-hill-close-legacy.png)と[近景source](../2026-10-12-authored-shoulder-runtime/c1/regressions/01-floor-shading-ab/actual/1280-hill-close-source.png)では、中央丘の三角形状の濃い縞が弱まり、面が滑らかになった。一方で細い点線状の境界は残る。陰影の全原因を解消したとはしない。スマートフォン幅での差は小さく、薄い森・中央と右の空白・角張った道・768幅の大きい海の余白も変わらない。

これは描画属性の比較であり、肩の35所有物の美術・取得・編集結果とは分ける。全島の森林構図、独立理解／安全N=0、M1と包括ゴールは継続する。


## c2で細い線の原因を分ける

全8回帰を通過した固定c2へ、アプリのファイルを変更しない[実rendererの診断](c2-causal-diagnostic/index.html)を行った。同じ32所有物・l14近景・1280×900で、床だけが影を受けない設定にすると大きな影は消えたが、細い点線状の境界は残った。続いて同じ床を照明の影響を受けない材質へ一時変更すると、その線は見えなくなった。カメラ・光・geometry・normal・color・indices・物理状態と歩行は各比較内で不変だった。

この結果は線がlit shadingに依存することを示すが、法線のみが原因と断定しない。照明のない表示を修正として採用せず、法線や材質の境目を調べる。各診断後、元のmaterial・shadow flag・Scene hookを復元し、一時material2個を破棄した。6,460 local入力・6 installed依存・driver/browser依存は前後一致。[34 filesの原記録](c2-causal-diagnostic/archive-proof.json)は圧縮を展開したbyteまで同一で保存。47.713秒／52.799秒は診断の実行時間で、製品性能ではない。美術HOLD・独立理解N=0・M1未完を維持する。

[静的な追跡](c2-causal-diagnostic/static-normal-audit/README.md.txt)では、細線の一部に対応する急な尾根の細長い三角形を特定した。source床だけのrayでは、面法線がカメラへ向く一方、補間された原本法線は逆向きとなる。対象部分の共有辺で法線断裂は見つからず、元床のPBR設定も共通だった。これは一部の線に対する候補原因であり、全細線や実rendererの原因確定ではない。[8 filesの保存証明](c2-causal-diagnostic/static-normal-audit/archive-proof.json)と[対象座標・入力SHA](c2-causal-diagnostic/static-normal-audit/candidate-cause.json)を保持する。次の診断は実bufferの対応座標を先に照合し、小領域の陰影用法線だけを一時変更して復元する。床形状や歩行は変更しない。

現在配置された水庭によるruntime切削と、原本にすでに彫られた水路は区別する。対象点を抽出時のscale／originで原本へ戻すと、native lower flowの近くになる。原本の[地形生成](../2026-10-10-island-final-3d/mature-island.py)は細分化した地形全体へsmooth shadingを設定し、[水庭の制作](../2026-10-10-island-final-3d/varied-world.py)は水路付近を追加細分化して頂点を彫っている。現在のruntime水庭が別位置であることは、原本の水路制作と無関係である証拠にはならない。

その後の[実rendererの小領域比較](c2-causal-diagnostic/roi-review.html)では、実bufferと原本の2三角形を照合した上で、対象域だけ陰影用法線を面法線へ一時変更し、元へ戻した。同じ近景の対象域では110画素が変わり、復元後は差分0だった。作者の視認では細線のごく一部の濃淡だけが変わり、細線全体は残る。局所の法線応答は確認したが、修正を採用せず、原因全体の解消とも扱わない。[作者の判定・元PNGのSHA・画素比較](c2-causal-diagnostic/roi-root-review.json)を残す。

最初の試行はprojectionの`-0`と`0`の比較でcapture前に停止し、原値を残して符号付きゼロのみを正規化した2回目は3枚と不変照合を取得した。ただし2回目も最終エラー検査は`favicon.ico`の404で**FAIL**。除外や再ラベルはしていない。[原記録45 files](../2026-10-12-authored-shoulder-runtime/c2/floor-diagnostic/roi-attempt-02/README.md)はその失敗も保持する。camera／geometry／normal buffer／材質復元／歩行不変の限定証拠と実行全体のFAILを区別する。製品美術HOLD・独立観察N=0を維持する。
