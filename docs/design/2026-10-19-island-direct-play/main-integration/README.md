# main統合候補の検証

2026-10-19。利用者の「コミットメインプッシュ」に基づき、base `88293758` から今回の島UIだけを分離した。海図・schema/writer隔離・橋開始処理・開発ポータル再設計は別作業として除外し、元のworking copyを保持した。

## 判定

ローカル統合候補は対象検証PASS、全体検証PARTIAL。全体テスト・実機・子どもの独立理解・魅力・公開の合格ではない。直前のChatGPT評価は方向性GO、強く遊びたくなる魅力は引き続き改善対象（住人の見やすさ、場所の違い、成長時の変化）。

- Node 22.23.3でtypecheck、lint（既存4 warnings）、build/assets PASS。PWA precache 8.53 MiB / 12 MiB。
- 対象6ファイル27 tests PASS。classic smoke32件PASS。
- 分離候補のDEV `127.0.0.1:5208` で320×568の無料家・分類・所有物・任意目標・ながめ・土地の費用・メニュー/退出と、390×844の実住人模型・補助4機能・5タブ・家・全数字入力/同じ未回答予約への復帰がPASS。320幅メニュー画像に黒帯なし。自然獲得・実機・PWAの証拠ではない。
- docs/checkとNode24の生成索引・portal整合は分離候補でPASS。最終indexも外部の新規directoryへ書き出してdocsを検査する。
- 全体 `npm run test:run -- --minWorkers=2 --maxWorkers=2` は約11分で終了を待たず中断。79ファイルの通過を記録したが、suite全体の合格・残りの結果は未確認。今回の対象6ファイルは別に完走した。最初のmaxWorkersだけの指定はminThreadsとの競合で開始できず、min/maxをそろえて再実行した。

## 入力と証拠

[build入力SHA](build-inputs.json)、[320幅のcatalog report](catalog-report.json)、[390幅のnavigation report](navigation-report.json)、[主要旅程contact sheet](index.html)。report内のruntime markerでapp/route・revision・flags・delivery・candidateを識別する。DEV revisionはdevelopment-localで、公開revisionではない。build-inputsのsrc/public/package/configは検証からcommitまで同一であることをindexと照合する。

[対象unit](focused.txt)、[型](typecheck.txt)、[lint](lint.txt)、[build/assets](build.txt)、[smoke](smoke.txt)、[現行入口](entry.txt)、[中断した全体テスト](full-tests-interrupted.txt)。上位のreview-v3と最初の改善記録は海図等を含む当時のworking copyの履歴であり、この分離候補と同じ入力とは扱わない。
