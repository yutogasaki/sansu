# P02 v5 3/4近景・追加生記録

同じ粗形sceneのcameraだけを変更した1枚を実行済み。**source visual HOLD / runtime HOLD**。旧whole/entry/生記録/親README/root reviewは変更していません。

[3/4実画像](runs/01-three-quarter/coarse-real-stair-HOLD-three-quarter.png)・[実行結果](completion-summary.json)・[byte保存証拠](archive-proof.json)。CPU2/60秒/2560MiB枠で20.682秒、exit0、入力・geometry・material不変、owned PID/group終了。pathshadowfalseはv5の他2画像と同一です。

実GLBの全階層行列とaccessor boundsから、cameraとnear面が全mesh boundsの手前になる位置を設定。全scene最前深さ.5/near.1、原点内包0・near交差0。これは遮蔽を解決する証明ではありません。黒いoval/切れた前景葉は解消しましたが、実foreground crownが階段下部を、元大樹の冠葉が上回廊の一部を隠します。形は補修せず、見えない物を非表示にしていません。このviewだけで全対象が同時に読めるとの合格は付けません。

最初のカメラ案の静的near交差結果もhistoryへ保持。prepared READMEはREADME.md.txtとして当時のbytesを保存し、実行後の状態はこの文書です。大きいbounds JSONはgzipで元byte復元SHAを照合。既存v5 archive-proofはそのまま、今回分だけ別proofです。
