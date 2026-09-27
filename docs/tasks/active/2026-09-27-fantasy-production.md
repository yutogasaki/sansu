# 幻想の庭と自然の暮らしを本番へ統合する

2026-09-27、ユーザーの「本番と統合しないの？」を受けて公開まで進める。対象は `https://sansu-seven.vercel.app`、開始時revisionは `67406a186e227ef3d66983d2b5dea72739c5d1db`。専用worktreeで対象差分を固定する。

## 範囲と完了条件

- 元のぽこもこを使う幻想の庭・昼夕夜・水の反応/思い出。
- 同じLifeで育つ・運ぶ・食べる、水路と木陰、土の水分。既存の経済・学習・所有は継続。
- 食料切替と保存版20をatomicに保存。水路購入前から旧writerを拒否。
- 実際の旧build→新buildのSW更新、途中学習・所有・offline保持。新保存を読むFantasy OFFの復旧buildを用意する。
- 基礎検証、対象E2E、公開後のversion/candidate/保存を確認し、commitと実公開結果を記録。

別作業の学習feedback・旧メニュー/試作の整理はこの変更に含めない。旧Nature Town DBを移行・削除しない。来訪・招待・供給による土地拡張、一通貨化、共有は後続。

## 受入の扱い

今回はユーザーが明示した家庭内本番統合。美術の最終承認、子どもの独立観察、実機FPSは未確認として残す。自動検査で補ったと記載しない。ぽこもこの見た目変更の許可にはしない。

## 実装順序

1. 本番版を固定し、今回のコードと仕様だけを分離。
2. 保存版20への切替を食料/土と一体化し、過去の履歴・経済を保持。
3. 公開設定とversion.jsonへ実際のLife/幻想candidate/flagを記録。
4. 基礎検査、旧→新/中断/復旧、通常学習と購入/offline、30品負荷を検証。
5. 対象commitをmainへ統合し、実公開URLで確認。

## Docs To Touch

- `docs/product/01_app_spec.md` / `48_island_life_spec.md`: 公開範囲と版20の保存境界。
- `docs/runbooks/pwa-release.md`: 互換版による復旧。
- `docs/design/2026-09-27-fantasy-production/`: 実公開版の検証結果。

## Verification

実行結果は公開証拠へ記録する。未実施をPASSにしない。

- Review By: 2026-10-04
