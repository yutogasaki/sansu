# Meshy → Blender 素材制作ルーチン

承認された元画像から、予算内で各素材1回だけ生成し、raw保存、Blender調整、GLBの再読込検証、比較ページまで進める。ゲームへの組込み・公開は別作業。元画像の構想と見た目の判断はCodexが担当し、予算・記録・調整・検証をスクリプトで扱う。

## 構成

- `tools/asset-pipeline/pipeline.py`: ロック・永続予約・画像hash・タスク状態・GLB検査。
- `tools/asset-pipeline/run_batch.mjs`: Meshy MCPからBlenderまでの再開可能な実行器。
- `tools/asset-pipeline/codex_bridge.mjs`: Codexのtoolsオブジェクトへの接続。APIキーの読取りや独自HTTPは行わない。
- `tools/asset-pipeline/blender_process.py`: Blender内で実行する無課金の調整・検証。
- `tools/asset-pipeline/gallery.py`: 元画像、正面、背面、底面を並べたHTMLと各素材のmanifestを出力。Pillowがあれば比較JPEGも作る。

保存先は `assets/<一意な素材ID>/source/`、`meshy_raw/`、`final/`、`manifest.json`。バッチのrecipe・state・残高証跡・一覧は `assets/pipeline/<バッチID>/`。同じ素材IDで既存GLBを上書きする新規バッチは拒否する。新しいデザインには新しいversionを付ける。

## 制作前

1. ユーザーが対象・総予算を承認していることを確認する。承認額はバッチのrecipeへ記録し、他バッチへ持ち越さない。木・岩・ベンチ90と庭小屋・花壇・街灯90は消費済み。2026-09-20の道と庭9点は、ユーザーが当初90から合計270へ上限を更新した別バッチ。
2. Meshy残高とBlender MCP接続を読み取り確認する。新バッチでは現在のMCP料金説明を確認し、固定30クレジットpresetと異なる場合は実行しない。
3. 既存の世界観を参考にbuilt-in image_genで元画像を作り、単体・白背景・全体が入った斜め前の構図にする。画像生成はMeshyのクレジット枠とは別の機能。入力品質の判断を省かない。
4. 画像とpromptを保存し、recipeにID、目標高さ、目標三角形数を記録する。今回のrecipeは `assets/pipeline/island-props-v1/recipe.json`。
5. 料金固定presetはMeshy 7 standard、PBRあり、2K、GLB、ultraなし。別リメッシュ・再テクスチャ・変換・リグ・購入・自動チャージを呼ぶ機能は作らない。

## 初期化と再開

生成前後の棚卸しは `python3 tools/asset-pipeline/inventory.py > /tmp/island-assets.json`。全バッチの予約・記録上の消費・残高照合、元画像/raw/finalの実ファイルhash、往復検証と軽量版の入力から出力までのhashを検査する。破損・古い検証は終了コード1。未生成・未レビュー・未軽量化は別状態で出力し、制作状態を書き換えたり課金したりしない。対象は `assets/pipeline/*/state.json` に登録された素材で、旧単発コテージは含まない。ファイル検証成功はゲーム採用・実機性能の承認ではない。

以下はリポジトリルートから実行する。既存stateへのinitは失敗するため、再開時はshowまたは実行器を使う。

```bash
python3 tools/asset-pipeline/pipeline.py init --recipe assets/pipeline/NEW_BATCH/recipe.json --state assets/pipeline/NEW_BATCH/state.json --root .
python3 tools/asset-pipeline/pipeline.py show --state assets/pipeline/island-props-v1/state.json
```

MCP実行はCodexの `functions.exec` 内で、実行器とbridgeを読み込む。下記のroot、statePathはそのバッチの絶対パスにする。通常のNode単体には `tools` がないため、このコードはCodexホスト用。

