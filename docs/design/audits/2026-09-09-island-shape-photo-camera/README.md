# 島の中央・写真保存・共同作業の画角

2026-09-09。ユーザーの「ゴールやめて実装して」に従い、進行中の3点を実装した。全体のベンチマーク監査は停止し、過去の未検証項目を完了へ変更しない。

[変更前後と実操作の原画面](contact-sheet.html) / [固定版と検証結果](verification.json)

- 東西が開いた島の中央にも奥行きのある床を追加した。初期/東のみの床と日常の庭の倍率、家・橋・保存位置を保持し、全景・比較・拡大後の平面移動と実配置を新床へ揃えた。新床と重なった自動生成の結晶飾りは岸外へ移した。[仕様28](../../../product/28_mystic_island_spec.md)
- 模様の多い景色で写真のthumbnailが128KiBを超えた場合、320→256→192→160pxの有限候補から収まるものを使う。写真本体、保存容量上限、取消とprofile/viewの所有判定を保つ。[仕様38](../../../product/38_island_shared_memories_spec.md)
- 共同作業は実際の住民・手・対象と周囲の遮蔽物から画角を選ぶ。同じphase内の角度を保ち、手や物の位置、保存条件を変えない。背後から隠れていた運搬の手元を側面から見やすくした。照射の無文字理解や全ての手先の95%可視を達成したという判定ではない。

## 固定したアプリ

production preview `http://127.0.0.1:5436`、revision `final-island-20260909-001e95ed1175`、source `001e95ed1175c9d941e392e4bf3d49aaca737ed46442518ccbc18b546874b272`。1092入力を実Git indexと照合した。Island/BuildPlay有効・Park legacy、delivery `mystic-island-v1`、visual candidate `mystic-island-shore-garden-v18`、job camera `island-shared-job-camera-v2`。別担当のhome-space変更は含めない。配信buildの正確なversionは検証JSONに収録する。

## 今回の確認

- lint・typecheck・production build・asset budget・全304 files / 3355 testsがPASS。元41の3353 PASS/2 FAILを残し、新床への探索先期待と実結晶衝突を修正後に42で全検査を通した。
- 同じ42のソースと固定QAによる標準smokeがPASS。commit対象のdocs:checkもPASS（既存のreview日付警告7件）。同時進行の別変更を含む作業ツリーのdocs結果とは区別した。
- phone/tabletの初期→東→東西、日常/全景の8比較と、旧版拒否・新版の実配置/取消/保存/reload/同予約復帰の4経路がPASS。成熟は明示fixtureで実取得ではなく、追加回答0。旧座標と全storeを保持した。
- 両幅で同じ所持済みハンモックの利用から実撮影→一覧/一枚表示→PNG→同写真へのreloadがPASS。phoneでは実256×242px/91,069bytesへfallbackし、tabletは通常320×179px/84,701bytesを維持した。写真本体とPNGは同SHA、写真追加以外の17storeと予約を保持。既存の取得済みcheckpointを各幅へ明示復元した検査である。
- 両幅それぞれ運搬・花集め・照射の3仕事と運搬記憶1件の再訪を確認。計6仕事・22回の全17store比較がPASS。旧63回答checkpointの明示復元で、追加取得・棚上限・中断・実回答の検査ではない。各専用browser/contextとsource/QA/buildの前後一致を確認した。

元の写真容量エラー、QAの写真ID escape不足、reload後を一覧と誤認したQA失敗は保存し、同じ42の修正QAで実保存と実画像を確認した。原経路とhashは検証JSONに残す。

## 判定の範囲

視覚は中央のまとまり・運搬時の手元の局所改善を作者が実画面で確認した。[Source A](../../2026-09-09-island-renewal/shore-garden-a.png)全体との品質一致は未達のまま、独立した無文字理解・意欲・自発的再遊びはHuman N=0。今回の変更の実装・保存・描画の確認と区別する。

全Goalの受入、4地区を新規に育て直す経路、正式80run、profile/CASの全故障行列は今回再実行しない。通常の学習入力・成長判定・schema・PWA処理は変更しておらず、以前の版別証拠は元の版に帰属させる。Goal全体の完了・配布先での更新完了を示す記録ではない。
