# 集まりのlive記録・当時と現在の再生

## 実行対象

- actual app: DEV `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true`、preview専用DB、fresh browser context、sound off。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb`＋未commit変更。Candidate `island-life-discovery-a-gatherings-v1`。
- 390×844（phone）/768×1024（tablet、reduced motion）。明示12creditと3株/6株/3台の所有fixture、成熟場面のみ明示24h経過。実学習獲得や本番配布の証拠ではない。

## 検査内容

各幅でG0/GF6/GP3を検査。全画面DOM遮蔽の1.5秒は未記録→覆いを外す→通常島のlive→思い出の実3D/replay→任意保存→1個移設→GF6はGF3、GP3はGP2のliveへ移る→当時の配置で再生→現在リンクは分かれた実配置を表示（元のルールcoreはfalse）→undo→reload。所有位置/残高/学習ログの不変、本人保存ID、最初に見えた記録の保持を実保存DBで比較する。

対象単体は、上位優先、実モデルの画角、物/土/接続面の実ray、DOM被覆、実遮蔽物、6株の成熟モデル、1秒/一度のみ/非同期準備の取消を検査する。地面のrayは中央の1点だけでなく、実際の面の幅内にある露出点を調べる。裏側・透明面やルール条件を見えたことの代わりにしない。

## 診断履歴

- `/tmp/sansu-v3-gatherings-runtime-1` phone-G0 PASS。
- `/tmp/sansu-v3-gatherings-runtime-2` phone-G0 PASS、GF6のcoreがfalseでFAIL。実モデルのray診断で、接続面の中央が花に隠れ、見えている端を調べていなかったことを確認。通常島の6株/角度を回帰テストへ追加。集まりの再生カメラも通常島の仰角に合わせた。
- `/tmp/sansu-v3-gatherings-runtime-3` phone-GF6、`-4` phone-GP3とも修正後PASS。可視1秒と実遮蔽の条件を維持。

## 非補償の判定

- 視覚: 既存の島/住人/地面の実モデルを継承。G0の低い縁、成熟花の面、遊具の床が見え、当時と現在の画面を区別できる。[最終contact sheetとbenchmark](contact-sheet.html)を比較。スマホの現在の分離、タブレットの当時の花畑を実画像でも確認。
- 無説明理解/安全: Human N=0。子どもの理解・意欲・学習効果は未評価。
- Runtime: 上記単体/DEV範囲。通常島のR1/R3のlive記録、B、成長/ひかり/土地のv3移行、production/PWA/offline/throughputを含むrelease全体は未完。

## 最終実UI

- 全6ケースPASS。[統合report](report.json)、[phone](report-phone.json)、[tablet](report-tablet.json)。
- 全実行のsource開始/終了SHA-256 `029da236e685d6664f37a92815b088a8a87a98d405fff0908cba9f78761e8c3c` 一致。

- 最終イベント境界の補強: 短いvisibility/context-lossでも次のRAFを待たず可視区間を切る。対象18テストPASS、補強後の全6ケースを再実行してPASS。補強前の通過ログは `/tmp/sansu-v3-gatherings-final-phone` / `-tablet` に保持。

- 最終 `npm run verify:core` PASS: 361 files / 3717 tests、docs/lint/typecheck/build/assets。既存Fast Refresh warning 1件、error 0。PWA precache10.79MiB/12MiB。ログ `/tmp/sansu-v3-gatherings-final2-core.log`。
