# 庭の遮蔽判定を軽量化

2026-09-29。30品の庭のCPU profileから、まとめて描画した静的な形状に対するraycastを改善した。ぽこもこのモデル・庭・家具・素材・照明・解像度・アニメーション、保存21、学習v8は変更しない。

## 変更と守る契約

描画用に結合した三角形を、元の部品ごとの範囲へ分けて判定する。各範囲のbounding box/sphereで届かない部分を除外してから、描画と同じ頂点・法線・UV・三角形へrayを当てる。範囲だけで可視と判定する代理形状ではない。頂点bufferを共有し、判定用のオブジェクトを描画sceneへ追加しない。家具へのhitは元の所有物へ戻す。

結合物とその親の回転・移動・非一様scale、near/far、空間の隙間を含む1,107本のrayについて、最適化前と同じ交点・距離・face・normal・UVを確認。離れた30部品の検査では三角形との交差計算を従来の1/10未満へ削減した。

## 計測の範囲

[CPU診断](cpu-comparison.json)は同じ所有者・配置を復元したproduction Chromiumの125 rAFフレームに対するinclusive sampling。390幅はraycast全体575→92ms、768幅は846→129ms（約84〜85%減）。CPU profile自体の負荷を含むため、FPSの合格判定に使わない。`program`への時間は未分類で、GPU時間と断定しない。

30品は実UIで作った隔離プロフィールへ、明示した旧版20の3住人・200 creditを設定し、通常commandで合法購入した負荷fixture。実獲得や物理端末の検証ではない。前後で同じnative IndexedDBを復元し、Lifeの実時刻anchorだけを実行開始へ合わせる。論理時刻・所有者・履歴・配置・3住人は保持し、同じ配置と描画個数を照合する。初期の別所有者比較は配置差があったため棄却。別作業の全体テストと重なった計測も棄却した。最初の診断失敗はサーバー未起動、次は計測側がDEVへ本番DB名を使ったため。開発用DB名の明示指定を追加し、最初の失敗をローカルの `output/frame-perf-20260929/` に保持した。

[描画の前後比較](render-comparison.json)は各build・各幅1回、先頭5フレームを除く120フレームの短時間計測。390幅のrAF P95は50.2→37.8ms、768幅は66.9→55.3ms。両版とも127 calls・149,716 triangles・96 geometries・8 texturesを維持。この固定fixtureは以前の110 callsの配置とは別であり、描画回数の回帰とは扱わない。33.3ms目標は未達。reloadから描画は約1.9秒のままで、起動短縮は確認できていない。

[前](load-before/report.json) / [後](load-after/report.json) / [実画面比較](index.html)。住民の歩行位置・撮影時刻は同一ではないためpixel一致の証拠ではない。

## 対象

- 基点main: `2c6b98a3a6be8802dcfe2244af874a7cc38c8713`。
- app入力SHA-256: `7ac2759d53abc28cba3c403454a60ce3099f08dfe52a23306ac3670aa24fa43b`。
- 本番形式ローカル: `http://127.0.0.1:5440/#/island`（隔離worktree）。
- build: `development-local:a8bde163-cbb2-444f-b03c-cc0b795cb892`。
- Island/Life/Discovery/Fantasy=true、Life preview/NatureTown=false。
- 庭candidate `living-fantasy-garden-v2`、家 `garden-house-continuity-v1`、学習 `pokomoko-pop-live-v8`。
- 390×844通常motion / 768×1024 reduced motion。実機・独立利用者 N=0。

## 検証と判定

- [全coreログ](core.log): 483 files / 4,283 tests、lint/typecheck/build/assets PASS。lintは既存IslandMilestoneのwarning 1件、docsは既存の期限切れReview By 2件。167 precache files / 8.52MiB。
- [水と発見の実操作](fantasy/report.json): 実回答→購入→再読込、昼夕夜、水の反応・本人保存・再演、非表示/遮蔽/編集/context loss時の非計上を両幅で確認。通貨・時間fixtureと明示障害注入を含み、自然な長期成長や実機の証拠とは区別する。
- [本番形式の往復](runtime/report.json): fixtureなしの初回学習→購入→招待/入居→庭/家の昼夕夜→再読込→実SW offline→同じ学習を両幅で完走。page error 0。
- [全入力・distのhash](candidate-manifest.json)をcore後および隔離worktreeで照合。別作業の学習画面変更は今回のcandidateへ混入していない。

| 判定 | 結果と限界 |
|---|---|
| 外観 | 実画面を変更前と比較し、元のモデル・庭・材質・灯りを保持。新しい美術採用ではない |
| 理解・安心・魅力 | 独立した利用者N=0。無文字理解・楽しさ・実機の音は未認定 |
| runtime | 上記の範囲でPASS。30品の33.3ms目標・実iPhoneの30秒起動・GPU/電池は未確認または未達。全release matrix合格とはしない |

本番公開の確認は配信後に追記する。
