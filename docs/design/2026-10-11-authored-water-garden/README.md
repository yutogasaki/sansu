# 実床と原本素材から育てる水庭

後続の[全島preflight c2](../2026-10-11-authored-whole-preflight/README.md)でactor `.45`と実高さfocusを実装し、取得から成熟の全景を確認した。以下はb6時点の制作・検証と次工程案。現在の進捗は構築方針とpreflightを参照する。

[全島の完成ゴール](../../product/island-construction-strategy.md)に向けたM1の部分実装。27所有ID・73取得権・固定anchorを保持して、非対称の池、厚みのある岸、下降する水路、鉱石洞、原本素材の木橋を同じ世界へ構成した。[原本と実画面の比較](contact-sheet.html)を先に見る。

**全島美術HOLD／独立理解・安全は未評価N=0／runtime PARTIAL。M1と全ゴールは未完。** 機能試験のPASSを完成像への到達に読み替えない。

## 何が実際にできたか

三つの池は採用native05から読み取った72点の輪郭を各所有anchorへ適応する。四つの輪郭層・三つの岸の帯を実際の流れの口で切り、鉱石洞も原本の三角形と材質から描く。水路の高さは池と合流内では同じ水面を保ち、その外側で下降する。岩や岸の側面は配置・歩行の支持に数えない。

丘の明示した造成scope内で原本groundだけを切る。配置地点の支持範囲から造成範囲を逆算しない。73取得権と固定anchor、join/water辺は変えず、乾いた支持を失った地点への新配置は拒否する。全27所有物の実接近と22個の乾いた占有面を確認した。819点の実水面高さ検査がPASS。[実島の計算記録](review/native-b4.log.txt)、[前後同一世界の比較](review/native-b3-b4-comparison.json)。

木橋はnative05の33部品を抽出し、必要な水路の幅・高さへ適応させる。同じworldの実deck・乾いた両岸・全足幅の連続・水面との離隔で通行を認める。原本の板の間には隙間があるため、実際に見える連続木床を併用する。水面下の底や不可視の支持を通路にしない。橋は材料と通水接続から派生し、新しい所有物や報酬に数えない。収納・分離で消え、元の乾いた床へ戻る。

原本GLB、原本世界、海岸線は変更していない。新しいbridge gzipはDEV診断の素材。本人save schema・取得・成熟・学習・時計を変更しない。詳細は[共通世界契約](../../product/island-world-contract.md)。

## 実画面と検証のidentity

対象はDEVの `http://127.0.0.1:5344/prototypes/place-qa/authored.html?water=wide`、build `authored-water-garden-b6`、native art明示true、candidate `native05-authored-water-garden-v2`。水庭revisionは `authored-water-v2:3f6b964a9069c5f0:eb41954202b1926a`。desktop 1280×900、phone 390×844、tablet 768×1024/reduced motionの実browser screenshot。静的未来地形の診断で、通常取得や本人保存の証拠ではない。

[水庭runtime](runtime/report.json)は6操作／14画面、例外0。実水面と原本の橋板から同じ所有IDを選択、収納の原本復帰、予告と確定revisionの一致、取消の状態保持、分離と再接続の27ID保持を確認した。Node integrationは実際の三枚の橋板でrayを検査し、旧水模型へのhitは0。phone/tabletはcrop確認で、実機touchの証拠にはしない。

[core](core/report.json)は594 files／5,164 tests、型、lint（既存3 WARN）、通常build、asset budgetがPASS。前後1860入力のSHA一致。normal false buildの[配布境界](core/build-boundary.json)では原本GLB・native kit・世界・bridge素材を通常precacheへ含めない。既存の無効化されたauthored helper JS chunkは残る。precache 8.30 MiB／12 MiB、Explore 2.97 MiB／8 MiB。

[元の全島編集](baseline-regression/report.json)6操作／7画面、[既存Growing](legacy-regression/report.json)8旅程／22画面・40通常回答、[classic](classic-smoke/report.json)32/32がPASS。全て前後source一致、coreとの共通入力も一致。[照合manifest](verification.json)。既存Growingは通常学習と本人保存の回帰であり、新authored世界の取得・保存を証明しない。

## 待ち時間と未達

同じ実島のNode composeは79秒から7.5秒へ短縮し、世界定義・所有状態・美術計画が全量一致した。岸の検索の訪問順、EPS、内部水域・高い床の拒否を保ち、独立した旧oracleとの36境界例が一致。[ソフトウェアreview](review/shore-independent-review.md)。これは子どもの独立理解評価ではない。

[実browser診断](runtime/report.json)ではpreview 12.0〜13.4秒、初回14.9秒が残る。Node時間の短縮から操作性能の合格を主張しない。water QAの時間は他のcore・回帰開始前に測定した。plain/legacy/classicの回帰は並行実行したため、そのplain操作時間は性能比較に使わない。実機の起動・FPS・電池・公開版は未評価。

全景では森林の面、集落のまとまり、住人と家の尺度が不足する。近景のfocusも高さを反映できず、上半分が海になる場合がある。大樹の実回廊と利用は未実装。P04/P05は現在の成立条件を満たさずseededで、完成した集会所や花の大屋根を背景へ注入しない。

## 次の到達点と作る順序

[全島preflight](whole-preflight.md)は次工程の草案で、実装済みの形ではない。現27ID・73権利とP02主景を保ち、地形・大樹・森・水庭・集落・住人の尺度を同じ全景で決める。actor `.45` は永続visual倍率の未実装候補で、世界位置や顔・頭身・布・服は縮尺変更のために作り替えない。入口だけで縮める方式にしない。

全景の大きな形・密度・余白を決める → 同じ世界に入口・足場・経路を通す → 素材と細部を仕上げる。単体回廊の詳細化を全景より先にしない。成立していない形を無所有の背景や条件緩和で補わない。その全島一例を確認してから、同じ材料の三配置、成長と利用、分離・再接続、既存地区を保持した16/32軒とその先の拡張、本人保存・配布へ進む。

[初回FAILと修正](review.md)を保持。実装commitは `1b64064754e547debf81661fce5cc661cf60be1c`、treeは `2efcfc49518c7ca858f05e680f71fbac31e1cc8a`。[実装indexの検証](index-verification/implementation-index.json)は1860入力がcoreと一致し、リポジトリ外で生成索引・文書を検査した。[検査log](index-verification/docs-check.log.txt)。末尾空行を含む検証済みextractorと生ログは保持し、indexの空白検査は `core.whitespace=-blank-at-eof` を明示した。commit identityの追補は文書だけのcommitで、アプリ入力を変更しない。