```javascript
const root = '/Users/yutogasaki/Projects/sansu';
const paths = ['codex_bridge.mjs', 'run_batch.mjs'];
const modules = [];
for (const file of paths) {
  const result = await tools.exec_command({
    cmd: `cat '${root}/tools/asset-pipeline/${file}'`, max_output_tokens: 10000,
  });
  if (result.exit_code !== 0) throw new Error(result.output);
  modules.push(result.output.replace(/^export /gm, ''));
}
const run = eval(`(async (tools) => {
  ${modules.join('\n')}
  const bridge = createCodexBridge(tools, {
    userPrompt: 'ユーザーの今回の指示をそのまま記載する',
    onProgress: async message => { notify(message); await yield_control(); },
  });
  return runBatch(bridge, {
    root: ${JSON.stringify(root)},
    statePath: ${JSON.stringify(root + '/assets/pipeline/island-props-v1/state.json')},
    maxPolls: 1,
    allowGeneration: false,
  });
})`);
text(await run(tools));
```

`allowGeneration`は既定false。新規生成は、そのバッチについて予算承認・残高・接続・元画像を確認した後だけtrueにする。完了済み素材はローカルのhash検証だけ行う。待機が終わらなければ同じstateで再実行する。タスクIDがある素材は決して再生成しない。

`reserve`は画像hashを検査して、30クレジットを**送信前**に永続予約する。排他ロック、atomic replace、ファイルとディレクトリのfsyncを使う。課金リクエストには自動retryをかけない。送信失敗・結果不明は `SUBMISSION_UNCERTAIN` のまま停止する。Meshy側の履歴を確認し、既存のIDを `attach --payload` で登録して復旧する。タスクを特定できない場合は停止を維持する。FAILEDや返金でも自動で予約を解放せず、再生成しない。

ダウンロード途中の壊れたファイルも勝手に成功扱いせず、GLB検査で止める。問題を報告して、その同じタスクからの無料再ダウンロードで復旧する。paid toolを増やす代替はしない。

## Blender調整

自動処理は別シーンにrawを読み込み、指定高さへ等比変換、底面中央原点、座標変換の焼込み、元のUV・カスタム法線・PBR保持を行う。選択物かつ現在シーンのみをGLBへ書き出す。不要な既存シーンのCubeや照明を含めない。Blender 5.2のdynamic enumはexporter側の形式一覧から確認する。

元画像との向きが違う場合は、ローカル調整を記録して同じrawから再処理する。Meshyクレジットは使わない。

```bash
python3 tools/asset-pipeline/pipeline.py adjust --state assets/pipeline/island-props-v1/state.json --asset island-rock-v1 --payload assets/island-rock-v1/final/adjustment.json
```

許可する調整は `yaw_degrees` と `target_height` のみ。adjust後に実行器を再開する。あるいはBlender MCPのexecute_blender_codeで次を実行する。

```python
import runpy
process_asset = runpy.run_path('/Users/yutogasaki/Projects/sansu/tools/asset-pipeline/blender_process.py')['process']
process_asset(
    '/Users/yutogasaki/Projects/sansu/assets/pipeline/island-props-v1/state.json',
    'island-rock-v1',
)
```

Blender変更後はget_scene_infoとget_viewport_screenshotで確認する。自動再処理は旧検査シーンを削除しないため、同じ素材の検査シーンが増える場合がある。最終GLBに余分なシーンが含まれないことは別途検査する。

## 完了条件

2026-09-19の庭小屋組込み検証: `npm run dev:island-runtime-assets` で5250を起動後、`HUT_RUNTIME_OUTPUT=output/playwright/hut-runtime-new node tools/asset-pipeline/verify-hut-runtime.mjs`。隔離ブラウザーの合成creditと実commandLife購入を使い、ベンチ→小屋へのUI呼出し、道具利用、保存保持、GLB障害時のfallback、学習復帰を390/768pxで検査する。自然獲得・実機・本番公開の検証ではない。詳細は [庭小屋のLifeWorld接続](../design/2026-09-19-hut-runtime/README.md)。

