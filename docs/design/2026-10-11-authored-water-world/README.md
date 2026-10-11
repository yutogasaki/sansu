# 所有物から実際の水底と岸を組み立てる

[全島を完成させる方針](../../product/island-construction-strategy.md)の M1 制作。採用地形と同じ27所有物・73取得地点を使う新しい明示診断で、丘の水庭を原本の床から構成した。本人の保存、土地取得、学習と時計を切り替える変更ではない。[原本・前回・今回の全島と編集経路](contact-sheet.html)を並べて確認できる。

**美術は HOLD、独立理解・安全は未評価 N=0、runtime は PARTIAL。** 実水底・岸・編集の技術基盤ができても、全島一例と水庭の美術を完成扱いにしない。

## 実際の水と支持

水ばちの anchor を保持して原本の ground 三角形を切り、水面・0.18下の実水底・岸を作る。三つの水面と四本の流れは同じ世界の実三角形。異なる高さの流れには垂直面があり、合流では既に作った水面と水底を共有する。床の表示・配置・歩行が別の地形を読まない。

取得権を証明する原本 anchor と、現在足を置ける乾いた支持を分けた。水へなった取得地点を消さず、そこへの新配置・歩行は拒否する。中心と8点の検査だけで見逃す内部の水も、占有面積で検査する。同じ論理位置でも、遠方や高すぎる deck は支持と認めない。現在の診断には deck はまだない。

所有物を収納・分離すると、毎回原本から組み直し乾いた床へ戻す。予告用の地形を確定した世界と分け、hit は確定床のまま扱う。取消で予告の地形を解放し、住人を戻す。水の地形が変わる予告中は住人を非表示・停止し、提示/利用 receipt を進めない。既存の道と所有物の表示は確定側を保つため、未来の全シーンを再現した証拠にはしない。確定後は現在の世界で描画・足元・場所・経路を作り直す。

旧い単体の水模型は表示と raycast を止め、実水面へ同じ所有 ID を対応させる。[Node の選択と岸の支持](review/runtime-review.json)では5所有物すべてが実 `authored-water-floor` から選ばれ、旧模型への hit は0。岸の足支持は明示した shore pose の幾何診断であり、自然な住人の利用や子どもの操作の証拠ではない。

## 同じ所有物で作る明示診断

候補は `native05-authored-water-m1-v1`、原本は native05、世界は `native05-authored-world-m0-v2`。水の revision は `authored-water-v1:c8e6505d85a8c885`。DEV の `/prototypes/place-qa/authored.html?water=wide` で明示する。元の全島診断と通常本体の入口は保持する。

新しい synthetic fixture では8所有物のセルだけを正式な move command で変え、27 ID・成熟・家の屋根/装い・住人・所有 record の他の値を保つ。73取得地点と原本 anchor、join/water の権利も維持する。[取得と接近の診断](review/review-native-final.json)は全27所有物へ乾いた岸から接近でき、到達歩行点1554を記録した。配置変更により元の花/入り江の目標は seeded となる場合があり、全五系統の完成とは扱わない。

`tools/growing-authored-water-fixture.mjs --output NEW_FILE` は同じ入力を正式な command から再生成し、各流れの41点で実水面の連続を確認する。既存出力を上書きしない。新しい `prototypes/place-qa/authored-water-fixture.json` は DEV の診断入力で、本人保存には書かない。

## 実画面と固定入力の検証

[水庭の編集 report](runtime/report.json)は desktop マウスの5確認・10画面が PASS。実水面の選択、収納による乾いた原本の復帰、再配置予告と確定の revision 一致、移動予告の取消、分離と再接続で27 ID保持を確認した。390幅と768幅/reduced motionは表示確認で、実機 touch の証拠ではない。source の開始/終了 SHA は一致し、例外は0。build revision は `authored-water-m1-a3`、native art は明示 true。

`VITE_NATIVE_GROWING_ART=false npm run verify:core` は588 files / 5,128 tests、型、lint（既存3 WARN）、通常 build が PASS。[原 log](core/execution.log.txt)、[前後1842入力](core/report.json)、[通常 false build の配布境界](core/build-boundary.json)を保存した。通常 precache は8.25 MiB / 12 MiB、原本全島・共通世界・native kit は通常配布へ追加していない。

[元の全島編集](baseline-regression/report.json)は6操作/7画面、[classic smoke](classic-smoke/report.json)は32/32、[既存本体の回帰](legacy-regression/report.json)は8旅程/22画面・40通常回答が PASS。全て開始/終了のsourceが一致し、今回のcore・水庭と共通の入力を照合した。classicと既存本体は authored 世界の取得/学習の証明ではない。元の編集はcore/classicと一部並行した機能回帰で、時間を性能比較へ使わない。[検証identity](verification.json)を参照。本人の次期保存・SW更新・公開の検査へ今回の DEV 結果を流用しない。実機性能は未評価で、前回の software preview 約8.6秒の未解決を合格へ変更しない。

## 修正と検査の限界

[レビュー記録](review.md)と生の診断を残した。池と流れの接続端が半径だけで決まり、実輪郭との間に乾いた隙間があったため実輪郭の内側へ接続した。途中の原本床が欠ける group は一部だけ掘らず全体を個別形へ戻す。遠距離の論理 water edge から水路を作らない。

合流部分の最初の41点検査は、別の流れが既に作った共有水面を参照しておらず FAIL した。実際の水面の穴とは区別し、同じ group の実交差する水面・水底だけを参照するよう直した。水域や権利を追加していない。高さ欠落の原本、内部の高い/遠い deck、keepsake による形の変化の cache も検査した。試験数と権利保持だけを美術の到達に置き換えない。

## 次に作るもの

全景ではまだ水庭が小さく直線的で、森の厚み・庭と集落のつながりが弱い。現輪郭は16頂点の診断形で、原本の三段泉の輪郭・鉱石/岩組・広さを移植したものではない。下段の原位置は現行の通水辺がなく、所有物をそこへ無条件で移す方式も採らない。

次は水庭の大きさ・輪郭・岩組と段差を、所有 anchor と玄関・乾いた道を守った全島3Dで作る。そのうえで大樹の実共有 deck・入口、森林の面を同じ世界へ構成する。原本の静的な回廊を重ねるだけでは歩行支持にならない。水庭と回廊と森を含む全島一例の美術を確認してから、同じ材料の三配置、成長/利用/分離/再接続、既存地区を守る16/32軒とその先の拡張、本人保存と配布へ進む。
