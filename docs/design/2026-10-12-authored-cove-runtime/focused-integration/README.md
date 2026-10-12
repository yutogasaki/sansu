# P04 cove focused integration — c1

2026-10-12、実 GLB と既存 32 所有物の明示 fixture を使った Vitest **2 files / 13 tests PASS**（56.35s）。[最終 stdout/stderr](final-run.log.txt) と [検査・SHA 一覧](report.json) を保存する。これは Node 上の実 Three.js geometry、domain command、公開 life API の focused 検証であり、ブラウザ描画、美術承認、実取得、保存・offline・実機性能の合格ではない。

runtime 証拠は source 入力の `authored-cove-entrance` と別の sibling folder に置く。source folder 内の JSON は driver が再帰的に hash するため。raw log は内容を保った `.log.txt` として保存し、`*.log` の ignore 対象にしない。

- 共通 apron の実頂点・描画 triangle 数・raycast 床高を照合。元の床、73 配置権、32 所有物を保持する。
- 実殻 79,384 triangles を cove-only と flower 混在の双方で歩行 guard に含め、全所有物への接近を維持する。
- 公開 pick/drag/drop と通常の目的地選択から apron → p9 の実歩行、posed actor の干渉・接地、700ms 後の利用 receipt、退場まで追う。殻への drop/cancel と apron 消失による退避は receipt を作らない。
- p9/l32 は実 store/unstore。居住中の p6 は既存の store 拒否を検査し、許可された move/reconnect で殻と床の解消・復元を確かめる。
- preview の取消で同じ殻 root・geometry・material と視認状態を戻す。再接続の preview と confirm は rigid transform・floor・plan が一致し、committed life の actor、位置、guard と pointer 支持床を保つ。

追加検査で P2 を再現した。最初から消失 preview がある layer を構築すると committed 殻が非表示になり、その後の `life.sync` が **0 triangles** を記録していた。root の修正は一時非表示の committed 殻だけを `authoredPreviewHidden` で識別し、その殻を物理検査に残す。元から非表示の source 子要素には例外を広げない。cancel 後も 79,384 triangles と安全な drop を保持する。[修正前 raw](preview-regression.log.txt)、[修正後 targeted raw](preview-regression-fixed.log.txt)。

初回は harness が有効経路を `x < 8` の片側迂回に限定し、居住中の p6 を store しようとしたため失敗した。二回目は seat 中の `walker.at`（最後の approach）を実表示位置と取り違えた。最終版は actual neighbors、guard clear、新 apron の通過、実 actor の p9 位置、receipt と退場を検査する。

| 記録 | 性質・結果 |
| --- | --- |
| [初回失敗](first-run-failures.txt) | **tool 出力の転記**。未加工 stdout 全量ではない。3 FAIL / 9 PASS。 |
| [初回 life test](first-authoredCoveLife.test.ts.txt)・[初回 integration test](first-authoredCoveIntegration.test.ts.txt) | 初回 test 内容の保存。test discovery を避ける `.txt` 拡張子。 |
| [二回目](second-run.log.txt) | stdout/stderr を直接保存。harness の観測座標 2 FAIL / 10 PASS。 |
| [三回目](third-run.log.txt) | stdout/stderr を直接保存。追加 P2 回帰前の 12 PASS。 |
| [最終](final-run.log.txt) | stdout/stderr を直接保存。修正済み P2 回帰を含む 13 PASS。 |

最終 2 test の相対 static import/export graph、明示されたファイル入力、source GLB、package/build 設定の **279 ファイル**について、現在内容・c1 snapshot manifest・candidate コピーの SHA-256 が一致した。snapshot は 2026-10-11T22:16:52.108Z、全 19,788 ファイルのコピー中差分 0。root は最終実行中の編集重複がないことを確認した。279 ファイルの各 SHA は [report.json](report.json) に収録する。この照合は focused source identity であり、full core/build closure の代替ではない。

最終 test SHA-256:

- `authoredCoveIntegration.test.ts`: `e61c08505af726f46ae42bebbf94e80c5eb4c55dd009086b33d19eb9cbf44f3e`
- `authoredCoveLife.test.ts`: `1045c73742f03487cd7aa0fe437eb2eb135611928c584dea52647a41ba05875f`

指定 2 test の eslint は PASS。shared typecheck は root から PASS 報告あり。本 worker は full core/typecheck/browser を重複実行していない。`THREE.Material: parameter 'map' has value of undefined` は既存 material 構築の警告として raw log に残す。
