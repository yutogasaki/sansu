# Blender MCP カニ制作試作

2026-10-18 / candidate `crab-mcp-trial-v1` / standalone source and browser viewer / application delivery flag: not applicable / base revision `eb4b907b` (dirty shared checkout).

目的は、MCP経由のBlenderで、生き物の造形→骨格→動き→GLB→ブラウザ表示までを短く試すこと。ふしぎ・愛着への制作仮説であり、ゲームの訪問条件や保存・学習には接続しない。親仕様・美術戦略・memoryの変更は不要。既存の未commit変更を保持し、本試作フォルダーと親タスクへの記録だけを追加した。

## 制作契約

| 参照 | 転用 | 転用しない |
| --- | --- | --- |
| 採用native-05全島 | 明るい昼、丸い立体、青い水、同系の石、斜め俯瞰 | 元のモデル・ぽこもこの変更、成熟島を本人の所有とすること |
| 紹介されたカニ制作事例 | 再生成するPython、骨格、短い動き、実ゲーム視点で確認 | 元のカニの造形・素材、53分や品質の再現という主張 |

動きは「気づく→横歩き→石の陰へ→浜辺へ戻る」。近接判定や逃走AIを実装したものではなく、ボタンで再生する約5秒の固定animation。今回の方向は既存美術に合わせた技術ラフ1案であり、美術候補3案の選定・採用工程ではない。

## 成果物

- [ブラウザ表示](index.html)：動きの再生、3ポーズ、スクラブ、近景切替。音なし。reduced motionは隠れる静止ポーズへ切替。
- [Blender原本](crab-trial.blend) / [GLB](crab-trial.glb)：12 bones、34 rigid-weighted parts。GLB約424 KiB。背景を含む11,424 triangles。
- [再制作スクリプト](build-crab.py) / [ポーズ描画](render-poses.py) / [実ブラウザ画像](browser-preview.png) / [3ポーズ比較](contact-sheet.jpg)。
- [入力hashとサイズ](artifact-manifest.json) / [モデル集計](model-report.json)。

ローカル表示はrepo rootから `python3 -m http.server 8248 --bind 127.0.0.1 --directory docs/design/2026-10-18-crab-mcp-trial`、URLは `http://127.0.0.1:8248/`。

## 確認と限界

2026-10-18 08:54 JST制作開始、検証集計日時はmanifestに記録。Blender 5.2.1 LTS / MCP addon 1.6 protocol 5 (server expected 13)。起動前は未接続、Blender起動後に旧protocolのfallbackで操作できた。addonの更新は行っていない。最初の制作はlocalized node名参照で失敗し、node type参照へ修正。ポーズ確認で石の屋根と目の重なりを見つけ、隙間を広げた。

- MCP `execute_blender_code`：形・rig・animation・保存・GLB exportが成功。
- Blender background `render-poses.py`：同じ原本の3フレームを再描画できた。
- esbuild bundle / `node --check viewer.js` / `npm run docs:check`：PASS。
- ローカル実ブラウザ1280×720：GLB読み込み、再生、戻り完了表示、3ポーズと実描画の差を確認。reduced motion・近景操作・phone/tabletは実操作検証していない。

美術：ラフ、採用benchmarkとの同画角比較・採点は未実施。理解/安全：独立観察N=0でHOLD。runtime：standalone表示のみで、本体統合・本体画角・実機性能・保存・PWAは未確認。アプリのsrc/publicを変更していないため本体の全検証を実施していない。硬い足の振り、接地の滑り、石との細部の接触は次段階の課題。再訪や子どもの理解の合格ではない。

元の制作事例と同じ工程を、この環境でも小さな素材で通せたことまでが今回の成果。次の一手は採用前にカニの造形と接地を評価し、本体の島の実画角で必要な大きさを判断すること。
