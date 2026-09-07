# 島の体験評価からの表示・操作改善

2026-09-07。対象は [体験評価](../2026-09-07-experience-review/README.md) の配置の隠れ、遊びの操作順、再学習時の住民の切れ、重複する説明と選択肢。継続課題の全体は [active task](../../../tasks/active/2026-09-07-experience-improvements.md) で管理する。

[実画面の比較と全6家具](contact-sheet.html) / [画像58枚の識別・SHA256](capture-manifest.json)。比較画像の問題は通常plannerの実予約であり、before/after間で同一問題を固定した比較ではない。問題の意味保持は独立した23シナリオで検査した。

## 対象と変更

- 配置中にプレビューを遮る住民・家具・木の部品を一時的に透過する。取消・保存・編集終了で元へ戻す。
- 遊びの家具一覧を先に置き、学習への復帰はその下の副操作にする。増えた家具は一覧内でスクロールする。
- 学習開始時に、その時点の住民と移動先を収める画角を決める。通常回答の間は画角を動かさない。
- ホームと学習待機中の繰り返し文言を減らす。見本と同じ選択肢が回答ボタンにもある問題は、意味が一致する場合に限り回答側へ一度だけ表示する。意味が一致しない旧保存問題は元の表示を保つ。

## 識別

| 対象 | 値 |
|---|---|
| 実行先 | ローカル production preview `http://127.0.0.1:5399/#/island` |
| 元build | `b9607fa66811f2fd89e643b443ff410f6a83d782:7155d06f-a7ae-4186-8191-a43cbaf2bc2f` |
| 修正build revision | `84d3ddf-experience-3535575a1ce3` |
| 修正build version | `84d3ddf-experience-3535575a1ce3:7dc2ff9e-dc44-4734-a2b8-bdc9f4b1e995` |
| delivery / flags | `mystic-island-v1` / Island=true、BuildPlay=true、Park renderer=three |
| world / learning candidate | `mystic-island-procedural-v2` / `mystic-island-learning-v2` |
| 配色 | `moon-garden` |
| 画面 | Chromiumの390×844 touch、768×1024 mouse/keyboard。実機端末の測定ではない |
| source / artifact | `output/builds/experience/84d3ddf-experience-3535575a1ce3-inputs.tar.gz`、同revisionの固定build。643入力ファイルのhashを記録。実行用の展開先はリポジトリ外 |

## 判定

この表示・操作修正の自動検証はPASS。三つの判定を平均せず、全課題や作品全体の完成と扱わない。

| ゲート | 判定と範囲 |
|---|---|
| 美術 | 局所修正を目視確認。6家具の形、プレビューの回転、遊びの操作順、住民の耳・頭・足、配色保持を確認。全体の魅力・素材・個性は前回評価から合格へ引き上げない |
| 無説明理解・安全 | 子どもの実観察0件でHOLD。操作階層・問題の意味・援助記録・保存不変の作者/自動確認は成功したが、子どもの理解を代替しない |
| runtime | 下表の必須検証と固定10問はPASS。実機の発熱・電池・iOS再起動は未測定 |

初回修正で樹冠まで薄くなった画面は不採用とし、木を部品ごとに判定する固定buildで再撮影した。ベンチと重なる住民の一時透過は意図した編集表現であり、身体の接触そのものを直す処理ではない。東への歩行中に住民同士が重なる場面も残る。次の住民の経路・遊び改善へ含める。

## 検証結果

| 検証 | 結果 |
|---|---|
| `verify:core` | PASS、129 files / 1430 tests。docs・lint・typecheck・production build・assetsを含む |
| `e2e:smoke` | PASS、31項目 |
| classic `e2e:pwa-update` | PASS、4 checkpoint / SW検査。Island/Park flagを無効にした別artifact |
| Island DEV | PASS、11シナリオ。新規導入・通常planner・受取保留・成長・profile分離・WebGL復旧 |
| production experience / 3D | PASS、phone/tablet。実獲得6家具、回転/取消/保存、リソース再利用、増えた家具一覧、再学習 |
| production learning | PASS、23シナリオ。数・図形・分数・小数・筆算・英語、支援/reload、入力とSVG形・色・順序・値 |
| production play | PASS、phone/tablet。3住民の参加・連打/再演・通路復旧・全DB不変・同じ学習予約の再開 |
| Island PWA | PASS、4 checkpoint検査と実service worker下のoffline reload/回答保存/同じ予約の再開 |
| 東土地の追補 | PASS、実回答2区間で獲得したブランコを矢印操作で東へ配置。歩行中から着座まで同じ学習画角を保持し、再学習後も全住民が収まる |
| 固定10問 | PASS、80 runs。phone/tablet各10反復×2条件×Study/Island。通常問題の追加操作0、source不変、`evidence.eligible=true` |

固定10問のP95は次のとおり。各画面で正解180件、同じ問題への誤答20件を測った。DEVの固定fixtureによる自動キー入力であり、子どもの解答速度でも通常plannerの真正性検査でもない。通常plannerは上のproduction/DEV検査で別に確認した。

| 画面 | 正解→次の入力 | 誤答→再入力 | 基準 |
|---|---:|---:|---|
| 390×844 | 193.3 ms | 195.4 ms | 正解 ≤650 ms / 誤答 ≤550 ms |
| 768×1024 | 481.7 ms | 457.7 ms | 同上 |

[速度の生データ](evidence/throughput.json)、[測定環境と境界](evidence/throughput-context.json)、[固定sourceのmanifest](evidence/build-source.json)、[PWA記録](evidence/pwa.json)、[東土地の記録](evidence/east-learning.json)、[追補harnessのSHA](evidence/east-learning-harness.json)。他のraw log/reportは同revisionの `output/playwright/` に保存している。展開したsourceを`output/`に置いてテストが二重検出された中断runは無効として保存し、リポジトリ外へ移した後の1430件のみを採用した。

## 未解決の範囲

6区間後の再遊び、住民の個性・通路上の重なり、段階的な学習支援、遅延した独力正答を使うSRS/進級条件、初回準備負担はこの表示修正だけでは解決しない。人間の観察は [1人からの手順と記録ページ](../2026-09-07-single-child-study/README.md) を用意した段階である。
