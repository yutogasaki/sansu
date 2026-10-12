# v5 保存値の限定解析

保存済み Float32 geometry と guard 記録の分類です。**source visual / runtime HOLD**。実 9 rig の踏段 pose、両足別高さ、蹴上げ越え、脚と胴体の連続性は未実装・未検証です。geometry / epsilon / 接触相手 / route を変更していません。追加 Blender・camera・app 検証は行っていません。

- [限定結論の原文](README.md.txt)
- [端線・実 GLB 三角形の照合](boundary-report.json)
- [全接触分類の生記録 gzip](contact-report.json.gz)
- [支持の局所内包](support-local-volume.json)
- [double / Float32 外周の差分](source-boundary-loss.json)
- [実行環境](analysis-runtime.json)
- [入力の現存 SHA と既存 durable 原記録の対応](input-identity.json)
- [14 原ファイルの保存証拠](archive-proof.json)

端線に沿う cm 単位の未被覆長と、境界からの距離を分けています。threshold の照会差と、可視 skin の39片/約5.94e−8m²の実微小欠けも別に保全しました。motion305件は riser167 / end-cap13 / 支持4 / 終端 guard121。支持4の当たる局所部は隣段の閉体内、終端134件は宣言利用点95°より先にあります。これらを除外せず、riser167を実踏段動作の主要未解決項目として残します。

コード・原 README は `.txt` の byte 同一 snapshot。1MiB超の JSON は lossless gzip で保存し、展開 SHA を照合しました。復元・再実行時は原絶対入力パスと `input-identity.json` の durable 対応を使います。封印入力を変更して再実行する許可ではありません。
