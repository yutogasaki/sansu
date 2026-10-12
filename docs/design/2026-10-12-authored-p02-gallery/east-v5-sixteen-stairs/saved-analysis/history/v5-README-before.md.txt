# P02 実16段の粗形・v5 source 記録

2026-10-12 のsource粗形buildと全景・入口近景各1枚は実行済みです。**source visual HOLD / runtime HOLD**。本体への統合・実住人の階段動作・美術採用を示しません。rootの美術判断は別ファイルの責任範囲です。

- [全景](east-v5-shape-view/runs/01-whole/coarse-real-stair-HOLD-whole.png)
- [入口近景](east-v5-entry-view/runs/01-entry/coarse-real-stair-HOLD-entry-section.png)
- [完成粗形 Blend](east-v5-stairs-build/runs/01-coarse-build/study.blend) / [可視35owner context GLB](east-v5-stairs-build/runs/01-coarse-build/study.glb) / [所有部品 GLB](east-v5-stairs-build/runs/01-coarse-build/owner-use-components.glb)
- [実行完了記録](completion-summary.json) / [保存SHA証拠](archive-proof.json)

## 今回の形と計測

同じ4owner、原幹・冠・家・door・主要端点・幅.64を固定。元の滑らかな坂を、共通頂点の実踏面・蹴上げ16段の直接閉体へ変更しました。踏面に隠れた別の坂はありません。足の実meshは固定c1の9rigから抽出し、左右offsetと往復方向を保った投影比較では16段・18段とも収まりました。16段の最小neutral余裕.0159416205m、18段.0057397466mを根拠に16段を選択。既存gallery swingの9位相も投影していますが、上り足・下り足を異なる段に置く動作、脚と胴体の連続性、蹴上げの非貫通は未実装・未検証です。

新階段は2,550頂点/5,096三角形。5床部品すべてclosed/components1/bad edges0/duplicate0/zero-area0/positive volumeで、5部品の正の内部接合witnessを記録しています。実tread1,280triは可視面と同じFloat32座標/順序です。低い接地根1本・幹からの支え5本・手すり3mesh・post20meshを生成。端capの接地/部品内側測定はできていますが、曲がる支持全体の自己交差・体積接合まで証明したものではありません。

[生QA](east-v5-stairs-build/runs/01-coarse-build/coarse-qa.json)には、neutral reserved-box37件/motion-band24件、exposed-skinのFloat32 lineage28片、入口/接合のHOLDを残しています。保守的envelopeと実body侵入の分類は未完了です。routeの高さを最高面へ自動変更したり、接触相手を除外したりしていません。

## 入口の幅と高さを分ける

旧4.8cmの差は採用していない中央入口(3.75,-7.25)の履歴で、v5へそのまま転記していません。現在は西入口(3,-7.25)から.20mで内部床Y1.6814100742へ至る固定形です。[現在接合座標](east-v5-stairs-build/current-joints-plan.json)と[実全幅断面](east-v5-stairs-build/runs/01-coarse-build/current-entry-joints.json)を保存しています。

[未被覆区間の換算](east-v5-stairs-build/runs/01-coarse-build-coverage-followup.json)では、原地形は端線幅.64mの全幅を支持する一方、新可視owner topだけの同じ端線照会は合計.2572902908m、最大連続.03506468085mが未被覆。plateau breakは合計.0078448801m、最大.0072294590mです。高さの最大残差1.436e−7mから横方向の欠けまで微小とは言えません。端線丸めによる照会の外れか実面の欠けかは未分類です。opening・native arrival・gallery接合の端線はuncovered0です。これらは元地面を含む空間全体が穴であるとの結論でもありません。

## 撮影・保存条件

同じsceneを補修せず、旧全景/入口カメラ、1280×925、Cycles CPU2/16samplesで描画。今回だけruntimeに合わせて exact `growing-reachable-paths.visible_shadow=false` を設定し、他meshのshadow flagは維持しました。旧v4にこの設定があったとは記録していません。全景差のすべてを階段変更に帰属できません。左の黒い断面や原本植物等はこの近景に残り、今回の階段が作った不具合と未確認で断定していません。

build15.52秒、whole13.47秒、entry19.80秒。すべてexit0、CPU2/時間/RSS制限内でowned PID/group退出、元入力/封印code/source/描画mesh/materialのbefore-after一致。時刻は外側Popen/psの観測UTCであり、childの正確な起動・退出時刻を主張しません。元8input、固定35ownerと左原本128meshを保持。app/browser/world compilationは起動していません。

[archive-proof.json](archive-proof.json)は元tmp before/after SHAと保存先のbyte一致を記録。最初の足抽出失敗（仮想esbuild入力の扱い）、修正版、比較raw、静的レビュー前後、build、2画像を保持しています。大きいJSON/テキストはgzipでlossless保存し、展開byteSHAを照合。code/README snapshotは`.txt`へ改名し、元bytesを保持しました。prepared manifestは当時の準備状態を表す履歴です。`execution-observers/east-v5-outcome.json`は全景後・近景前の履歴で、現在の完了状態はこのREADMEとcompletion-summaryです。旧archive/root review/原本モデルを上書きしていません。
