# 法線保持と全樹木guardの分離草稿検査

2026-10-12。固定c4から作った `/private/tmp/sansu-next-m1-code` で10 files／94 testsがPASS（116.97秒、worker上限2）。[生log](focused-first.log.txt)と[検査情報・17変更ファイルのSHA](report.json)を保持する。対象eslintはerror 0、既存QA入口のFast Refresh warning 1。

原法線の地区回転、水切削時の補間、描画buffer／材質／pointer支持、殻の物理条件を確認した。同じ草稿に全native樹木guardと共有入口探索を含め、l14への通常life tickでの訪問・退出、実ベンチ利用とreceipt、移動・収納・復元、利用可能入口のない場合の拒否も確認した。`THREE.Material` の既存 `map: undefined` warningは生logに残す。

原法線10変更ファイルは検査前の草稿manifestと現在byteを照合した。ここに保存したsourceは検査した草稿の変更部分であり、全依存入力の開始終了を照合したcore snapshotではない。元の変更前sourceはc4の復元archiveから回復できる。実アプリへの接続、同cameraのA/B、global typecheck／core／build、美術判定は未実施。中央肩の別実装もこの94 testsの対象ではない。

保存した17 sourceは、履歴のテストを現行suiteとして二重実行しないため拡張子へ `.txt` を加えた。[元pathとの対応と同byteの証拠](source-paths.json)を保持し、検査時のreport・log・source内容は変えていない。
