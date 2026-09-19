# Nature Town RNG-02：ネイティブ固定フレーム比較

2026-09-19。**RNG-02 PASS**。受入46/47。SAFE-06の独立観察は未完了。

## 実行と結果

[Linux CI run](https://github.com/yutogasaki/sansu/actions/runs/35424841865)でcommit 0415af9396a8a49cad859e6840986d177d1aa19bをbuild。実行先はrunner内 http://127.0.0.1:5339/#/nature-town 。build revisionはrng-fixed-0415af9396a8a49cad859e6840986d177d1aa19b、完全なversionは[結果](report.json)。flagはVITE_ISLAND_ENABLED=true / VITE_NATURE_TOWN_ENABLED=true、候補nature-town-living-s1。Chromium 145.0.7632.6、Linux。

同じ初期保存から、390×844・通常motion・60Hzと、768×1024・動き抑制・音OFF・全景・水分表示・30Hzを比較。家と畑は実操作で置き、使い捨てプロフィール以外の世界・乱数・入居候補を注入していない。

- 60Hz: 7,200フレーム、観測平均間隔16.666662ms。
- 30Hz: 3,600フレーム、観測平均間隔33.333315ms。
- 各論理秒にfps個のネイティブフレームを描画した後、実アプリtimerのコールバックを1回実行。保存完了を待ち、120tickで全WorldStateと学習progressを比較。
- 住人の位置・経路・在庫・抽選ordinalを含む全世界が一致。共通SHA256: bdab06411cd13111a90f642f6d7521bd77e15ae72f2b44ae0747b51dc25923f2。

[60Hz実画面](60hz.png)、[30Hz実画面](30hz.png)。[60Hz全時刻](60hz-frame-times.json)、[30Hz全時刻](30hz-frame-times.json)。

## 固定フレームと時刻精度

[HeadlessExperimental.beginFrame](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/HeadlessExperimental.pdl)で、描画フレームの時刻と間隔を制御。ブラウザのrequestAnimationFrameを置換せず、そのタイムスタンプで検証する。[Target.createTarget](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Target.pdl)のBeginFrameControlはMacOS未対応なのでLinuxを使用した。

最初の2回は検査側が時刻の丸めを考慮せず、±0.1msの比較で失敗。[診断run](https://github.com/yutogasaki/sansu/actions/runs/35424684923)では7200フレームが欠落なく届き、間隔16.5〜16.8msと判明した。[High Resolution Timeの精度低減](https://www.w3.org/TR/hr-time-3/#dfn-coarsen-time)に対応し、2つの時刻の差に許容する丸め幅を0.201ms（0.2msに浮動小数誤差分）とした。フレーム数は7200/3600と厳密一致、全フレームの間隔と累積ずれもこの幅以内をassertする。フレーム落ちや平均値だけの一致を許容していない。

制御するのはrendererのフレーム時刻。実測の処理所要時間は60Hz側約5.2秒・30Hz側約3.6秒であり、120秒の実時間プレイ・物理ディスプレイのrefresh rate・端末性能の検査ではない。これは同tickの結果が描画設定に依存しないことの診断である。

## 独立した判定

- 実装整合: RNG-02 PASS。固定フレーム比較と同tickの世界一致。
- 見た目の魅力: HOLD継続。最終美術の評価ではない。
- 無文字理解・安全: 独立観察0人、SAFE-06はNOT_RUN。

[実行script](../../../tools/e2e-nature-town-fixed-frames.mjs)、[Linux workflow](../../../.github/workflows/nature-town-fixed-frames.yml)、[hash一覧](sha256.json)。
