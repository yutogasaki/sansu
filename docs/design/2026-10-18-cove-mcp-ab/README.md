# 既存の入り江をMCPで修正するA/B試験

2026-10-18 / candidate `cove-mcp-roof-v1` / 30分上限の独立した制作診断。目的は、既存素材の一部をBlenderで修正し、同じ本体rendererで差を判断できるか確かめること。ふしぎ・愛着のための場所の形を対象とし、経済・学習・所有の変更はしない。

## 比較と判定

[比較ページ](index.html) / [近景比較](comparison-near.jpg) / [全景比較](comparison-whole.jpg) / [小画面比較](comparison-phone.jpg)。実体は `GrowingWorld` を使う `/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner`。通常の `/#/island`、本人の取得・保存、固定production buildの証拠ではない。

| 項目 | 判定と範囲 |
| --- | --- |
| 制作工程 | 部分編集→GLB→hash更新→本体rendererのDEV診断表示まで通過。MCPのfile-open直後のcontext問題があり、同じ変更の最終再生成はbackground Blenderで行った。MCPだけの完全自動完結とはしない |
| 作者による美術評価 | HOLD。近景の天井高は読めるが、オレンジ色の隣家屋根との投影上の余白が減る。全景・390幅の効果は小さい。採用済み全島に対する改善とは認定しない |
| 理解・安全 | 独立観察N=0。無説明理解や安全の合格にしない |
| runtime | GLBとDOMの実source SHA一致、同camera、同所有・成熟、物理worldの一致を確認。実歩行の全旅程、本人保存、PWA、実機FPS、通常配布は未確認 |

この1案が示したのは、既存アセットを修正して現在のrendererへ返す方法が使えること。道具をつないだだけで美術判断や構図が解決するわけではない。今回は形の比較1回で終了し、別案を自動制作しない。

## 変更の契約

参照は `2026-10-12-authored-cove-entrance/cove-corner-v3.blend` と同GLB。転用するのは元の殻・リブ・4材質・位置・尺度。転用しないのは固定模型を本人の所有と見立てること、原本の採用を派生形へ引き継ぐこと。

元source Zが2.90以下の点を固定し、上部だけに滑らかな上向き変位を加える。最大source .90、world .405。水平方向は固定。曲線をmesh化し、同じ変位を殻・リブへ適用する。床や入口の開口を拡張する変更ではない。方向選定前の3案制作や、全島美術の採用工程を代替しない。

`serve-ab.mjs` が元のVite設定を使い、診断プロセス内だけで3つのJSON importと殻の配信レスポンスを差し替える。`src/`、`public/`、元のGLB・blend・manifestを書き換えない。比較元・候補のbuild revisionは `mcp-cove-ab-baseline-v1` / `mcp-cove-ab-variant-v1`。Island/LifeはON、候補markerは `native05-authored-cove-shore-v4+mcp-roof-v1`。実source hashとcamera・viewportは各metadataを参照。PWAの配布切替flagは該当しない。

## 検証記録

- [source audit](source-audit.json)：元のblend/GLB/3manifestのSHA保持。18 nodes・19 primitives・79,384 triangles・4材質を維持。
- [asset check](asset-check.json)：出力GLBから全primitiveを比較。25,444点の下部を許容差2e-6以内で保持し、水平方向の差は0。上部18,445点が上昇。材質JSONは完全一致。三角形数は軽量化していない。
- [domain check](domain-check.json) / [field comparison](world-field-comparison.json)：同じ入力状態から両profileでworldを再構成。出自revisionだけが異なり、districts・床・sites・edges等の物理内容のhashは一致。
- [desktop metadata](browser-metadata.json)：1280×720、昼、選択p9の同camera。両版のshell source SHAを実DOMで確認し、歩行候補・ownerAccessの投影は一致。
- [before phone](before-phone-metadata.json) / [after phone](after-phone-metadata.json)：390×844、同じ近景・ページ先頭。実端末ではなくブラウザのviewport変更。
- esbuildで使うNodeスクリプトの構文確認と `npm run docs:check` を実行。アプリ本体を変更していないためcore・build・PWAの全検証は追加しない。チェックの完了結果は[verification](verification.json)に保存。

32所有物、land、town、nature、学習等は同じ。各画面の自律actorは動き続けるため、`applied`の自律利用UUIDと`placeProgress`の利用履歴は一致しない。これを黙って除外して「state全体が不変」とは報告しない。同じ固定入力によるdomain比較を別途行い、実利用履歴の保存互換検証とは区別した。

## 初回失敗と補正

1. GUIのMCP callback内で `open_mainfile` の後に旧contextを使うと `selected_objects` / GLTF exporterの `active_object` が欠けた。別callbackでexportは通ったが、分割実行の `audit` 変数が失われた。同じ変更をbackground Blenderで再生成して全成果物を揃えた。これは工程上の制限として残す。
2. 最初のdomain比較はsourceを含むtop-level `revision` まで完全一致を要求して失敗。差をfieldごとに記録し、唯一の差がrevisionであることと、残る全内容のhash一致を検査した。物理差を無視した合格ではない。
3. 390幅で対象ボタンにfocusするとページがscrollし、殻が画像上部から外れた。Homeキーで先頭へ戻し、同viewport/camera/scrollを記録した。初回の読み込み直後のclickもCDP待ちでtimeoutし、描画後の同じ操作で撮影した。

## 再現

repo rootから：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python docs/design/2026-10-18-cove-mcp-ab/build-variant.py
node docs/design/2026-10-18-cove-mcp-ab/serve-ab.mjs
node docs/design/2026-10-18-cove-mcp-ab/serve-ab.mjs --variant
node docs/design/2026-10-18-cove-mcp-ab/check-domain.mjs
python3 docs/design/2026-10-18-cove-mcp-ab/check-assets.py
```

serverは別terminal。比較ページは `http://127.0.0.1:8251/docs/design/2026-10-18-cove-mcp-ab/`。`browser-metadata.json`は今回採取した合成入力の記録。新しいブラウザでの撮影は自律利用履歴まで一致しない。

製品仕様・運用規則の変更ではないため親仕様・memory・ADRの更新は不要。親タスクに試験の所在だけを記録し、既存のR2採用待ち・R3以降の優先順位を変更しない。
