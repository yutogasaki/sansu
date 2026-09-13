# 海岸形状に沿う浅瀬のDEV試作

状態: 視覚HOLD、無文字理解/安全HOLD（Human N=0）。限定runtime検査はPASS。本番採用ではない。

前回の地面素材だけでは島が板のように浮いて見えた。浅瀬の基準が実際の海岸とは別の丸角長方形だったため、[事前の転用範囲](transfer.md)に従い、実海岸polygonから距離を作る方式へ変更した。砂のextrusionに使う輪郭と同じ形・z移動量を使う。描画地形の頂点/高さ、歩行/配置判定、キャラの顔・頭身・耳・配色・布・動作、学習/保存は変更していない。

距離は128×128のRedFormat texture（データ16 KiB、色変換なし）へ一度計算し、画素shaderは一回参照する。画素ごとの96辺総当たりは避ける。入り江の内外、角、移動した海岸、遠海の4単位clampをunitで確認。landscape破棄時にtextureも破棄する。既存の時間位相とreduced motionは維持する。

## 候補比較と選択

[C3・3候補・修正後の実画面](comparison.png)。初回3候補は同じ保存QAの3住民、同じ地形/画角、390×844と768×1024で比較。元profile/割当/論理時刻を保ち、realAtのみ開始時へ合わせる明示fixture。実取得/自然発見/利用者観察ではない。

- [lagoon v1](comparison/lagoon/report.json): 浅瀬1.4単位。3案の中では岸の見通しと明るさが両立するため、次の試作用に選択。
- [tidal v1](comparison/tidal/report.json): 浅瀬.85単位。岸の帯は狭いが、遠海が沈んで見える。
- [shelf v1](comparison/shelf/report.json): 浅瀬2.1単位。広い浅瀬が発光帯のように見えるため不採用。

初回は全案で海と下部操作面に色の段差があった。v2では実描画の深海色（ACES exposure .95）と下部背景色を合わせた。修正前のv1証拠と最終v2の候補/sourceを混同しない。この色の対応は描画exposureやpaletteを変える際に再検査が必要。新しい生成画像は作成していない。木肌と芝は前回のDEV素材をそのまま使う。

## 配信と検証

実target `http://127.0.0.1:5237`。`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true VITE_CANOPY_MATERIAL_STUDY=true VITE_CANOPY_GROUND_STUDY=turf VITE_CANOPY_SHORE_STUDY=lagoon`。shore値はlagoon/tidal/shelfのみで、DEVと木肌studyが必要。実DOM候補 `canopy-shore-lagoon-study-v2`、world `canopy-dots-c3-v1`、DEV build `development-local:bb3a3faa-60aa-45b6-b12d-3f4e11ef4de5`。元revision `3ae51d4`＋この試作差分。外側delivery `snap-root-v1`、島delivery `mystic-island-v1`。

最終app source `32e85144a88cf8f1c4fc3e78614d88810df50d35369e4c224002c99435bf884c`。core後UI開始/終了で一致。素材atlasは別途reportのSHA-256に記録。距離textureはコードから生成し、追加の画像取得はない。

- [core出力](runtime/core-output.txt): docs/lint/typecheck、408ファイル・3,948テスト、build/assets PASS。precache98ファイル・10.88 MiB。既存の期限/Browserslist/fast-refresh警告あり。
- [最終UI](runtime/report.json): phone通常motion/tablet reduced motionで旧memoryのsnapshot、actions、credits、native学習正本を保持。現在観察→reload→全体→学習入力への復帰、実候補ID、下部背景の色一致をassert。両幅PASS、console/page errorなし。QA花3個・simulated旧memoryを使う。
- [導線シート](contact-sheet.png): 現在の島→旧おもいで→現在観察→全体→学習。旧memoryの旧背景は保存契約上の意図的な差。独立した新しい物語や承認済みの統一世界を意味しない。
- coreのproduction JavaScriptで `coastField` / `coastWidth` /新候補文字列が不在。CSSには候補限定の背景selectorが残るがproductionで候補は発生せず、既定の世界は変わらない。正式な素材/描画版や過去C3 snapshotへの適用は未完契約。

## 独立した判定

- 視覚: **HOLD、34/60**。入ってみたい6、愛着7、素材6、構図/奥行き5、色7、出来事3。2026-09-14の最終両幅runtimeに対する作者評価、確信度中。海岸との接続は改善したが、立体的な岸、根奥の層、葉の光、tablet上部のcropは未解決。52/60・各8以上に届かない。
- 無文字理解/安全: **HOLD、Human N=0**。既存の顔/足場/操作は見えるが、理解・継続意欲・危険解釈の独立観察は未実施。
- Runtime: 上記の距離計算・限定導線は **PASS**。全releaseは **HOLD**。最大土地/全配置の性能、固定10問10反復、実機/PWA更新、正式C3素材の受入へは拡張しない。

次は根元と岸の立体的な前後関係を改善する。色や粒子を追加するだけでC3への未達を埋めない。元の仕様全体の残件は継続。
