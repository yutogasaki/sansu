# ぽこもこのデザインを復元し、プレビューの入口を揃える

2026-09-27。ユーザーの「ぽこもこのデザインは勝手に変更しない」「実画面とプレビューが違いすぎる」という指摘への修正。候補IDは `living-fantasy-garden-v2`。`fantasy-garden-v1` は保存する地形/場面の種類であり、画面候補の版とは分ける。

## 修正内容

幻想の庭で既存のぽこもこを別の生成り/青モデルへ差し替えていた処理を削除した。元の顔・輪郭・頭身・耳・布の切り替え・水玉・配色・大きさ・スカーフと、保存済みの着替えを使う。住人のアイコンも既存画像へ戻し、思い出の再演も同じ既存モデルを使う。

基準は `src/components/island/homeJourney/scene.ts`、`src/components/island/three/residentFabric.ts` と[既存portrait](../2026-09-19-life-startup-stills/source/pokomoko-original.png)。これらの造形・素材そのものを編集して元に似せたのではなく、そのまま使う経路へ戻した。今後の世界観変更からキャラクター変更を推定しないことを、憲法・親仕様・美術章・デザイン憲章・MASTER・durable memoryに反映した。

元の素材に戻すと描画負荷が増えたため、庭の小物・地層・灯りを吊るす線の静的な色面をまとめ、葉・細い枝・草の分割を減らした。座面・止まり木・食べ物の表示用groupは元の参照を保ち、移動・接触・食事の表示を維持する。ぽこもこのメッシュや布素材を軽量版へ変更していない。

## 表示の不一致をどう直したか

以前の「実画面」ギャラリーは、DEVの追加creditと24時間送りで8品を置いた診断用の庭だった。リンク先は別originのproduction形式で、初回設定から始まった。版・保存・育成段階を揃えずに並べたため、同じ状態の見本になっていなかった。

[現在の入口](../2026-09-27-living-fantasy-first-playable/index.html)は、実際の `http://127.0.0.1:5330/#/island` を390×844のiframeへ直接表示する。同じURLを大きく開くリンクを置く。初回設定、学習途中、保存済みの庭のどれが出るかは本人の状態によることを明記し、診断用の完成庭を初期状態として紹介しない。

入口・家・庭の美術の統一はまだ途中。今回、案内と実アプリの参照先を揃えたことを、全画面の美術統一が終わったという意味にはしない。[比較と一連の実画面](contact-sheet.html)には、既存portrait、実回答による購入/配置・オフライン再開、別の診断fixtureを分けて載せる。

旧PNGや元のreportは削除・上書きせず、[取り下げた旧試作](../2026-09-27-living-fantasy-first-playable/withdrawn-v1.html)として区別する。新しい実画面の証拠は、このフォルダに別保存する。旧画像のキャラクターを承認済みの参照に使わない。

## Nature Townとの関係

Nature Townは廃棄していない。既存のぽこもこが暮らす一つの島へ、その自然と物流の仕組みを移す。現状は部分統合であり、植物の育成・実在庫の運搬/食事・水路・木陰・土の湿り具合は現行Lifeへローカル実装済み。供給→来訪/招待→土地拡張、旧Nature Town保存の扱いは未接続。

幻想の庭は同じ島の環境表現であり、Nature Townの遊びを捨てて鑑賞だけにする変更ではない。別の町ホームを並行して仕上げず、旧コード・テスト・保存は保持する。正本は[統合方針](../../product/island-nature-integration.md)、実装の担当は[統合タスク](../../tasks/active/2026-09-22-island-nature-integration.md)。

## 確認

元のぽこもこと同じ形・布・スカーフ・尺度であること、庭の昼夜、水の反応と記録、実学習から取得した花、production形式のoffline保存を対象とする。[build source](build-source.json)はローカルの固定コピーで作ったproduction形式の入力・flag・build ID・配布ファイルのSHAを記録する。実配布のdeliveryは `mystic-island-v1`、庭の候補は `living-fantasy-garden-v2`。両者を区別する。

