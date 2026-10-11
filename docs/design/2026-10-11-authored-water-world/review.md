# M1 水底・岸のレビュー

美術 HOLD／独立理解・安全 N=0／runtime PARTIAL。レビューは機能と保存境界の検査であり、採用原本への美術到達を認定しない。

## 修正した実不具合

- 原本の権利と current dry support が混在していたため、固定 anchor と現在の支持を分離。原本で y が欠落しても NaN を0へ丸めて証明できる入力は、読込時に拒否する。
- 内部の薄い水域は9 probe の間に入り得る。水×占有面を実三角形で検査し、上空や実座標が遠方の deck を支持に数えない。同位置の到達可能な deck は許可する。
- mixed district の原本床を全域へ適用せず、該当地区の原本と active 床を選ぶ。
- 論理距離だけが近い遠方の shore を入口にせず、実位置・高さと乾いた足幅を確認する。
- keepsakes を形の memo key へ含める。receipt metadata だけでは形を作り直さない。
- required stream の一つが作れない group は、pool の描画抑止だけ残さず全体を fallback する。整数の直交隣接以外から trench を生成しない。
- radius trim と実輪郭の間の乾いた隙間を修正。四つの pool 接続口は実交差面積が正。生の[実島結果](review/review-native-final.json)を保持する。
- Three の raycast は非表示の子も拾う。初回 Node review の owner ID一致だけでは実水面選択の証明に不足した。旧水模型の raycast を明示停止し、[診断 source](review/runtime-review.mjs.txt)と[最終結果](review/runtime-review.json)で全5 IDを actual water floorから選択、旧模型 hit 0を確認した。

## 初回 FAIL の分類

- [数値比較の最初の失敗](review/numeric-tolerance-first-check.failure.log.txt)：rounding の1e-9条件を compiler EPS より厳しい1e-8へそろえた。固定 anchor の一致は緩めない。
- [欠けた床 fixture の最初の失敗](review/missing-ground-fixture-first-check.failure.log.txt)：fixture 自身が欠けた床を跨ぐ walk grant を持ち compiler が拒否。[分類](review/missing-ground-fixture.classification.txt)。fixture の不正辺だけ除き、支持規則は緩めない。
- [実合流の最初の連続検査](review/shared-junction-first-check.failure.log.txt)：当該 stream 独自の floor IDだけを参照し、既存の共有面を見落としていた。同 group の実交差する water/bed floorへ参照を解決。[修正後13 tests](review/shared-junction-fixed.log.txt)と[実島4×41点](review/shared-junction-fixture-fixed.log.txt)を確認。地面や水の面を増やす修正ではない。

[最終の統合 focused 5 files / 40 tests](review/integrated-focused-final.log.txt)と全 coreを別々に保持する。Node の明示 shore pose は左右の足の dry support 検査で、自然利用の証拠ではない。予告は静的な未来地形に限定し、既存の道・所有物は確定側を保つ。原本・全島・近景の美術、自然取得、保存/PWA、実機、無説明理解は今回の検査で合格にしない。`.mjs.txt` は当時の絶対pathを含む診断 source の保存で、汎用 CLIではない。
