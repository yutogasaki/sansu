# 根と岸の造形3案：不採用の記録

状態: **3案とも視覚REJECT**。アプリの造形コードは残さない。画像と再現patchは失敗の証拠であり、配信素材や完成案ではない。

[事前の転用範囲](transfer.md)に従い、既存の草地上面を残して、その外側/下側の岸を傾斜meshへ置換。追加の根は後方の同じ幹から地面へ広げた。キャラの顔/頭身/耳/色/布/行動、学習/保存/歩行/配置の正本は変更していない。新しい画像生成はなく、既存木肌と芝を使用。

[C3と実画面比較](comparison.png)。全案390×844/768×1024、同じ保存済みQAの3住民・地形・画角を使う。元profile/割当/論理時刻を維持しrealAtだけ開始時へ合わせた明示fixture。実取得/自然発見/利用者観察ではない。

| 案 | 実画面とreport | 不採用理由 |
|---|---|---|
| bank | [report](comparison/bank/report.json)、[tablet](comparison/bank/tablet-current.png) | 連続する岸が滑らかすぎて成形品のように見える |
| roots | [report](comparison/roots/report.json)、[tablet](comparison/roots/tablet-current.png) | 根が独立した帯に見え、幹から連続する量感にならない |
| terrace | [report](comparison/terrace/report.json)、[tablet](comparison/terrace/tablet-current.png) | 段差を強めても人工的な厚い板の印象が残る |

## 同定と範囲

元revision `7a7a07ca0b080541275c55072d15ff90593d72b5`＋[不採用patch](rejected-prototype.patch.gz)、prototype app source `5fc02ef3a123e2b9e404408b596d613c3bf3707cbc2f15357fb104532fd87648`。各reportの開始終了が一致。targetはbank5240/roots5241/terrace5242のlocal DEV、候補はそれぞれ `canopy-relief-<案>-study-v1`。Island/Life preview・木肌study・turf・lagoonに加えreliefの各案を明示。実version/delivery/候補は各reportに保存。検証後、この3つの試作serverは停止した。

[patch適用確認](patch-check.json)は宣言したbaseの6ファイルをfresh directoryへ復元して `git apply --check` でPASS。patchはgzipを展開して元baseへ適用して比較を再現するための記録で、現在mainへそのまま適用する指示ではない。

[prototype unit](prototype-unit-output.txt)は7テストPASS。元/拡張寸法で岸が元の草地面より下にあり、追加根の曲線全体と半径が最初の歩行列より後ろに収まることを確認した。これは視覚合格や全配置の実操作検査の代わりではない。タイプ検査もPASSしたが、造形を不採用にしたため、このprototypeを全core/全導線の正式候補へ進めていない。

## 独立した判定と次の方法

視覚: **REJECT**。作者の両幅実画面評価はいずれも31/60（5,7,5,4,7,3）、確信度中。C3の地形と根の連続性を改善せず、前の浅瀬試作34/60にも届かない。

無文字理解/安全: **HOLD、Human N=0**。独立観察はない。幾何の後方余白と既存キャラ維持の検査を、利用者の安全理解と混同しない。

Runtime: **診断のみ**。素材読込/候補描画と幾何unitは通ったが、全操作/保存/PWA/性能の受入は行わない。技術的に描けることを不採用の見た目の代わりにしない。

次は独立したtubeやringを足す方式をやめ、根と幹の継ぎ目を滑らかにつなぐ一体meshを試す。岸も単純な一様断面を避ける。ローカルにNumPyとscikit-imageは利用可能と確認したが、この新方式の形や実画面はまだ作成/承認していない。

造形検討中に見つけた[海岸座標の反転不足](../2026-09-14-canopy-shore-transform/README.md)だけは独立した修正として検証して統合する。元の仕様全体は継続。