- GLB header・面数・埋込みPBR・raw非変更・余分なnodeなし。
- 高さ・底面・原点と、書き出しGLB再インポートの寸法・面数が一致。
- 同一照明の再レンダーの平均絶対差が0–1で0.002未満。
- rawとfinalの埋込み画像hashが一致。検証JSONはraw/finalのファイルhashに結び付ける。
- 前後・側面・底面を目視し、元画像との差を `final/review.json` に記録する。
- 全タスクの実消費と前後残高を照合し、`balance.json`へ記録する。

```bash
python3 tools/asset-pipeline/gallery.py assets/pipeline/island-props-v1/state.json
python3 -m unittest discover -s tools/asset-pipeline -p 'test_*.py' -v
npx vitest run tools/asset-pipeline/run_batch.test.mjs
npm run docs:check
```

技術検証、見た目、無文字理解・安全、ゲーム実機の判定を混ぜない。VERIFIEDはファイルと往復の成功のみ。衝突形状・LOD・座席位置・ゲーム内配置・モバイル性能・本番採用はこのルーチンでは未検証。今回の2K PBRは1素材約7.8–9.0MBのため、量産前に端末予算とテクスチャ圧縮方針を決める。元画像から見えない裏面は生成側の推定。

## 初回バッチ実績（2026-09-17 JST）

各1回、Meshy 7 / PBR / 2K。970→880、計90クレジット。木12,390三角形・高さ4m、岩4,005三角形・高さ0.8m、ベンチ7,709三角形・高さ1m。生成時間はサーバーのstarted_at→finished_atで176.337秒、170.779秒、172.683秒。岩のみ180度回転。追加生成・有料後処理・課金操作なし。画像とGLB、詳細証跡は `assets/pipeline/island-props-v1/index.html` と各素材のmanifestにある。

既存アプリの動作・仕様は変更しないためproduct spec変更なし。検証対象は制作ツール・記録・生成物で、アプリ全体のrelease検証とは扱わない。

## 既存素材の軽量化と島での比較（2026-09-17）

追加のMeshy生成・消費は不要。`final/model.glb`を保存したまま、Blender MCPで次を実行する。今回は3素材の1K版だけを検証対象とする。

```python
import runpy
optimize = runpy.run_path('/Users/yutogasaki/Projects/sansu/tools/asset-pipeline/optimize_textures.py')['optimize']
for aid in ['island-tree-v1', 'island-rock-v1', 'island-bench-v1']:
    optimize('/Users/yutogasaki/Projects/sansu', aid, 1024)
```

`optimized/model-1024.glb`と`optimized/profile-1024.json`へ出力する。Blenderで縮小した埋込みPNGだけを元GLBへ戻し、形状・UV・法線のバイト列とPBR設定の一致を検査する。BlenderでGLB全体を再出力すると木の頂点が2個増えたため、再出力された形状は採用しない。縮小そのものは非可逆。元ファイルは保持する。512は処理可能だが見た目未検証であり標準採用しない。

```bash
npm run dev:asset-lab
# 別ターミナルで実行
npm run e2e:asset-lab
```

比較画面は `http://127.0.0.1:5243/prototypes/asset-lab/` 。「元の2K」「軽い1K」を切り替えると視点を保持する。「木・岩・ベンチ」で寄り、「島全体」で戻す。ドラッグとピンチで観察できる。既存ゲームの島・家・住人・照明を利用する開発専用の試験配置で、本番ルート・所有状態・保存データには組み込まない。

自動チェックは両解像度・各素材・PC/390px幅・読込失敗から再試行・再読込・WebGLエラーを確認する。証跡は `output/playwright/asset-lab/` に画面とrevision/source hash付きreport.jsonを保存する。CPU側の描画呼出時間はGPU完了時間ではなく、端末幅の変更も実機性能の測定ではない。キャッシュ条件が異なる読込時間から速度向上率を断定しない。