共有workspaceでは別の学習画面の作業が検査中に入り、一時的に未作成CSSへのimportでbuild/DEVが停止した。その作業を巻き戻さず `/tmp/sansu-pokomoko-restore.7V3VQI` へ固定コピーを作った。今回の変更前にはHEADと同じだった学習4ファイルと、新しい学習演出3ファイルだけを別作業として除外した。対象名はmanifestの `scope` に記録する。元のworkspaceの該当ファイルは変更していない。

全体検査は472ファイル・4,220件。固定コピーの全体runでは1件が15秒の時間切れになり、該当する学習進行の12件を単独で再実行してすべてPASS。続いてbuild/assetsもPASS。[全体ログ](verification-core.log)、[該当検査とbuildの再確認](verification-retry.log)。描画処理の最終調整後は[関連15件・lint・typecheck・build/assets](verification-focused.log)を再確認してPASS。描画変更に合わせて無関係な全テストを反復したとは扱わない。

最初の復元版は8品で132 callsとなり制作予算120を超えた。終点だけ通った次のrunでも途中captureに121 calls/152,204 trianglesが残ったため、全captureの検査を追加。水の反応中にさらに1 callが増えることも検査で検出し、基準を緩めず環境側をまとめた。元reportは[試行の記録](attempts/first-draw-budget.json)、[終点だけの検査だったrun](attempts/endpoint-only-budget.json)に保持する。

全テストと複数の3Dブラウザーを並行したrunでは、水の可視性が1秒以上続いたことを保存で確認できず終了した。live/replayの可視性基準を維持して単独再実行すると、水・思い出の全シナリオは通った。そのrunで[水の反応中の121 calls](attempts/water-response-budget.json)を検出したため、静的な吊り線を背景へまとめた。production検査の最初の失敗は「ようす」と実際のアクセシブル名「しまの ようす」の不一致であり、UIを変更せず検証器を修正した。preview起動完了前の接続拒否も別の失敗記録として保持する。

### 最終の確認結果

- [本番形式の2シナリオ](production/report.json)も同じ最終buildでPASS。初回設定→実回答4問→実際の購入/配置→Service Workerでのオフライン再起動→学習の続き→再保存を390×844/768×1024で確認した。DEVの追加creditや時計送りは使っていない。庭のv2候補と元のportraitを検査した。対象と結果は[確認manifest](manifest.json)に集約する。
- [DEVの4シナリオ](dev/report.json)はPASS。実回答から購入/配置・再起動・同じ予約への復帰と、両幅の昼夕夜・水の実反応・可視性証拠・再演・非表示時の非計上を確認した。20 captureすべてで最大119 calls / 146,404 triangles / 8 textures。制作予算120 calls / 150,000 trianglesを満たす。30品や実機FPSの確認ではない。
- 元モデルとの一致は既存と幻想の庭で、heroの全メッシュ頂点・布panel・素材色・位置・尺度・スカーフを比較。食べ物を運ぶ場面の描画検査は両方の庭へ適用した。
- ビルドは `development-local:806cd1c5-b188-4e1c-904b-472c587efca4`。code/config/referenceのhashは `995c0ea0b437f4c7f0205efce22c8c940d759a8a9009f8177c6414484f0739c4`。flag・各ファイル・QA・実配布ファイルのSHAは[manifest](build-source.json)を参照。

| 判定軸 | この修正で確認したこと | 残ること |
|---|---|---|
| 視覚の魅力 | 既存のぽこもこを実画面へ復元し、既存portraitと並べて確認 | 庭全体の最終美術、入口・家・学習との統一。新しい美術点や承認を付与していない |
| 無説明理解・安心 | 学習と保存を継続する自動検査、初期状態と診断fixtureの説明を分離 | 独立した子どもの観察は0人。理解・意欲の合格とはしない |
| runtime | 対象のunit・lint・型・build、実ブラウザーの操作/保存/描画を検査 | 旧Nature Town DB移行、30品負荷、実機FPS、実端末の更新 |

今回の判断は既存キャラクターの復元と案内の整合。庭全体の最終美術、子どもの無説明理解（独立観察0人）、実機FPS、Nature Townの全統合は別の残件。今回、学習の入力ロジックは変更していない。旧v1の80run比較をv2で再実施したとは報告しない。公開先の更新、学習履歴・所有物・旧Nature Town DBの変換は行っていない。
