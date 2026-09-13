# C3 world runtime candidate

2026-09-13。通常の Life 島の世界美術を C3 に沿って更新する開発候補。キャラクター・住民行動・学習入力・経済を変更しない。

| TRANSFER | DO NOT TRANSFER |
| --- | --- |
| 家を包む大きくうねる枝、広い葉 | 固定地形・カメラ・配置、参照画像の直接配信 |
| 葉の曲面に沿った大粒で間隔のある水玉 | 生成された顔・頭身・耳・配色・布の差分 |
| 黄色・桃色・青の鮮やかな瓦 | 全面の紫色化、暗い画面、細かな装飾の密集 |
| 根元と木の奥だけの青緑の陰 | 新たな住民の性格・動作・学習操作 |
| 家、住民、開いた庭の尺度差 | 既存の歩行・配置セルへの障害物追加 |

通常の島で、住民が既存の庭を歩き、家と大きな植物に包まれた暮らしを見る。新しい操作や報酬は追加しない。

候補 `canopy-dots-c3-v1`。DEV の Life preview 内で表示する。production の既定値は旧世界表現を維持。背景版は発見場面の immutable snapshot に含め、版のない旧記録は `moon-garden-v1` として再生する。保存済み hash は書き換えない。

最新の検証済み経路は末尾の「統合検証」を参照。Human N=0、視覚HOLD、release 認定なし。

## 初期の開発診断（未採用・旧候補）

[phone](diagnostic-phone.png) / [tablet](diagnostic-tablet.png) / [report](diagnostic.json)。空の新規DEV所有者、実取得fixtureなし、sound off、tablet reduced motion。main `1b7edba` 上の未commit差分、source hashはreportに記録。実画面の候補属性を確認、pageerror 0。critical path / PWA / throughput はこの診断の対象外。

[1回目](iteration-1-phone.png)は葉の切れと薄い枝が支配的。[2回目](iteration-2-phone.png)は高さと瓦の立体化で改善したが、C3の奥行き・材質には未達。細部追加を止め、主要な樹形を太い非対称の枝へ変更した。最新画面でもtabletの上部で葉が切れ、樹形の連続性と木の奥の陰が弱い。次はカメラと樹形を一体で再構成し、薄い面に見える葉の立体構造を見直す。

3つの判定を分離する。

- **視覚: HOLD**。作者による最新実画面評価（中程度の確信）: 入りたさ5、愛着7、素材4、構図/奥行き4、色6、出来事/期待3。C3を基準とする各軸8に未達。形状・画角の主要な見直しを継続する。
- **無文字理解/安全: 未評価**。Human N=0。新しい住民行動は追加していないが、実参加者の安全/理解PASSにはしない。
- **runtime: 部分検証**。typecheckと対象14テストPASS（背景版のimmutable保存/旧記録hash不変、全住民のmesh/布/transform/歩行、配置セル不変）。両幅の実描画は確認。全面のcore/release検証は候補が安定してから実施する。

productionの既定値は旧背景のまま。未採用の試作を完成扱いでpushしない。


## 統合検証

閉じた厚みのある葉へ形状を変更し、先端の裂けを修正。通常カメラの視点/中心、根の接地用の後端、葉の手前をうねる太い枝をまとめて再構成した。配置可能セルと住民は変更しない。

[比較HTML](comparison.html) / [critical-path contact sheet](contact-sheet.png) / [両幅のreport](verified-flow/report.json)。source開始/終了 `4c696b4b66a948d3096a4af3748a3b02639bfb70ef8db268450f8930b3719db7` 一致。旧世界の明示simulated記録をfixtureで作り、実UIで現在→旧い思い出→現在の観察→全景→学習を通した。見えた現在のG0は実描画からliveとして記録し、C3のworldStyleを保存。旧記録の内容/hash・購入action・credit・学習正本は不変。pageerror/console error 0。実取得や利用者の理解の証拠ではない。

`npm run verify:core` PASS: 366 files / 3753 tests、docs/lint/typecheck/build/assets。PWA precache 98 files / 10.80 MiB。実SW更新/offline、固定問題のthroughput、全smokeはこの候補では未検証。

- **視覚: HOLD**。最新実画面をC3と並べた作者評価（中程度の確信）: 入りたさ6、愛着7、素材5、構図/奥行き6、色7、出来事/期待3。枝の連続性と瓦は改善したが、木の奥の陰と素材の表情は不足。tabletで葉の上部が切れるため、全景の見通しと通常の親密さをさらに詰める。実装技術PASSで補わない。
- **無文字理解/安全: 未評価**。Human N=0。
- **runtime: 上記の統合範囲PASS、release全体は未完**。背景版の保存とDEV試作としてcheckpointを残す。完成美術やproduction反映とは扱わない。
