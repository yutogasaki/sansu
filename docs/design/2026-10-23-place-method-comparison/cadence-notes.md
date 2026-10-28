# フレーム間隔の観測

`TrialCadence` は `trialEvidence` query があるローカル比較画面だけに表示する。明示的な開始ボタンから約10秒、連続する `requestAnimationFrame` のタイムスタンプ差を採取する。自動開始、ゲームstateの変更、保存、外部送信はない。

- React stateは開始・終了時だけ更新。各フレームの標本はclosureに保持する。
- `samples` はフレーム間隔の数。最初のcallbackまでの待ち時間は標本に含めない。`frameCallbacks` はcallback総数。
- medianは偶数標本なら中央2点の平均。p95は昇順の `ceil(n × .95)` 番目。maxと50ms超の件数も記録する。値はms単位、小数3桁へ丸める。
- elapsedは開始操作から終了処理までの単調時計。実際の最終callbackが10秒を超えることがある。終了日時はUTCのISO文字列。
- 開始時にタブが非表示なら開始しない。途中で非表示になれば中断し、部分標本とvisibility状態を残す。unmount時はrAFとlistenerを破棄し、結果更新は行わない。
- `data-trial-cadence` 内のJSONは表示した観測結果。候補IDとquery値を記録する。データを入力する権限は持たない。

これはブラウザのcallback間隔であり、GPU処理時間、画面へ提示された全フレーム数、端末全体の性能、児童の快適さではない。比較時は同じviewport・カメラ・操作・タブ可視状態・住人活動を揃え、同条件でも時間依存の挙動が残ることを明記する。パネルを閉じたこととページが非表示になったことは別で、visibilityはタブ単位である。
