# 編集できる全島の計算と初回描画

M1の[編集できる全島](../2026-10-11-authored-island-runtime/README.md)で、地形と所有物を保ったまま重い床照会を減らした。美術の完成を示す変更ではない。**全島美術はHOLD、独立理解・安全は未評価 N=0、実機性能と次期保存は未達。** [完成方針](../../product/island-construction-strategy.md)の全島一例を継続する。

## 床と道の前後比較

main `a2ea3e98d8996df6fb466d2e6ce064e35589f275` を隔離した変更前と、同じ入力・Node 24.18.0・Three 0.185.1・DEV=falseの変更後を比較した。[比較結果](benchmark/comparison.json)、[変更前](benchmark/baseline.results.json)、[変更後](benchmark/optimized.results.json)に計測と出力のfingerprintを保持する。

| Nodeの処理 | 変更前 | 床・道の改善後 |
| --- | ---: | ---: |
| 世界定義のコンパイル | 5,305 ms | 433 ms |
| 道の辺を求める | 1,258 ms | 12 ms |
| 道のmeshを作る | 5,020 ms | 73 ms |
| 全所有物layer・初回 | 7,386 ms | 188 ms |
| 同じ全所有物layer・再生成2回 | 7,462 / 7,588 ms | 163 / 151 ms |

各版1run、全layerの再生成2回である。browser/GPU/実機のFPSや入力P95を示さない。2,000tickのCPU診断も画面のframetimeへ読み替えない。

13項目のfingerprintは完全一致した。4,562地点の床・逆変換・岸の欠け、163本の順序付き経路、306nodes/221meshesの全buffer・法線・index・材質・変換、364,876camera points、27所有物と1,580到達地点を比較した。全出力は圧縮したnodesとlayout samplesへ保持した。形状を減らしたり、入り江を埋めたり、歩ける条件を緩めたりしていない。

shader/receipt変更を統合した固定版でも[最終比較](benchmark/comparison-final.json)の13項目が一致し、[最終Node結果](benchmark/final.results.json)のsource/入力SHAが開始・終了で一致した。Node比較はrenderer/GPUの準備やghostの透過画面の同一性を含まない。

密な整数bucketだけを1/16へ細分し、元の三角形順とEPS境界を保持する。広い重複床と細い三角形は保守的に扱う。経路は既にdry floorを検証したcompiled sitesを再利用する。道の頂点の支持とlayoutの床pointはローカルに再利用し、面の中心のdry supportは引き続き検査する。返すvectorは独立しており、所有・成熟・保存・世界の規則を変更しない。

初回の比較harnessはNodeで `import.meta.env.DEV` が未定義だったため失敗した。[失敗原文](benchmark/baseline-first-attempt.failure.json)を残し、両版を同じDEV=false条件へ合わせて再実行した。アプリの失敗とは区別する。保存したharness `.txt` は当時の絶対pathを含む生の診断入力であり、汎用の再現CLIではない。

## 実画面に残った待ち

床改善後の[初回UI診断](before-warming-ui/report.json)は6操作・7画面と入力の開始/終了SHA一致を確認したが、driverを含むpreview/move/store/restoreは約5〜13秒だった。Nodeの高速化だけで編集性能を合格としなかった。

[別のheaded診断](before-warming-profile/report.json)で、最初の選択はpointer到着から2rAFまで約3,719 ms、温まった収納は約636 msだった。[CPU sample](before-warming-profile/sampled-costs.json)では `getProgramInfoLog` に約2,765 msが集中した。ANGLE SwiftShaderのsoftware GPU・desktopの1runで、sampling overheadを含む。cameraの約14 msやdomainの[操作診断](domain-actions.json)だけでは、秒単位の待ちを説明できなかった。

初回shaderをready前へ準備し、cloneに原本のshader hookを保持した。bankのmaterialをrenderer寿命まで持ち、previewを消すたびに最後のprogram参照が失われることを防ぐ。shader error checks、全programのcompletionとLINK検査、abort/context lossを維持する。実shadowとtransmission条件も含む。[独立監査と初回失敗](review.md)に責任と限界を記す。

同じheaded SwiftShaderの[変更後profile](after-warming-profile/report.json)はsource 1,539件の開始/終了SHAが一致した。shader準備は444 compile-only meshes/30programsで456 ms、操作中の `getProgramInfoLog` は[CPU sample上0 ms](after-warming-profile/sampled-costs.json)だった。起動全体の短縮や、呼び出し回数ゼロを示す値ではない。

