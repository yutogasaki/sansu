# 初回の失敗を保持する

- [最初のfocused検査](focused-first.log.txt)：株の占有へ住人の全高の最大幅を一律に適用した候補は、元の通行を切断した。現在は元のindexed rigを部位別の高さで検査し、実際の歩行角度・接地補正・bobを含める。現在のfocused49件と型検査は別の出力へ保存した。
- [c3 report](camera-c3/report.json)：取消/分離/収納/再接続と4画面まで実行後、『海のタップで選択が解除される』というharness仮定で停止。現在rendererは海で選択を維持する。この4画面は暫定美術評価で、固定入力の全旅程PASSではない。
- [c4 report](camera-c4/report.json)：全景への切替途中で旧focusのcameraを読む可能性がある待機条件。失敗画面で別の家が選択され、tapのcamera/pointを記録していなかったため、exact inputの断定はしない。旧host切断→新host readyの待機へ修正した。
- [c6 report](camera-c6/report.json)：新しい全景cameraと投影点を記録。白花l31の低い中心は手前の貝屋根に隠れている。遮っている実物が選択されるため、株の見える側面をtapする。屋根の遮蔽は美術の構図課題として残す。
- [c5環境log](chromium-environment-c5.log.txt)：sandbox下でChromiumのMachPort起動が拒否された。アプリは起動していない。許可したローカルChromiumで再実行した。
- [c7中断log](interrupted-c7.log.txt)：選択なしの初期画面へ待機型locatorを使うharnessに気づき、exit130で中断。同期DOMで現在選択の有無を読み直した。完了reportやsource closureはなく、合格の証拠に使わない。

- [c9中断記録](interrupted-c9.json)：全coreと3D撮影を同時に開始し、最初の描画が待機したまま中断。完成report/画面はなく、経過時間を性能や美術の証拠にしない。sourceを変えず、core終了後に単独browserで全旅程を再実行する。

[c8の限定ray検査](../focused-ray/report.json)は修正後の実canvas4株選択とsource開始/終了一致を確認した。限定検査を全景/成長/編集/小画面・本人保存・独立観察へ流用しない。元の生JSONとPNGは書き換えない。

- [回帰c10の初回環境FAIL](regression-environment-c10/report.json)：sandbox ChromiumのMachPort起動拒否。アプリ画面には到達していない。全core入力は一致したまま、許可したlocal Chromiumで新出力へ再実行した。
- [回帰c11の中断](regression-interrupted-c11/report.json)：source reviewの解放処理指摘を修正するため、desktopの6確認／5画面後、phone全景待機中に専用process groupだけを停止した。開始／終了の1,895入力は一致。water／通常Growing／classicは未開始。成功した一部操作を全回帰のPASSに数えず、修正後sourceで新出力へ再実行する。
