# 広がり方で姿が変わる島 — 本体への実装

利用者「一気に実装」により、三方向の地形・所有物・操作を本体へ接続した。[全景の比較](index.html)と、DEVの`/prototypes/place-qa/expansion.html`で8／16／32軒を往復できる。展示は本体と同じ`GrowingWorld`を使い、DBへ保存しない。

## 今回の実装

東西へ曲がる岸が湾を抱く。東へ木の列と樹冠が続く。南へうねる低い丘と庭が連なる。三つの固定島タイプを保存せず、本人の土地選択・配置・実成熟から姿を作る。家の尺度と初期の8軒を共用し、16／32軒の比較では家数・材料・成熟を揃えた明示診断保存を使う。実入居や自然成熟の実績にはしない。

全取得セルの陸を残す連続床写像に、道・分数位置の足・共有回廊・橋・配置hit／移動previewを合わせた。家・布の原本meshは歪めず、実足元を移す。保存4、ID・屋根色・支払・育成・学習・価格・時計を保つ。詳細は[実装契約](../../product/island-expanding-runtime.md)と[制作戦略](../../product/island-expansion-art-strategy.md)。

## 固定版と素材

| 項目 | 今回の識別 |
| --- | --- |
| app target | `http://127.0.0.1:5337/#/island` |
| revision | `native05-expanding-a3` |
| version | `native05-expanding-a3:514ee4e9-b099-4d77-a44b-11a6f839e44f` |
| Growing／native flag | true／trueを明示。通常productionのnative既定はfalse |
| visual candidate／床 | `native05-expanding-runtime-v2`／`curved-owned-v1` |
| build source SHA | `e2c80f19f4ea22545eef465e442de64f7ad58685c00eaf1d849a2a61e8ebcacc` |
| 原本kit SHA | `7a02fb27a0dfad8d1cb4b2700074b9de42dddb052611354176bddf4bf69f6a34` |

[NEW固定build](builds/new.json)、[OLD](builds/old.json)、[ROLLBACK](builds/rollback.json)は実sourceとdistの各SHAを含む。A1／A2を履歴として保持する。最終の画面と検査はA3に揃え、旧画像を再ラベルしない。

[編集可能なBlender](expanding-islands.blend)は七つのcollection。実床と実所有物をGLBから読み込み、確認用の海・光・cameraを加えた。[モデル一覧](models.json)の七つの`glb.gz`は8軒中心と三案の16／32軒。解凍したGLBはBlender／Three.jsで扱える。動く住人・海・UIは本体rendererの範囲で、static GLBの人工的な住人で代用しない。[素材照合](artifact-check.json)と`check-artifacts.mjs`でexporter入力・gzip／GLB／blend SHA、所有ID、収納の非描画を確認する。

## 確認と残る美術

core、実回答／取得／配置の3旅程、20件の成熟配置×2幅、三案×16／32軒×2幅、通常SWの更新／中断／rollback、破損kit／context lossを別に記録する。検査入口は[verification matrix](../../ai/verification_matrix.md)。診断fixtureは通常の学習・取得の旅程へ混ぜない。

| 最終確認 | 結果と証拠 |
| --- | --- |
| 通常core | 568 files／4,991 tests、docs／入口／lint／typecheck／build／assets PASS。[ログ](verification-logs/core.txt) |
| 固定productionの通常取得 | 390／768／320幅、各21実回答、購入・接続・分離・同所有の再接続・同予約再開 PASS。fixture／時計操作なし。[report](production/report.json) |
| 固定productionの成熟配置 | 20配置×2幅、実利用と収納／再接続を含め74画面 PASS。[同report](production/report.json) |
| 16／32軒の拡張 | 3方向×2規模×2幅、12ケース／24全画面と24canvas crop、一覧から枠外の本人の家へ寄る／reload PASS。[report](wide/report.json) |
| 破損kit／実context loss | 2ケース／8画面 PASS。[report](faults/report.json) |
| OLD→NEW／中断／rollback | 通常SW、両幅4ケース／18画面、保存4→4 PASS。[report](update/report.json) |
| 標準smoke | DEVの32経路 PASS。固定productionの美術検査とは区別。[report](classic/smoke-report.json) |
| 3D素材／配信容量 | 七つの実所有GLBとBlender照合 PASS。native precache 11,247,904／12,582,912 bytes、通常buildにkitなし。[素材](artifact-check.json)・[予算](asset-budget.json) |

[取得からの状態列](critical-path.jpg)、[三方向](three-directions.jpg)、[完成像との比較](benchmark-comparison.jpg)、[別々の判定](gate-review.json)を残す。完成像との比較は全景を保ち、sourceと本体のcameraの違いを明記する。作者の実画面採点42／60・美術HOLD、独立理解／安全はNOT_EVALUATED、runtimeは今回の範囲でPASS。

状態列の初回フレームは3D準備中のloading captureと明記し、表示完了の証拠へ読み替えない。実床を表示した後の取得状態は次のfirst-home以降で確認する。[差分レビュー](diff-review.md)。lintはerror0、既存IslandMilestoneとDEV展示entryのfast-refresh warning2件、文書の既存Review By警告12件は残る。

固定A3の2,051入力のうち2,049が現入力とbyte一致する。build後の差は、次問で入力準備を待つQA helper一行と、DEV専用比較画面の同じ選択を押した時の読込表示だけ。本体のruntime入力は一致し、これら二つを本体entryがimportしないことも照合した。[sourceの閉じ合わせ](source-closure.json)と`check-source-closure.mjs`は意図したindexのexportでも再実行する。A3のsource SHAを現在の全source一致と読み替えない。

三方向と床の接続は今回の完了単位。原本native-05の深い湾、高い段泉、密な森と庭は完全到達していない。特に32軒では余白の多い地区と家の列が残るため、品数を増やす前に密度・抜け・地区の形を詰める。美術、独立した理解／安全、runtimeは別判定。独立観察N=0、実機性能／数日かけた成熟／公開は継続する。

初回検査ではDEV読込45秒超過、数列を解けないQA helper、16軒fixtureの参照共有を診断した。fixture／helperを修正し、CSS探索を本体sourceに限定した。最初のA3 smokeでは次問のcheckpoint中に直接入力して一桁が欠けたため、既存の一回入力helperへ合わせて32経路を再確認した。元の失敗report・harness・観察を[履歴](history/)に保持する。DEV比較では選択中の16軒ボタン／8軒共通中心の方向切替で読込表示が残る問題を実操作で修正・再確認した。通常のDB削除・45秒／15秒の時間制限・学習ロジックは保持する。探索指定は[Tailwind公式](https://tailwindcss.com/docs/detecting-classes-in-source-files#setting-your-base-path)とインストール済み実装で確認した。