初回の比較で影テクスチャ作成前に描画し、既存の島・家・住人が消えるWebGLエラーを検出。初回描画前にshadow map更新を要求して修正し、WebGLのwarningも検査対象に加えた。アプリ本体への修正は今回行わない。

### 島全体の同条件ベンチマーク

```bash
node tools/asset-pipeline/benchmark-island.mjs
```

比較専用のproduction buildを `output/playwright/island-benchmark/` に作り、5244番で一時配信して自動終了する。島・家・住人・照明・カメラを共通にし、既存素材の木/岩/ベンチを使う場合と生成1K素材へ置き換えた場合を比較する。同じJSバンドルを使用するため、既存側にも比較用GLTFローダーのコードが含まれる。ゲーム全体の起動時間ではなく素材置換の差を測るもの。

キャッシュ無効・毎回新規ブラウザーコンテキスト・10Mbps/遅延50ms・390×844/DPR1.5で各3回、順序を交互にする。初回表示は全素材読込と描画呼出後の2回のRAFまで。操作中は同じカメラ軌道を150フレーム動かし、先頭31フレームを除外する。これは実スマホではなくMac上のChromium。フレーム間隔はGPU単独の描画時間ではない。

JS heapはGC後の実測、形状は配列byte数、テクスチャはRGBA8＋必要なmipmapを仮定した推定。GPUドライバー/描画先/ブラウザ全体のメモリを含めない。PNG/GLBの転送量と展開後のメモリを混同しない。途中失敗した実行は有効な比較に含めない。

### 配置数・種類数の増加試験

```bash
node tools/asset-pipeline/stress-island.mjs
```

`stress-scene.ts`を比較専用エントリへ結合してproduction buildし、5245番で一時配信する。アプリ本体・保存データ・Meshyは変更しない。30/100/300個について、形状・マテリアル共有の通常Meshと、区画ごとのInstancedMeshを全景/近接/移動で比較する。300個では影を毎フレーム更新する負荷も別計測する。島は面積を広げた人工的な負荷試験用配置で、完成したゲーム画面ではない。

種類増加は30個配置に固定し、同じGLBを別URLで再取得する6/12種類相当を計測する。実際の新しいアートの種類ではなく、独立したモデル/画像を保持した場合の模擬試験。未圧縮画像が大量に積み上がるため12種類までに限定し、100/300種類を実際には読み込まない。

出力は `output/playwright/island-stress/report.json` と画面。ローカル通信/キャッシュ無効、390×844/DPR1.5、headless Chromium、各条件1回・各視点45フレーム（先頭11を除く）。描画回数・転送量・保持画像の推定サイズを重視し、fpsはスマホ実機の性能と扱わない。視錐台外の描画削減を検査するもので、区画ごとの非同期ロード/アンロード実装は含まない。

### GPU画像圧縮と遠景LOD（開発用）

既存3素材だけを処理し、Meshy APIは呼ばない。詳細と採用候補は [300個配置の検証](../design/2026-09-17-asset-lab/runtime/README.md)。

依存は別ディレクトリへ配置する。glTF Transform CLI/core/extensions/functions 4.5.0、meshoptimizer、sharpが必要。KTX-Software 4.4.2の`ktx`・`toktx`と共有ライブラリを配置し、binをPATHへ追加する。今回の配置先は一時ディレクトリのため再起動後などは再セットアップが必要。

```bash
npm install --prefix /tmp/sansu-asset-tools @gltf-transform/cli@4.5.0
PATH="/tmp/sansu-ktx/bin:$PATH" node tools/asset-pipeline/build-runtime.mjs
node tools/asset-pipeline/benchmark-runtime.mjs
```

別の依存配置先は`ASSET_TOOLS_ROOT`で指定。KTXバイナリは公式KTX-SoftwareリリースからOSに対応する4.4.2を取得する。builderは`runtime/near.glb`・`far-geometry.glb`・設定とハッシュを出力する。farには画像がなく、`runtime-lod.ts`のようにnearのマテリアルを共有して使う。24px未満でfar、32px超でnearに戻す。nearはKTX2Loaderとbasisデコーダが必須。

