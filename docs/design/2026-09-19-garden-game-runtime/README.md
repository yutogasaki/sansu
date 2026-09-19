# 花壇・街灯のLifeWorld接続

2026-09-19。生成済みの花壇と街灯を開発flag `VITE_ISLAND_RUNTIME_ASSETS=true` で接続。候補 `island-life-runtime-assets-v3`。Meshy追加処理・クレジット消費は0。raw/final/runtime GLBは変更しない。

[スマホ幅の実画面](390-garden.png)・[タブレット幅](768-garden.png)・[一連の画面](contact-sheet.jpg)・[検証report](report.json)

## 表示条件

original色の満開（growth 6以上）の花だけを生成花壇に置換し、芽とつぼみを保持する。original色の配置済みの灯りを街灯に置換する。色変更版・配置ゴースト・商品見本は従来形状。距離による近景/遠景切替と同種の資源共有は既存poolを使用する。

花壇近景1,924,852 bytes / 8,353三角形、街灯近景1,759,800 bytes / 6,099三角形。これは素材単体の値で、スマホ実機FPSの保証ではない。

灯りの地面の照明と効果範囲は既存の保存位置と機能解放条件から計算する。ランプの窓に新しいemissive材質は加えていない。購入・価格・占有・成長・保存のロジックは変更しない。読込失敗時は従来形状を保持する。

## 検証

対象は `http://127.0.0.1:5250/` のDEVアプリ。reportに候補ID・flag・対象ソースSHA・基点commitを記録する。未コミットの作業ツリーを検証したもので、本番配信の証拠ではない。

隔離ブラウザーで100件の合成creditを使い、過去時刻の購入から芽・つぼみ・満開を用意する。通常の移行を経て庭小屋を購入し、地面の照明機能が有効な島を検査する。実ユーザーの保存領域・学習実績には書き込まない。

- focused: 成長境界・色/ゴースト保持・runtime資源管理・LOD・照明範囲の4 files / 13 tests PASS。
- `npm run verify:core`: 433 files / 4,069 tests PASS。docs・lint・typecheck・build・asset budget PASS。
- `npm run e2e:smoke`: 31項目 PASS。
- 最終ブラウザー結果: PASS、page error 0（report参照）。390×844 / 768×1024 reduced motionで成長3段階、素材読込、reload、GLB本体遮断時の代替表示、actions/credits/成長/照明範囲の保持、学習入力への復帰を検査する。

先行ハーネスでは照明機能が保存recordだけから有効になると誤認した。実際はpresentation capabilityを合成し、所有物またはflagの条件を満たす必要がある。旧versionのrecordへ小屋を直接購入する試みも移行ガードで拒否されたため、通常reload移行の後に購入する形へ修正した。アプリのガードは変更していない。失敗証拠はローカル `output/playwright/garden-game-runtime/`、`garden-game-runtime-verified/`、`garden-game-runtime-v3/` に保持。

## 判定の範囲

視覚: 通常画面で芽・つぼみ・満開を区別でき、花壇と街灯の接地を確認。街灯は細部が小さく、ランプ本体の発光は今後の視覚改善候補。開発候補としての確認であり、正式な美術採用とは分ける。

無説明理解・安全: 利用者観察はN=0。成長段階の誤表示を避ける条件をテストしたが、子どもの理解や動機づけの合格を代替しない。

runtime: 主島LifeWorldで検証。独立した観察rendererへの展開、本番flag変更、実機性能、自然な獲得全行程、区画streamingはこの変更の検証範囲外。
