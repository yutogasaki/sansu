# 採用地形で編集する全島 — M1制作中

本体の `GrowingWorld`、配置command、場所の計算、住人の経路へ、採用native05の共通地形を接続した。入り江と丘の実床上で27所有物・8軒を選び、移動・収納・復元できる。**M1は未完、美術HOLD。包括ゴールは継続する。**

[原本と実画面の比較](contact-sheet.html)を判断の入口にする。[完成方針](../../product/island-construction-strategy.md#12-作る順序を変える)、[世界契約](../../product/island-world-contract.md)、[版・検証](verification.json)、[診断入力](fixture.json)が対象と境界を記す。

## 今回成立したもの

- 原本の入り江・丘・段丘の89,488三角形を配置hit・足元・地形描画で共有し、[元の海岸側面](../2026-10-11-authored-coast-skin/README.md)も同じ変換で描く。海を矩形床で埋めない。
- 73取得地点と細かな歩行グラフをdomainへ明示して渡す。家・家具・木の支持部分と住人の足幅を避け、整数地点だけを結合と通水に使う。接続距離は辺の本数に置き換えない。
- 成熟した2×2の4所有木は、原本の幹一本と扇冠一本を同じ`.45`尺度で構成する。4所有IDを選べ、分離すると元の個体形へ戻る。
- 同じ27個の泉・水路・ベンチ4件を通常の移動commandで置き直し、主景のP01、P02、P03、P04、P05の条件と全27所有物への実経路を成立させた。元の4花を維持した。小さい左のP01はベンチ不足でseededのまま。
- 実UIで海の拒否、歩行専用地点の拒否、移動取消、木の分離、収納、元位置への復元を確認。所有ID・成熟・装い・住人・土地・残高・時計を保持した。

これは明示した所有・成熟・土地・住人のDEV診断である。本人の取得・自然成長・学習成果を示さず、IndexedDBへ保存しない。再読込は入力へ戻る。世界を省略する既存呼出側は旧土地の規則を使い、保存4/schema5、既得の位置、価格と学習を切り替えない。

## 原本との不足と次の順序

1. **編集の待ち時間を減らす。** 実地形のobject layer再構築はNode診断で約9秒。道の頂点と面、泉が同じ床を何度も照会している。床支持と入り江の欠けを保って再利用し、変更した場所だけを更新する。計測値は実機FPSではない。
2. **水庭の実床を作る。** 現在は所有した鉢と通行可能な水路部品だけ。広い水面を乾いた道へ重ねる代替表示は停止した。所有・成熟から導く水底、岸、渡れる床を共通世界へ組み立てる。
3. **大樹の入口と上の床を接続する。** source worldはgroundのみ。無関係なdeckを理由に仮想回廊を作らず、authoredの回廊利用は停止している。支持・入口・経路を同じ定義へ出力する。
4. **森の面と地区ごとの密度を仕上げる。** 大樹だけは主景になったが、中ほどは裸地が広く、森・水庭・花庭の対比と暮らす場の連なりが原本に届いていない。白い家、戸数、小物や発光の追加で代用しない。

この全島一例を仕上げてからM2の三配置、M3の成長/利用/分離、M4の16/32軒と既存中心を守る拡張、M5の本人保存・更新・offline・学習へ進む。

## 検証の読み方

| ゲート | 現在 |
| --- | --- |
| 美術 | **HOLD**。全景と近景を原本 beside runtime で確認。水庭・回廊・森の面と配置差が不足 |
| 独立理解・安全 | **未評価・N=0**。操作テストや作者評価を子どもの無説明理解へ置き換えない |
| runtime | **PARTIAL**。編集6項目・7画面、既存本体8旅程・22画面、core579 files/5,044 tests、classic smoke32はPASS。重い再構築と新世界の保存/配布/実機は未達 |

[実編集report](runtime/report.json)と[既存本体のreport](legacy-regression/report.json)は全入力の開始/終了SHAが一致した。後者は390/768幅の実タッチで各20回答、購入・配置・再読込・同予約復帰、明示した旧保存/土地/人口の互換を検査する。前者はdesktopのpointer操作とphone/tablet幅の表示確認で、実機touchの証拠ではない。両方の世界IDとcandidateは異なり、旧島のPASSをauthoredの保存や美術の合格へ読み替えない。

初回の型エラー、編集中のcore結果、sandboxによるsmoke起動拒否、CLI形式/動的importの制約、headless初回の中断は[検証履歴](review.md)に区別して残した。通常productionのnative美術既定falseを保持し、公開しない。

## 開く・再現する

```bash
VITE_ISLAND_ENABLED=true VITE_NATIVE_GROWING_ART=true SANSU_BUILD_REVISION=authored-editable-m1-a1 npm exec vite -- --host 127.0.0.1 --port 5340 --strictPort
```

`http://127.0.0.1:5340/prototypes/place-qa/authored.html` を開く。診断入力の再生成は `node tools/growing-authored-fixture.mjs --output NEW_FILE`。既存の出力を上書きせず、prototypeへコピーして使う。実編集の検査は `SANSU_AUTHORED_EDIT_URL=... SANSU_AUTHORED_EDIT_OUTPUT=NEW_DIR SANSU_AUTHORED_EDIT_HEADED=1 node tools/e2e-authored-island-editing.mjs`。検査用の新しいブラウザだけを閉じる。