benchmarkは5246番で一時配信し終了する。`output/playwright/island-runtime/`に数値・各視点画像を保存。`RUNTIME_BUILD_ONLY=1`で比較用buildだけ作成できる。元1K・UASTC・UASTC＋LODを同一300個配置で比較する。実ゲームへの組込み、区画のロード/アンロード、実スマホ検証は別工程。

### Lifeゲーム内の切替検証

```bash
npm run dev:island-runtime-assets
# http://127.0.0.1:5250/ : Life本来のmoon-garden、DEV専用DB
```

`VITE_ISLAND_RUNTIME_ASSETS=true`でLifeWorldに圧縮GLB＋LODを接続する。本番用固定buildでは`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true`も必要。`VITE_ISLAND_LIFE_PREVIEW`だけではproductionでLifeは有効にならない。素材flagを省けば従来表示。

```bash
VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true VITE_ISLAND_RUNTIME_ASSETS=true npx vite build --outDir output/playwright/life-runtime-production
npx vite preview --outDir output/playwright/life-runtime-production --host 127.0.0.1 --port 5248 --strictPort
# 別ターミナル。隔離ブラウザーに明示の所有fixtureを作る検証。
RUNTIME_GAME_URL=http://127.0.0.1:5248/ RUNTIME_GAME_OUTPUT=output/playwright/life-runtime-assets-new node tools/asset-pipeline/verify-life-runtime.mjs
```

ゲームの背景木・岸の岩・original色の配置済みベンチが対象。同種の形状・画像を画面内で共有し、再構築前に借用モデルを外し、画面終了でpoolを解放する。KTXデコーダはViteのハッシュ付きURLを使用。読み込み中/失敗時は元の形状へ戻す。データ保存や学習条件は変えない。

LODは正投影では距離でなく画面高さ・zoomから判定する。配置中のゴースト、カタログの見本、色変更版、C3大樹、成長植物は今回の対象外。商品表示まで統一した正式採用とスマホ実機性能の判定は未完。区画streamingも未実装。

最終検証と実画面は [Life組込みの記録](../design/2026-09-17-asset-lab/game-integration/README.md) を参照。

なお、今回の12配置のゲーム内検証では最小表示でもLOD閾値に達せず、全て近景のままだった。LODの接続は完了しているが、ゲームでの削減効果は島が広がった条件で別途測定する。

### 拡張した実ゲーム / スマホ計測ページ

`RUNTIME_GAME_EXPANDED=1`を`verify-life-runtime.mjs`へ渡すと、隔離ブラウザーで正式な3方向拡張と22個のベンチ配置を検査する。実機計測用には`tools/asset-pipeline/device-check.html`を固定build直下へコピーしてHTTPSで配信する。20秒操作後にJSONを保存できる。LANのHTTPはアプリのcrypto.randomUUIDが使えないため非対応。PCによる計測ページの検証をスマホ実測と扱わない。[結果と残る接続条件](../design/2026-09-18-runtime-expanded/README.md)。

### 庭セットのLifeWorld接続（v3）

`npm run dev:island-runtime-assets` の起動後、`node tools/asset-pipeline/verify-garden-runtime.mjs` で芽・つぼみ・満開、街灯、reload、GLB障害時の代替表示、学習復帰を検証する。隔離したブラウザー内の合成creditと過去時刻を使い、実際の購入・移行処理を通す。追加のMeshy処理はない。

original色の満開の花だけを花壇へ、配置済みの灯りを街灯へ置換する。地面の照明は従来の機能解放条件を引き継ぐ。独立観察画面・商品見本・配置ゴースト・色変更版は従来形状。[v3の実画面と検証](../design/2026-09-19-garden-game-runtime/README.md)。