| profiled desktopの単発操作 | 準備前のinput→2rAF | 準備後のinput→2rAF |
| --- | ---: | ---: |
| 初めて木を選択 | 3,719 ms | 1,724 ms |
| 同じ木を収納 | 636 ms | 534 ms |

これも各版1run・profiling overheadありの診断である。変更後の選択にCPU long taskは記録されなかったが、rAF待ちが残る。GPU/compositor/driver schedulingのどれが残る原因かは、このCPU profileだけでは確定しない。暖める処理をloadingへ移したので、cold起動の予算は別に検証する。実機の入力P95・frame P95を達成済みにせず、runtime全体はPARTIALとする。

[固定版の編集旅程](runtime/report.json)は6操作・7画面とsource 1,540件の開始/終了SHA一致がPASS。全layer buildは初期1→木の移動2→収納3→復元4となり、選択・preview・取消と保存receiptでは増えなかった。所有・成熟・住人・土地・残高・時計を保持した。desktopのmouse操作と390/768幅の表示確認であり、実機touchではない。

この旅程のinput→2rAF markerはpreview 8,564 ms、移動1,817 ms、収納2,059 ms、復元2,012 msだった。初回previewに大きな待ちが残り、選択profileの改善を全編集へ一般化しない。markerはGPUの画面提示時刻ではない。

同じ固定sourceの[全旅程CPU診断](full-journey-profile/report.json)も6操作・7画面を通った。previewのinput→2rAFは8,594 msだったが、その区間にCPU long taskは記録されず、全profileの `getProgramInfoLog` のexclusive sampleも0 msだった。[long tasks](full-journey-profile/longtasks.json)と[CPU集計](full-journey-profile/sampled-costs.json)を残す。全profileはreload・cleanup・phone/tabletへのresizeも含むため、`WebGLRenderer.setSize` の約15.2秒をpreviewの費用へ移さない。GPU/compositor/driverの帰属は未確定で、この環境の遅い画面更新は未解決とする。

別担当の[preview shader key比較](preview-key-diagnostic/report.json)では、実fixtureのl13移動 `(4,-8)→(7,-8)` が使う4 keysはinitial bankの15 keysへ全件含まれていた。未来P01のFrontSide/RGB vertexColorsの透過branchも対象で、missing 0。これはinstalled ThreeのNode key診断であり、実GL program保持やGPU時間の証拠ではない。shader未準備という仮説は、この入力で支持されなかった。

## 固定sourceの回帰確認

最終の `VITE_NATIVE_GROWING_ART=false npm run verify:core` は584 files / 5,093 tests、lint（既存3 WARN）、型、build、通常precache 8.23 MiB / 12 MiBがPASS。[原log](core/execution.log.txt)と[前後source](core/report.json)を保持する。通常productionのnative美術既定falseを確認した。最終の[classic smoke](classic-smoke/browser/smoke-report.json)も32/32 PASSで、[source 1,539件](classic-smoke/execution-report.json)の開始/終了が一致した。classicの合格を新世界の美術・学習へ転用しない。

[既存島のDEV回帰](legacy-regression/report.json)は390/768幅のtouchで8旅程・22画面がPASS。各幅20問、計40の通常回答から家を購入し、再読込と同予約へ戻った。旧保存1→4、3方向拡張、銀行時間、記念品、13住人の選択は別の明示fixtureで確認した。source 1,539件の開始/終了SHAが一致し、最終coreと編集旅程との共通入力も一致した。通常 `legacy-world-v1` / `curved-owned-v1` の回帰で、authored floorや新世界の本人取得・保存・SWを証明しない。

## 完成までの境界

この改善後も、水庭の実水底と岸、大樹の入口と共有deck、森林の面と集落の連なりを同じ世界へ作る。[次の水庭制作の調査](next-water-plan.md)では、原本の三段水形が未抽出で、取得権とdry支持の分離・斜面のowner連結が必要だと分かった。契約を確定して同じ世界に組み立てる。全島一例の美術が成立してから、同じ材料の三配置、成長と分離・再接続、中心を守る16/32軒とその先の拡張へ進む。所有fixtureの編集を本人の取得・学習・保存の証拠にしない。通常productionのnative美術既定falseを保持する。
