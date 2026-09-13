# 浅瀬の輪郭を実際の地形回転に合わせる修正

[前回の浅瀬試作](../2026-09-14-canopy-shore/README.md)は、押し出し前のXY輪郭をそのままXZとして参照していた。実地形はExtrudeGeometryをX軸で-PI/2回転するため、正しくは `(x,y) -> (x,-y)`。非対称な海岸の浅瀬が奥行き方向に鏡像になる問題を修正した。前回のunitは対称形中心で、この差を検出できていなかった。

`coastWorldOutline` で座標変換してから既存のz移動量を適用する。非対称な3点を実際のThree.js回転と照合する回帰テストを追加。島の頂点/高さ、歩行/配置、キャラ/行動、学習/保存、時間更新は変更しない。候補を `canopy-shore-lagoon-study-v3` へ更新し、CSSと検証の同定も追随した。

同時に試した[根と岸の3造形](../2026-09-14-canopy-relief-rejected/README.md)は見た目が改善せず不採用。造形コードはアプリから除去し、再現patchと実画面だけを保存した。今回統合するアプリ変更は海岸の座標反転修正と候補同定である。

## 固定sourceの検証

target `http://127.0.0.1:5237`、DEV build `development-local:bb3a3faa-60aa-45b6-b12d-3f4e11ef4de5`、元revision `7a7a07c`＋修正。`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true VITE_CANOPY_MATERIAL_STUDY=true VITE_CANOPY_GROUND_STUDY=turf VITE_CANOPY_SHORE_STUDY=lagoon`。外側delivery `snap-root-v1`、島delivery `mystic-island-v1`、world `canopy-dots-c3-v1`、実候補 `canopy-shore-lagoon-study-v3`。

最終app source `36b47561a73b5167db0db22daea7beba999d87ecf3f439c6499bbf60aaca4d41`。core後UIの開始終了で一致。atlasは別途reportのSHA-256で同定する。

- [core](runtime/core-output.txt): docs/lint/typecheck、408ファイル・3,949テスト、build/assets PASS。precache98ファイル・10.88 MiB。既存の期限/Browserslist/fast-refresh警告あり。
- [最終UI](runtime/report.json): phone390×844通常motion、tablet768×1024 reduced motion。旧memory内容・actions・credits・native学習正本を保持し、現在観察→reload→全体→学習入力へ復帰。候補IDと下部背景色を照合。両幅PASS、console/page errorなし。QA花3個とsimulated旧memoryであり実取得や利用者観察ではない。
- [導線シート](contact-sheet.png): 現在→旧memory→現在観察→全体→学習。旧memoryの旧背景は保存契約上の差として維持する。
- production JavaScriptにcoastField/coastWidth/新候補が不在。候補限定CSSは残るがproductionで候補は発生しない。前回と同様DEV限定で、正式描画版や本番採用は未完。

## 独立した判定

視覚は **HOLD、34/60**（入ってみたい6、愛着7、素材6、構図/奥行き5、色7、出来事3）。2026-09-14の最終両幅runtimeの作者評価、確信度中。座標の整合は直ったが、大きな見た目の改善とはしない。C3との差とtablet上部のcropは残る。

無文字理解/安全は **HOLD、Human N=0**。独立した理解・継続意欲・危険解釈は未測定。

Runtimeは修正範囲のunit/core/両幅導線 **PASS**、全release **HOLD**。最大配置・固定10問10反復・実機/PWA更新・C3正式素材・自然X3・全仕様の合格へ拡張しない。
