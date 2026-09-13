# 地面の素材と根元の局所陰：DEV限定の比較試作

状態: 視覚HOLD、無文字理解/安全HOLD（Human N=0）。本番採用ではない。

C3の広い草地と根元の局所陰を対象に、単色＋高さだけの地面を、素材画像＋位置に沿った青緑の陰へ変える方法を比較した。[事前の転用範囲](transfer.md)に従い、地形の頂点/高さ/歩行判定、家具配置、キャラの顔・頭身・耳・色・布・行動、学習と保存は変更していない。新しい性格や演出は追加しない。

## 比較と選択

[C3と3候補の実画面](comparison.png)。同じ保存済みQA記録の3住民・同じ地形とカメラを使う。元profile ID・割当・論理時刻を維持し、realAtだけ開始時へ合わせた明示fixture。実取得や自然な出来事の証拠ではない。

| 候補 | phone / tabletの診断 | 作者の見た目の判断 |
|---|---|---|
| moss | [report](comparison/moss/report.json) | 濃淡の粒が強く、住民の周囲を騒がしくする |
| turf | [report](comparison/turf/report.json) | 3案では見通しを保ちやすい。次の検討用に選択。ただしtabletの細かい模様は強い |
| earth | [report](comparison/earth/report.json) | 大きい色面が迷彩のように見え、静かな地面として不採用 |

3候補は実アプリ390×844/768×1024、reduced motionで撮影。比較時sourceは `f1305815ea5fc3c338aecf28f1eda9a03985ff0b32146eae510434262c827546`。その後srcに6テストを追加したため最終hashと異なるが、描画コードと画像は同じ。比較のraw reportは後から書き換えていない。

[生成元と寸法/hash](provenance.json)、[正確な生成prompt](prompt.txt)、[未加工の素材atlas](material-atlas.png)。実寸2172×724（各724角）、要求寸法3072×1024とは異なる。画像内にキャラ・建物・UIはない。UVで各パネルを参照する比較用atlasであり、配信最適化した完成素材ではない。2pxの内側参照は深いmipmapでの隣接パネル混入を完全保証しない。採用する段階では独立素材と遠景で再検査する。

## 配信と所有

`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true VITE_CANOPY_MATERIAL_STUDY=true VITE_CANOPY_GROUND_STUDY=turf`。ground値はmoss/turf/earthのみ。木肌studyもDEVも必要で、未指定またはproductionでは無効。検証targetは `http://127.0.0.1:5235`、実候補は `canopy-ground-turf-study-v1`、worldは `canopy-dots-c3-v1`。DEV実versionは `development-local:c562d558-e2e4-4b12-80f8-025d29e2b79f`、元revision `7ff0053`＋この試作差分。外側delivery `snap-root-v1` と島delivery `mystic-island-v1` は別にreportへ記録。

画像読込前は1px代替色で地面を保持し、失敗しても描画を継続。破棄後の画像到着はsceneへ反映しない。素材だけが所有するtextureを破棄し、既存bumpMapとmaterialの所有は元のlandscapeへ残す。public/precacheへ素材を追加しない。coreのproduction出力で地面atlas URL・shader識別子・候補名が不在と確認した。世界/保存版は上げず、過去C3 snapshotを含む正式な素材版は採用時の未完契約。

## 固定sourceの検証

最終app source `168dc11ce006fa001ad3f3059a9d889c84247ea73b48b1090992984c89af7d10`。core後のUIと画像失敗診断の開始終了で一致。app hashにはsrcのテストを含むがdocs素材は含まないため、最終UI reportにはatlasのSHA-256も記録した。

- [core出力](runtime/core-output.txt): docs/lint/typecheck、407ファイル・3,946テスト、build/assets PASS。PWA precache 98ファイル・10.88 MiB。既存の期限/Browserslist/fast-refresh警告あり。coreとは別に最終tools 2本のeslintもPASS。
- [対象UI旅程](runtime/report.json): phone通常motion/tablet reduced motion。旧snapshotの内容、actions、credits、学習正本を保持し、現在の観察→reload→全体→学習入力へ復帰。両幅PASS、console/page errorsなし。QA花3個とsimulated旧memoryを使う。
- [画像取得失敗診断](fallback/report.json): 同一候補のatlas取得だけを明示abort。両幅でfallback描画・候補IDを確認。意図的なネットワーク失敗でありproduction offlineの代用ではない。
- [実導線シート](contact-sheet.png): 現在の島→旧おもいで→現在の観察→島全体→学習。旧memoryの旧世界は保存契約上の意図的な違い。全体が承認済みの同一世界になったという証拠ではない。

## 独立した3判定

- 視覚: **HOLD、33/60**。入ってみたい6、愛着7、素材6、構図/奥行き4、色7、出来事3。2026-09-14の上記両幅runtimeに対する作者評価、確信度中。質感は増えたが、C3の静かな余白・根奥の層・葉の光・海との連続性には届かない。tablet上部のcropも残る。52/60・各8以上を満たさない。
- 無文字理解/安全: **HOLD、Human N=0**。作者点検でキャラ再設計や身体への新しい作用はない。独立観察の理解・継続意欲・危険解釈0件は未測定であり合格としない。
- Runtime: 上記の素材寿命・限定導線・失敗時描画は **PASS**。総合releaseは **HOLD**。通常連問の固定10問10反復、実機、全拡張土地/配置、正式素材のcold-cache/PWA更新、C3全面の受入をこの検査へ読み替えない。

次は素材の粒や演出を増やすのではなく、根元の前後関係と地面/海の接続を形・光・空間として組み直す。キャラ維持、歩行/自由配置、学習入力/保存/PWAの契約は継続する。
