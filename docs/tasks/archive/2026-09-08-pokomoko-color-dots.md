# ぽこもこ — 水玉の配色

- Review By: 2026-09-15

## Goal / Scope

水玉だけで、動きに頼らず、色使いでファンタジーを感じる画面へ修正する。背景SVGと候補識別が担当範囲。深い青緑/青紫/少量の琥珀を基準に3配色を実画面比較する。

## Docs To Touch

親01、UI07、MASTER、監査記録、月次done。

## Verification

固定コピーでbuild/lint/typecheck/testsとphone/tabletの往復・保存確認。共有workspaceの他作業を上書きせず、担当ファイルだけhash照合して統合する。公開なし。

## Progress

- シンプルな静止水玉と配色だけに限定し、A青緑/青紫/琥珀をローカル試作へ反映。B生成り/葡萄、C葡萄/珊瑚も同じ実設定画面で比較。
- 固定productionで26画面と保存を保った往復PASS。lint/build内typecheck、194ファイル/2,232 tests、build/assets PASS。入力810ファイルの変更0、担当3ファイルの統合hash一致。
- 共有docs:checkは別作業のwritten-input-flow taskの必須節不足でFAIL。前回の別作業の型エラーと速度未達も、この配色変更で解消したとはしない。
- [3配色](../../design/audits/2026-09-08-pokomoko-color-dots/review.html)と[確認範囲](../../design/audits/2026-09-08-pokomoko-color-dots/verification.md)。背景画・新しい動き・学習変更なし。ローカル試作として完了し、commit/push/deployなし。
